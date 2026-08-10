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
import ingestion_api_enum

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import *
from sqlalchemy.orm import *
from urdhva_base.postgresmodel import UrdhvaPostgresBase


class GeoCordinatesCreate(pydantic.BaseModel):
    latitude: str
    longitude: str


class vtsDataCreate(pydantic.BaseModel):
    vendor_id: str
    location_id: str
    location_type: str
    tl_number: str
    report_duration: str
    scheduled_trip_start_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_trip_end_datetime: typing.Optional[datetime.datetime] | None = None
    total_trips: typing.Optional[int] = pydantic.Field(0, **{})
    stoppage_violations_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count: typing.Optional[int] = pydantic.Field(0, **{})
    speed_violation_count: typing.Optional[int] = pydantic.Field(0, **{})
    main_supply_removal_count: typing.Optional[int] = pydantic.Field(0, **{})
    night_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    no_halt_zone_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_offline_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_tamper_count: typing.Optional[int] = pydantic.Field(0, **{})
    continuous_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    approved_by: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    data_reprocessed: typing.Optional[bool] = pydantic.Field(False, )
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    destination_name: typing.Optional[str] = pydantic.Field("", **{})


class VtsEventDataCreate(pydantic.BaseModel):
    vendor_id: str
    location_id: str
    location_type: str
    tt_number: str
    event_id: str
    report_duration: typing.Optional[str] = pydantic.Field("", **{})
    event_start_time: typing.Optional[datetime.datetime] | None = None
    event_end_time: typing.Optional[datetime.datetime] | None = None
    event_start_location: typing.Optional[str] = pydantic.Field("", **{})
    event_end_location: typing.Optional[str] = pydantic.Field("", **{})
    coordinates: typing.Optional[GeoCordinatesCreate] | None = None
    distance: typing.Optional[str] = pydantic.Field("", **{})
    total_trips: typing.Optional[int] = pydantic.Field(0, **{})
    stoppage_violations_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count: typing.Optional[int] = pydantic.Field(0, **{})
    speed_violation_count: typing.Optional[int] = pydantic.Field(0, **{})
    main_supply_removal_count: typing.Optional[int] = pydantic.Field(0, **{})
    night_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    no_halt_zone_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_offline_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_tamper_count: typing.Optional[int] = pydantic.Field(0, **{})
    continuous_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    approved_by: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    transporter: typing.Optional[str] = pydantic.Field("", **{})
    data_reprocessed: typing.Optional[bool] = pydantic.Field(False, )
    is_valid: typing.Optional[bool] = pydantic.Field(False, )
    unique_id: typing.Optional[int] = pydantic.Field(0, **{})
    alert: typing.Optional[str] = pydantic.Field("", **{})


class VtsTripDataCreate(pydantic.BaseModel):
    vendor_id: str
    location_id: str
    location_type: str
    tt_number: str
    trip_start_time: typing.Optional[datetime.datetime] | None = None
    trip_end_time: typing.Optional[datetime.datetime] | None = None
    distance: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    transporter: typing.Optional[str] = pydantic.Field("", **{})


class vtsDataUpdatedCreate(pydantic.BaseModel):
    alert_id: str
    zone: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    terminal_code: typing.Optional[str] = pydantic.Field("", **{})
    trip_status: typing.Optional[str] = pydantic.Field("", **{})
    truck_regno: str
    violation_type: str
    threshold_limit: typing.Optional[str] = pydantic.Field("", **{})
    unit: typing.Optional[str] = pydantic.Field("", **{})
    min_violation_count: typing.Optional[str] = pydantic.Field("", **{})
    max_violation_count: typing.Optional[str] = pydantic.Field("", **{})
    trip_alert_count: typing.Optional[str] = pydantic.Field("", **{})
    violation_count: typing.Optional[str] = pydantic.Field("", **{})
    shortage_in_trip: typing.Optional[str] = pydantic.Field("", **{})
    cumulative_duration: typing.Optional[str] = pydantic.Field("", **{})
    trip_type: typing.Optional[str] = pydantic.Field("", **{})
    active: typing.Optional[str] = pydantic.Field("", **{})
    approval_status: typing.Optional[str] = pydantic.Field("", **{})
    start_location: typing.Optional[str] = pydantic.Field("", **{})
    end_location: typing.Optional[str] = pydantic.Field("", **{})
    distance: typing.Optional[str] = pydantic.Field("", **{})
    duration: typing.Optional[str] = pydantic.Field("", **{})
    from_date: typing.Optional[str] = pydantic.Field("", **{})
    to_date: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[str] = pydantic.Field("", **{})
    longitude: typing.Optional[str] = pydantic.Field("", **{})
    endlatitude: typing.Optional[str] = pydantic.Field("", **{})
    endlongitude: typing.Optional[str] = pydantic.Field("", **{})


