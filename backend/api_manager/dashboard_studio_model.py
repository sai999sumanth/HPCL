import typing
import datetime
import ipaddress
import fastapi
import pydantic
import shutil
import os
import urdhva_base.postgresmodel
import urdhva_base.queryparams
import urdhva_base.types
import dashboard_studio_enum

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import *
from sqlalchemy.orm import *
from urdhva_base.postgresmodel import UrdhvaPostgresBase


class salesFiltersCreate(pydantic.BaseModel):
    key: str
    cond: typing.Optional[str] = pydantic.Field("", **{})
    value: typing.Optional[typing.List[str]] = pydantic.Field("", **{})


class currencyFormatInternalCreate(pydantic.BaseModel):
    symbol_position: typing.Optional[str] = pydantic.Field("", **{})
    symbol: typing.Optional[str] = pydantic.Field("", **{})


class ColumnConfigCreate(pydantic.BaseModel):
    column_name: typing.Optional[str] = pydantic.Field("", **{})
    d3_number_format: typing.Optional[str] = pydantic.Field("", **{})
    currency_format: typing.Optional[currencyFormatInternalCreate] | None = None


class TagsCreate(pydantic.BaseModel):
    name: typing.Optional[str] = pydantic.Field("", **{})
    value: typing.Optional[str] = pydantic.Field("", **{})


class columnInternalMCreate(pydantic.BaseModel):
    column_name: str
    type: str


class columnInternalCreate(pydantic.BaseModel):
    column_name: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[str] = pydantic.Field("", **{})


class filtersInternalCreate(pydantic.BaseModel):
    col: str
    op: str
    val: typing.List[str]


class columnsInternalCreate(pydantic.BaseModel):
    column_type: str
    sql_expression: str
    label: typing.Optional[str] = pydantic.Field("", **{})
    expression_type: typing.Optional[str] = pydantic.Field("", **{})


class metricsInternalCreate(pydantic.BaseModel):
    expression_type: typing.Optional[str] = pydantic.Field("", **{})
    column: columnInternalMCreate
    aggregate: str
    label: typing.Optional[str] = pydantic.Field("", **{})


class orderbyInternalCreate(pydantic.BaseModel):
    order_by: typing.Optional[bool] = pydantic.Field(False, )
    expression_type: typing.Optional[str] = pydantic.Field("", **{})
    column: columnInternalMCreate
    aggregate: str
    label: typing.Optional[str] = pydantic.Field("", **{})


class groupbyInternalCreate(pydantic.BaseModel):
    name: typing.Optional[str] = pydantic.Field("", **{})
    label: typing.Optional[str] = pydantic.Field("", **{})


class x_axisInternalCreate(pydantic.BaseModel):
    name: typing.Optional[str] = pydantic.Field("", **{})
    label: typing.Optional[str] = pydantic.Field("", **{})
    sort_ascending: typing.Optional[bool] = pydantic.Field(False, )
    time_format: typing.Optional[str] = pydantic.Field("", **{})


class queriesInternalCreate(pydantic.BaseModel):
    filters: typing.List[filtersInternalCreate]
    metrics: typing.List[metricsInternalCreate]
    orderby: typing.List[orderbyInternalCreate]
    row_limit: typing.Optional[int] = pydantic.Field(0, **{})
    series_columns: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    series_limit: typing.Optional[int] = pydantic.Field(0, **{})
    order_descending: bool


class form_dataInternalCreate(pydantic.BaseModel):
    x_axis: typing.Optional[x_axisInternalCreate] | None = None
    time_grain: typing.Optional[str] = pydantic.Field("", **{})
    groupby: typing.Optional[typing.List[groupbyInternalCreate]] | None = None
    query_mode: typing.Optional[str] = pydantic.Field("", **{})
    show_legend: typing.Optional[bool] = pydantic.Field(False, )
    column_config: typing.Optional[typing.List[ColumnConfigCreate]] | None = None


class ChartsParamsCreate(pydantic.BaseModel):
    queries: typing.List[queriesInternalCreate]
    form_data: form_dataInternalCreate


class filtered_keysCreate(pydantic.BaseModel):
    cloud_account_id: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    region_name: typing.Optional[str] = pydantic.Field("", **{})
    component: typing.Optional[str] = pydantic.Field("", **{})


class WidgetFiltersCreate(pydantic.BaseModel):
    key: str = pydantic.Field(**{'pattern': '^[a-zA-Z0-9_.\\-=" ]+$'})
    cond: str
    value: typing.Optional[str] = pydantic.Field("", **{'pattern': '^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$'})
    val: typing.Optional[str] = pydantic.Field("", **{'pattern': '^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$'})


