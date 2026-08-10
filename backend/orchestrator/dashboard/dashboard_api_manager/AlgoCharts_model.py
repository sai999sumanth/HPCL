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
import AlgoCharts_enum

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import *
from sqlalchemy.orm import *
from urdhva_base.postgresmodel import UrdhvaPostgresBase


class columnInternalCreate(pydantic.BaseModel):
    column_name: str
    type: str


class filtersInternalCreate(pydantic.BaseModel):
    col: str
    op: str   
    # val: typing.Optional[typing.Union[typing.List[str],typing.List[bool],str]]
    val: typing.Optional[typing.Union[typing.List[typing.Optional[str]], typing.List[typing.Optional[bool]], str]]


class columnsInternalCreate(pydantic.BaseModel):
    column_type: str
    sql_expression: str
    label: str
    expression_type: str


class metricsInternalCreate(pydantic.BaseModel):
    expression_type: str
    column: columnInternalCreate
    aggregate: str
    label: str


class orderbyInternalCreate(pydantic.BaseModel):
    order_by: typing.Optional[bool] = pydantic.Field(False, )
    expression_type: str
    column: columnInternalCreate
    aggregate: str
    label: str

class groupbyInternalCreate(pydantic.BaseModel):
    name: str
    label: typing.Optional[str] = pydantic.Field("", **{})

class x_axisInternalCreate(pydantic.BaseModel):
    column_name: typing.Optional[str] = pydantic.Field("", **{})
    sort_ascending: typing.Optional[bool] = pydantic.Field(False, )


class queriesInternalCreate(pydantic.BaseModel):
    filters: typing.Optional[typing.List[filtersInternalCreate]]
    columns: typing.Union[typing.List[str], typing.List[typing.Dict[str, str]]]
    metrics: typing.Optional[typing.List[metricsInternalCreate]]
    orderby: typing.Optional[typing.List[orderbyInternalCreate]]
    row_limit: typing.Optional[int] = pydantic.Field(0, **{})
    series_columns: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    series_limit: typing.Optional[int] = pydantic.Field(0, **{})
    order_descending: bool


class form_dataInternalCreate(pydantic.BaseModel):
    x_axis: typing.Optional[x_axisInternalCreate] | None = None
    metrics: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    groupby: typing.List[groupbyInternalCreate]
    query_mode:  typing.Optional[str] = pydantic.Field("", **{})
    order_descending: typing.Optional[bool] = pydantic.Field(False, )
    row_limit: typing.Optional[int] = pydantic.Field(0, **{})
    show_legend: typing.Optional[bool] = pydantic.Field(False, )


class AlgoChartsInternalCreate(pydantic.BaseModel):
    queries: typing.List[queriesInternalCreate]
    form_data: form_dataInternalCreate


class AlgoChartsSchema(UrdhvaPostgresBase):
    __tablename__ = 'algo_charts'
    
    database: Mapped[str] = mapped_column("database", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    schema: Mapped[str] = mapped_column("schema", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    table: Mapped[str] = mapped_column("table", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    visualization_name: Mapped[str] = mapped_column("visualization_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[str] = mapped_column("name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    description: Mapped[typing.Optional[str]] = mapped_column("description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    params: Mapped[typing.Any] = mapped_column("params", JSONB, index=False, nullable=False, default=None, primary_key=False, unique=False) 


class AlgoChartsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'algo_charts'
    
    database: str
    schema: str
    table: str
    visualization_name: str
    name: str
    description: typing.Optional[str] = pydantic.Field("", **{})
    params: AlgoChartsInternalCreate

    class Config:
        collection_name = 'algo_charts'
        schema_class = AlgoChartsSchema


class AlgoCharts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'algo_charts'
    
    database: typing.Optional[str]
    schema: typing.Optional[str]
    table: typing.Optional[str]
    visualization_name: typing.Optional[str]
    name: typing.Optional[str]
    description: typing.Optional[str] = pydantic.Field("", **{})
    params: typing.Optional[AlgoChartsInternalCreate] | None = None

    class Config:
        collection_name = 'algo_charts'
        schema_class = AlgoChartsSchema


class AlgoChartsGetResp(pydantic.BaseModel):
    data: typing.List[AlgoCharts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Algocharts_Get_TablesParams(pydantic.BaseModel):
    database: str
    schema: str


class Algocharts_Get_ColumnsParams(pydantic.BaseModel):
    database: str
    schema: str
    table: str


class Algocharts_Get_Unique_ValuesParams(pydantic.BaseModel):
    database: str
    schema: str
    table: str
    column: typing.List[str]
