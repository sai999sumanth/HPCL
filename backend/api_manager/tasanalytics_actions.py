from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import orchestrator.tas_analytics.tas_analytics as tas_analytics

router = fastapi.APIRouter(prefix='/tasanalytics')


# Action tas_analytics
@router.post('/tas_analytics', tags=['TasAnalytics'])
async def tasanalytics_tas_analytics(data: Tasanalytics_Tas_AnalyticsParams):

    return await tas_analytics.tas_analytics_action(data)