class vtsBlockedTruckOldCreate(pydantic.BaseModel):
    alert_id: str
    alert_type: str
    action_type: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    rca_reason: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    truck_regno: typing.Optional[str] = pydantic.Field("", **{})
    without_shortage_count: typing.Optional[str] = pydantic.Field("", **{})
    with_shortage_count: typing.Optional[str] = pydantic.Field("", **{})
    first_blocked_days: typing.Optional[str] = pydantic.Field("", **{})
    second_blocked_days: typing.Optional[str] = pydantic.Field("", **{})
    third_blocked_days: typing.Optional[str] = pydantic.Field("", **{})
    active: typing.Optional[bool] = pydantic.Field(False, )
    approval_status: typing.Optional[str] = pydantic.Field("", **{})
    blocked_datetime: typing.Optional[str] = pydantic.Field("", **{})
    unblocked_datetime: typing.Optional[str] = pydantic.Field("", **{})


class VtsTripNotClosedCreate(pydantic.BaseModel):
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    event_date: typing.Optional[datetime.datetime] | None = None
    zone: typing.Optional[str] = pydantic.Field("", **{})
    location_code: typing.Optional[str] = pydantic.Field("", **{})
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_number: typing.Optional[str] = pydantic.Field("", **{})
    transporter_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    invoice_no: typing.Optional[str] = pydantic.Field("", **{})
    trip_id: typing.Optional[str] = pydantic.Field("", **{})
    load_no: typing.Optional[str] = pydantic.Field("", **{})
    route_no: typing.Optional[str] = pydantic.Field("", **{})
    driver_name: typing.Optional[str] = pydantic.Field("", **{})
    scheduled_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_end_datetime: typing.Optional[datetime.datetime] | None = None
    vehicle_latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_location: typing.Optional[str] = pydantic.Field("", **{})


class VtsTripWithoutRouteCreate(pydantic.BaseModel):
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    event_date: typing.Optional[datetime.datetime] | None = None
    zone: typing.Optional[str] = pydantic.Field("", **{})
    location_code: typing.Optional[str] = pydantic.Field("", **{})
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_number: typing.Optional[str] = pydantic.Field("", **{})
    transporter_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    invoice_no: typing.Optional[str] = pydantic.Field("", **{})
    trip_id: typing.Optional[str] = pydantic.Field("", **{})
    load_no: typing.Optional[str] = pydantic.Field("", **{})
    driver_name: typing.Optional[str] = pydantic.Field("", **{})
    scheduled_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_end_datetime: typing.Optional[datetime.datetime] | None = None


class VtsRouteTwoKmCreate(pydantic.BaseModel):
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    event_start_datetime: typing.Optional[datetime.datetime] | None = None
    event_end_datetime: typing.Optional[datetime.datetime] | None = None
    zone: typing.Optional[str] = pydantic.Field("", **{})
    location_code: typing.Optional[str] = pydantic.Field("", **{})
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_number: typing.Optional[str] = pydantic.Field("", **{})
    transporter_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    invoice_no: typing.Optional[str] = pydantic.Field("", **{})
    trip_id: typing.Optional[str] = pydantic.Field("", **{})
    load_no: typing.Optional[str] = pydantic.Field("", **{})
    route_no: typing.Optional[str] = pydantic.Field("", **{})
    driver_name: typing.Optional[str] = pydantic.Field("", **{})
    scheduled_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_end_datetime: typing.Optional[datetime.datetime] | None = None
    vehicle_latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_location: typing.Optional[str] = pydantic.Field("", **{})


