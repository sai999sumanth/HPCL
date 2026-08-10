import urdhva_base
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class UCVACommand:
    async def get_required_variables(self):
        return ["alert_id"]
    
    async def ucvacommand(self, params):
        return True, None