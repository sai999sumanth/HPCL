from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
import json
import traceback
from fastapi.encoders import jsonable_encoder

router = fastapi.APIRouter(prefix='/ongoingtripsvts')


logger = urdhva_base.logger.Logger.getInstance("ongoing_trips_data")

# Action trip_not_closed
@router.post('/trip_not_closed', tags=['OngoingTripsVts'])
async def ongoingtripsvts_trip_not_closed(data: Ongoingtripsvts_Trip_Not_ClosedParams):
    try:        
        # Ensure data.data is a list and contains items
        if isinstance(data.data, list) and len(data.data) > 0:
            enriched_data = jsonable_encoder(data.data)
        else:
            logger.error(f"Invalid data structure: data.data is not a list or is empty")
            return {"status": False, "message": "Invalid data", "data": []}
        logger.info(f"Received VTS data for trip_not_closed ingestion from vendor {enriched_data}")
        print(f"Received VTS data for trip_not_closed ingestion from vendor {enriched_data}")

        redis_queue = urdhva_base.redispool.RedisQueue('vts_ongoing_trips_queue')
        await redis_queue.put(json.dumps(enriched_data))
        return True, "Success"

    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}

# Action trip_without_route
@router.post('/trip_without_route', tags=['OngoingTripsVts'])
async def ongoingtripsvts_trip_without_route(data: Ongoingtripsvts_Trip_Without_RouteParams):
    try:        
        # Ensure data.data is a list and contains items
        if isinstance(data.data, list) and len(data.data) > 0:
            enriched_data = jsonable_encoder(data.data)
        else:
            logger.error(f"Invalid data structure: data.data is not a list or is empty")
            return {"status": False, "message": "Invalid data", "data": []}
        logger.info(f"Received VTS data for trip_without_route ingestion from vendor {enriched_data}")
        print(f"Received VTS data for trip_without_route ingestion from vendor {enriched_data}")

        redis_queue = urdhva_base.redispool.RedisQueue('vts_ongoing_trips_queue')
        await redis_queue.put(json.dumps(enriched_data))
        return True, "Success"

    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}


# Action route_deviation_more_than_two_km
@router.post('/route_deviation_more_than_two_km', tags=['OngoingTripsVts'])
async def ongoingtripsvts_route_deviation_more_than_two_km(data: Ongoingtripsvts_Route_Deviation_More_Than_Two_KmParams):
    try:        
        # Ensure data.data is a list and contains items
        if isinstance(data.data, list) and len(data.data) > 0:
            enriched_data = jsonable_encoder(data.data)
        else:
            logger.error(f"Invalid data structure: data.data is not a list or is empty")
            return {"status": False, "message": "Invalid data", "data": []}
        logger.info(f"Received VTS data for route_deviation_more_than_two_km ingestion from vendor {enriched_data}")
        print(f"Received VTS data for route_deviation_more_than_two_km ingestion from vendor {enriched_data}")

        redis_queue = urdhva_base.redispool.RedisQueue('vts_ongoing_trips_queue')
        await redis_queue.put(json.dumps(enriched_data))
        return True, "Success"

    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}


# Action trip_unauthorised_stoppage
@router.post('/trip_unauthorised_stoppage', tags=['OngoingTripsVts'])
async def ongoingtripsvts_trip_unauthorised_stoppage(data: Ongoingtripsvts_Trip_Unauthorised_StoppageParams):
    try:        
        # Ensure data.data is a list and contains items
        if isinstance(data.data, list) and len(data.data) > 0:
            enriched_data = jsonable_encoder(data.data)
        else:
            logger.error(f"Invalid data structure: data.data is not a list or is empty")
            return {"status": False, "message": "Invalid data", "data": []}
        logger.info(f"Received VTS data for trip_unauthorised_stoppage ingestion from vendor {enriched_data}")
        print(f"Received VTS data for trip_unauthorised_stoppage ingestion from vendor {enriched_data}")

        redis_queue = urdhva_base.redispool.RedisQueue('vts_ongoing_trips_queue')
        await redis_queue.put(json.dumps(enriched_data))
        return True, "Success"

    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}
