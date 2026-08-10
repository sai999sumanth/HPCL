from sqlalchemy import text
import datetime
from orchestrator.dashboard.chart_factory import charts_functions


class BignumberTrendlineChart:
    async def get_data(self,metrics_data):
        database = metrics_data.database
        async_session = await charts_functions.check_db(database)
        session = async_session()
        try:
            table_name, table_schema = metrics_data.table, metrics_data.schema
            viztype = 'bignumber_trendline'
            resp = dict()
            resp['viztype'] = viztype
            if metrics_data.type == 'Query':
                resp['query'] = metrics_data.user_query
            else:
                queries = metrics_data.params.queries
                for q in queries:
                    metrics = q.metrics
                    filters = q.filters
                    orderby = q.orderby
                    order_descending = q.order_descending
                    row_limit = q.row_limit

                # taking groupby columns and storing in list

                grp_by_col = []  # groupby column details in dictionary {'name':'','label':''}

                if metrics_data.params.form_data.groupby:
                    groupbyCol = metrics_data.params.form_data.groupby
                    for cols in groupbyCol:
                        if cols.name:
                            if not cols.label:
                                cols.label = cols.name
                            grp_by_col.append(cols)

                if not metrics_data.params.form_data.x_axis:
                    return {"status": False, "message": "x axis missing", "data": []}

                time_grain = dict()
                if metrics_data.params.form_data.time_grain:
                    time_grain['column'] = metrics_data.params.form_data.x_axis.name
                    time_grain['column_label'] = metrics_data.params.form_data.x_axis.label
                    time_grain['granularity'] = metrics_data.params.form_data.time_grain

                if not time_grain:
                    grp_by_col.append(metrics_data.params.form_data.x_axis)

                query_mode = 'aggregate'
                if metrics_data.params.form_data.query_mode:
                    query_mode = metrics_data.params.form_data.query_mode



                # taking orderby columns
                orderbyColumn = {'data': [], "sortbydesc": False}
                if orderby:
                    orderbyColumn['data'] = orderby
                    if order_descending:
                        orderbyColumn['sortbydesc'] = True

                # getting the query
                resp['query'] = await charts_functions.getQuery(
                    viztype, table_name, table_schema, metrics, filters, grp_by_col, query_mode, orderbyColumn, time_grain=time_grain,
                    rowlimit=row_limit
                )

            # keeping default status and data
            resp['status'] = True
            resp['data'] = []

            # query execution
            query_ = resp['query']
            print("query--> ", query_)
            start_time = datetime.datetime.now(datetime.timezone.utc)
            query_results = await session.execute(text(query_))
            print("duration: ", datetime.datetime.now(datetime.timezone.utc) - start_time)
            # final data preparation
            column_names = query_results.keys()
            final_list = [dict(zip(column_names, row))  for row in query_results.fetchall()]
            resp['data'] = final_list
            return resp
        except Exception as e:
            return {"status": False, "message": str(e), "data": []}
        finally:
            await session.close()
