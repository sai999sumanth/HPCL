from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import orchestrator.analytics.lpg_plant_analysis as lpg_plant_analysis

router = fastapi.APIRouter(prefix='/lpgoperationsinsights')


# Action lpg_plants_insights
@router.post('/lpg_plants_insights', tags=['LpgOperationsInsights'])
async def lpgoperationsinsights_lpg_plants_insights(data: Lpgoperationsinsights_Lpg_Plants_InsightsParams):
    return await lpg_plant_analysis.lpg_plants_insights(
        filters=data.filters or [],
        cross_filters=data.cross_filters or [],
        drill_state=data.drill_state or "",
        metric_type=data.metric_type
    )


# Action lpg_car_download
@router.post('/lpg_car_download', tags=['LpgOperationsInsights'])
async def lpgoperationsinsights_lpg_car_download(data: Lpgoperationsinsights_Lpg_Car_DownloadParams):
    return await lpg_plant_analysis.lpg_car_download(data)
