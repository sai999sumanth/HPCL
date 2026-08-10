from sqlalchemy import text
from orchestrator.dashboard.chart_factory import charts_functions


class TableChart:
    async def get_data(self, metrics_data):
        database = metrics_data.database

        async_session = await charts_functions.check_db(database)
        session = async_session()
        try:
            table_name, table_schema = metrics_data.table, metrics_data.schema
            viztype='table'
            resp = dict()
            resp['viztype'] = viztype
            column_labels = dict()
            if metrics_data.type == 'Query':
                resp['query'] = metrics_data.user_query
            else:
                queries = metrics_data.params.queries
                # As there is only one queries, so taken the first element - to avoid looping
                q = queries[0]
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
                            column_labels[cols.name] = cols.label

                # Gather metric column and its label
                if metrics:
                    for met in metrics:
                        if not met.label:
                            met.label = met.column.column_name
                        column_labels[met.column.column_name] = met.label

                query_mode = 'aggregate'
                if metrics_data.params.form_data.query_mode:
                    query_mode = metrics_data.params.form_data.query_mode

                # taking orderby columns
                orderbyColumn = {'data':[],"sortbydesc":False}
                if orderby:
                    orderbyColumn['data'] = orderby
                    if order_descending:
                        orderbyColumn['sortbydesc'] = True

                # getting the query
                resp['query'] = await charts_functions.getQuery(
                    viztype, table_name, table_schema, metrics, filters, grp_by_col, query_mode, orderbyColumn, rowlimit=row_limit
                )

            # keeping default status and data
            resp['status'] = True
            resp['data'] = []

            query_ = resp['query']
            query_results = await session.execute(text(query_))

            # Get columns from the query
            column_names = query_results.keys()

            # Gather column configs information
            column_config = metrics_data.params.form_data.column_config

            # Number formatting
            column_number_formatting = await charts_functions.list_column_configs(column_labels, column_config)

            # Symbol formatting
            symbol_formatting = await charts_functions.list_symbol_formats(column_labels, column_config)

            # Variable to store formatted data
            final_list = []

            # Looping each data for formatting
            for row in query_results.fetchall():
                row_dict = dict(zip(column_names, row))
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

            resp['data'] = final_list
            return resp
        except Exception as e:
            return {"status": False, "message": str(e), "data": []}

        finally:
            await session.close()