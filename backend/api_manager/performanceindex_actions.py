from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import traceback
from orchestrator.dbconnector.widget_actions import widget_actions
from orchestrator.analytics.performance_index import tas_performance_index
from orchestrator.analytics.performance_index import lpg_performance_index
import pandas as pd
from datetime import datetime
router = fastapi.APIRouter(prefix='/performanceindex')


# Action get_pi_score
@router.post('/get_pi_score', tags=['PerformanceIndex'])
async def performanceindex_get_pi_score(data: Performanceindex_Get_Pi_ScoreParams):
    """
        Get the performance index score for a given location and filters.

        Args:
            data (Performanceindex_Get_Pi_ScoreParams): The input data containing the location and filters.

        Returns:
            dict: The performance index score for the given location and filters.
    """
    try:
        def safe_float(x):
            try:
                return float(x)
            except Exception:
                return 0.0

        resp = await widget_actions.WidgetActions().generate_filter_clause(data.filters) if data.filters else ""
        clause = f" and {resp}" if resp else ""
        is_plant = getattr(data, "is_plant", False)

        if data.bu in ["TAS", "LPG", "RO"]:
            location_str = f" and sap_id='{data.sap_id}'" if data.sap_id else ''
            zone_str = f" and zone = '{data.zone}'" if data.zone else ''

            # choose table based on filters
            table = "performance_score" if data.filters and any(f.value == "t" for f in data.filters) else "performance_score_history"
            query = f"select * from {table} where bu='{data.bu}' {zone_str} {location_str} {clause}"
            score_data = await (PerformanceScore if table == "performance_score" else PerformanceScoreHistory).get_aggr_data(query, limit=100000)
            print(query)

            if not score_data['data']:
                return {}

            # ----- Plant-level logic -----
            if is_plant:
                # Aggregate scores by sap_id
                sap_scores = {}
                for rec in score_data['data']:
                    sid = rec.get('sap_id')
                    if not sid:
                        continue
                    if sid not in sap_scores:
                        sap_scores[sid] = {
                            'total_scores': [],
                            'categories': {},
                            'category_details': {},
                            'name': rec.get('name') or None,
                            'region': rec.get('region') or None,
                            'zone': rec.get('zone') or None
                        }
                    else:
                        sap_scores[sid]['name'] = sap_scores[sid]['name'] or rec.get('name')
                        sap_scores[sid]['region'] = sap_scores[sid]['region'] or rec.get('region')
                        sap_scores[sid]['zone'] = sap_scores[sid]['zone'] or rec.get('zone')

                    sap_scores[sid]['total_scores'].append(safe_float(rec.get('score', 0)))

                    # Category scores
                    for category_ in rec.get('category', []):
                        cat_name = category_.get('name')
                        if not cat_name:
                            continue
                        sap_scores[sid]['categories'].setdefault(cat_name, []).append({
                            'score': safe_float(category_.get('score', 0)),
                            'weightage': safe_float(category_.get('weightage', 0))
                        })

                        # Detailed aggregation
                        cat_det = sap_scores[sid]['category_details'].setdefault(cat_name, {
                            'score_sum': 0.0, 'weight_sum': 0.0, 'count': 0, 'results': {}, 'extra': {}
                        })
                        cat_det['score_sum'] += safe_float(category_.get('score', 0))
                        cat_det['weight_sum'] += safe_float(category_.get('weightage', 0))
                        cat_det['count'] += 1
                        for k, v in category_.items():
                            if k not in ['name', 'score', 'weightage', 'results']:
                                cat_det['extra'][k] = v
                        
                        for res in category_.get('results', []):
                            res_name = res.get('name')
                            if not res_name: continue
                            res_det = cat_det['results'].setdefault(res_name, {
                                'score_sum': 0.0, 'weight_sum': 0.0, 'count': 0, 'extra': {}
                            })
                            res_det['score_sum'] += safe_float(res.get('score', 0))
                            res_det['weight_sum'] += safe_float(res.get('weightage', 0))
                            res_det['count'] += 1
                            for k, v in res.items():
                                if k not in ['name', 'score', 'weightage']:
                                    res_det['extra'][k] = v

                # Detect date range and whether to show msg
                has_date_range = False
                show_msg = True
                today = datetime.now().date()

                for f in getattr(data, 'filters', []):
                    key = getattr(f, 'key', '')
                    cond = getattr(f, 'cond', '')
                    value = getattr(f, 'value', '')

                    if cond == 'date_filter' or key in ['date_from', 'date_to', 'created_at']:
                        if value:
                            has_date_range = True
                            try:
                                parts = [v.strip() for v in value.split(',') if v.strip()]
                                if len(parts) == 2:
                                    start = datetime.strptime(parts[0], "%Y-%m-%d").date()
                                    end = datetime.strptime(parts[1], "%Y-%m-%d").date()
                                    # msg only if start == end == today
                                    # show_msg = (start == end == today)
                                    show_msg = (start == end)
                            except Exception:
                                pass

                temp_result = []
                for sid, details in sap_scores.items():
                    category_scores = {}
                    for cat, scores in details['categories'].items():
                        if scores:
                            category_scores[cat] = {
                                'oi_score': round(sum(s['score'] for s in scores) / len(scores), 2),
                                'weightage': round(sum(s['weightage'] for s in scores) / len(scores), 2)
                            }

                    total_scores = details['total_scores']
                    if total_scores:
                        overall = round(sum(total_scores) / len(total_scores), 2)

                        full_category = []
                        for cat_name, cat_det in details.get('category_details', {}).items():
                            c_count = cat_det['count']
                            c_obj = {
                                'name': cat_name,
                                'score': round(cat_det['score_sum'] / c_count, 2) if c_count else 0,
                                'weightage': round(cat_det['weight_sum'] / c_count, 2) if c_count else 0,
                                'results': []
                            }
                            c_obj.update(cat_det['extra'])
                            
                            for res_name, res_det in cat_det['results'].items():
                                r_count = res_det['count']
                                r_obj = {
                                    'name': res_name,
                                    'score': round(res_det['score_sum'] / r_count, 2) if r_count else 0,
                                    'weightage': round(res_det['weight_sum'] / r_count, 2) if r_count else 0
                                }
                                r_obj.update(res_det['extra'])
                                if has_date_range and not show_msg:
                                    r_obj.pop('msg', None)
                                c_obj['results'].append(r_obj)
                            
                            full_category.append(c_obj)

                        temp_result.append({
                            'sap_id': sid,
                            'name': details['name'],
                            'region': details['region'],
                            'zone': details['zone'],
                            'overall_oi_score': overall,
                            'category': full_category,
                            f"{data.bu.lower()}_category_scores": category_scores
                        })

                if not temp_result:
                    return {}

                # ----- Ranking (descending = higher score = better rank) -----
                temp_result.sort(key=lambda x: (-x['overall_oi_score'], str(x['sap_id'])))
                rank = 1
                prev_score = None
                for idx, rec in enumerate(temp_result):
                    cur_score = rec['overall_oi_score']
                    if prev_score is not None and cur_score < prev_score:
                        rank += 1
                    rec['rank'] = rank
                    prev_score = cur_score

                # Compute national average
                df = pd.DataFrame(temp_result)
                national_avg = round(float(df['overall_oi_score'].mean()), 2)
                performance_score = {rec['sap_id']: rec for rec in temp_result}
                for sap_id, rec in performance_score.items():
                    rec['national_score'] = national_avg

                return performance_score

            # ----- Non-plant logic -----
            else:
                category = {}
                total_scores = []
                for rec in score_data['data']:
                    total_scores.append(safe_float(rec.get('score', 0)))
                    for category_ in rec.get('category', []):
                        category.setdefault(category_.get('name'), []).append({
                            'score': safe_float(category_.get('score', 0)),
                            'weightage': safe_float(category_.get('weightage', 0))
                        })

                if not total_scores:
                    return {}

                overall_score = round(sum(total_scores) / len(total_scores), 2)
                national_avg = overall_score  # same as overall for non-plant

                category_scores = {}
                for cat, scores in category.items():
                    if scores:
                        category_scores[cat] = {
                            'oi_score': round(sum(s['score'] for s in scores) / len(scores), 2),
                            'weightage': round(sum(s['weightage'] for s in scores) / len(scores), 2)
                        }

                return {
                    'overall_oi_score': overall_score,
                    'national_score': national_avg,
                    f"{data.bu.lower()}_category_scores": category_scores
                }

        elif data.bu == "RO":
            return {}
        else:
            return {}

    except Exception as e:
        print(traceback.format_exc())
        return False, "Error in getting performance index score"




# Action get_pi_score_by_category
@router.post('/get_pi_score_by_category', tags=['PerformanceIndex'])
async def performanceindex_get_pi_score_by_category(data: Performanceindex_Get_Pi_Score_By_CategoryParams):
    ...
