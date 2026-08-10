import urdhva_base
import json
import asyncio
import datetime
import pandas as pd
import argparse
import hpcl_ceg_model
import performance_score_lpg as pslpg
import performance_score_ro as psro
import performance_score_sod as pssod
import orchestrator.analytics.va_analysis as va_analysis
from orchestrator.analytics.performance_score.performance_score_insights import generate_overall_insights


def get_performance_score_instance(bu):
    if bu == 'LPG':
        return pslpg.LPGPerformanceScore()
    elif bu == 'TAS':
        return pssod.SODPerformanceScore()
    elif bu == 'RO':
        return psro.ROPerformanceScore()
    return None

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

previous_va_score = {}

async def fetch_va_score(bu):
    resp = await va_analysis.get_ro_terminal_scores({'LocationType': bu,
                                                     'StartDate': datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")})
    if resp['status']:
        va_score = {rec.get('LOCATION_ID', '').split(',')[-1].strip(): rec for rec in resp.get('data', []) if rec.get('LOCATION_ID', '')}
        return va_score
    return {}

async def validate_locations_from_history(bu, location_ids, va_data):

    if not location_ids:
        return {}

    # Faster lookup
    va_keys = set(va_data.keys())

    # Find locations missing in VA
    missing_in_va = [loc for loc in location_ids if loc not in va_keys]

    if not missing_in_va:
        return {}

    ids = ", ".join(f"'{loc}'" for loc in missing_in_va)

    query = f"""
       SELECT DISTINCT ON (sap_id) sap_id, category, created_at
        FROM performance_score_history 
        WHERE bu = '{bu}'
        AND sap_id IN ({ids})
        AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(performance_score_history.category) cat
            JOIN jsonb_array_elements(cat->'results') res ON TRUE
            WHERE cat->>'name' = 'VA'
              AND res->>'name' = 'VA Portal'
              AND (res->>'score')::numeric > 0
        )
        ORDER BY sap_id, created_at DESC

    """

    resp = await hpcl_ceg_model.PerformanceScoreHistory.get_aggr_data(query, limit=0)
    db_data = resp.get("data", [])

    fallback_scores = {}

    for row in db_data:
        sap_id = row['sap_id']
        category_data = row.get('category')
        if isinstance(category_data, str):
            category_data = json.loads(category_data)
        if not isinstance(category_data, list):
            continue
        for module in category_data:
            if module.get("name") == "VA":
                # 👇 NEW LOGIC: fetch VA Portal score
                for result in module.get("results", []):
                    if result.get("name") == "VA Portal":
                        score = float(result.get("score", 0))
                        if score > 0:
                            if score > result.get('weightage', 1):
                                score = result.get('weightage', 1)
                            score = (score * 100) / (10 * result.get('weightage', 1))
                            fallback_scores[sap_id] = score
                        break

                break  # stop after VA module
    return fallback_scores


async def generate_performance_score(bu, location_id=None):
    """Generating Performance Score per location for the given BU"""
    locations = []
    required_keys = ['sap_id', 'zone', 'region', 'name']
    # if not location_id:
    #     query = f"""SELECT {','.join(required_keys)} from location_master where bu='{bu}'"""
    # else:
    #     location_id = [location_id] if isinstance(location_id, str) else location_id
    #     location_id = ", ".join(f"'{value}'" for value in location_id)
    #     query = f"""SELECT {','.join(required_keys)} from location_master where bu='{bu}' AND 
    #     sap_id in ({location_id})"""
    if location_id:
        # Filter both LPG + TAS using the provided hardcoded list
        ids = ", ".join(f"'{v.strip()}'" for v in location_id)
        query = f"""
SELECT {','.join(required_keys)}
FROM location_master
WHERE bu = '{bu}'
  AND TRIM(sap_id) IN ({ids})
"""
    else:
        # Fallback — should never run for you
        query = f"""
SELECT {','.join(required_keys)}
FROM location_master
WHERE bu = '{bu}'
"""
    limit = 1000
    skip = 0
    # Listing all locations for the given BU
    while True:
        resp = await hpcl_ceg_model.LocationMaster.get_aggr_data(query, limit=limit, skip=skip)
        locations.extend(resp['data'])
        if len(resp['data']) < limit:
            break
        skip += 1

    # Getting PI Score class instance (implementations live under performance_score/ only)
    ins = get_performance_score_instance(bu)
    if ins is None:
        logger.warning("No performance score implementation for BU %s", bu)
        return []
    await ins.initialize()
    va_data = await fetch_va_score(bu)
    fallback_scores = await validate_locations_from_history(
        bu,
        location_id,
        va_data
    )

    # Merge fallback VA scores into va_data
    for sap_id, score in fallback_scores.items():
        va_data[sap_id] = {
            "LOCATION_ID": sap_id,
            "OVERALL_SCORE": str(score),
            "DATE": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
            "FALLBACK": True
        }

    logger.info(f"Fallback applied for locations: {list(fallback_scores.keys())}")

    # generating performance score for every plant
    performance_score = {}
    present_timestamp = datetime.datetime.now(tz=datetime.timezone.utc).strftime("%Y-%m-%d")
    present_timestamp = datetime.datetime.strptime(present_timestamp, "%Y-%m-%d")
    for location in locations:
        print("location --> ", location)
        # Generating performance score for each location
        print(f"Generating performance score for {location['sap_id']}")
        await ins.configure_va(va_data.get(location['sap_id']))
        response, _ = await ins.generate_performance_index(location['sap_id'])
        print("response --> ", response)
        score = sum([rec['score'] for rec in list(response.values())])
        final_score = round(score if score < 100 else 100, 2)
        
        performance_score[location['sap_id']] = {
            "sap_id": location['sap_id'],
            "score": final_score,
            "category": list(response.values()),
            'timestamp': present_timestamp, 
            "region": location["region"],
            'bu': bu, 
            "zone": location["zone"], 
            "name": location["name"]
        }
        
        # Generate overall insights for this location
        performance_score[location['sap_id']]["insights"] = generate_overall_insights(
            performance_score[location['sap_id']]
        )
    # Generating rank and national average
    df = pd.DataFrame(list(performance_score.values()))
    df = df[['sap_id', 'score']]
    df['rank'] = df['score'].rank(method='dense', ascending=False).astype(int)
    national_avg = round(float(df['score'].mean()), 2)
    for sap_id, rec in performance_score.items():
        performance_score[sap_id]['rank'] = int(df[df['sap_id'] == sap_id]['rank'].values[0])
        performance_score[sap_id]['national_score'] = national_avg
    performance_score = list(performance_score.values())
    print("performance_score --> ", performance_score)
    # Updating performance score to database
    await hpcl_ceg_model.PerformanceScore.bulk_update(performance_score.copy(), upsert=True)
    await hpcl_ceg_model.PerformanceScoreHistory.bulk_update(performance_score, upsert=True)
    return performance_score


def get_default_location_ids(bu):
    """Get default location IDs for a given business unit."""
    if bu == 'LPG':
        return ['2662','2693','2241','2935','2371','2121','2520','2401','2324','2811',
               '2435','2891','2663','2314','2844','2402','2455','2203','2892','2504',
               '2248','2171','2262','2655','2215','2623','2204','2472','2959','2921',
               '2330','2126','2947','2539','2777','2507','2829','2779','2373','2657',
               '2949','2173','2707','2568','2659','2792','2660','2692','2471','2731',
               '2630','2408','2316','2117','2732']
    elif bu == 'TAS':
        return ['1527', '1424', '1435', '1436', '1457', '1630', '1636', '1742', '1712',
                '1723', '1128', '1146', '1157', '1292', '1305', '1313', '1319', '1644', 
                '1650', '1656', '1677', '1164', '1180', '1183', '1187', '1254', '1256', 
                '1259', '1265', '3129', '1233', '1242', '1278', '1281', '1385', '1410', 
                '1412', '1546', '1583', '1155', '1308', '1216', '1221', '1334', '1341', 
                '1915', '1919', '1937', '1940', '1953', '1979', '1992', '3693', '3708', 
                '1775', '1777', '1797', '1800', '1895', '3833', '1845', '1892', '1856', 
                '1871', '1879', '1973', '1991', '1999', '1397', '1485', '1504', '1509', 
                '1551', '1554', '1584', '1585', '1588', '3562']
    elif bu == 'RO':
        # Supply --location-ids for RO retail outlets; no baked-in defaults here.
        # Present Performance Score was giving only for 35 COMCO sites
        return ["41050855", "41009322", "41050256", "41050290", "41004350", "41039832", "41044897",
                "41053055", "41003470", "41036056", "41050766", "41054479", "41028213", "41042622",
                "41011136", "41039837", "41047019", "41015616", "41002358", "41084274", "41035734",
                "41002360", "41055484", "41015250", "41015332", "41056842", "41044984", "41043471",
                "41043271", "41002792", "41072929", "41009289", "41055419", "41069653"]
    return []


async def main():
    parser = argparse.ArgumentParser(
        description='Generate performance scores for locations',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run for all BUs with default locations
  python performance_score_generator.py
  
  # Run for specific BU with default locations
  python performance_score_generator.py --bu LPG
  
  # Run for specific BU with custom location IDs
  python performance_score_generator.py --bu LPG --location-ids 2662,2693,2241
  
  # Run for specific BU with custom location IDs (space-separated)
  python performance_score_generator.py --bu TAS --location-ids "1216 1221 1334"
        """
    )
    
    parser.add_argument(
        '--bu',
        type=str,
        nargs='+',
        choices=['LPG', 'TAS', 'RO'],
        help='Business unit(s) to process. Can specify multiple: --bu LPG TAS RO. If not provided, processes all supported BUs.'
    )
    
    parser.add_argument(
        '--location-ids',
        type=str,
        help='Comma-separated or space-separated list of location IDs (SAP IDs). If not provided, uses default locations for each BU.'
    )
    
    args = parser.parse_args()
    
    # Determine which BUs to process
    if args.bu:
        supported_bus = args.bu
    else:
        supported_bus = ['LPG', 'TAS', 'RO']
    
    # Parse location IDs if provided
    location_ids_dict = {}
    if args.location_ids:
        # Support both comma-separated and space-separated
        if ',' in args.location_ids:
            location_ids = [lid.strip() for lid in args.location_ids.split(',') if lid.strip()]
        else:
            location_ids = [lid.strip() for lid in args.location_ids.split() if lid.strip()]
        
        # If location IDs are provided, use them for all BUs
        # (User can filter by BU in the query)
        for bu in supported_bus:
            location_ids_dict[bu] = location_ids
    else:
        # Use default location IDs for each BU
        location_ids_dict = {}
    
    # Process each BU
    for bu in supported_bus:
        # Get location IDs for this BU
        if bu in location_ids_dict:
            location_id = location_ids_dict[bu]
        else:
            # Use default locations from code
            location_id = get_default_location_ids(bu)
        
        if not location_id:
            print(f"Warning: No location IDs found for BU '{bu}'. Skipping...")
            continue
        
        print(f"Processing BU: {bu}")
        print(f"Location IDs: {location_id}")
        print(f"Total locations: {len(location_id)}")
        print("-" * 50)
        
        await generate_performance_score(bu, location_id)
    

if __name__ == "__main__":
    asyncio.run(main())
    

