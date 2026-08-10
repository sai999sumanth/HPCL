from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import orchestrator.gen_ai.industry_generative_ai as industry_generative_ai
router = fastapi.APIRouter(prefix='/industryperformance')


# Action generate_ai_industry_performance
@router.post('/generate_ai_industry_performance', tags=['IndustryPerformance'])
async def industryperformance_generate_ai_industry_performance(data: Industryperformance_Generate_Ai_Industry_PerformanceParams):
    return await industry_generative_ai.generative_ai(data.user_prompt)


# Action list_ai_industry_performance_queries
@router.post('/list_ai_industry_performance_queries', tags=['IndustryPerformance'])
async def industryperformance_list_ai_industry_performance_queries(data: Industryperformance_List_Ai_Industry_Performance_QueriesParams):
    return await industry_generative_ai.list_ai_industry_performance_queries(data.search_text)



