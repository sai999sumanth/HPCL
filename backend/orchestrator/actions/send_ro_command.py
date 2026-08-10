import urdhva_base
import uuid
import hpcl_ceg_model
import orchestrator.analytics.ro_analysis as ro_analysis
import utilities.cris_alert_mapping as cris_alert_mapping

class SendRoCommand:
    def __init__(self):
        self.params = dict()

    async def get_required_variables(self):
        return ["alert_id", "va_level", "vehicle", "level"]

    async def check_ro_level(self, params: dict):
        if not self.params:
            self.params = params

        alert_data = await hpcl_ceg_model.Alerts.get(self.params['alert_id'])
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        levels = await ro_analysis.get_ro_levels("RO", alert_data['violation_type'], alert_data['sap_id'])
        if self.params['level'] == 'sales_officer':
            if levels in ['level - 2', 'level - 3']:
                return True, {"ok": True}
            return True, {"ok": False}
        elif self.params['level'] == 'regional_manager':
            if levels in ["level - 3"]:
                return True, {"ok": True}
            return True, {"ok": False}
        return False, {"ok": False}


    async def interlock_disable_command(self, params: dict):
        if not self.params:
            self.params = params

        alert_data = await hpcl_ceg_model.Alerts.get(self.params['alert_id'])
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__

        interlock_data = cris_alert_mapping.Cris_Alert_Mapping[alert_data['bu']][alert_data['violation_type']]
        interlock_data = interlock_data['escalations'][self.params['va_level']]
        interlock_map = await self.interlock_type_map()
        interlock_disable = {
            "rocode": alert_data['sap_id'],
            "reqno": str(uuid.uuid4()),
            "interlocktype": interlock_map.get(alert_data['violation_type'], alert_data['violation_type']),
            "device": alert_data['device_name'],
            "deviceid": alert_data['device_id'],
            "disablehrs": interlock_data['disabling_hrs'],
            "alert_id": str(alert_data['id'])
        }
        resp = await ro_analysis.interlock_disable(interlock_disable)
        print(f"Ro interlock disable resp: {resp}")
        return True, {"msg": "Ok"}

    async def interlock_type_map(self):
        return {
            "Pump Test": "PUMP_TEST", "Low Product": "LOW_PRODUCT", "High Water": "HIGH_WATER",
            "TT Receipt": "TT_RECEIPT", "Decantation": "DECANTATION", "NANF": "NANF"
        }