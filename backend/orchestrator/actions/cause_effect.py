import urdhva_base
import time
import datetime
import traceback
import hpcl_ceg_model
import utilities.helpers as helpers

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")

class CauseEffect:
    async def get_required_variables(self):
        return ["BU", "sap_id", "sop_id", "device_id", 
                "device_type", "device_name", "cause_effect", 
                "effect_sop_id", "cause_sop_id", "alert_id", "interlock_name"]

    async def handle_cause_alert(self, params):
        effect_sop_id = params.get("effect_sop_id")
        if isinstance(effect_sop_id, list):
            effect_sop_id = ','.join([f"'{item.strip('[]')}'" for item in effect_sop_id])
        
        # Get current cause alert details
        cause_alert_id = params.get("alert_id")
        interlock_name = params.get("interlock_name", "Unknown")
        
        query = (
            f"""bu = '{params.get("BU")}' and """
            f"""sap_id = '{params.get("sap_id")}' and """
            f"""sop_id in ({effect_sop_id}) and """
            f"""device_id = '{params.get("device_id")}' and """ 
            f""" alert_status != 'Close' and """
            f"""cause_effect = 'Effect'"""
            # f"""created_at >= NOW() - INTERVAL '5 minutes'"""
        )

        query_params = urdhva_base.queryparams.QueryParams()
        query_params.q = query
        query_params.sort = {"created_at": "desc"}

        effect_alerts = await hpcl_ceg_model.Alerts.get_all(query_params, resp_type='plain')
        processed_time = datetime.datetime.now(datetime.timezone.utc)
        
        # Get the cause alert to update its history
        cause_alert = await hpcl_ceg_model.Alerts.get(cause_alert_id) if cause_alert_id else None
        existing_cause_history = getattr(cause_alert, 'alert_history', []) or [] if cause_alert else []
        
        # Process each effect alert
        for effect_alert in effect_alerts.get('data', []):
            effect_alert_id = effect_alert['id']
            effect_interlock_name = effect_alert.get('interlock_name', "Unknown Effect")
            
            # if effect_interlock_name.lower().endswith('_fail'):
            #     continue
            # Update effect alert's history with cause reference
            existing_effect_history = effect_alert.get('alert_history', [])
            last_processed_time = processed_time
            
            # Find the position right after InterlockCreated
            insert_position = len(existing_effect_history)
            for i, entry in enumerate(existing_effect_history):
                if entry.get("action_type") == "InterlockCreated":
                    insert_position = i + 1
                    last_processed_time = entry.get("processed_time", processed_time)
                    break
            
            # Check if this cause is already referenced in effect's history
            cause_exists = any(
                entry.get("action_type") == "Cause" 
                and interlock_name in entry.get("action_msg", "")
                for entry in existing_effect_history
            )
            
            # Add to effect's history if not already present
            if not cause_exists:
                new_effect_entry = {
                    "processed_time": processed_time.isoformat(),
                    "allocated_time": last_processed_time if isinstance(last_processed_time, str) else last_processed_time.isoformat(),
                    "action_msg": f"Related Cause alert {interlock_name}",
                    "action_type": "Cause"
                }
                # Insert right after InterlockCreated
                updated_effect_history = (
                    existing_effect_history[:insert_position] + 
                    [new_effect_entry] + 
                    existing_effect_history[insert_position:]
                )
                effect_data_obj = hpcl_ceg_model.Alerts(id=effect_alert_id, alert_history=updated_effect_history)
                await effect_data_obj.modify()
            
            # Update cause's history with this effect reference
            # Find the position right after InterlockCreated in cause's history
            cause_insert_position = len(existing_cause_history)
            for i, entry in enumerate(existing_cause_history):
                if entry.get("action_type") == "InterlockCreated":
                    cause_insert_position = i + 1
                    last_processed_time = entry.get("processed_time", processed_time)
                    break
            
            # Check if this specific effect is already in cause's history
            effect_exists = any(
                entry.get("action_type") == "Effect" 
                and effect_interlock_name in entry.get("action_msg", "")
                for entry in existing_cause_history
            )
            
            if not effect_exists:
                new_cause_entry = {
                    "processed_time": processed_time.isoformat(),
                    "allocated_time": last_processed_time if isinstance(last_processed_time, str) else last_processed_time.isoformat(),
                    "action_msg": f"Related Effect alert {effect_interlock_name}",
                    "action_type": "Effect"
                }
                # Insert right after InterlockCreated
                existing_cause_history.insert(cause_insert_position, new_cause_entry)
        
        # Save the updated cause history if we made changes
        if cause_alert and existing_cause_history:
            cause_data_obj = hpcl_ceg_model.Alerts(id=cause_alert_id, alert_history=existing_cause_history)
            await cause_data_obj.modify()

        return True, {"Message": "Alert History updated"}

    async def handle_effect_alert(self, params):
        # if params.get('interlock_name', '').lower().endswith('_fail'):
        #     return True, {"Message": "Skipped _fail interlock"}
        
        # Get current effect alert details
        effect_alert_id = params.get("alert_id")
        interlock_name = params.get("interlock_name", "Unknown")
        cause_sop_id = params.get("cause_sop_id")

        query = (
            f"""bu = '{params.get("BU")}' and """
            f"""sap_id = '{params.get("sap_id")}' and """
            f"""sop_id = '{cause_sop_id}' and """
            f"""device_id = '{params.get("device_id")}' and """ 
            f""" alert_status != 'Close' and """
            f"""cause_effect = 'Cause'"""
            # f"""created_at >= NOW() - INTERVAL '5 minutes'"""
        )

        query_params = urdhva_base.queryparams.QueryParams()
        query_params.q = query
        query_params.sort = {"created_at": "desc"}
        
        cause_alerts = await hpcl_ceg_model.Alerts.get_all(query_params, resp_type='plain')
        processed_time = datetime.datetime.now(datetime.timezone.utc)
        
        # Variable to store the related cause alert info
        related_cause_interlock_name = None
        
        if cause_alerts['data']:
            # Process each cause alert (there should typically only be one)
            for cause_alert in cause_alerts['data']:
                cause_alert_id = cause_alert['id']
                related_cause_interlock_name = cause_alert.get('interlock_name', "Unknown Cause")
                existing_cause_history = cause_alert.get('alert_history', [])
                last_processed_time = processed_time

                # Find position right after InterlockCreated
                insert_position = len(existing_cause_history)
                for i, entry in enumerate(existing_cause_history):
                    if entry.get("action_type") == "InterlockCreated":
                        insert_position = i + 1
                        last_processed_time = entry.get("processed_time", processed_time)
                        break
                
                # Check if this effect alert is already referenced in the cause's history
                effect_exists = any(
                    entry.get("action_type") == "Effect" 
                    and interlock_name in entry.get("action_msg", "")
                    for entry in existing_cause_history
                )
                
                # Only add if this effect isn't already referenced
                if not effect_exists:
                    new_entry = {
                        "processed_time": processed_time.isoformat(),
                        "allocated_time": last_processed_time if isinstance(last_processed_time, str) else last_processed_time.isoformat(),
                        "action_msg": f"Related Effect alert {interlock_name}",
                        "action_type": "Effect"
                    }
                    # Insert right after InterlockCreated
                    updated_cause_history = (
                        existing_cause_history[:insert_position] + 
                        [new_entry] + 
                        existing_cause_history[insert_position:]
                    )
                    cause_data_obj = hpcl_ceg_model.Alerts(id=cause_alert_id, alert_history=updated_cause_history)
                    await cause_data_obj.modify()
        
        # Update the current effect alert's history with cause info
        if effect_alert_id:
            effect_alert = await hpcl_ceg_model.Alerts.get(effect_alert_id)
            if effect_alert:
                existing_effect_history = getattr(effect_alert, 'alert_history', []) or []
                last_processed_time = processed_time

                # Find position right after InterlockCreated
                insert_position = len(existing_effect_history)
                for i, entry in enumerate(existing_effect_history):
                    if entry.get("action_type") == "InterlockCreated":
                        insert_position = i + 1
                        last_processed_time = entry.get("processed_time", processed_time)
                        break

                # Check if this cause is already referenced
                cause_exists = any(
                    entry.get("action_type") == "Cause" 
                    and related_cause_interlock_name 
                    and related_cause_interlock_name in entry.get("action_msg", "")
                    for entry in existing_effect_history
                )
                
                # Only add if we found a cause and it's not already referenced
                if not cause_exists and related_cause_interlock_name:
                    new_effect_entry = {
                        "processed_time": processed_time.isoformat(),
                        "allocated_time": last_processed_time if isinstance(last_processed_time, str) else last_processed_time.isoformat(),
                        "action_msg": f"Related to Cause alert {related_cause_interlock_name}",
                        "action_type": "Cause"
                    }
                    # Insert right after InterlockCreated
                    updated_effect_history = (
                        existing_effect_history[:insert_position] + 
                        [new_effect_entry] + 
                        existing_effect_history[insert_position:]
                    )
                    effect_data_obj = hpcl_ceg_model.Alerts(id=effect_alert_id, alert_history=updated_effect_history)
                    await effect_data_obj.modify()
        
        return True, {"Message": "Alert History updated"}

    async def cause_effect_alert(self, params):
        print("params --> ", params)
        try:
            if params.get('cause_effect') == 'Cause':
                return await self.handle_cause_alert(params)
            elif params.get('cause_effect') == 'Effect':
                return await self.handle_effect_alert(params)
            else:
                logger.warning(f"Unknown Cause_Effect value: {params.get('Cause_Effect')}")
                return True, {"message": "Moving to Next Block"}
        except Exception as e:
            logger.error(f"Error processing alert: {traceback.format_exc()}")
            return None