class ChartsSchema(UrdhvaPostgresBase):
    __tablename__ = 'charts'
    
    connection_id: Mapped[typing.Optional[str]] = mapped_column("connection_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    database: Mapped[typing.Optional[str]] = mapped_column("database", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    schema: Mapped[typing.Optional[str]] = mapped_column("schema", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    table: Mapped[str] = mapped_column("table", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    organization_id: Mapped[int] = mapped_column("organization_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    visualization_name: Mapped[str] = mapped_column("visualization_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[str] = mapped_column("name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    description: Mapped[typing.Optional[str]] = mapped_column("description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    params: Mapped[typing.Any] = mapped_column("params", JSONB, index=False, nullable=False, default=None, primary_key=False, unique=False)
    tags: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("tags", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    group_id: Mapped[typing.Optional[int]] = mapped_column("group_id", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    group_name: Mapped[typing.Optional[str]] = mapped_column("group_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    type: Mapped[typing.Optional[typing.Any]] = mapped_column("type", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    user_query: Mapped[typing.Optional[str]] = mapped_column("user_query", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    user_ai_text: Mapped[typing.Optional[str]] = mapped_column("user_ai_text", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_by: Mapped[typing.Optional[str]] = mapped_column("created_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_user: Mapped[typing.Optional[str]] = mapped_column("created_user", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    hashed_value: Mapped[typing.Optional[str]] = mapped_column("hashed_value", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class ChartsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'charts'
    
    connection_id: typing.Optional[str] = pydantic.Field("", **{})
    database: typing.Optional[str] = pydantic.Field("", **{})
    schema: typing.Optional[str] = pydantic.Field("", **{})
    table: str
    organization_id: int
    visualization_name: str
    name: str
    description: typing.Optional[str] = pydantic.Field("", **{})
    params: ChartsParamsCreate
    tags: typing.Optional[typing.List[TagsCreate]] | None = None
    group_id: typing.Optional[int] = pydantic.Field(0, **{})
    group_name: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[dashboard_studio_enum.Types] | None = None
    user_query: typing.Optional[str] = pydantic.Field("", **{})
    user_ai_text: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    hashed_value: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'charts'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ChartsSchema
        upsert_keys = []


class Charts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'charts'
    
    connection_id: typing.Optional[str] = pydantic.Field("", **{})
    database: typing.Optional[str] = pydantic.Field("", **{})
    schema: typing.Optional[str] = pydantic.Field("", **{})
    table: typing.Optional[str] | None = None
    organization_id: typing.Optional[int] | None = None
    visualization_name: typing.Optional[str] | None = None
    name: typing.Optional[str] | None = None
    description: typing.Optional[str] = pydantic.Field("", **{})
    params: typing.Optional[ChartsParamsCreate] | None = None
    tags: typing.Optional[typing.List[TagsCreate]] | None = None
    group_id: typing.Optional[int] = pydantic.Field(0, **{})
    group_name: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[dashboard_studio_enum.Types] | None = None
    user_query: typing.Optional[str] = pydantic.Field("", **{})
    user_ai_text: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    hashed_value: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'charts'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ChartsSchema
        upsert_keys = []


class ChartsGetResp(pydantic.BaseModel):
    data: typing.List[Charts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Charts_Get_TablesParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'ge': 1, 'le': 1000000})
    database: str
    schema: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_ColumnsParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'ge': 1, 'le': 1000000})
    database: str
    schema: str
    table: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_Unique_ValuesParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'ge': 1, 'le': 1000000})
    database: str
    schema: str
    table: str
    column: typing.List[str]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Drill_Down_DataParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'ge': 1, 'le': 1000000})
    database: str
    schema: str
    table: str
    filter_mapping: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )
    limit: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Dashboard_ChartsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_Dashboard_Chart_FormParams(pydantic.BaseModel):
    unique_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_Distinct_ValuesParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'ge': 1, 'le': 1000000})
    schema: str
    table: str
    column: typing.List[str]
    where_cond: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_Product_ValuesParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'le': 1000000})
    schema: str
    table: str
    column: typing.List[str]
    where_cond: typing.Optional[typing.List[dict]] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Generate_Dynamic_Chart_QueryParams(pydantic.BaseModel):
    query_context: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Save_ChartsParams(pydantic.BaseModel):
    connection_id: typing.Optional[str] = pydantic.Field("", **{})
    record_id: typing.Optional[int] = pydantic.Field(0, **{})
    database: typing.Optional[str] = pydantic.Field("", **{})
    schema: typing.Optional[str] = pydantic.Field("", **{})
    table: str
    organization_id: int
    visualization_name: str
    name: str
    description: typing.Optional[str] = pydantic.Field("", **{})
    params: ChartsParamsCreate
    tags: typing.Optional[typing.List[TagsCreate]] | None = None
    group_id: typing.Optional[int] = pydantic.Field(0, **{})
    group_name: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[dashboard_studio_enum.Types] | None = None
    user_query: typing.Optional[str] = pydantic.Field("", **{})
    user_ai_text: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    hashed_value: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_Time_RangeParams(pydantic.BaseModel):
    text: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_Auto_Complete_TextParams(pydantic.BaseModel):
    prompt: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Connection_Vault_RoutingParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'ge': 1, 'le': 1000000})
    action: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_Creds_DetailsParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'ge': 1, 'le': 1000000})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Get_SchemaParams(pydantic.BaseModel):
    connection_id: typing.Optional[int] = pydantic.Field(0, **{'ge': 1, 'le': 1000000})
    database: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Generate_Vis_DataParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    action: str
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})
    resp_format: typing.Optional[str] = pydantic.Field("", **{'pattern': '^([a-zA-Z0-9_. ]+|)$'})
    resp_level: typing.Optional[str] = pydantic.Field("", **{})
    payload: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Enable_Cross_FilterParams(pydantic.BaseModel):
    filters: typing.List[WidgetFiltersCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Generate_Embedded_UrlParams(pydantic.BaseModel):
    dash_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Previous_Present_Month_SalesParams(pydantic.BaseModel):
    cross_filters: typing.Optional[typing.List[salesFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})
    sort_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Sales_Drop_DownParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[salesFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Previous_Present_Month_Sales_By_ProductParams(pydantic.BaseModel):
    cross_filters: typing.Optional[typing.List[salesFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})
    sort_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Charts_Previous_Present_Month_Amount_LitresParams(pydantic.BaseModel):
    cross_filters: typing.Optional[typing.List[salesFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})
    sort_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class DashboardOrderInternalCreate(pydantic.BaseModel):
    dashboard_id: int
    display_name: typing.Optional[str] = pydantic.Field("", **{})


class CurrencyformInternalCreate(pydantic.BaseModel):
    symbol_position: typing.Optional[str] = pydantic.Field("", **{})
    symbol: typing.Optional[str] = pydantic.Field("", **{})


class ColumnConfigInternalCreate(pydantic.BaseModel):
    column_name: typing.Optional[str] = pydantic.Field("", **{})
    d3_number_format: typing.Optional[str] = pydantic.Field("", **{})
    currency_format: typing.Optional[CurrencyformInternalCreate] | None = None


class TagsInternalCreate(pydantic.BaseModel):
    name: typing.Optional[str] = pydantic.Field("", **{})
    value: typing.Optional[str] = pydantic.Field("", **{})


class dashboard_filter_internalCreate(pydantic.BaseModel):
    column: typing.Optional[str] = pydantic.Field("", **{})
    op: typing.Optional[str] = pydantic.Field("", **{})
    val: typing.Optional[str] = pydantic.Field("", **{})
    cond: typing.Optional[str] = pydantic.Field("", **{})


class chart_layoutCreate(pydantic.BaseModel):
    w: typing.Optional[int] = pydantic.Field(0, **{})
    h: typing.Optional[int] = pydantic.Field(0, **{})
    x: typing.Optional[int] = pydantic.Field(0, **{})
    y: typing.Optional[int] = pydantic.Field(0, **{})
    i: typing.Optional[str] = pydantic.Field("", **{})
    moved: typing.Optional[bool] = pydantic.Field(False, )
    static: typing.Optional[bool] = pydantic.Field(False, )


class OrderByInternalCreate(pydantic.BaseModel):
    order_by: typing.Optional[bool] = pydantic.Field(False, )
    expression_type: typing.Optional[str] = pydantic.Field("", **{})
    column: typing.Optional[columnInternalCreate] | None = None
    aggregate: typing.Optional[str] = pydantic.Field("", **{})
    label: typing.Optional[str] = pydantic.Field("", **{})


class FiltersInternalCreate(pydantic.BaseModel):
    col: typing.Optional[str] = pydantic.Field("", **{})
    op: typing.Optional[str] = pydantic.Field("", **{})
    val: typing.Optional[typing.List[str]] = pydantic.Field("", **{})


class ColumnInternalCreate(pydantic.BaseModel):
    column_name: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[str] = pydantic.Field("", **{})


class MetricsInternalCreate(pydantic.BaseModel):
    expression_type: typing.Optional[str] = pydantic.Field("", **{})
    column: typing.Optional[ColumnInternalCreate] | None = None
    aggregate: typing.Optional[str] = pydantic.Field("", **{})
    label: typing.Optional[str] = pydantic.Field("", **{})


class xAxisInternalCreate(pydantic.BaseModel):
    name: typing.Optional[str] = pydantic.Field("", **{})
    label: typing.Optional[str] = pydantic.Field("", **{})


class GroupByCreate(pydantic.BaseModel):
    name: typing.Optional[str] = pydantic.Field("", **{})
    label: typing.Optional[str] = pydantic.Field("", **{})


class formDataInternalCreate(pydantic.BaseModel):
    x_axis: typing.Optional[xAxisInternalCreate] | None = None
    groupby: typing.Optional[typing.List[GroupByCreate]] | None = None
    order_descending: typing.Optional[bool] = pydantic.Field(False, )
    row_limit: typing.Optional[int] = pydantic.Field(0, **{})
    show_legend: typing.Optional[bool] = pydantic.Field(False, )
    column_config: typing.Optional[typing.List[ColumnConfigInternalCreate]] | None = None


class QueriesInternalCreate(pydantic.BaseModel):
    filters: typing.Optional[typing.List[FiltersInternalCreate]] | None = None
    metrics: typing.Optional[typing.List[MetricsInternalCreate]] | None = None
    orderby: typing.Optional[typing.List[OrderByInternalCreate]] | None = None
    row_limit: typing.Optional[int] = pydantic.Field(0, **{})
    series_columns: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    series_limit: typing.Optional[int] = pydantic.Field(0, **{})
    order_descending: typing.Optional[bool] = pydantic.Field(False, )


class ParamsInternalCreate(pydantic.BaseModel):
    queries: typing.Optional[typing.List[QueriesInternalCreate]] | None = None
    form_data: typing.Optional[formDataInternalCreate] | None = None


class chartRequestInternalCreate(pydantic.BaseModel):
    connection_id: typing.Optional[str] = pydantic.Field("", **{})
    database: typing.Optional[str] = pydantic.Field("", **{})
    schema: typing.Optional[str] = pydantic.Field("", **{})
    table: typing.Optional[str] = pydantic.Field("", **{})
    organization_id: typing.Optional[int] = pydantic.Field(0, **{})
    visualization_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    description: typing.Optional[str] = pydantic.Field("", **{})
    params: typing.Optional[ParamsInternalCreate] | None = None
    tags: typing.Optional[typing.List[TagsInternalCreate]] | None = None
    group_id: typing.Optional[int] = pydantic.Field(0, **{})
    group_name: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[dashboard_studio_enum.Types] | None = None
    user_query: typing.Optional[str] = pydantic.Field("", **{})
    user_ai_text: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    hashed_value: typing.Optional[str] = pydantic.Field("", **{})


class chartCloudDataCreate(pydantic.BaseModel):
    cloud_account_name: typing.Optional[str] = pydantic.Field("", **{})
    cloud_account_id: typing.Optional[int] = pydantic.Field(0, **{})


class chartDataInternalCreate(pydantic.BaseModel):
    chart_type: typing.Optional[str] = pydantic.Field("", **{})
    chart_request: typing.Optional[chartRequestInternalCreate] | None = None
    show_legend: typing.Optional[bool] = pydantic.Field(False, )
    legend_orientation: typing.Optional[str] = pydantic.Field("", **{})
    legend_type: typing.Optional[str] = pydantic.Field("", **{})
    show_label_lines: typing.Optional[bool] = pydantic.Field(False, )


class chart_widgetCreate(pydantic.BaseModel):
    
    name: typing.Optional[str] = pydantic.Field("", **{})
    metric: typing.Optional[str] = pydantic.Field("", **{})
    value: typing.Optional[int] = pydantic.Field(0, **{})
    dataset: typing.Optional[str] = pydantic.Field("", **{})
    data: typing.Optional[str] = pydantic.Field("", **{})
    viz_type: typing.Optional[str] = pydantic.Field("", **{})
    x: typing.Optional[int] = pydantic.Field(0, **{})
    y: typing.Optional[int] = pydantic.Field(0, **{})
    w: typing.Optional[int] = pydantic.Field(0, **{})
    h: typing.Optional[int] = pydantic.Field(0, **{})
    i: typing.Optional[str] = pydantic.Field("", **{})
    chart_data: typing.Optional[chartDataInternalCreate] | None = None


class DashBoardsSchema(UrdhvaPostgresBase):
    __tablename__ = 'dash_boards'
    
    dashboard_title: Mapped[str] = mapped_column("dashboard_title", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    charts: Mapped[typing.Optional[typing.List[int]]] = mapped_column("charts", ARRAY(Integer), index=False, nullable=True, default=0, primary_key=False, unique=False)
    changed_by: Mapped[typing.Optional[str]] = mapped_column("changed_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_by: Mapped[str] = mapped_column("created_by", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    created_user: Mapped[typing.Optional[str]] = mapped_column("created_user", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    organization_id: Mapped[int] = mapped_column("organization_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    widgets: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("widgets", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    layout: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("layout", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    assigned_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("assigned_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    roles: Mapped[typing.Optional[typing.List[str]]] = mapped_column("roles", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    dashboard_filter: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("dashboard_filter", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    dashboard_status: Mapped[typing.Optional[typing.Any]] = mapped_column("dashboard_status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    group_id: Mapped[typing.Optional[typing.List[int]]] = mapped_column("group_id", ARRAY(Integer), index=False, nullable=True, default=0, primary_key=False, unique=False)
    group_name: Mapped[typing.Optional[typing.List[str]]] = mapped_column("group_name", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    tags: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("tags", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)


class DashBoardsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'dash_boards'
    
    dashboard_title: str
    charts: typing.Optional[typing.List[int]] = pydantic.Field(0, **{})
    changed_by: typing.Optional[str] = pydantic.Field("", **{})
    created_by: str
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    organization_id: int
    widgets: typing.Optional[typing.List[chart_widgetCreate]] | None = None
    layout: typing.Optional[typing.List[chart_layoutCreate]] | None = None
    assigned_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    roles: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    dashboard_filter: typing.Optional[typing.List[dashboard_filter_internalCreate]] | None = None
    dashboard_status: typing.Optional[dashboard_studio_enum.DashboardStatus] | None = None
    group_id: typing.Optional[typing.List[int]] = pydantic.Field(0, **{})
    group_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    tags: typing.Optional[typing.List[TagsInternalCreate]] | None = None

    class Config:
        collection_name = 'dashboards'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DashBoardsSchema
        upsert_keys = []


class DashBoards(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'dash_boards'
    
    dashboard_title: typing.Optional[str] | None = None
    charts: typing.Optional[typing.List[int]] = pydantic.Field(0, **{})
    changed_by: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] | None = None
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    organization_id: typing.Optional[int] | None = None
    widgets: typing.Optional[typing.List[chart_widgetCreate]] | None = None
    layout: typing.Optional[typing.List[chart_layoutCreate]] | None = None
    assigned_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    roles: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    dashboard_filter: typing.Optional[typing.List[dashboard_filter_internalCreate]] | None = None
    dashboard_status: typing.Optional[dashboard_studio_enum.DashboardStatus] | None = None
    group_id: typing.Optional[typing.List[int]] = pydantic.Field(0, **{})
    group_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    tags: typing.Optional[typing.List[TagsInternalCreate]] | None = None

    class Config:
        collection_name = 'dashboards'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DashBoardsSchema
        upsert_keys = []


class DashBoardsGetResp(pydantic.BaseModel):
    data: typing.List[DashBoards]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Dashboards_Save_DashboardsParams(pydantic.BaseModel):
    record_id: typing.Optional[int] = pydantic.Field(0, **{})
    dashboard_title: str
    charts: typing.List[int]
    changed_by: typing.Optional[str] = pydantic.Field("", **{})
    created_by: str
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    widgets: typing.Optional[typing.List[chart_widgetCreate]] | None = None
    layout: typing.Optional[typing.List[chart_layoutCreate]] | None = None
    assigned_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    roles: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    dashboard_filter: typing.Optional[typing.List[dashboard_filter_internalCreate]] | None = None
    dashboard_status: typing.Optional[dashboard_studio_enum.DashboardStatus] | None = None
    organization_id: int
    group_id: typing.Optional[typing.List[int]] = pydantic.Field(0, **{})
    group_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    tags: typing.Optional[typing.List[TagsInternalCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dashboards_Get_Dashboard_DetailsParams(pydantic.BaseModel):
    organization_id: int
    name: typing.Optional[str] = pydantic.Field("", **{})
    value: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dashboards_Get_Dashboard_GroupsParams(pydantic.BaseModel):
    organization_id: int
    group_id: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dashboards_Get_Dashboard_UriParams(pydantic.BaseModel):
    dashboard_name: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class GroupsSchema(UrdhvaPostgresBase):
    __tablename__ = 'groups'
    
    name: Mapped[str] = mapped_column("name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    description: Mapped[typing.Optional[str]] = mapped_column("description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_by: Mapped[typing.Optional[str]] = mapped_column("created_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_user: Mapped[typing.Optional[str]] = mapped_column("created_user", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    organization_id: Mapped[int] = mapped_column("organization_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)


class GroupsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'groups'
    
    name: str
    description: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    organization_id: int

    class Config:
        collection_name = 'groups'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = GroupsSchema
        upsert_keys = []


class Groups(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'groups'
    
    name: typing.Optional[str] | None = None
    description: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    organization_id: typing.Optional[int] | None = None

    class Config:
        collection_name = 'groups'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = GroupsSchema
        upsert_keys = []


class GroupsGetResp(pydantic.BaseModel):
    data: typing.List[Groups]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class GroupOrderCreate(pydantic.BaseModel):
    group_id: int
    group_order: int


class DashboardOrderCreate(pydantic.BaseModel):
    dashboard_id: typing.Optional[int] = pydantic.Field(0, **{})
    display_name: typing.Optional[str] = pydantic.Field("", **{})


class DashboardGroupsSchema(UrdhvaPostgresBase):
    __tablename__ = 'dashboard_groups'
    
    name: Mapped[str] = mapped_column("name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    description: Mapped[typing.Optional[str]] = mapped_column("description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_by: Mapped[typing.Optional[str]] = mapped_column("created_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_user: Mapped[typing.Optional[str]] = mapped_column("created_user", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dashboard_order: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("dashboard_order", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    group_order: Mapped[typing.Optional[int]] = mapped_column("group_order", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    organization_id: Mapped[int] = mapped_column("organization_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)


class DashboardGroupsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'dashboard_groups'
    
    name: str
    description: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    dashboard_order: typing.Optional[typing.List[DashboardOrderCreate]] | None = None
    group_order: typing.Optional[int] = pydantic.Field(0, **{})
    organization_id: int

    class Config:
        collection_name = 'dashboard_groups'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DashboardGroupsSchema
        upsert_keys = []


class DashboardGroups(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'dashboard_groups'
    
    name: typing.Optional[str] | None = None
    description: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    dashboard_order: typing.Optional[typing.List[DashboardOrderCreate]] | None = None
    group_order: typing.Optional[int] = pydantic.Field(0, **{})
    organization_id: typing.Optional[int] | None = None

    class Config:
        collection_name = 'dashboard_groups'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DashboardGroupsSchema
        upsert_keys = []


class DashboardGroupsGetResp(pydantic.BaseModel):
    data: typing.List[DashboardGroups]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Dashboardgroups_Update_Dashboard_GroupsParams(pydantic.BaseModel):
    record_id: int
    name: str
    description: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    dashboard_order: typing.Optional[typing.List[DashboardOrderCreate]] | None = None
    group_order: typing.Optional[int] = pydantic.Field(0, **{})
    organization_id: int

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dashboardgroups_Update_Dashboard_Group_OrderParams(pydantic.BaseModel):
    group_orders: typing.List[GroupOrderCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class AITextsSchema(UrdhvaPostgresBase):
    __tablename__ = 'ai_texts'
    
    ai_texts: Mapped[str] = mapped_column("ai_texts", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class AITextsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'ai_texts'
    
    ai_texts: str

    class Config:
        collection_name = 'ai_texts'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = AITextsSchema
        upsert_keys = []


class AITexts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'ai_texts'
    
    ai_texts: typing.Optional[str] | None = None

    class Config:
        collection_name = 'ai_texts'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = AITextsSchema
        upsert_keys = []


class AITextsGetResp(pydantic.BaseModel):
    data: typing.List[AITexts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Solarpanelcleaning_Get_Solar_Dashboard_SummaryParams(pydantic.BaseModel):
    bu: str
    action: str
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    is_download: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class SolarPanelWetDryCleaningSchema(UrdhvaPostgresBase):
    __tablename__ = 'solar_panel_wet_dry_cleaning'
    
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location: Mapped[str] = mapped_column("location", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cleaning_type: Mapped[str] = mapped_column("cleaning_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    frequency: Mapped[int] = mapped_column("frequency", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    last_cleaning_date: Mapped[str] = mapped_column("last_cleaning_date", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cleaning_date: Mapped[str] = mapped_column("cleaning_date", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    panel_status: Mapped[typing.Optional[typing.Any]] = mapped_column("panel_status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)


class SolarPanelWetDryCleaningCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'solar_panel_wet_dry_cleaning'
    
    bu: str
    sap_id: str
    location: str
    zone: str
    cleaning_type: str
    frequency: int
    last_cleaning_date: str
    cleaning_date: str
    panel_status: typing.Optional[dashboard_studio_enum.panel_status] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SolarPanelWetDryCleaningSchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'location', 'zone']
        access_key_mapping = ['bu', 'zone', 'location', 'sap_id']


class SolarPanelWetDryCleaning(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'solar_panel_wet_dry_cleaning'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    location: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    cleaning_type: typing.Optional[str] | None = None
    frequency: typing.Optional[int] | None = None
    last_cleaning_date: typing.Optional[str] | None = None
    cleaning_date: typing.Optional[str] | None = None
    panel_status: typing.Optional[dashboard_studio_enum.panel_status] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SolarPanelWetDryCleaningSchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'location', 'zone']
        access_key_mapping = ['bu', 'zone', 'location', 'sap_id']


class SolarPanelWetDryCleaningGetResp(pydantic.BaseModel):
    data: typing.List[SolarPanelWetDryCleaning]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Solarpanelwetdrycleaning_Create_Solar_Panel_Cleaning_RecordParams(pydantic.BaseModel):
    bu: str
    sap_id: str
    location: str
    zone: str
    cleaning_type: str
    cleaning_date: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Solarpanelwetdrycleaning_Get_Last_Cleaning_DateParams(pydantic.BaseModel):
    bu: str
    sap_id: str
    location: str
    zone: str
    cleaning_type: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Solarpanelwetdrycleaning_Get_Panel_StatusParams(pydantic.BaseModel):
    bu: str
    sap_id: str
    location: str
    zone: str
    cleaning_type: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Solarpanelwetdrycleaning_Get_Pending_Completed_CountsParams(pydantic.BaseModel):
    cleaning_type: str
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Solarpanelwetdrycleaning_Get_All_Dry_Wet_Cleaning_RecordsParams(pydantic.BaseModel):
    cleaning_type: str
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class HistoricSolarPanelWetDryCleaningCreateSchema(UrdhvaPostgresBase):
    __tablename__ = 'historic_solar_panel_wet_dry_cleaning_create'
    
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location: Mapped[str] = mapped_column("location", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cleaning_type: Mapped[str] = mapped_column("cleaning_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    frequency: Mapped[int] = mapped_column("frequency", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    last_cleaning_date: Mapped[str] = mapped_column("last_cleaning_date", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cleaning_date: Mapped[str] = mapped_column("cleaning_date", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    panel_status: Mapped[typing.Optional[typing.Any]] = mapped_column("panel_status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)


class HistoricSolarPanelWetDryCleaningCreateCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'historic_solar_panel_wet_dry_cleaning_create'
    
    bu: str
    sap_id: str
    location: str
    zone: str
    cleaning_type: str
    frequency: int
    last_cleaning_date: str
    cleaning_date: str
    panel_status: typing.Optional[dashboard_studio_enum.panel_status] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricSolarPanelWetDryCleaningCreateSchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'location', 'zone']
        access_key_mapping = ['bu', 'zone', 'location', 'sap_id']


class HistoricSolarPanelWetDryCleaningCreate(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'historic_solar_panel_wet_dry_cleaning_create'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    location: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    cleaning_type: typing.Optional[str] | None = None
    frequency: typing.Optional[int] | None = None
    last_cleaning_date: typing.Optional[str] | None = None
    cleaning_date: typing.Optional[str] | None = None
    panel_status: typing.Optional[dashboard_studio_enum.panel_status] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricSolarPanelWetDryCleaningCreateSchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'location', 'zone']
        access_key_mapping = ['bu', 'zone', 'location', 'sap_id']


class HistoricSolarPanelWetDryCleaningCreateGetResp(pydantic.BaseModel):
    data: typing.List[HistoricSolarPanelWetDryCleaningCreate]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class SolarGenerationSummarySchema(UrdhvaPostgresBase):
    __tablename__ = 'solar_generation_summary'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    source_id: Mapped[str] = mapped_column("source_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    source_name: Mapped[typing.Optional[str]] = mapped_column("source_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    source_type: Mapped[typing.Optional[str]] = mapped_column("source_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    timestamp_ist: Mapped[str] = mapped_column("timestamp_ist", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    capacity_kw: Mapped[typing.Optional[str]] = mapped_column("capacity_kw", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    solar_generation_kwh: Mapped[str] = mapped_column("solar_generation_kwh", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    solar_generation_hrs: Mapped[str] = mapped_column("solar_generation_hrs", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    solar_start_time: Mapped[str] = mapped_column("solar_start_time", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    solar_end_time: Mapped[str] = mapped_column("solar_end_time", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    solar_window_hrs: Mapped[str] = mapped_column("solar_window_hrs", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    solar_generation_hrs_day: Mapped[typing.Optional[str]] = mapped_column("solar_generation_hrs_day", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class SolarGenerationSummaryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'solar_generation_summary'
    
    bu: str
    sap_id: str
    location_name: str
    zone: str
    source_id: str
    source_name: typing.Optional[str] = pydantic.Field("", **{})
    source_type: typing.Optional[str] = pydantic.Field("", **{})
    timestamp_ist: str
    capacity_kw: typing.Optional[str] = pydantic.Field("", **{})
    solar_generation_kwh: str
    solar_generation_hrs: str
    solar_start_time: str
    solar_end_time: str
    solar_window_hrs: str
    solar_generation_hrs_day: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SolarGenerationSummarySchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'location_name', 'zone', 'source_id']
        access_key_mapping = ['bu', 'zone', 'location_name', 'sap_id', 'source_id']


class SolarGenerationSummary(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'solar_generation_summary'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    source_id: typing.Optional[str] | None = None
    source_name: typing.Optional[str] = pydantic.Field("", **{})
    source_type: typing.Optional[str] = pydantic.Field("", **{})
    timestamp_ist: typing.Optional[str] | None = None
    capacity_kw: typing.Optional[str] = pydantic.Field("", **{})
    solar_generation_kwh: typing.Optional[str] | None = None
    solar_generation_hrs: typing.Optional[str] | None = None
    solar_start_time: typing.Optional[str] | None = None
    solar_end_time: typing.Optional[str] | None = None
    solar_window_hrs: typing.Optional[str] | None = None
    solar_generation_hrs_day: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SolarGenerationSummarySchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'location_name', 'zone', 'source_id']
        access_key_mapping = ['bu', 'zone', 'location_name', 'sap_id', 'source_id']


class SolarGenerationSummaryGetResp(pydantic.BaseModel):
    data: typing.List[SolarGenerationSummary]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class SolarOutageSummarySchema(UrdhvaPostgresBase):
    __tablename__ = 'solar_outage_summary'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    source_id: Mapped[str] = mapped_column("source_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    source_name: Mapped[typing.Optional[str]] = mapped_column("source_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    source_type: Mapped[typing.Optional[str]] = mapped_column("source_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    capacity_kw: Mapped[typing.Optional[str]] = mapped_column("capacity_kw", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    grid_freq: Mapped[str] = mapped_column("grid_freq", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    timestamp_ist: Mapped[str] = mapped_column("timestamp_ist", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    solar_outage_hrs: Mapped[str] = mapped_column("solar_outage_hrs", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    outage_start_time: Mapped[str] = mapped_column("outage_start_time", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    outage_end_time: Mapped[str] = mapped_column("outage_end_time", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    solar_outage_hrs_day: Mapped[typing.Optional[str]] = mapped_column("solar_outage_hrs_day", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class SolarOutageSummaryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'solar_outage_summary'
    
    bu: str
    sap_id: str
    location_name: str
    zone: str
    source_id: str
    source_name: typing.Optional[str] = pydantic.Field("", **{})
    source_type: typing.Optional[str] = pydantic.Field("", **{})
    capacity_kw: typing.Optional[str] = pydantic.Field("", **{})
    grid_freq: str
    timestamp_ist: str
    solar_outage_hrs: str
    outage_start_time: str
    outage_end_time: str
    solar_outage_hrs_day: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SolarOutageSummarySchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'location_name', 'zone', 'source_id']
        access_key_mapping = ['bu', 'zone', 'location_name', 'sap_id', 'source_id']


class SolarOutageSummary(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'solar_outage_summary'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    source_id: typing.Optional[str] | None = None
    source_name: typing.Optional[str] = pydantic.Field("", **{})
    source_type: typing.Optional[str] = pydantic.Field("", **{})
    capacity_kw: typing.Optional[str] = pydantic.Field("", **{})
    grid_freq: typing.Optional[str] | None = None
    timestamp_ist: typing.Optional[str] | None = None
    solar_outage_hrs: typing.Optional[str] | None = None
    outage_start_time: typing.Optional[str] | None = None
    outage_end_time: typing.Optional[str] | None = None
    solar_outage_hrs_day: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SolarOutageSummarySchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'location_name', 'zone', 'source_id']
        access_key_mapping = ['bu', 'zone', 'location_name', 'sap_id', 'source_id']


class SolarOutageSummaryGetResp(pydantic.BaseModel):
    data: typing.List[SolarOutageSummary]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class SolarPlantCapacitySchema(UrdhvaPostgresBase):
    __tablename__ = 'solar_plant_capacity'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    capacity_kw: Mapped[str] = mapped_column("capacity_kw", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    monitoring: Mapped[str] = mapped_column("monitoring", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    doc: Mapped[typing.Optional[str]] = mapped_column("doc", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ref_marking: Mapped[typing.Optional[str]] = mapped_column("ref_marking", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    net_metering: Mapped[typing.Optional[str]] = mapped_column("net_metering", String, index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(sap_id, capacity_kw, name="solar_plant_capacity_sap_id_capacity_kw"),)


class SolarPlantCapacityCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'solar_plant_capacity'
    
    bu: str
    sap_id: str
    location_name: str
    zone: str
    capacity_kw: str
    monitoring: str
    doc: typing.Optional[str] = pydantic.Field("", **{})
    ref_marking: typing.Optional[str] = pydantic.Field("", **{})
    net_metering: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SolarPlantCapacitySchema
        upsert_keys = ['sap_id', 'capacity_kw']
        search_fields = ['bu', 'sap_id', 'location_name', 'zone']
        access_key_mapping = ['bu', 'zone', 'location_name', 'sap_id']


class SolarPlantCapacity(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'solar_plant_capacity'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    capacity_kw: typing.Optional[str] | None = None
    monitoring: typing.Optional[str] | None = None
    doc: typing.Optional[str] = pydantic.Field("", **{})
    ref_marking: typing.Optional[str] = pydantic.Field("", **{})
    net_metering: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SolarPlantCapacitySchema
        upsert_keys = ['sap_id', 'capacity_kw']
        search_fields = ['bu', 'sap_id', 'location_name', 'zone']
        access_key_mapping = ['bu', 'zone', 'location_name', 'sap_id']


class SolarPlantCapacityGetResp(pydantic.BaseModel):
    data: typing.List[SolarPlantCapacity]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Solarplantcapacity_Upload_Solar_Plant_CapacityParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields