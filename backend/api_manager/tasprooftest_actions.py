import urdhva_base
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import traceback
import pandas as pd


router = fastapi.APIRouter(prefix='/tasprooftest')


# Action prooftest_data
@router.post('/prooftest_data', tags=['TasProofTest'])
async def tasprooftest_prooftest_data(data: Tasprooftest_Prooftest_DataParams):
    try:
        resp = await TasProofTest.get_all(urdhva_base.queryparams.QueryParams(
            limit = 0,
            skip = 0,
            sort = None,
        ), 
          resp_type='plain'
        )
        if resp:
            df = pd.DataFrame(resp['data'])
            required_columns = ['sap_id', 'location_name', 'device_name', 'interlock_name', 'proof_test_created_at', 'next_proof_test_date']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
              raise KeyError(f"Missing columns in response: {', '.join(missing_columns)}")
            
            df = df.rename (columns= {'proof_test_created_at': 'proof_test_update_date'})

            filtered_columns = [
                'sap_id', 
                'location_name', 
                'device_name', 
                'interlock_name', 
                'proof_test_update_date', 
                'next_proof_test_date'
            ]
            df = df[filtered_columns]
            return {"status": True, "message": "Success",  "data": df.to_dict(orient='records')}

    except Exception as e:
        print(traceback.format_exc())
        return {"status": False, "message": f"Error: {str(e)}"}
