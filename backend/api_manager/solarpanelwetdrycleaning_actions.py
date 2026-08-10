from dashboard_studio_enum import *
from dashboard_studio_model import *
from dashboard_studio_model import HistoricSolarPanelWetDryCleaningCreateCreate
from dashboard_studio_model import HistoricSolarPanelWetDryCleaningCreate
import fastapi
from dateutil import parser as date_parser
import urdhva_base
import json
from datetime import datetime, date
from orchestrator.dbconnector.widget_actions import widget_actions

router = fastapi.APIRouter(prefix='/solarpanelwetdrycleaning')


# Action create_solar_panel_cleaning_record
@router.post('/create_solar_panel_cleaning_record', tags=['SolarPanelWetDryCleaning'])
async def solarpanelwetdrycleaning_create_solar_panel_cleaning_record(data: Solarpanelwetdrycleaning_Create_Solar_Panel_Cleaning_RecordParams):
    """
    Create a new solar panel cleaning record.
    - Copies fields from previous record (bu, sap_id, location, zone, cleaning_type, frequency)
    - Sets last_cleaning_date = cleaning_date (same value)
    - Sets panel_status = Completed if cleaning_date is provided, Pending if empty
    - No 7-day logic checking (that's handled by get_panel_status)
    """
    try:
        query_conditions = [
            f"bu='{data.bu}'",
            f"sap_id='{data.sap_id}'",
            f"location='{data.location}'",
            f"zone='{data.zone}'",
            f"cleaning_type='{data.cleaning_type}'"
        ]
        query_string = " AND ".join(query_conditions)
        
        historic_latest = await HistoricSolarPanelWetDryCleaningCreate.get_all(
            urdhva_base.queryparams.QueryParams(
                q=query_string,
                limit=1,
                sort=json.dumps({'updated_at': 'DESC'})
            ),
            resp_type="plain"
        )
        historic_last_cleaning_date = ""
        if historic_latest.get("data") and len(historic_latest["data"]) > 0:
            historic_last_cleaning_date = historic_latest["data"][0].get("cleaning_date", "")
        
        existing_records = await SolarPanelWetDryCleaning.get_all(
            urdhva_base.queryparams.QueryParams(
                q=query_string,
                limit=2,
                sort=json.dumps({'updated_at': 'DESC'})
            ),
            resp_type="plain"
        )
        
        if existing_records.get("data") and len(existing_records["data"]) > 0:
            previous_record = existing_records["data"][0]
            prev_cleaning_date = previous_record.get('cleaning_date', "")
            prev_status = previous_record.get('panel_status')
            if not prev_cleaning_date or prev_cleaning_date == "":
                if data.cleaning_date and data.cleaning_date.strip() != "":
                    if len(existing_records["data"]) > 1:
                        older_record = existing_records["data"][1]
                        historic_data = {
                            'bu': older_record.get('bu', data.bu),
                            'sap_id': older_record.get('sap_id', data.sap_id),
                            'location': older_record.get('location', data.location),
                            'zone': older_record.get('zone', data.zone),
                            'cleaning_type': older_record.get('cleaning_type', data.cleaning_type),
                            'frequency': older_record.get('frequency', 7),
                            'last_cleaning_date': older_record.get('last_cleaning_date', ""),
                            'cleaning_date': older_record.get('cleaning_date', ""),
                            'panel_status': older_record.get('panel_status', panel_status.Completed)
                        }
                        historic_record = HistoricSolarPanelWetDryCleaningCreateCreate(**historic_data)
                        await historic_record.create()
                        try:
                            await SolarPanelWetDryCleaning.delete(older_record.get('id'))
                        except Exception:
                            pass

                    update_data = previous_record.copy()
                    update_data['bu'] = data.bu
                    update_data['sap_id'] = data.sap_id
                    update_data['zone'] = data.zone
                    update_data['cleaning_type'] = data.cleaning_type
                    update_data['cleaning_date'] = data.cleaning_date
                    update_data['last_cleaning_date'] = previous_record.get('last_cleaning_date', older_record.get('cleaning_date', "")) if len(existing_records["data"]) > 1 else previous_record.get('last_cleaning_date', "")
                    update_data['panel_status'] = panel_status.Completed
                    await SolarPanelWetDryCleaning(**update_data).modify()
                    return {"status": True, "message": "Solar panel cleaning record updated successfully"}
                else:
                    update_data = previous_record.copy()
                    update_data['bu'] = data.bu
                    update_data['sap_id'] = data.sap_id
                    update_data['zone'] = data.zone
                    update_data['cleaning_type'] = data.cleaning_type
                    update_data['panel_status'] = panel_status.Pending
                    await SolarPanelWetDryCleaning(**update_data).modify()
                    return {"status": True, "message": "Solar panel cleaning record pending status retained"}
            else:
                if data.cleaning_date and data.cleaning_date.strip() != "" and prev_status == panel_status.Completed:
                    historic_data = {
                        'bu': previous_record.get('bu', data.bu),
                        'sap_id': previous_record.get('sap_id', data.sap_id),
                        'location': previous_record.get('location', data.location),
                        'zone': previous_record.get('zone', data.zone),
                        'cleaning_type': previous_record.get('cleaning_type', data.cleaning_type),
                        'frequency': previous_record.get('frequency', 7),
                        'last_cleaning_date': previous_record.get('last_cleaning_date', prev_cleaning_date),
                        'cleaning_date': prev_cleaning_date,
                        'panel_status': previous_record.get('panel_status', panel_status.Completed)
                    }
                    historic_record = HistoricSolarPanelWetDryCleaningCreateCreate(**historic_data)
                    await historic_record.create()
                    try:
                        await SolarPanelWetDryCleaning.delete(previous_record.get('id'))
                    except Exception:
                        pass
                    record_data = {
                        'bu': data.bu,
                        'sap_id': data.sap_id,
                        'location': data.location,
                        'zone': data.zone,
                        'cleaning_type': data.cleaning_type,
                        'frequency': previous_record.get('frequency', 7),
                        'last_cleaning_date': prev_cleaning_date,
                        'cleaning_date': data.cleaning_date,
                        'panel_status': panel_status.Completed
                    }
                else:
                    record_data = {
                        'bu': data.bu,
                        'sap_id': data.sap_id,
                        'location': data.location,
                        'zone': data.zone,
                        'cleaning_type': data.cleaning_type,
                        'frequency': previous_record.get('frequency', getattr(data, 'frequency', 7)),
                        'last_cleaning_date': prev_cleaning_date,
                        'cleaning_date': "",
                        'panel_status': panel_status.Pending
                    }
        else:
            record_data = data.model_dump()
            record_data['last_cleaning_date'] = ""
            if 'frequency' not in record_data or not record_data.get('frequency'):
                record_data['frequency'] = 7
        
        if data.cleaning_date and data.cleaning_date.strip() != "":
            panel_status_value = panel_status.Completed
        else:
            panel_status_value = panel_status.Pending
        
        record_data['panel_status'] = panel_status_value
        
    except Exception as e:
        return {"status": False, "message": str(e)}

    cleaning_record = SolarPanelWetDryCleaningCreate(**record_data)
    await cleaning_record.create()
    return {"status": True, "message": "Solar panel cleaning record created successfully"}


