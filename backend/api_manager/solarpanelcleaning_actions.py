import urdhva_base
from dashboard_studio_enum import *
from dashboard_studio_model import *
import fastapi
import orchestrator.analytics.solar_capacity as solar_capacity

router = fastapi.APIRouter(prefix='/solarpanelcleaning')


# Action get_solar_dashboard_summary
@router.post('/get_solar_dashboard_summary', tags=['SolarPanelCleaning'])
async def solarpanelcleaning_get_solar_dashboard_summary(data: Solarpanelcleaning_Get_Solar_Dashboard_SummaryParams):
    """
    API endpoint to get solar dashboard summary.
    Routes to the appropriate function in SolarCapacity class based on the action parameter.
    """
    return await solar_capacity.SolarCapacity.route_action(data)

