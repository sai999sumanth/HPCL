class MultiDBWidgetQueryGenerator:
    def __init__(self, db_connector):
        """
        Initialize with a database connector instance.
        :param db_connector: An instance of a derived DBConnector (MySQL, Postgres, MSSQL).
        """
        self.db_connector = db_connector

    def generate_query(self, widget_type: str, x_axis: str, y_axis: str = None, filters: dict = None):
        """
        Generate a query for a specific widget type.
        :param widget_type: Type of widget (e.g., 'pie', 'bar', 'area').
        :param x_axis: Column for grouping or categorization.
        :param y_axis: Column for aggregation (optional for pie charts).
        :param filters: Conditions to apply (e.g., {"column": "value"}).
        :return: Query string for the target database.
        """
        filters_clause = self.db_connector.generate_filter_clause(filters)

        if widget_type == "pie":
            return self._generate_pie_query(x_axis, y_axis, filters_clause)
        elif widget_type == "bar":
            return self._generate_bar_query(x_axis, y_axis, filters_clause)
        elif widget_type == "area":
            return self._generate_area_query(x_axis, y_axis, filters_clause)
        else:
            raise ValueError(f"Unsupported widget type: {widget_type}")

    def _generate_pie_query(self, x_axis, y_axis, filters_clause):
        if not y_axis:
            y_axis = "COUNT(*)"
        return f"""
        SELECT {x_axis}, {y_axis} AS value
        FROM {self.db_connector.table_name}
        {filters_clause}
        GROUP BY {x_axis}
        """

    def _generate_bar_query(self, x_axis, y_axis, filters_clause):
        return f"""
        SELECT {x_axis}, SUM({y_axis}) AS value
        FROM {self.db_connector.table_name}
        {filters_clause}
        GROUP BY {x_axis}
        ORDER BY {x_axis}
        """

    def _generate_area_query(self, x_axis, y_axis, filters_clause):
        return f"""
        SELECT {x_axis}, SUM({y_axis}) AS value
        FROM {self.db_connector.table_name}
        {filters_clause}
        GROUP BY {x_axis}
        ORDER BY {x_axis}
        """
