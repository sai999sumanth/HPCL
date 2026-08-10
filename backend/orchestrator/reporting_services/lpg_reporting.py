import urdhva_base
import datetime
import asyncio
import decimal
import utilities.helpers as helpers
import dateutil.parser as dateutil_parser


async def get_lpg_day_wise_trends(by_plant=False, by_day=True, by_month=False, time_range=None):
    """
    Generates LPG Day wise Trends based on user selection
    :param by_plant:
    :param by_day:
    :param time_range:
    :return:
    """
    start_time = ""
    end_time = ""
    if time_range is None:
        end_time = helpers.get_time_stamp_by_delta(days=1, with_month_start_day=False)
        start_time = helpers.get_time_stamp_by_delta(dateutil_parser.parse(end_time), with_month_start_day=True)
    else:
        start_time = time_range.split(",")[0]
        end_time = time_range.split(",")[1]
    required_keys = []
    group_by_keys = []
    if by_plant:
        required_keys.append('name')
        group_by_keys.append('name')
    if by_month:
        required_keys.append("DATE_TRUNC('month', timestamp)::DATE As month")
        group_by_keys.append('month')
    elif by_day:
        required_keys.append('timestamp::DATE')
        group_by_keys.append('timestamp::DATE')
    group_by = "" if not required_keys else f""" Group by {','.join(group_by_keys)}"""
    required_keys.append('ROUND(AVG(score), 2) as score')
    order_by = ""
    if by_month:
        order_by = "order by month desc"
    elif by_day:
        order_by = "order by timestamp desc"
    elif by_plant:
        order_by = "order by ROUND(AVG(score), 2) desc"
    query = f"""SELECT {','.join(required_keys)} from performance_score_history where timestamp >= '{start_time}' AND bu='LPG' AND timestamp <= '{end_time}' {group_by} {order_by}"""
    print(query)
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
    resp = resp['data']
    for rec in resp:
        for key in rec:
            if isinstance(rec[key], datetime.datetime) or isinstance(rec[key], datetime.date):
                rec[key] = rec[key].strftime("%Y-%m-%d")
            elif isinstance(rec[key], decimal.Decimal):
                rec[key] = float(rec[key])
    return resp


async def get_zone_wise_cylinder_backlog():
    query = f"""
                SELECT
                "ZOName",
                "Pending 1-3 days",
                "Pending 4-7 days",
                "Pending 8-15 days",
                "Pending Beyond 15 days",
                "Total"
            FROM (
                SELECT
                    "ZOName",
                    SUM("pending_1_3_days")  AS "Pending 1-3 days",
                    SUM("pending_4_7_days")  AS "Pending 4-7 days",
                    SUM("pending_8_15_days") AS "Pending 8-15 days",
                    SUM("Pending_Beyond15D") AS "Pending Beyond 15 days",
                    SUM("pending_1_3_days"
                    + "pending_4_7_days"
                    + "pending_8_15_days"
                    + "Pending_Beyond15D") AS "Total",
                    1 AS sort_order
                FROM "lpg_todays_cdcms_sales_summary"
                GROUP BY "ZOName"

                UNION ALL

                SELECT
                    'All India Total'        AS "ZOName",
                    SUM("pending_1_3_days")  AS "Pending 1-3 days",
                    SUM("pending_4_7_days")  AS "Pending 4-7 days",
                    SUM("pending_8_15_days") AS "Pending 8-15 days",
                    SUM("Pending_Beyond15D") AS "Pending Beyond 15 days",
                    SUM("pending_1_3_days"
                    + "pending_4_7_days"
                    + "pending_8_15_days"
                    + "Pending_Beyond15D") AS "Total",
                    2 AS sort_order
                FROM "lpg_todays_cdcms_sales_summary"
            ) t
            ORDER BY sort_order, "ZOName"
        """
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
    resp = resp['data']
    for rec in resp:
        for key in rec:
            if isinstance(rec[key], datetime.datetime) or isinstance(rec[key], datetime.date):
                rec[key] = rec[key].strftime("%Y-%m-%d")
            elif isinstance(rec[key], decimal.Decimal):
                rec[key] = int(rec[key])
    return resp


async def data_test():
    # By Month
    
    resp1 = await get_lpg_day_wise_trends(by_day=False, by_month=True, time_range='2025-06-01,2025-12-01')
    print("*"*200)
    print('resp1',resp1)
    print("*"*200)
    # SAMPLE Output
    """ [{'month': '2025-12-01', 'score': 89.89}, {'month': '2025-11-01', 'score': 89.68}, 
    {'month': '2025-10-01', 'score': 85.91}, {'month': '2025-09-01', 'score': 74.39}, 
    {'month': '2025-08-01', 'score': 60.16}, {'month': '2025-07-01', 'score': 63.19}, 
    {'month': '2025-06-01', 'score': 59.81}] """
    # By Day in the present month
    resp2 = await get_lpg_day_wise_trends(by_day=True)
    print("*"*200)
    print('resp2',resp2)
    print("*"*200)
    # SAMPLE Output
    """
    [{'timestamp': '2025-12-17', 'score': 82.33}, {'timestamp': '2025-12-16', 'score': 80.85}, 
    {'timestamp': '2025-12-15', 'score': 78.55}, {'timestamp': '2025-12-14', 'score': 78.06}, 
    {'timestamp': '2025-12-13', 'score': 81.04}, {'timestamp': '2025-12-12', 'score': 84.56}, 
    {'timestamp': '2025-12-11', 'score': 85.11}, {'timestamp': '2025-12-10', 'score': 83.63}, 
    {'timestamp': '2025-12-09', 'score': 84.76}, {'timestamp': '2025-12-08', 'score': 83.17}, 
    {'timestamp': '2025-12-07', 'score': 82.52}, {'timestamp': '2025-12-06', 'score': 83.44}, 
    {'timestamp': '2025-12-05', 'score': 84.09}, {'timestamp': '2025-12-04', 'score': 84.21}, 
    {'timestamp': '2025-12-03', 'score': 89.77}, {'timestamp': '2025-12-02', 'score': 89.65}, 
    {'timestamp': '2025-12-01', 'score': 89.89}]
    """
    # By Day and per plant in the present month
    resp3 = await get_lpg_day_wise_trends(by_day=True, by_plant=True)
    print("*"*200)
    print('resp3',resp3)
    print("*"*200)
    # SAMPLE Output
    """[{'sap_id': '3833', 'timestamp': '2025-12-01', 'score': 82.0}]"""
    # By Plant in the present month in descending order
    resp4 = await get_lpg_day_wise_trends(by_day=False, by_plant=True)
    print("*"*200)
    print('resp4',resp4)
    print("*"*200)
    # SAMPLE Output
    """[{'sap_id': '2262', 'score': 56.94}]"""

    resp5 = await get_zone_wise_cylinder_backlog()
    print("*"*200)
    print('resp5',resp5)
    print("*"*200)


if __name__ == '__main__':
    asyncio.run(data_test())
