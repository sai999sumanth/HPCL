Model columnInternal internal{
    column_name str
    type str
}

Model filtersInternal internal{
    col str
    op str
    val list str
}

Model columnsInternal internal{
    columnType str
    sqlExpression str
    label str
    expressionType str
}

Model metricsInternal internal{
    expressionType str
    column columnInternal
    aggregate str
    label str
}

Model orderbyInternal internal {
    order_by optional bool
    expressionType str
    column columnInternal
    aggregate str
    label str
}

Model x_axisInternal internal{
    column_name optional str
    sort_ascending optional bool
}

Model queriesInternal internal{
    filters list filtersInternal
    columns list columnsInternal
    metrics list metricsInternal
    orderby list orderbyInternal
    row_limit optional int
    series_columns optional list str
    series_limit optional int
    order_descending bool
}

Model form_dataInternal internal{    
    x_axis optional x_axisInternal  
    metrics optional list str
    groupby list str
    order_descending optional bool
    row_limit optional int
    show_legend optional bool
}

Model AlgoChartsInternal internal{
    queries list queriesInternal
    form_data form_dataInternal
}

Model AlgoCharts{
    database str
    schema str
    table str
    visualization_name str
    name str
    description optional str
    params AlgoChartsInternal

    Action=> get_tables {
        database str
        schema str
    }
    Action=> get_columns {
        database str
        schema str
        table str
    }
    Action=> get_unique_values {
        database str
        schema str
        table str
        column list str
    }
    
    Config=> {
        collection_name=algo_charts
    }
}
