import asyncio
import asyncpg
import mysql.connector
from datetime import datetime
from typing import List, Dict, Optional

import sys
sys.path.append("/opt/ceg/algo")

import orchestrator.dbconnector.credential_loader as credential_loader

# Get credentials
tibco_creds = credential_loader.get_credentials('TIBCO')
app_db_creds = credential_loader.get_credentials('APP_DB')


def convert_date_format(date_str: str) -> Optional[str]:
    """
    Convert TIBCO date format YYYYMMDD to DD-MM-YYYY
    
    
    Returns:
        Date in DD-MM-YYYY format (e.g., '16-11-2026') or None if invalid
    """
    try:
        if not date_str or len(str(date_str).strip()) != 8:
            return None

        parsed_date = datetime.strptime(str(date_str).strip(), "%Y%m%d")
        return parsed_date.strftime("%d-%m-%Y")

    except (ValueError, AttributeError) as e:
        print(f"Date conversion error for '{date_str}': {str(e)}")
        return None

async def fetch_from_tibco(query: str) -> List[Dict]:
    """
    Fetch data from TIBCO using MySQL interface
        
    Returns: 
        List of dictionaries containing query results 
    """  
    try:  
        connection = mysql.connector.connect(
            host=tibco_creds['host'],
            user=tibco_creds['user'],
            passwd=tibco_creds['password'],
            port=tibco_creds['port']
        )
        cursor = connection.cursor()
        cursor.execute(query)  
        data = cursor.fetchall()
        
        # Convert to list of dictionaries
        columns = [col[0] for col in cursor.description]
        result = [dict(zip(columns, row)) for row in data]

        cursor.close()
        connection.close()

        print(f"TIBCO: Fetched {len(result)} records")
        return result

    except mysql.connector.Error as e:
        print(f"TIBCO database error: {str(e)}")
        return []
    except Exception as e:
        print(f"Error fetching from TIBCO: {str(e)}")
        return []


async def sync_aot_expiry_dates():
    """
    Sync AOT expiry dates from TIBCO to device_installation table
    
    Process:
    1. Fetch transporter contract data from TIBCO
    2. Batch update device_installation table
    """
    conn: Optional[asyncpg.Connection] = None

    try:
        print("Starting AOT Expiry Date Sync")

        # Query to fetch transporter contract data from TIBCO
        tibco_query = """
            SELECT 
                TRUCK_NO,
                EXPIRY_DATE
            FROM CONN_ENT.ZSDCV_VEH_LIC_STG
            WHERE LICENSE_DESC = 'Transporter Contract'
        """

        # Fetch data from TIBCO
        tibco_data = await fetch_from_tibco(tibco_query)

        if not tibco_data:
            print("No transporter contract data found in TIBCO")
            return {
                "status": False,
                "message": "No data found in TIBCO",
            }

        print(f"Processing {len(tibco_data)} records from TIBCO")

        # Connect to APP DB
        conn = await asyncpg.connect(
            user=app_db_creds['user'],
            password=app_db_creds['password'],
            host=app_db_creds['host'],
            port=app_db_creds['port'],
            database=app_db_creds['database']
        )
        print("Connected to APP DB")
        
        synced_count = 0
        failed_count = 0
        update_records = []

        # Process and prepare batch updates
        for record in tibco_data:
            try:
                truck_no = str(record.get("TRUCK_NO", "")).strip()
                expiry_date_raw = record.get("EXPIRY_DATE")

                if not truck_no:
                    failed_count += 1
                    continue

                # Convert date format
                expiry_date = convert_date_format(expiry_date_raw)
                if not expiry_date:
                    print(f"Invalid date for truck {truck_no}: {expiry_date_raw}")
                    failed_count += 1
                    continue

                update_records.append((truck_no, expiry_date))

            except Exception as e:
                print(f"Error processing record: {str(e)}")
                failed_count += 1
                continue

        # Batch update using asyncpg
        if update_records:
            print(f"Performing batch update for {len(update_records)} records")

            # Prepare batch update
            result = await conn.executemany(
                """
                UPDATE device_installation
                SET tibco_expiry_date = $2
                WHERE sap_tt_no = $1
                """,
                update_records
            )

            synced_count = len(update_records)
            print(f"Batch update completed: {result}")

        print(f"Sync completed. Synced: {synced_count}, Failed: {failed_count}")
        
        return {
            "status": True,
            "message": "AOT Expiry Date Sync completed successfully",
            "synced_count": synced_count,
            "failed_count": failed_count,
            "total_records": len(tibco_data)
        }

    except Exception as e:
        print(f"Fatal error in AOT expiry date sync: {str(e)}")
        return {
            "status": False,
            "message": f"Sync failed: {str(e)}",
            "synced_count": 0,
            "failed_count": 0
        }

    finally:
        if conn:
            await conn.close()
            print("APP DB connection closed")


if __name__ == "__main__":
    print("AOT Expiry Date Sync Service Started")
    result = asyncio.run(sync_aot_expiry_dates())
    print(f"Sync Result: {result}")

