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
import hpcl_ceg_ticketing_enum

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import *
from sqlalchemy.orm import *
from urdhva_base.postgresmodel import UrdhvaPostgresBase


class Ticket_HistoryCreate(pydantic.BaseModel):
    description: typing.Optional[str] = pydantic.Field("", **{})
    processed_time: typing.Optional[str] = pydantic.Field("", **{})
    allocated_time: typing.Optional[str] = pydantic.Field("", **{})
    action_msg: typing.Optional[str] = pydantic.Field("", **{})
    action_type: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})


class Merge_HistoryCreate(pydantic.BaseModel):
    ticket_id: typing.Optional[str] = pydantic.Field("", **{})
    merge_ticket_id: typing.List[str]
    comment: typing.Optional[str] = pydantic.Field("", **{})
    processed_time: typing.Optional[str] = pydantic.Field("", **{})
    allocated_time: typing.Optional[str] = pydantic.Field("", **{})
    action_msg: typing.Optional[str] = pydantic.Field("", **{})
    action_type: typing.Optional[str] = pydantic.Field("", **{})


class TruckInfoCreate(pydantic.BaseModel):
    truck_number: str
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})


class CommentHistoryCreate(pydantic.BaseModel):
    updated_by: typing.Optional[str] = pydantic.Field("", **{})
    updated_time: typing.Optional[str] = pydantic.Field("", **{})
    ticket_msg: typing.Optional[str] = pydantic.Field("", **{})
    comments: typing.Optional[str] = pydantic.Field("", **{})


class CreatedHistoryCreate(pydantic.BaseModel):
    updated_by: typing.Optional[str] = pydantic.Field("", **{})
    updated_time: typing.Optional[str] = pydantic.Field("", **{})
    action: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    sub_category: typing.Optional[str] = pydantic.Field("", **{})


class TicketingSchema(UrdhvaPostgresBase):
    __tablename__ = 'ticketing'
    
    ticket_name: Mapped[str] = mapped_column("ticket_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ticket_id: Mapped[str] = mapped_column("ticket_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    alert_id: Mapped[typing.Optional[str]] = mapped_column("alert_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[typing.Any] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    alert_section: Mapped[typing.Optional[str]] = mapped_column("alert_section", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sop_id: Mapped[typing.Optional[str]] = mapped_column("sop_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.List[str]] = mapped_column("sap_id", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[typing.List[str]]] = mapped_column("location_name", ARRAY(String), index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[typing.List[str]]] = mapped_column("zone", ARRAY(String), index=True, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ticket_status: Mapped[typing.Any] = mapped_column("ticket_status", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    ticket_state: Mapped[typing.Any] = mapped_column("ticket_state", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    start_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("start_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    end_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("end_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    summary: Mapped[str] = mapped_column("summary", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    description: Mapped[str] = mapped_column("description", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ticket_severity: Mapped[typing.Any] = mapped_column("ticket_severity", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    assignee: Mapped[typing.Optional[typing.Any]] = mapped_column("assignee", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    reporter: Mapped[typing.Optional[str]] = mapped_column("reporter", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ticket_history: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("ticket_history", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    merge_history: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("merge_history", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    linked_alert_id: Mapped[typing.Optional[typing.List[str]]] = mapped_column("linked_alert_id", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    interlock_name: Mapped[typing.Optional[typing.List[str]]] = mapped_column("interlock_name", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    comment: Mapped[typing.Optional[str]] = mapped_column("comment", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    file_attachment: Mapped[typing.Optional[typing.List[str]]] = mapped_column("file_attachment", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    file_attachment_name: Mapped[typing.Optional[str]] = mapped_column("file_attachment_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    file_attachment_id: Mapped[typing.Optional[str]] = mapped_column("file_attachment_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    comment_text: Mapped[typing.Optional[str]] = mapped_column("comment_text", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    comment_id: Mapped[typing.Optional[str]] = mapped_column("comment_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    comment_attachment_path: Mapped[typing.Optional[str]] = mapped_column("comment_attachment_path", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    context: Mapped[typing.Optional[str]] = mapped_column("context", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    merge_status: Mapped[typing.Optional[str]] = mapped_column("merge_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    parent_id: Mapped[typing.Optional[str]] = mapped_column("parent_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    subtask_id: Mapped[typing.Optional[typing.List[str]]] = mapped_column("subtask_id", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    ticket_end_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("ticket_end_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    truck_no: Mapped[typing.Optional[typing.List[str]]] = mapped_column("truck_no", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    ticket_section: Mapped[typing.Optional[str]] = mapped_column("ticket_section", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    category: Mapped[typing.Optional[typing.List[str]]] = mapped_column("category", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    sub_category: Mapped[typing.Optional[typing.List[str]]] = mapped_column("sub_category", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    reason: Mapped[typing.Optional[str]] = mapped_column("reason", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    auto_ticket_close: Mapped[typing.Optional[str]] = mapped_column("auto_ticket_close", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    assignee_name: Mapped[typing.Optional[typing.List[str]]] = mapped_column("assignee_name", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    assignee_mail: Mapped[typing.Optional[typing.List[str]]] = mapped_column("assignee_mail", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    escalation_level: Mapped[typing.Optional[str]] = mapped_column("escalation_level", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    comment_history: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("comment_history", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    employee_id: Mapped[typing.Optional[typing.List[str]]] = mapped_column("employee_id", ARRAY(String), index=True, nullable=True, default="", primary_key=False, unique=False)
    re_assingee_employee_id: Mapped[typing.Optional[typing.List[str]]] = mapped_column("re_assingee_employee_id", ARRAY(String), index=True, nullable=True, default="", primary_key=False, unique=False)
    re_assingee_mail: Mapped[typing.Optional[typing.List[str]]] = mapped_column("re_assingee_mail", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    reassigne_due_date: Mapped[typing.Optional[str]] = mapped_column("reassigne_due_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    employee_role: Mapped[typing.Optional[typing.List[str]]] = mapped_column("employee_role", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    order_id: Mapped[typing.Optional[typing.List[str]]] = mapped_column("order_id", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(ticket_id, sap_id, name="ticketing_ticket_id_sap_id"),)


class TicketingCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'ticketing'
    
    ticket_name: str
    ticket_id: str
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: hpcl_ceg_ticketing_enum.BusinessUnit
    alert_section: typing.Optional[str] = pydantic.Field("", **{})
    sop_id: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.List[str]
    location_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    ticket_status: hpcl_ceg_ticketing_enum.Status
    ticket_state: hpcl_ceg_ticketing_enum.State
    start_date: typing.Optional[datetime.datetime] | None = None
    end_date: typing.Optional[datetime.datetime] | None = None
    summary: str
    description: str
    ticket_severity: hpcl_ceg_ticketing_enum.Severity
    assignee: typing.Optional[hpcl_ceg_ticketing_enum.Assignee] | None = None
    reporter: typing.Optional[str] = pydantic.Field("", **{})
    ticket_history: typing.Optional[typing.List[Ticket_HistoryCreate]] | None = None
    merge_history: typing.Optional[typing.List[Merge_HistoryCreate]] | None = None
    linked_alert_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    interlock_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    comment: typing.Optional[str] = pydantic.Field("", **{})
    file_attachment: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    file_attachment_name: typing.Optional[str] = pydantic.Field("", **{})
    file_attachment_id: typing.Optional[str] = pydantic.Field("", **{})
    comment_text: typing.Optional[str] = pydantic.Field("", **{})
    comment_id: typing.Optional[str] = pydantic.Field("", **{})
    comment_attachment_path: typing.Optional[str] = pydantic.Field("", **{})
    context: typing.Optional[str] = pydantic.Field("", **{})
    merge_status: typing.Optional[str] = pydantic.Field("", **{})
    parent_id: typing.Optional[str] = pydantic.Field("", **{})
    subtask_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ticket_end_date: typing.Optional[datetime.datetime] | None = None
    truck_no: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ticket_section: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sub_category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    reason: typing.Optional[str] = pydantic.Field("", **{})
    auto_ticket_close: typing.Optional[str] = pydantic.Field("", **{})
    assignee_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assignee_mail: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    escalation_level: typing.Optional[str] = pydantic.Field("", **{})
    comment_history: typing.Optional[typing.List[CommentHistoryCreate]] | None = None
    employee_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    re_assingee_employee_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    re_assingee_mail: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    reassigne_due_date: typing.Optional[str] = pydantic.Field("", **{})
    employee_role: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    order_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TicketingSchema
        upsert_keys = ['ticket_id', 'sap_id']
        search_fields = ['bu', 'sap_id', 'location_name', 'zone', 'ticket_id']


class Ticketing(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'ticketing'
    
    ticket_name: typing.Optional[str] | None = None
    ticket_id: typing.Optional[str] | None = None
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[hpcl_ceg_ticketing_enum.BusinessUnit] | None = None
    alert_section: typing.Optional[str] = pydantic.Field("", **{})
    sop_id: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[typing.List[str]] | None = None
    location_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    ticket_status: typing.Optional[hpcl_ceg_ticketing_enum.Status] | None = None
    ticket_state: typing.Optional[hpcl_ceg_ticketing_enum.State] | None = None
    start_date: typing.Optional[datetime.datetime] | None = None
    end_date: typing.Optional[datetime.datetime] | None = None
    summary: typing.Optional[str] | None = None
    description: typing.Optional[str] | None = None
    ticket_severity: typing.Optional[hpcl_ceg_ticketing_enum.Severity] | None = None
    assignee: typing.Optional[hpcl_ceg_ticketing_enum.Assignee] | None = None
    reporter: typing.Optional[str] = pydantic.Field("", **{})
    ticket_history: typing.Optional[typing.List[Ticket_HistoryCreate]] | None = None
    merge_history: typing.Optional[typing.List[Merge_HistoryCreate]] | None = None
    linked_alert_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    interlock_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    comment: typing.Optional[str] = pydantic.Field("", **{})
    file_attachment: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    file_attachment_name: typing.Optional[str] = pydantic.Field("", **{})
    file_attachment_id: typing.Optional[str] = pydantic.Field("", **{})
    comment_text: typing.Optional[str] = pydantic.Field("", **{})
    comment_id: typing.Optional[str] = pydantic.Field("", **{})
    comment_attachment_path: typing.Optional[str] = pydantic.Field("", **{})
    context: typing.Optional[str] = pydantic.Field("", **{})
    merge_status: typing.Optional[str] = pydantic.Field("", **{})
    parent_id: typing.Optional[str] = pydantic.Field("", **{})
    subtask_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ticket_end_date: typing.Optional[datetime.datetime] | None = None
    truck_no: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ticket_section: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sub_category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    reason: typing.Optional[str] = pydantic.Field("", **{})
    auto_ticket_close: typing.Optional[str] = pydantic.Field("", **{})
    assignee_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assignee_mail: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    escalation_level: typing.Optional[str] = pydantic.Field("", **{})
    comment_history: typing.Optional[typing.List[CommentHistoryCreate]] | None = None
    employee_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    re_assingee_employee_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    re_assingee_mail: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    reassigne_due_date: typing.Optional[str] = pydantic.Field("", **{})
    employee_role: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    order_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TicketingSchema
        upsert_keys = ['ticket_id', 'sap_id']
        search_fields = ['bu', 'sap_id', 'location_name', 'zone', 'ticket_id']


class TicketingGetResp(pydantic.BaseModel):
    data: typing.List[Ticketing]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Ticketing_Get_TicketParams(pydantic.BaseModel):
    ticket_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Create_TicketParams(pydantic.BaseModel):
    bu: str
    alert_section: typing.Optional[str] = pydantic.Field("", **{})
    sop_id: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.List[str]
    location_name: typing.List[str]
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    alert_type: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assignee: typing.Optional[hpcl_ceg_ticketing_enum.Assignee] | None = None
    summary: str
    description: str
    ticket_state: hpcl_ceg_ticketing_enum.State
    ticket_severity: hpcl_ceg_ticketing_enum.Severity
    comment: typing.Optional[str] = pydantic.Field("", **{})
    start_date: datetime.datetime
    file_attachment: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    file_attachment_name: typing.Optional[str] = pydantic.Field("", **{})
    file_attachment_id: typing.Optional[str] = pydantic.Field("", **{})
    linked_alert_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    parent_id: typing.Optional[str] = pydantic.Field("", **{})
    subtask_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ticket_end_date: typing.Optional[datetime.datetime] | None = None
    truck_no: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ticket_section: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sub_category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    reason: typing.Optional[str] = pydantic.Field("", **{})
    auto_ticket_close: typing.Optional[str] = pydantic.Field("", **{})
    assignee_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assignee_mail: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    reporter: typing.Optional[str] = pydantic.Field("", **{})
    escalation_level: typing.Optional[str] = pydantic.Field("", **{})
    comment_history: typing.Optional[typing.List[CommentHistoryCreate]] | None = None
    employee_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    employee_role: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    order_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Close_TicketParams(pydantic.BaseModel):
    close_id: str
    end_date: datetime.datetime

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Update_TicketParams(pydantic.BaseModel):
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sop_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    alert_section: typing.Optional[str] = pydantic.Field("", **{})
    alert_type: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assignee: typing.Optional[str] = pydantic.Field("", **{})
    summary: typing.Optional[str] = pydantic.Field("", **{})
    description: typing.Optional[str] = pydantic.Field("", **{})
    ticket_state: typing.Optional[str] = pydantic.Field("", **{})
    ticket_severity: typing.Optional[str] = pydantic.Field("", **{})
    comment: typing.Optional[str] = pydantic.Field("", **{})
    update_id: str
    linked_alert_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    parent_id: typing.Optional[str] = pydantic.Field("", **{})
    subtask_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    truck_no: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ticket_section: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sub_category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    reason: typing.Optional[str] = pydantic.Field("", **{})
    auto_ticket_close: typing.Optional[str] = pydantic.Field("", **{})
    assignee_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assignee_mail: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    reporter: typing.Optional[str] = pydantic.Field("", **{})
    comment_history: typing.Optional[typing.List[CommentHistoryCreate]] | None = None
    re_assingee_employee_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    re_assingee_mail: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    reassigne_due_date: typing.Optional[str] = pydantic.Field("", **{})
    ticket_end_date: typing.Optional[datetime.datetime] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Merge_TicketParams(pydantic.BaseModel):
    ticket_id: str
    merge_ticket_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    comment: typing.Optional[str] = pydantic.Field("", **{})
    merge_status: typing.Optional[str] = pydantic.Field("", **{})
    truck_no: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ticket_section: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Delete_TicketParams(pydantic.BaseModel):
    delete_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Attach_FileParams(pydantic.BaseModel):
    ticket_id: typing.Optional[str] = pydantic.Field("", **{})
    tid: typing.Optional[str] = pydantic.Field("", **{})
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Delete_File_AttachmentParams(pydantic.BaseModel):
    ticket_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Download_File_AttachmentParams(pydantic.BaseModel):
    ticket_id: str
    file_attachment_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Update_AssigneeParams(pydantic.BaseModel):
    ticket_id: str
    assignee_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assignee_mail: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Update_ReporterParams(pydantic.BaseModel):
    ticket_id: str
    reporter: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Update_PriorityParams(pydantic.BaseModel):
    ticket_id: str
    ticket_priority: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Add_Comment_To_TicketParams(pydantic.BaseModel):
    ticket_id: str
    comment_text: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Edit_CommentParams(pydantic.BaseModel):
    ticket_id: str
    comment_id: str
    existing_comment_text: str
    new_comment: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Delete_CommentParams(pydantic.BaseModel):
    ticket_id: str
    comment_id: str
    existing_comment_text: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Edit_DescriptionParams(pydantic.BaseModel):
    ticket_id: str
    new_description: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Delete_DescriptionParams(pydantic.BaseModel):
    ticket_id: str
    delete_existing_desctiption: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Attach_File_To_CommentParams(pydantic.BaseModel):
    ticket_id: str
    comment_id: str
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Delete_File_From_CommentParams(pydantic.BaseModel):
    ticket_id: str
    comment_id: str
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Get_Location_DataParams(pydantic.BaseModel):
    bu: typing.List[str]
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sales_area: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sap_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Vts_Block_TrucksParams(pydantic.BaseModel):
    ticket_id: str
    block_days: typing.Optional[int] = pydantic.Field(0, **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    reason: typing.Optional[str] = pydantic.Field("", **{})
    check_ticket_close: typing.Optional[bool] = pydantic.Field(False, )
    truck_info: typing.List[TruckInfoCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Process_EscalationsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Pm_OrdersParams(pydantic.BaseModel):
    planning_plant: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    end_date: typing.Optional[str] = pydantic.Field("", **{})
    search: typing.Optional[str] = pydantic.Field("", **{})
    data_required: bool
    skip: typing.Optional[int] = pydantic.Field(0, **{})
    limit: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Pm_Orders_WeeklyParams(pydantic.BaseModel):
    planning_plant: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    end_date: typing.Optional[str] = pydantic.Field("", **{})
    search: typing.Optional[str] = pydantic.Field("", **{})
    data_required: bool
    segment_type: typing.Optional[str] = pydantic.Field("", **{})
    skip: typing.Optional[int] = pydantic.Field(0, **{})
    limit: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketing_Run_Alert_CloserParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class TicketCommentSchema(UrdhvaPostgresBase):
    __tablename__ = 'ticket_comment'
    
    ticket_id: Mapped[str] = mapped_column("ticket_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    created_by: Mapped[str] = mapped_column("created_by", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    content: Mapped[str] = mapped_column("content", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    documents: Mapped[typing.Optional[typing.List[str]]] = mapped_column("documents", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    update_history: Mapped[typing.Optional[typing.List[str]]] = mapped_column("update_history", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)


class TicketCommentCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'ticket_comment'
    
    ticket_id: str
    created_by: str
    content: str
    documents: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    update_history: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TicketCommentSchema
        upsert_keys = []


class TicketComment(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'ticket_comment'
    
    ticket_id: typing.Optional[str] | None = None
    created_by: typing.Optional[str] | None = None
    content: typing.Optional[str] | None = None
    documents: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    update_history: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TicketCommentSchema
        upsert_keys = []


class TicketCommentGetResp(pydantic.BaseModel):
    data: typing.List[TicketComment]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Ticketcomment_Add_Comment_To_TicketParams(pydantic.BaseModel):
    ticket_id: str
    content: str
    documents: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketcomment_Edit_CommentParams(pydantic.BaseModel):
    ticket_id: str
    content: str
    comment_id: str
    documents: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketcomment_Delete_CommentParams(pydantic.BaseModel):
    ticket_id: str
    comment_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketcomment_Attach_File_To_CommentParams(pydantic.BaseModel):
    ticket_id: str
    comment_id: str
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Ticketcomment_Download_AttachmentParams(pydantic.BaseModel):
    ticket_id: str
    file_attachment_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class TicketUserMailsSchema(UrdhvaPostgresBase):
    __tablename__ = 'ticket_user_mails'
    
    level: Mapped[typing.Optional[str]] = mapped_column("level", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    role: Mapped[str] = mapped_column("role", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    employee_name: Mapped[typing.Optional[str]] = mapped_column("employee_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    email_id: Mapped[typing.Optional[str]] = mapped_column("email_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    employee_id: Mapped[typing.Optional[str]] = mapped_column("employee_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class TicketUserMailsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'ticket_user_mails'
    
    level: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    role: str
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    employee_name: typing.Optional[str] = pydantic.Field("", **{})
    email_id: typing.Optional[str] = pydantic.Field("", **{})
    employee_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TicketUserMailsSchema
        upsert_keys = []


class TicketUserMails(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'ticket_user_mails'
    
    level: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    role: typing.Optional[str] | None = None
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    employee_name: typing.Optional[str] = pydantic.Field("", **{})
    email_id: typing.Optional[str] = pydantic.Field("", **{})
    employee_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TicketUserMailsSchema
        upsert_keys = []


class TicketUserMailsGetResp(pydantic.BaseModel):
    data: typing.List[TicketUserMails]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Ticketusermails_Get_Ticket_MailsParams(pydantic.BaseModel):
    sap_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.List[str]
    category: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class AlertCategoryMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'alert_category_master'
    
    category: Mapped[typing.Optional[typing.List[str]]] = mapped_column("category", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    sub_category: Mapped[typing.Optional[typing.List[str]]] = mapped_column("sub_category", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_on: Mapped[typing.Optional[datetime.datetime]] = mapped_column("created_on", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    updated_on: Mapped[typing.Optional[datetime.datetime]] = mapped_column("updated_on", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    created_by: Mapped[typing.Optional[str]] = mapped_column("created_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_history: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("created_history", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)


class AlertCategoryMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'alert_category_master'
    
    category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sub_category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    created_on: typing.Optional[datetime.datetime] | None = None
    updated_on: typing.Optional[datetime.datetime] | None = None
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_history: typing.Optional[typing.List[CreatedHistoryCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = AlertCategoryMasterSchema
        upsert_keys = []


class AlertCategoryMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'alert_category_master'
    
    category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sub_category: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    created_on: typing.Optional[datetime.datetime] | None = None
    updated_on: typing.Optional[datetime.datetime] | None = None
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_history: typing.Optional[typing.List[CreatedHistoryCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = AlertCategoryMasterSchema
        upsert_keys = []


class AlertCategoryMasterGetResp(pydantic.BaseModel):
    data: typing.List[AlertCategoryMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Alertcategorymaster_Add_CategoryParams(pydantic.BaseModel):
    category: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alertcategorymaster_Add_Sub_CategoryParams(pydantic.BaseModel):
    sub_category: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alertcategorymaster_Delete_CategoryParams(pydantic.BaseModel):
    category: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alertcategorymaster_Delete_Sub_CategoryParams(pydantic.BaseModel):
    sub_category: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields