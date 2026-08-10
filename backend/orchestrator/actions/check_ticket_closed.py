import hpcl_ceg_model
import urdhva_base
import api_manager_ticketing.hpcl_ceg_ticketing_model as hpcl_ceg_ticketing_model
import json

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckTicketClosed:
   async def get_required_variables(self):
        return ["alert_id"]
   
   async def check_ticket_closed(self,params):
       try:
            query = f"id = {params.get('alert_id')}"
            params = urdhva_base.queryparams.QueryParams(q=query, limit=1, sort=json.dumps({"created_at": "desc"}))
            result = await hpcl_ceg_model.Alerts.get_all(params=params, resp_type="plain")
            if not result.get("data"):
                logger.error(f"No alert found for alert_id {params.get('alert_id')}")
                return False, {"message": f"No alert found for alert_id {params.get('alert_id')}"}
            alert_data = result["data"][0]
            alert_data["ticket_id"] = alert_data["ticket_id"] 
            
            query = f"ticket_id = '{alert_data.get('ticket_id')}'"
            params = urdhva_base.queryparams.QueryParams(q=query, limit=1, sort=json.dumps({"created_at": "desc"}))
            result = await hpcl_ceg_ticketing_model.Ticketing.get_all(params=params, resp_type="plain")
            if not result.get("data"):
                logger.error(f"No ticket found for alert_id {params.get('alert_id')}")
                return False, {"message": f"No ticket found for alert_id {params.get('alert_id')}"}
            ticket_data = result["data"][0]
            if ticket_data["ticket_status"] in ["Close"]:
                return True, {"TicketClosed": True}
            
            
            return True, {"TicketClosed": False}   
       except Exception as e:
                logger.error(f"Error while checking ticket closed: {str(e)}")
                return False, {"message": "Error while checking ticket closed"}