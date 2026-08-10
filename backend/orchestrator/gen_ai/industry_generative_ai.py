import urdhva_base
import os
import pandas as pd
import hpcl_ceg_model
import orchestrator.gen_ai.sql_query_generator as sql_query_generator


async def generative_ai(prompt):
    # pkl_file = f"{os.path.dirname(sql_query_generator.__file__)}/industry_performance.pkl"
    # pkl_file = f"{os.path.dirname(sql_query_generator.__file__)}/industry_performance_high_model.pk1"
    sql_query = sql_query_generator.generate_sql_query(prompt)
    # sql_query = sql_query_generator.nl_to_sql(prompt, pkl_file)
    if sql_query and sql_query[-1] == ';':
        sql_query = sql_query[:-1]
    if 'industry_performance_test' in sql_query:
        sql_query = sql_query.replace('industry_performance_test', 'industry_performance')
    if 'company_name' in sql_query:
        sql_query = sql_query.replace('company_name', 'comname')
    print(sql_query)
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(sql_query, limit=0)
    return resp['data']


async def list_ai_industry_performance_queries(search_text):
    csv_file = f"{os.path.dirname(sql_query_generator.__file__)}/oil_gas_industry_500_queries.csv"
    df = pd.read_csv(csv_file)
    if search_text:
        df = df[df['Prompt'].str.contains(search_text, case=False)]
    return df['Prompt'].tolist()[0:20]