# Action get_last_cleaning_date
@router.post('/get_last_cleaning_date', tags=['SolarPanelWetDryCleaning'])
async def solarpanelwetdrycleaning_get_last_cleaning_date(data: Solarpanelwetdrycleaning_Get_Last_Cleaning_DateParams):
    """
    Get the last cleaning_date from the most recent record based on bu, sap_id, location, zone, cleaning_type
    Returns the cleaning_date from the latest historic record sorted by updated_at
    """
    try:
        query_conditions = [
            f"bu='{data.bu}'",
            f"sap_id='{data.sap_id}'",
            f"location='{data.location}'",
            f"zone='{data.zone}'",
            f"cleaning_type='{data.cleaning_type}'"
        ]
        query_string = " AND ".join(query_conditions)
        
        historic_records = await HistoricSolarPanelWetDryCleaningCreate.get_all(
            urdhva_base.queryparams.QueryParams(
                q=query_string,
                limit=1,
                sort=json.dumps({'updated_at': 'DESC'})
            ),
            resp_type="plain"
        )
        
        if historic_records.get("data") and len(historic_records["data"]) > 0:
            previous_record = historic_records["data"][0]
            last_cleaning_date = previous_record.get('cleaning_date', "")
            return {
                "status": True,
                "message": "Last cleaning date retrieved successfully",
                "data": {
                    "last_cleaning_date": last_cleaning_date,
                    "cleaning_date": last_cleaning_date
                }
            }
        else:
            return {
                "status": True,
                "message": "No previous record found",
                "data": {
                    "last_cleaning_date": "",
                    "cleaning_date": ""
                }
            }
            
    except Exception as e:
        return {
            "status": False,
            "message": f"Error retrieving last cleaning date: {str(e)}",
            "data": {
                "last_cleaning_date": "",
                "cleaning_date": ""
            }
        }


# Action get_panel_status
@router.post('/get_panel_status', tags=['SolarPanelWetDryCleaning'])
async def solarpanelwetdrycleaning_get_panel_status(data: Solarpanelwetdrycleaning_Get_Panel_StatusParams):
    """
    Check if 7 days have passed since last cleaning_date.
    If 7 days have passed, create a new record with panel_status = Pending using historic last cleaning date.
    Ensure only one record remains in SolarPanelWetDryCleaning for the given keys.
    """
    try:
        query_conditions = [
            f"bu='{data.bu}'",
            f"sap_id='{data.sap_id}'",
            f"location='{data.location}'",
            f"zone='{data.zone}'",
            f"cleaning_type='{data.cleaning_type}'"
        ]
        query_string = " AND ".join(query_conditions)
        
        existing_records = await SolarPanelWetDryCleaning.get_all(
            urdhva_base.queryparams.QueryParams(
                q=query_string,
                limit=1,
                sort=json.dumps({'updated_at': 'DESC'})
            ),
            resp_type="plain"
        )
        
        historic_latest = await HistoricSolarPanelWetDryCleaningCreate.get_all(
            urdhva_base.queryparams.QueryParams(
                q=query_string,
                limit=1,
                sort=json.dumps({'updated_at': 'DESC'})
            ),
            resp_type="plain"
        )
        last_cleaning_date_str = ""
        if existing_records.get("data") and len(existing_records["data"]) > 0:
            last_cleaning_date_str = existing_records["data"][0].get('cleaning_date', "")
            if not last_cleaning_date_str:
                if historic_latest.get("data") and len(historic_latest["data"]) > 0:
                    last_cleaning_date_str = historic_latest["data"][0].get('cleaning_date', "")
        else:
            if historic_latest.get("data") and len(historic_latest["data"]) > 0:
                last_cleaning_date_str = historic_latest["data"][0].get('cleaning_date', "")
        
        if not last_cleaning_date_str:
            return {
                "status": True,
                "message": "No last cleaning date found",
                "data": {
                    "panel_status": "",
                    "record_created": False
                }
            }
        
        last_cleaning = date_parser.parse(last_cleaning_date_str).date()
        
        today = date.today()
        days_diff = (today - last_cleaning).days
        
        if days_diff < 7:
            return {
                "status": True,
                "message": "Last cleaning was within 7 days",
                "data": {
                    "panel_status": existing_records["data"][0].get('panel_status', "") if (existing_records.get("data") and len(existing_records["data"]) > 0) else "",
                    "days_since_last_cleaning": days_diff,
                    "record_created": False
                }
            }
        
        current_all = await SolarPanelWetDryCleaning.get_all(
            urdhva_base.queryparams.QueryParams(
                q=query_string,
                limit=0,
                sort=json.dumps({'updated_at': 'DESC'})
            ),
            resp_type="plain"
        )
        pending_record = None
        archived_last_cleaning_date = last_cleaning_date_str
        for rec in current_all.get("data", []):
            cd = rec.get('cleaning_date', "")
            if not cd or cd == "":
                pending_record = rec
                break
        for rec in current_all.get("data", []):
            if pending_record and rec.get('id') == pending_record.get('id'):
                continue
            cd = rec.get('cleaning_date', "")
            if cd and cd != "":
                if not archived_last_cleaning_date:
                    archived_last_cleaning_date = cd
                hist_data = {
                    'bu': rec.get('bu', data.bu),
                    'sap_id': rec.get('sap_id', data.sap_id),
                    'location': rec.get('location', data.location),
                    'zone': rec.get('zone', data.zone),
                    'cleaning_type': rec.get('cleaning_type', data.cleaning_type),
                    'frequency': rec.get('frequency', 7),
                    'last_cleaning_date': rec.get('last_cleaning_date', ""),
                    'cleaning_date': rec.get('cleaning_date', ""),
                    'panel_status': rec.get('panel_status', panel_status.Completed)
                }
                hist_rec = HistoricSolarPanelWetDryCleaningCreateCreate(**hist_data)
                await hist_rec.create()
                try:
                    await SolarPanelWetDryCleaning.delete(rec.get('id'))
                except Exception:
                    pass
        
        if pending_record:
            return {
                "status": True,
                "message": "Pending record already exists",
                "data": {
                    "panel_status": "Pending",
                    "days_since_last_cleaning": days_diff,
                    "record_created": False
                }
            }
        else:
            record_data = {
                'bu': data.bu,
                'sap_id': data.sap_id,
                'location': data.location,
                'zone': data.zone,
                'cleaning_type': data.cleaning_type,
                'frequency': 7,
                'last_cleaning_date': archived_last_cleaning_date,
                'cleaning_date': "",
                'panel_status': panel_status.Pending
            }
            cleaning_record = SolarPanelWetDryCleaningCreate(**record_data)
            await cleaning_record.create()
        
        return {
            "status": True,
            "message": "Record created/retained with Pending status",
            "data": {
                "panel_status": "Pending",
                "days_since_last_cleaning": days_diff,
                "record_created": True if not pending_record else False
            }
        }
            
    except Exception as e:
        return {
            "status": False,
            "message": f"Error checking panel status: {str(e)}",
            "data": {
                "panel_status": "",
                "record_created": False
            }
        }


# Action get_pending_completed_counts
@router.post('/get_pending_completed_counts', tags=['SolarPanelWetDryCleaning'])
async def solarpanelwetdrycleaning_get_pending_completed_counts(data: Solarpanelwetdrycleaning_Get_Pending_Completed_CountsParams):
    try:
        filters = (data.filters or []) + (data.cross_filters or [])
        drill_state = getattr(data, "drill_state", "") or ""
        cleaning_type = (data.cleaning_type or "").replace("'", "''")

        async def fetch_records(query: str, limit: int):
            if filters:
                query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)
            result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=limit, skip=0)
            return result.get("data", []) if isinstance(result, dict) else []

        pending_count_query = f"""
            SELECT COUNT(*) AS count
            FROM public.solar_panel_wet_dry_cleaning
            WHERE "cleaning_type" = '{cleaning_type}'
              AND "panel_status" = 'Pending'
        """
        pending_details_query = f"""
            SELECT *
            FROM public.solar_panel_wet_dry_cleaning
            WHERE "cleaning_type" = '{cleaning_type}'
              AND "panel_status" = 'Pending'
        """

        completed_count_current_query = f"""
            SELECT COUNT(*) AS count
            FROM public.solar_panel_wet_dry_cleaning
            WHERE "cleaning_type" = '{cleaning_type}'
              AND "panel_status" = 'Completed'
        """
        completed_details_current_query = f"""
            SELECT *
            FROM public.solar_panel_wet_dry_cleaning
            WHERE "cleaning_type" = '{cleaning_type}'
              AND "panel_status" = 'Completed'
        """

        completed_count_historic_query = f"""
            SELECT COUNT(*) AS count
            FROM public.historic_solar_panel_wet_dry_cleaning_create
            WHERE "cleaning_type" = '{cleaning_type}'
              AND "panel_status" = 'Completed'
        """
        completed_details_historic_query = f"""
            SELECT *
            FROM public.historic_solar_panel_wet_dry_cleaning_create
            WHERE "cleaning_type" = '{cleaning_type}'
              AND "panel_status" = 'Completed'
        """

        pending_count_rows = await fetch_records(pending_count_query, limit=0)
        pending_count = int((pending_count_rows[0] or {}).get("count", 0)) if pending_count_rows else 0

        completed_count_current_rows = await fetch_records(completed_count_current_query, limit=0)
        completed_count_current = int((completed_count_current_rows[0] or {}).get("count", 0)) if completed_count_current_rows else 0

        completed_count_historic_rows = await fetch_records(completed_count_historic_query, limit=0)
        completed_count_historic = int((completed_count_historic_rows[0] or {}).get("count", 0)) if completed_count_historic_rows else 0

        details_limit = getattr(data, "limit", 0) or 0

        pending_details = await fetch_records(pending_details_query, limit=details_limit)

        completed_details_current = await fetch_records(completed_details_current_query, limit=details_limit)

        completed_details_historic = await fetch_records(completed_details_historic_query, limit=details_limit)

        completed_details = completed_details_current + completed_details_historic
        completed_count = completed_count_current + completed_count_historic

        return {
            "status": True,
            "message": "success",
            "data": {
                "pending": {
                    "count": pending_count,
                    "details": pending_details
                },
                "completed": {
                    "count": completed_count,
                    "details": completed_details
                }
            }
        }
    except Exception as e:
        return {
            "status": False,
            "message": f"Error fetching pending/completed counts: {str(e)}",
            "data": {
                "pending": {"count": 0, "details": []},
                "completed": {"count": 0, "details": []}
            }
        }


# Action get_all_dry_wet_cleaning_records
@router.post('/get_all_dry_wet_cleaning_records', tags=['SolarPanelWetDryCleaning'])
async def solarpanelwetdrycleaning_get_all_dry_wet_cleaning_records(data: Solarpanelwetdrycleaning_Get_All_Dry_Wet_Cleaning_RecordsParams):
    try:
        query = """
                SELECT *
                    FROM (
                        SELECT * FROM solar_panel_wet_dry_cleaning
                        UNION ALL
                        SELECT * FROM historic_solar_panel_wet_dry_cleaning_create
                    ) AS combined_data
                    WHERE panel_status = 'Completed'
            """
        if data.filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, data.filters, data.drill_state)

        result = await urdhva_base.BasePostgresModel.get_aggr_data(
            query, limit=0, skip=0
        )

        records = result.get("data", [])
        return records

    except Exception as e:
        return {
            "status": "error",
            "message": "Failed to fetch solar panel cleaning data",
            "error": str(e)
        }
