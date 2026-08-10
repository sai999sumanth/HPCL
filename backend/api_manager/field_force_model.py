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
import field_force_enum

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import *
from sqlalchemy.orm import *
from urdhva_base.postgresmodel import UrdhvaPostgresBase


class WidgetFiltersCreate(pydantic.BaseModel):
    key: str
    cond: str
    value: typing.Optional[str] = pydantic.Field("", **{})
    values: typing.Optional[typing.List[str]] = pydantic.Field("", **{})


class LevelFilterCreate(pydantic.BaseModel):
    level: typing.Optional[str] = pydantic.Field("", **{'pattern': '^(sales_area|region|zone|plant|dealer)$'})


class DrillFilterCreate(pydantic.BaseModel):
    drill_to: typing.Optional[str] = pydantic.Field("", **{'pattern': '^(locations|dealers|outlets|dealer_tank)$'})


class Indentmanagement_Get_Indents_By_Product_VolumeParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    level_filter: typing.Optional[LevelFilterCreate] | None = None
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Pending_Vs_Executed_IndentsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    level_filter: typing.Optional[LevelFilterCreate] | None = None
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Cancelled_IndentsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    level_filter: typing.Optional[LevelFilterCreate] | None = None
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Dtp_Dealers_CountParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Top_Dtp_CustomersParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    sales_cutoff_kl: typing.Optional[float] = pydantic.Field(0.0, **{})
    top_count: typing.Optional[int] = pydantic.Field(10, **{})
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Dct_Indents_By_Product_VolumeParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    level_filter: typing.Optional[LevelFilterCreate] | None = None
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Trucks_Failed_To_ReportParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Tpt_Indents_Vs_AvailabilityParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Indents_DetailsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    level_filter: typing.Optional[LevelFilterCreate] | None = None
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_R3_R1_DetailsParams(pydantic.BaseModel):
    action: str
    drill_state: str
    filters: typing.List[WidgetFiltersCreate]
    cross_filters: typing.List[WidgetFiltersCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentmanagement_Get_Indent_DetailsParams(pydantic.BaseModel):
    bu: typing.Optional[str] = pydantic.Field("", **{})
    table_data: typing.Optional[bool] = pydantic.Field(False, )
    action: str
    filters: typing.List[WidgetFiltersCreate]
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    skip: typing.Optional[int] = pydantic.Field(0, **{})
    limit: typing.Optional[int] = pydantic.Field(20, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dryoutmanagement_Get_Dry_Out_LocationsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    by_product: typing.Optional[bool] = pydantic.Field(False, )
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dryoutmanagement_Get_Dry_Out_Indent_AnalysisParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dryoutmanagement_Get_Dry_Out_IndentsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dryoutmanagement_Get_Retail_Outlet_StockoutsParams(pydantic.BaseModel):
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


class Dryoutmanagement_Get_Loss_Of_Sales_VolumeParams(pydantic.BaseModel):
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


class Nozzle_Sales_Stock_Stock_AvailabilityParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzle_Sales_Stock_Tank_UtilizationParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzle_Sales_Stock_Nozzle_Sales_AnalysisParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzle_Sales_Stock_Nozzle_Sales_ComparisonParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzle_Sales_Stock_Nozzle_Sales_Prev_Day_ComparisonParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzle_Sales_Stock_Product_Availability_DaysParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    level_filter: typing.Optional[LevelFilterCreate] | None = None
    action: str
    drill_state: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tankinventory_Stock_AvailabilityParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tankinventory_Tank_UtilizationParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_Nozzle_Sales_By_ProductParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_Nozzle_Sales_Day_ComparisonParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_Product_PerformanceParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_Degrading_OutletsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_Top_Degrading_DealersParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    top_count: typing.Optional[int] = pydantic.Field(10, **{})
    by_product: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_High_Risk_OutletsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_Zero_Sales_OutletsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    period: typing.Optional[str] = pydantic.Field("", **{'pattern': '^(1_week|15_days|1_month)$'})
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_Outlets_By_Degrowth_GroupParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Get_Power_Sales_Growth_LocationsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    top_count: typing.Optional[int] = pydantic.Field(10, **{})
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Nozzle_Sales_AnalysisParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Nozzle_Sales_ComparisonParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Nozzlesales_Nozzle_Sales_TmtParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    level_filter: typing.Optional[LevelFilterCreate] | None = None
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    segregation: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ms_products: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    hsd_products: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    action: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Retailsales_Get_Sales_By_ProductParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Retailsales_Get_Lubes_Arb_ComparisonParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    drill_filter: typing.Optional[DrillFilterCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Retailsales_Get_Lube_Sales_ComparisonParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Retailsales_Get_Sales_ComparisonParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    comparison_type: str = pydantic.Field(**{'pattern': '^(yesterday|mtd|ytd|historical)$'})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Retailsales_Get_Volume_TrackingParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dealermanagement_Get_Last_TransactionsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    transaction_count: typing.Optional[int] = pydantic.Field(20, **{})
    dealer_specific: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dealermanagement_Get_Retail_Ledger_TransactionsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    transaction_count: typing.Optional[int] = pydantic.Field(20, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dealermanagement_Get_Total_Outstanding_DuesParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dealermanagement_Get_Top_Outstanding_DealersParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    top_count: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dealermanagement_Get_Outstanding_By_Days_GroupParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dealermanagement_Get_Dealer_Outstanding_TableParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dealermanagement_Get_Outstanding_DetailsParams(pydantic.BaseModel):
    data: WidgetFiltersCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dealermanagement_Get_Outstanding_DealersParams(pydantic.BaseModel):
    data: WidgetFiltersCreate
    top_count: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields