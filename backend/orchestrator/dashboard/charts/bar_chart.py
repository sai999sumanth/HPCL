from sqlalchemy import text
from orchestrator.dashboard.chart_factory import charts_functions
import decimal

class BarChart:
    async def get_data(self, metrics_data):
        database = metrics_data.database
        async_session = await charts_functions.check_db(database)
        session = async_session()
        try:
            table_name, table_schema = metrics_data.table, metrics_data.schema
            viztype = 'bar'
            resp = dict()
            resp['viztype'] = viztype
            column_labels = dict()
            if metrics_data.type == 'Query':
                user_query = metrics_data.user_query
                if 'join' not in user_query.lower():
                    resp['query'] = await charts_functions.get_not_join_query(user_query, metrics_data.organization_id)
                else:
                    resp['query'] = await charts_functions.get_join_query(user_query, metrics_data.organization_id)
                print('QUERY GENERATED: ',resp['query'])
            else:
                queries = metrics_data.params.queries
                # As there is only one queries, so taken the first element - to avoid looping
                q = queries[0]
                metrics = q.metrics
                filters = q.filters
                orderby = q.orderby
                order_descending = q.order_descending
                row_limit = q.row_limit

                # taking group_by columns and storing in list
                grp_by_col = []  # group_by column details in dictionary {'name':'','label':''}

                # Return False, if there is no x-axis - as x-axis mandatory for bar chart
                if not metrics_data.params.form_data.x_axis:
                    return {"status": False, "message": "x axis missing", "data": []}

                time_grain = dict()
                if metrics_data.params.form_data.time_grain:
                    time_grain['column'] = metrics_data.params.form_data.x_axis.name
                    time_grain['column_label'] = metrics_data.params.form_data.x_axis.label
                    time_grain['granularity'] = metrics_data.params.form_data.time_grain

                if not time_grain:
                    grp_by_col.append(metrics_data.params.form_data.x_axis)

                if metrics_data.params.form_data.groupby:
                    groupbyCol = metrics_data.params.form_data.groupby
                    for cols in groupbyCol:
                        if cols.name:
                            if not cols.label:
                                cols.label = cols.name
                            grp_by_col.append(cols)
                            column_labels[cols.name] = cols.label

                # Gather metric column and its label
                if metrics:
                    for met in  metrics:
                        if not met.label:
                            met.label = met.column.column_name
                        column_labels[met.column.column_name] = met.label

                # Gather x axis column and its label
                if not metrics_data.params.form_data.x_axis.label:
                    metrics_data.params.form_data.x_axis.label = metrics_data.params.form_data.x_axis.name
                column_labels[metrics_data.params.form_data.x_axis.name] = metrics_data.params.form_data.x_axis.label

                # Default query mode
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
                    viztype, table_name, table_schema, metrics, filters, grp_by_col, query_mode, orderbyColumn,time_grain=time_grain, rowlimit=row_limit
                )

            # keeping default status and data
            resp['status'] = True
            resp['data'] = []
            resp['x_axis'] = metrics_data.params.form_data.x_axis
            x_axis_time_format = metrics_data.params.form_data.x_axis.time_format
            x_axis_sorting = not metrics_data.params.form_data.x_axis.sort_ascending
            query_ = resp['query']
            query_results = await session.execute(text(query_))

            # Get columns from the query
            column_names = query_results.keys()

            # Get x-axis name for sorting
            x_axis = metrics_data.params.form_data.x_axis.name if not metrics_data.params.form_data.x_axis.label else metrics_data.params.form_data.x_axis.label
            if metrics_data.type == 'Query':
                x_axis = list(column_names)[0]

            # Get x-axis name only if the time format is provided - because in x-axis other type of column may also present
            x_axis_name = metrics_data.params.form_data.x_axis.label if x_axis_time_format else None

            # Gather column configs information
            column_config = metrics_data.params.form_data.column_config

            # Number formatting
            column_number_formatting = await charts_functions.list_column_configs(column_labels,column_config)

            # Symbol formatting
            symbol_formatting = await charts_functions.list_symbol_formats(column_labels,column_config)

            # Variable to store formatted data
            final_list = []

            # Looping each data for formatting
            for row in query_results.fetchall():
                row_dict = dict(zip(column_names, row))
                if x_axis_name and x_axis_name in row_dict:
                    row_dict[x_axis_name] = await charts_functions.timestamp_formatting(row_dict[x_axis_name],
                                                                                        x_axis_time_format)
                if column_number_formatting:
                    for column in column_number_formatting:
                        row_dict[column['name']] = await charts_functions.number_formatting(
                            row_dict[column['name']],
                            column['type']
                        )
                if symbol_formatting:
                    for sym in symbol_formatting:
                        row_dict[sym['name']] = await charts_functions.add_symbol_format(
                            row_dict[sym['name']],
                            sym['type'].symbol_position,
                            sym['type'].symbol
                        )
                final_list.append(row_dict)

            sorted_data = sorted(final_list, key=lambda x: x[x_axis],reverse=x_axis_sorting)
            resp['data'] = sorted_data
            return resp
        except Exception as e:
            return {"status": False, "message": str(e), "data": []}
        finally:
            await session.close()