class VtsUnauthStoppageCreate(pydantic.BaseModel):
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    event_date: typing.Optional[datetime.datetime] | None = None
    zone: typing.Optional[str] = pydantic.Field("", **{})
    location_code: typing.Optional[str] = pydantic.Field("", **{})
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_number: typing.Optional[str] = pydantic.Field("", **{})
    transporter_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    invoice_no: typing.Optional[str] = pydantic.Field("", **{})
    trip_id: typing.Optional[str] = pydantic.Field("", **{})
    load_no: typing.Optional[str] = pydantic.Field("", **{})
    driver_name: typing.Optional[str] = pydantic.Field("", **{})
    scheduled_datetime: typing.Optional[datetime.datetime] | None = None
    vehicle_latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_location: typing.Optional[str] = pydantic.Field("", **{})


class vtsBlockedTruckCreate(pydantic.BaseModel):
    tt_no: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    transporter_code: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_blocked_desc: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_blocked_start_date: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_blocked_end_date: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_blocked_instance_no: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_blocked_instance_type: typing.Optional[str] = pydantic.Field("", **{})
    alert_type: typing.Optional[str] = pydantic.Field("", **{})


class Ongoingtripsvts_Trip_Not_ClosedParams(pydantic.BaseModel):
    data: typing.List[VtsTripNotClosedCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ongoingtripsvts_Trip_Without_RouteParams(pydantic.BaseModel):
    data: typing.List[VtsTripWithoutRouteCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ongoingtripsvts_Route_Deviation_More_Than_Two_KmParams(pydantic.BaseModel):
    data: typing.List[VtsRouteTwoKmCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ongoingtripsvts_Trip_Unauthorised_StoppageParams(pydantic.BaseModel):
    data: typing.List[VtsUnauthStoppageCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Vts_Ingest_DataParams(pydantic.BaseModel):
    data: typing.List[vtsDataCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Vts_Ingest_Event_DataParams(pydantic.BaseModel):
    data: typing.List[VtsEventDataCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Vts_Ingest_Trip_DataParams(pydantic.BaseModel):
    data: typing.List[VtsEventDataCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Vts_Ingest_Data_Blocked_TrucksParams(pydantic.BaseModel):
    vendor_id: str
    location_id: str
    location_type: typing.Optional[ingestion_api_enum.BusinessUnit] | None = None
    data: typing.List[vtsBlockedTruckCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Vts_Ingest_Data_Un_Blocked_TrucksParams(pydantic.BaseModel):
    vendor_id: str
    location_id: str
    location_type: typing.Optional[ingestion_api_enum.BusinessUnit] | None = None
    data: typing.List[vtsBlockedTruckCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class vaDataCreate(pydantic.BaseModel):
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    alert_timestamp: typing.Optional[str] = pydantic.Field("", **{})
    alert_type: str
    alert_description: typing.Optional[str] = pydantic.Field("", **{})
    device_id: str
    video_url: typing.Optional[str] = pydantic.Field("", **{})


class vaScoreCreate(pydantic.BaseModel):
    overall_score: typing.Optional[str] = pydantic.Field("", **{})


class VA_RO_Cleanliness_MasterCreate(pydantic.BaseModel):
    ro_code: str
    ro_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})


class VA_RO_Cleanliness_Master_StatusCreate(pydantic.BaseModel):
    ro_code: str
    ro_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    upload_done: bool


class Va_Ingest_DataParams(pydantic.BaseModel):
    vendor_id: str
    location_id: str
    location_type: typing.Optional[ingestion_api_enum.BusinessUnit] | None = None
    data: typing.Optional[typing.List[vaDataCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Va_Ingest_Data_ScoreParams(pydantic.BaseModel):
    vendor_id: str
    location_id: str
    location_type: typing.Optional[ingestion_api_enum.BusinessUnit] | None = None
    data: typing.List[vaScoreCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Va_Ingest_Data_CloseParams(pydantic.BaseModel):
    alert_id: str
    status: str
    acknowledged_by: str
    closed_at: str
    action_description: typing.Optional[str] = pydantic.Field("", **{})
    action_code: typing.Optional[str] = pydantic.Field("", **{})
    action_reason: typing.Optional[str] = pydantic.Field("", **{})
    action_category: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Va_Ro_No_Video_Upload_ListParams(pydantic.BaseModel):
    data: typing.List[VA_RO_Cleanliness_MasterCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Va_Ro_No_Video_Upload_List_StatusParams(pydantic.BaseModel):
    data: typing.List[VA_RO_Cleanliness_Master_StatusCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class productsDetailsCreate(pydantic.BaseModel):
    prod_code: typing.Optional[str] = pydantic.Field("", **{})
    uom: typing.Optional[str] = pydantic.Field("", **{})
    qty: typing.Optional[str] = pydantic.Field("", **{})


class crisDataCreate(pydantic.BaseModel):
    interlock_type: str
    interlock_description: typing.Optional[str] = pydantic.Field("", **{})
    device_name: str
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    severity: typing.Optional[str] = pydantic.Field("", **{})
    alarm_id: str
    tank_id: typing.Optional[str] = pydantic.Field("", **{})
    nozzle_id: typing.Optional[str] = pydantic.Field("", **{})
    pump_no: typing.Optional[str] = pydantic.Field("", **{})
    occurrence_date: typing.Optional[str] = pydantic.Field("", **{})
    closure_date: typing.Optional[str] = pydantic.Field("", **{})
    indent_no: typing.Optional[str] = pydantic.Field("", **{})
    products: typing.Optional[typing.List[productsDetailsCreate]] | None = None


class Cris_Ingest_DataParams(pydantic.BaseModel):
    vendor_name: str
    vendor_id: str
    location_id: str
    ro_code: str
    location_type: typing.Optional[ingestion_api_enum.BusinessUnit] | None = None
    data: typing.Optional[typing.List[crisDataCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Cris_Api_AckParams(pydantic.BaseModel):
    req_no: str
    applied_on: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ims_Ingest_DataParams(pydantic.BaseModel):
    vendor_id: str
    location_id: str
    location_type: typing.Optional[ingestion_api_enum.BusinessUnit] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class emlockDataCreate(pydantic.BaseModel):
    location_id: str
    location_type: typing.Optional[ingestion_api_enum.BusinessUnit] | None = None
    vehicle_number: str
    violation_type: str
    initiated_date: str
    approved_date: typing.Optional[str] = pydantic.Field("", **{})
    approved_by: typing.Optional[str] = pydantic.Field("", **{})


class emlockVendorDataCreate(pydantic.BaseModel):
    location_type: str
    emlock_exception_id: str
    terminal_code: str
    truck_number: str
    exception_type: str
    ro_code: typing.Optional[str] = pydantic.Field("", **{})
    created_datetime: str


class Emlock_Ingest_DataParams(pydantic.BaseModel):
    vendor_id: str
    data: typing.Optional[typing.List[emlockVendorDataCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Taslistener_Get_DataParams(pydantic.BaseModel):
    input_data: dict

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class TasAgentCommStatusSchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_agent_comm_status'
    
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    message: Mapped[typing.Optional[str]] = mapped_column("message", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    opcda_status: Mapped[typing.Optional[str]] = mapped_column("opcda_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    data_receiving_status: Mapped[typing.Optional[str]] = mapped_column("data_receiving_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    configuration_healthy: Mapped[typing.Optional[str]] = mapped_column("configuration_healthy", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    last_opc_failure: Mapped[typing.Optional[str]] = mapped_column("last_opc_failure", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    last_rabbit_failure: Mapped[typing.Optional[str]] = mapped_column("last_rabbit_failure", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class TasAgentCommStatusCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_agent_comm_status'
    
    sap_id: str
    status: typing.Optional[str] = pydantic.Field("", **{})
    message: typing.Optional[str] = pydantic.Field("", **{})
    opcda_status: typing.Optional[str] = pydantic.Field("", **{})
    data_receiving_status: typing.Optional[str] = pydantic.Field("", **{})
    configuration_healthy: typing.Optional[str] = pydantic.Field("", **{})
    last_opc_failure: typing.Optional[str] = pydantic.Field("", **{})
    last_rabbit_failure: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasAgentCommStatusSchema
        upsert_keys = []


class TasAgentCommStatus(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_agent_comm_status'
    
    sap_id: typing.Optional[str] | None = None
    status: typing.Optional[str] = pydantic.Field("", **{})
    message: typing.Optional[str] = pydantic.Field("", **{})
    opcda_status: typing.Optional[str] = pydantic.Field("", **{})
    data_receiving_status: typing.Optional[str] = pydantic.Field("", **{})
    configuration_healthy: typing.Optional[str] = pydantic.Field("", **{})
    last_opc_failure: typing.Optional[str] = pydantic.Field("", **{})
    last_rabbit_failure: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasAgentCommStatusSchema
        upsert_keys = []


class TasAgentCommStatusGetResp(pydantic.BaseModel):
    data: typing.List[TasAgentCommStatus]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Tas_Location_Listener_Get_Agent_Service_StatusParams(pydantic.BaseModel):
    sap_id: str
    status: typing.Optional[str] = pydantic.Field("", **{})
    message: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tas_Location_Listener_Get_Agent_Comm_StatusParams(pydantic.BaseModel):
    sap_id: str
    status: typing.Optional[str] = pydantic.Field("", **{})
    message: typing.Optional[str] = pydantic.Field("", **{})
    opcda_status: typing.Optional[str] = pydantic.Field("", **{})
    data_receiving_status: typing.Optional[str] = pydantic.Field("", **{})
    configuration_healthy: typing.Optional[str] = pydantic.Field("", **{})
    last_opc_failure: typing.Optional[str] = pydantic.Field("", **{})
    last_rabbit_failure: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class emlockStatusDataCreate(pydantic.BaseModel):
    event_id: str
    vendor_id: str
    location_type: str
    emlock_exception_id: typing.Optional[str] = pydantic.Field("", **{})
    terminal_code: typing.Optional[str] = pydantic.Field("", **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    swipein_l1: typing.Optional[bool] = pydantic.Field(False, )
    swipein_l2: typing.Optional[bool] = pydantic.Field(False, )
    swipeout_l1: typing.Optional[bool] = pydantic.Field(False, )
    swipeout_l2: typing.Optional[bool] = pydantic.Field(False, )
    l1_id: typing.Optional[str] = pydantic.Field("", **{})
    l2_id: typing.Optional[str] = pydantic.Field("", **{})
    created_date: typing.Optional[datetime.datetime] | None = None
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})


class Emlockstatus_Ingest_DataParams(pydantic.BaseModel):
    vendor_id: str
    event_id: str
    data: typing.Optional[typing.List[emlockStatusDataCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class HyperLocalZoneSummaryCreate(pydantic.BaseModel):
    zone: str
    rating: float


class ReviewsSentimentCreate(pydantic.BaseModel):
    zone: str
    sales_area: str
    region: str
    store_code: str
    store_name: str
    reviewer_name: str
    rating: float
    review_comment: str
    tone_type: str
    review_date: datetime.datetime
    rank: int


class Hyperlocal_Ingest_DataParams(pydantic.BaseModel):
    report_date: datetime.date
    total_reviews: int
    positive_reviews: int
    negative_reviews: int
    neutral_reviews: int
    zone_summary: typing.List[HyperLocalZoneSummaryCreate]
    sentiment_of_reviews: typing.List[ReviewsSentimentCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields