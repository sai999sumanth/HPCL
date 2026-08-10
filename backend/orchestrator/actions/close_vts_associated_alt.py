import urdhva_base
import httpx
import asyncio
import datetime
import hpcl_ceg_model



class CloseVtsAssociatedAlert:
    async def get_required_variables(self):
        return ["alert_id"]
    
    async def closeWorkflow(self, original_altid):
        url = urdhva_base.settings.camunda_url + "/engine-rest/message"
        alert_data = await hpcl_ceg_model.Alerts.get(int(original_altid))
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        
        workflow_id = alert_data.get('unique_id')
        data = {
            "messageName": "interLockOk",
            "businessKey": workflow_id,
            "variables": {"alert_id": {"value": workflow_id, "type": "String"},
                          "closed": {"value": True, "type": "Boolean"}}}
        r = httpx.post(url, headers={'Content-Type': 'application/json'}, json=data, verify=False)
        if int(r.status_code / 100) != 2:
            print(f"Error while sending message to camunda: {r.status_code} - {r.text}")
        else:
            print("Message sent to camunda")
        return True, "Successfully sent message to camunda"
    
    async def closeVtsAssociatedAlt(self, params):
        alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id',''))
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        
        interlock_id = alert_data.get('interlock_id')
        for i in range(3):
            try:
                alert_data['alert_status'] = 'Close'
                alert_data['role'] = ''
                alert_data['rolelist'] = ''
                alert_data['updated_at'] = datetime.datetime.utcnow().replace(microsecond=0)

                await hpcl_ceg_model.Alerts(**alert_data).modify()

                await self.closeWorkflow(alert_data['origin_altid'])
                if interlock_id:
                    alert_data['alert_status'] = 'Close'
                    await hpcl_ceg_model.Alerts(**alert_data).modify()
                break
            except Exception as e:
                print('Exception in closing the alert:%s AlertId:%s' % (e, params.get('alert_id')))
                await asyncio.sleep(30)
        return True, {"alertClosed": True}
