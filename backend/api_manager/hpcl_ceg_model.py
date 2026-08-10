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
import hpcl_ceg_enum

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import *
from sqlalchemy.orm import *
from urdhva_base.postgresmodel import UrdhvaPostgresBase


class RoleMapperCreate(pydantic.BaseModel):
    menu_name: str
    allowed_sub_menus: typing.Optional[typing.List[str]] = pydantic.Field("", **{})


class RolesSchema(UrdhvaPostgresBase):
    __tablename__ = 'roles'
    
    name: Mapped[str] = mapped_column("name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    status: Mapped[bool] = mapped_column("status", Boolean, index=False, nullable=False, default=None, primary_key=False, unique=False)
    allowed_pages: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("allowed_pages", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    bu: Mapped[typing.Optional[typing.List[str]]] = mapped_column("bu", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(name, name="roles_name"),)


class RolesCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'roles'
    
    name: str
    status: bool
    allowed_pages: typing.Optional[typing.List[RoleMapperCreate]] | None = None
    bu: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = RolesSchema
        upsert_keys = ['name']


class Roles(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'roles'
    
    name: typing.Optional[str] | None = None
    status: typing.Optional[bool] | None = None
    allowed_pages: typing.Optional[typing.List[RoleMapperCreate]] | None = None
    bu: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = RolesSchema
        upsert_keys = ['name']


class RolesGetResp(pydantic.BaseModel):
    data: typing.List[Roles]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Roles_Create_RoleParams(pydantic.BaseModel):
    name: str
    allowed_pages: typing.Optional[typing.List[RoleMapperCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Roles_Update_Role_StatusParams(pydantic.BaseModel):
    enable: bool
    role_name: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Roles_Create_Role_UiParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Roles_Delete_Role_UiParams(pydantic.BaseModel):
    role_name: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Roles_Get_Menu_Submenu_DetailsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Roles_Get_All_PagesParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class UserLoginAuditSchema(UrdhvaPostgresBase):
    __tablename__ = 'user_login_audit'
    
    employee_id: Mapped[str] = mapped_column("employee_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    email: Mapped[str] = mapped_column("email", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    role: Mapped[str] = mapped_column("role", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    login_id: Mapped[str] = mapped_column("login_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    login_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("login_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    logout_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("logout_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    login_status: Mapped[typing.Optional[typing.Any]] = mapped_column("login_status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    failure_reason: Mapped[typing.Optional[str]] = mapped_column("failure_reason", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    auth_method: Mapped[str] = mapped_column("auth_method", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    user_agent: Mapped[typing.Optional[str]] = mapped_column("user_agent", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class UserLoginAuditCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'user_login_audit'
    
    employee_id: str
    email: str
    role: str
    login_id: str
    login_time: typing.Optional[datetime.datetime] | None = None
    logout_time: typing.Optional[datetime.datetime] | None = None
    login_status: typing.Optional[hpcl_ceg_enum.LoginStatus] | None = None
    failure_reason: typing.Optional[str] = pydantic.Field("", **{})
    auth_method: str
    user_agent: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = UserLoginAuditSchema
        upsert_keys = []


class UserLoginAudit(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'user_login_audit'
    
    employee_id: typing.Optional[str] | None = None
    email: typing.Optional[str] | None = None
    role: typing.Optional[str] | None = None
    login_id: typing.Optional[str] | None = None
    login_time: typing.Optional[datetime.datetime] | None = None
    logout_time: typing.Optional[datetime.datetime] | None = None
    login_status: typing.Optional[hpcl_ceg_enum.LoginStatus] | None = None
    failure_reason: typing.Optional[str] = pydantic.Field("", **{})
    auth_method: typing.Optional[str] | None = None
    user_agent: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = UserLoginAuditSchema
        upsert_keys = []


class UserLoginAuditGetResp(pydantic.BaseModel):
    data: typing.List[UserLoginAudit]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Userloginaudit_Fetch_Login_AuditParams(pydantic.BaseModel):
    search_string: typing.Optional[str] = pydantic.Field("", **{})
    limit: typing.Optional[int] = pydantic.Field(100, **{})
    skip: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class UsersSchema(UrdhvaPostgresBase):
    __tablename__ = 'users'
    
    username: Mapped[str] = mapped_column("username", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    email: Mapped[str] = mapped_column("email", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    first_name: Mapped[str] = mapped_column("first_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    last_name: Mapped[str] = mapped_column("last_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    password: Mapped[typing.Optional[urdhva_base.types.Secret]] = mapped_column("password", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    employee_id: Mapped[str] = mapped_column("employee_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    employee_number: Mapped[typing.Optional[str]] = mapped_column("employee_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[typing.List[typing.Any]] = mapped_column("bu", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.List[str]] = mapped_column("sap_id", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    system_role: Mapped[typing.List[str]] = mapped_column("system_role", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    novex_role: Mapped[typing.List[str]] = mapped_column("novex_role", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[typing.Optional[typing.List[str]]] = mapped_column("region", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.List[str]] = mapped_column("state", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[typing.List[str]] = mapped_column("zone", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    sales_area: Mapped[typing.List[str]] = mapped_column("sales_area", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    escalation_level: Mapped[typing.Optional[typing.Any]] = mapped_column("escalation_level", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    is_ad_user: Mapped[bool] = mapped_column("is_ad_user", Boolean, index=False, nullable=False, default=None, primary_key=False, unique=False)
    status: Mapped[bool] = mapped_column("status", Boolean, index=False, nullable=False, default=None, primary_key=False, unique=False)
    manual_user: Mapped[bool] = mapped_column("manual_user", Boolean, index=False, nullable=False, default=None, primary_key=False, unique=False)
    contact_number: Mapped[typing.Optional[str]] = mapped_column("contact_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    mfa: Mapped[typing.Optional[bool]] = mapped_column("mfa", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    login_user_id: Mapped[str] = mapped_column("login_user_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    file_path: Mapped[typing.Optional[str]] = mapped_column("file_path", String, index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(username, employee_id, name="users_username_employee_id"),)


class UsersCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'users'
    
    username: str
    email: str
    first_name: str
    last_name: str
    password: typing.Optional[urdhva_base.types.Secret] | None = None
    employee_id: str
    employee_number: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.List[hpcl_ceg_enum.BusinessUnit]
    sap_id: typing.List[str]
    system_role: typing.List[str]
    novex_role: typing.List[str]
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.List[str]
    zone: typing.List[str]
    sales_area: typing.List[str]
    escalation_level: typing.Optional[hpcl_ceg_enum.NotificationLevel] | None = None
    is_ad_user: bool
    status: bool
    manual_user: bool
    contact_number: typing.Optional[str] = pydantic.Field("", **{})
    mfa: typing.Optional[bool] = pydantic.Field(False, )
    login_user_id: str
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = UsersSchema
        upsert_keys = ['username', 'employee_id']
        search_fields = ['username', 'email', 'first_name', 'last_name', 'employee_id', 'employee_number']


class Users(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'users'
    
    username: typing.Optional[str] | None = None
    email: typing.Optional[str] | None = None
    first_name: typing.Optional[str] | None = None
    last_name: typing.Optional[str] | None = None
    password: typing.Optional[urdhva_base.types.Secret] | None = None
    employee_id: typing.Optional[str] | None = None
    employee_number: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[typing.List[hpcl_ceg_enum.BusinessUnit]] | None = None
    sap_id: typing.Optional[typing.List[str]] | None = None
    system_role: typing.Optional[typing.List[str]] | None = None
    novex_role: typing.Optional[typing.List[str]] | None = None
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] | None = None
    zone: typing.Optional[typing.List[str]] | None = None
    sales_area: typing.Optional[typing.List[str]] | None = None
    escalation_level: typing.Optional[hpcl_ceg_enum.NotificationLevel] | None = None
    is_ad_user: typing.Optional[bool] | None = None
    status: typing.Optional[bool] | None = None
    manual_user: typing.Optional[bool] | None = None
    contact_number: typing.Optional[str] = pydantic.Field("", **{})
    mfa: typing.Optional[bool] = pydantic.Field(False, )
    login_user_id: typing.Optional[str] | None = None
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = UsersSchema
        upsert_keys = ['username', 'employee_id']
        search_fields = ['username', 'email', 'first_name', 'last_name', 'employee_id', 'employee_number']


class UsersGetResp(pydantic.BaseModel):
    data: typing.List[Users]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Users_Fetch_UsersParams(pydantic.BaseModel):
    search_string: str
    limit: typing.Optional[int] = pydantic.Field(100, **{})
    skip: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Users_Create_UserParams(pydantic.BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str
    employee_id: str
    role: typing.List[str]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Users_Update_User_StatusParams(pydantic.BaseModel):
    enable: bool
    username: str
    first_name: str
    last_name: str
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.List[str]
    zone: typing.List[str]
    sap_id: typing.List[str]
    bu: typing.List[hpcl_ceg_enum.BusinessUnit]
    sales_area: typing.List[str]
    novex_role: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Users_LoginParams(pydantic.BaseModel):
    username: str = pydantic.Field(**{'pattern': '^[a-zA-Z0-9_.-]+$'})
    password: str
    login_type: typing.Optional[str] = pydantic.Field("employee", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Users_ApploginParams(pydantic.BaseModel):
    username: str = pydantic.Field(**{'pattern': '^[a-zA-Z0-9_.-]+$'})
    password: str
    login_type: typing.Optional[str] = pydantic.Field("employee", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Users_LogoutParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class DataFiltersCreate(pydantic.BaseModel):
    key: str
    cond: str
    value: str


class TasActionLogsSchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_action_logs'
    
    username: Mapped[str] = mapped_column("username", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    email: Mapped[typing.Optional[str]] = mapped_column("email", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    first_name: Mapped[typing.Optional[str]] = mapped_column("first_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    last_name: Mapped[typing.Optional[str]] = mapped_column("last_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    employee_id: Mapped[typing.Optional[str]] = mapped_column("employee_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    employee_number: Mapped[typing.Optional[str]] = mapped_column("employee_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[typing.List[typing.Any]] = mapped_column("bu", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.List[str]] = mapped_column("sap_id", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[typing.List[str]] = mapped_column("location_name", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    system_role: Mapped[typing.List[str]] = mapped_column("system_role", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    novex_role: Mapped[typing.List[str]] = mapped_column("novex_role", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[typing.Optional[typing.List[str]]] = mapped_column("region", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[typing.List[str]]] = mapped_column("state", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[typing.List[str]]] = mapped_column("zone", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[typing.List[str]]] = mapped_column("sales_area", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    description: Mapped[typing.Optional[str]] = mapped_column("description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    comments: Mapped[typing.Optional[str]] = mapped_column("comments", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    action: Mapped[typing.Optional[typing.Any]] = mapped_column("action", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    section: Mapped[typing.Optional[typing.Any]] = mapped_column("section", String, index=False, nullable=True, default=None, primary_key=False, unique=False)


class TasActionLogsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_action_logs'
    
    username: str
    email: typing.Optional[str] = pydantic.Field("", **{})
    first_name: typing.Optional[str] = pydantic.Field("", **{})
    last_name: typing.Optional[str] = pydantic.Field("", **{})
    employee_id: typing.Optional[str] = pydantic.Field("", **{})
    employee_number: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.List[hpcl_ceg_enum.BusinessUnit]
    sap_id: typing.List[str]
    location_name: typing.List[str]
    system_role: typing.List[str]
    novex_role: typing.List[str]
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sales_area: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    description: typing.Optional[str] = pydantic.Field("", **{})
    comments: typing.Optional[str] = pydantic.Field("", **{})
    action: typing.Optional[hpcl_ceg_enum.TasLogAction] | None = None
    section: typing.Optional[hpcl_ceg_enum.TasLogSection] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasActionLogsSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'zone', 'region', 'sales_area', 'sap_id']


class TasActionLogs(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_action_logs'
    
    username: typing.Optional[str] | None = None
    email: typing.Optional[str] = pydantic.Field("", **{})
    first_name: typing.Optional[str] = pydantic.Field("", **{})
    last_name: typing.Optional[str] = pydantic.Field("", **{})
    employee_id: typing.Optional[str] = pydantic.Field("", **{})
    employee_number: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[typing.List[hpcl_ceg_enum.BusinessUnit]] | None = None
    sap_id: typing.Optional[typing.List[str]] | None = None
    location_name: typing.Optional[typing.List[str]] | None = None
    system_role: typing.Optional[typing.List[str]] | None = None
    novex_role: typing.Optional[typing.List[str]] | None = None
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sales_area: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    description: typing.Optional[str] = pydantic.Field("", **{})
    comments: typing.Optional[str] = pydantic.Field("", **{})
    action: typing.Optional[hpcl_ceg_enum.TasLogAction] | None = None
    section: typing.Optional[hpcl_ceg_enum.TasLogSection] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasActionLogsSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'zone', 'region', 'sales_area', 'sap_id']


class TasActionLogsGetResp(pydantic.BaseModel):
    data: typing.List[TasActionLogs]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Tasactionlogs_Capture_LogsParams(pydantic.BaseModel):
    sap_id: str
    action: str
    description: typing.Optional[str] = pydantic.Field("", **{})
    comments: typing.Optional[str] = pydantic.Field("", **{})
    section: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LocationMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'location_master'
    
    bu: Mapped[typing.Any] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    bu_id: Mapped[typing.Optional[str]] = mapped_column("bu_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ro_id: Mapped[typing.Optional[str]] = mapped_column("ro_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[str] = mapped_column("name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    is_active: Mapped[typing.Optional[bool]] = mapped_column("is_active", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    activation_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("activation_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    activation_notes: Mapped[typing.Optional[str]] = mapped_column("activation_notes", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    activated_by: Mapped[typing.Optional[str]] = mapped_column("activated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    deactivated_by: Mapped[typing.Optional[str]] = mapped_column("deactivated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    deactivation_notes: Mapped[typing.Optional[str]] = mapped_column("deactivation_notes", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    health_status: Mapped[typing.Optional[typing.Any]] = mapped_column("health_status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    health_notes: Mapped[typing.Optional[str]] = mapped_column("health_notes", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    scada_vendor: Mapped[typing.Optional[str]] = mapped_column("scada_vendor", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    scada_version: Mapped[typing.Optional[str]] = mapped_column("scada_version", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    scada_conn_status: Mapped[typing.Optional[bool]] = mapped_column("scada_conn_status", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    scada_conn_notes: Mapped[typing.Optional[str]] = mapped_column("scada_conn_notes", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    region_code: Mapped[typing.Optional[str]] = mapped_column("region_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    pincode: Mapped[typing.Optional[str]] = mapped_column("pincode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dealer_name: Mapped[typing.Optional[str]] = mapped_column("dealer_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dealer_phone: Mapped[typing.Optional[str]] = mapped_column("dealer_phone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dealer_email: Mapped[typing.Optional[str]] = mapped_column("dealer_email", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    local_automation_vendor: Mapped[typing.Optional[str]] = mapped_column("local_automation_vendor", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[str]] = mapped_column("latitude", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[str]] = mapped_column("longitude", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[str]] = mapped_column("sales_area", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sales_area_code: Mapped[typing.Optional[str]] = mapped_column("sales_area_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    terminal_plant_id: Mapped[typing.Optional[str]] = mapped_column("terminal_plant_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    terminal_plant_name: Mapped[typing.Optional[str]] = mapped_column("terminal_plant_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    distributor_code: Mapped[typing.Optional[str]] = mapped_column("distributor_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    distributor_name: Mapped[typing.Optional[str]] = mapped_column("distributor_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    round_trip_distance: Mapped[typing.Optional[int]] = mapped_column("round_trip_distance", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    location_onboard: Mapped[typing.Optional[bool]] = mapped_column("location_onboard", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(bu, sap_id, name="location_master_bu_sap_id"),)


class LocationMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'location_master'
    
    bu: hpcl_ceg_enum.BusinessUnit
    sap_id: str
    bu_id: typing.Optional[str] = pydantic.Field("", **{})
    ro_id: typing.Optional[str] = pydantic.Field("", **{})
    name: str
    is_active: typing.Optional[bool] = pydantic.Field(False, )
    activation_date: typing.Optional[datetime.datetime] | None = None
    activation_notes: typing.Optional[str] = pydantic.Field("", **{})
    activated_by: typing.Optional[str] = pydantic.Field("", **{})
    deactivated_by: typing.Optional[str] = pydantic.Field("", **{})
    deactivation_notes: typing.Optional[str] = pydantic.Field("", **{})
    health_status: typing.Optional[hpcl_ceg_enum.LocationHealth] | None = None
    health_notes: typing.Optional[str] = pydantic.Field("", **{})
    scada_vendor: typing.Optional[str] = pydantic.Field("", **{})
    scada_version: typing.Optional[str] = pydantic.Field("", **{})
    scada_conn_status: typing.Optional[bool] = pydantic.Field(False, )
    scada_conn_notes: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    region_code: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    pincode: typing.Optional[str] = pydantic.Field("", **{})
    dealer_name: typing.Optional[str] = pydantic.Field("", **{})
    dealer_phone: typing.Optional[str] = pydantic.Field("", **{})
    dealer_email: typing.Optional[str] = pydantic.Field("", **{})
    local_automation_vendor: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[str] = pydantic.Field("", **{})
    longitude: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    sales_area_code: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_name: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    distributor_code: typing.Optional[str] = pydantic.Field("", **{})
    distributor_name: typing.Optional[str] = pydantic.Field("", **{})
    round_trip_distance: typing.Optional[int] = pydantic.Field(0, **{})
    location_onboard: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LocationMasterSchema
        upsert_keys = ['bu', 'sap_id']
        search_fields = ['bu', 'sap_id', 'name', 'region', 'zone', 'terminal_plant_name']
        access_key_mapping = ['bu', 'zone', 'region', 'sales_area', 'sap_id']


class LocationMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'location_master'
    
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    sap_id: typing.Optional[str] | None = None
    bu_id: typing.Optional[str] = pydantic.Field("", **{})
    ro_id: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] | None = None
    is_active: typing.Optional[bool] = pydantic.Field(False, )
    activation_date: typing.Optional[datetime.datetime] | None = None
    activation_notes: typing.Optional[str] = pydantic.Field("", **{})
    activated_by: typing.Optional[str] = pydantic.Field("", **{})
    deactivated_by: typing.Optional[str] = pydantic.Field("", **{})
    deactivation_notes: typing.Optional[str] = pydantic.Field("", **{})
    health_status: typing.Optional[hpcl_ceg_enum.LocationHealth] | None = None
    health_notes: typing.Optional[str] = pydantic.Field("", **{})
    scada_vendor: typing.Optional[str] = pydantic.Field("", **{})
    scada_version: typing.Optional[str] = pydantic.Field("", **{})
    scada_conn_status: typing.Optional[bool] = pydantic.Field(False, )
    scada_conn_notes: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    region_code: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    pincode: typing.Optional[str] = pydantic.Field("", **{})
    dealer_name: typing.Optional[str] = pydantic.Field("", **{})
    dealer_phone: typing.Optional[str] = pydantic.Field("", **{})
    dealer_email: typing.Optional[str] = pydantic.Field("", **{})
    local_automation_vendor: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[str] = pydantic.Field("", **{})
    longitude: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    sales_area_code: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_name: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    distributor_code: typing.Optional[str] = pydantic.Field("", **{})
    distributor_name: typing.Optional[str] = pydantic.Field("", **{})
    round_trip_distance: typing.Optional[int] = pydantic.Field(0, **{})
    location_onboard: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LocationMasterSchema
        upsert_keys = ['bu', 'sap_id']
        search_fields = ['bu', 'sap_id', 'name', 'region', 'zone', 'terminal_plant_name']
        access_key_mapping = ['bu', 'zone', 'region', 'sales_area', 'sap_id']


class LocationMasterGetResp(pydantic.BaseModel):
    data: typing.List[LocationMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Locationmaster_Upload_Location_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Download_Location_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Fetch_Global_StatsParams(pydantic.BaseModel):
    bu: typing.Optional[typing.List[hpcl_ceg_enum.BusinessUnit]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Download_TemplateParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Upload_Tags_DataParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Update_Location_MasterParams(pydantic.BaseModel):
    sap_id: str
    name: str
    city: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    pincode: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Get_Sod_Engineering_StatsParams(pydantic.BaseModel):
    sap_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Location_Command_ControlParams(pydantic.BaseModel):
    sap_id: str
    action: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Get_Dist_Loc_DetailsParams(pydantic.BaseModel):
    bu: str
    zone: typing.Optional[str] = pydantic.Field("", **{})
    plant: typing.Optional[str] = pydantic.Field("", **{})
    location_onboard: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Get_Pipeline_LocationsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Locationmaster_Get_Location_MetadataParams(pydantic.BaseModel):
    bu: typing.List[str]
    metadata_filters: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )
    required_fields: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class RoleMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'role_master'
    
    bu: Mapped[typing.List[typing.Any]] = mapped_column("bu", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.List[str]] = mapped_column("sap_id", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    user_name: Mapped[typing.Optional[str]] = mapped_column("user_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    employee_id: Mapped[str] = mapped_column("employee_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    system_role: Mapped[str] = mapped_column("system_role", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    novex_role: Mapped[str] = mapped_column("novex_role", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    email: Mapped[str] = mapped_column("email", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    phone_no: Mapped[str] = mapped_column("phone_no", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[typing.Optional[typing.List[str]]] = mapped_column("region", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.List[str]] = mapped_column("state", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[typing.List[str]] = mapped_column("zone", ARRAY(String), index=True, nullable=False, default=None, primary_key=False, unique=False)
    escalation_level: Mapped[typing.Optional[typing.Any]] = mapped_column("escalation_level", String, index=False, nullable=True, default=None, primary_key=False, unique=False)


class RoleMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'role_master'
    
    bu: typing.List[hpcl_ceg_enum.BusinessUnit]
    sap_id: typing.List[str]
    location_name: str
    user_name: typing.Optional[str] = pydantic.Field("", **{})
    employee_id: str
    system_role: str
    novex_role: str
    email: str
    phone_no: str
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.List[str]
    zone: typing.List[str]
    escalation_level: typing.Optional[hpcl_ceg_enum.NotificationLevel] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = RoleMasterSchema
        upsert_keys = []


class RoleMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'role_master'
    
    bu: typing.Optional[typing.List[hpcl_ceg_enum.BusinessUnit]] | None = None
    sap_id: typing.Optional[typing.List[str]] | None = None
    location_name: typing.Optional[str] | None = None
    user_name: typing.Optional[str] = pydantic.Field("", **{})
    employee_id: typing.Optional[str] | None = None
    system_role: typing.Optional[str] | None = None
    novex_role: typing.Optional[str] | None = None
    email: typing.Optional[str] | None = None
    phone_no: typing.Optional[str] | None = None
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] | None = None
    zone: typing.Optional[typing.List[str]] | None = None
    escalation_level: typing.Optional[hpcl_ceg_enum.NotificationLevel] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = RoleMasterSchema
        upsert_keys = []


class RoleMasterGetResp(pydantic.BaseModel):
    data: typing.List[RoleMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Rolemaster_Upload_Role_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Rolemaster_Download_Role_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Rolemaster_Download_TemplateParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class ROAssetMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'ro_asset_master'
    
    bu: Mapped[typing.Any] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bay_id: Mapped[int] = mapped_column("bay_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    mpd_id: Mapped[int] = mapped_column("mpd_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    tank_id: Mapped[int] = mapped_column("tank_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    nozzle_id: Mapped[int] = mapped_column("nozzle_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    global_nozzle_id: Mapped[int] = mapped_column("global_nozzle_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class ROAssetMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'ro_asset_master'
    
    bu: hpcl_ceg_enum.BusinessUnit
    sap_id: str
    location_name: str
    bay_id: int
    mpd_id: int
    tank_id: int
    nozzle_id: int
    global_nozzle_id: int
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ROAssetMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id', 'region']


class ROAssetMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'ro_asset_master'
    
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    bay_id: typing.Optional[int] | None = None
    mpd_id: typing.Optional[int] | None = None
    tank_id: typing.Optional[int] | None = None
    nozzle_id: typing.Optional[int] | None = None
    global_nozzle_id: typing.Optional[int] | None = None
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ROAssetMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id', 'region']


class ROAssetMasterGetResp(pydantic.BaseModel):
    data: typing.List[ROAssetMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Roassetmaster_Upload_Ro_Asset_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Roassetmaster_Download_Ro_Asset_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Roassetmaster_Download_TemplateParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class WidgetFiltersCreate(pydantic.BaseModel):
    key: str = pydantic.Field(**{'pattern': '^[a-zA-Z0-9_.\\-=" ]+$'})
    cond: str
    value: typing.Optional[str] = pydantic.Field("", **{})
    val: typing.Optional[str] = pydantic.Field("", **{'pattern': '^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$'})


class TASAssetMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_asset_master'
    
    bu: Mapped[typing.Any] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_type: Mapped[str] = mapped_column("device_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_desc: Mapped[str] = mapped_column("device_desc", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_tag: Mapped[str] = mapped_column("device_tag", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_id: Mapped[str] = mapped_column("device_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_key: Mapped[str] = mapped_column("device_key", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class TASAssetMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_asset_master'
    
    bu: hpcl_ceg_enum.BusinessUnit
    sap_id: str
    location_name: str
    device_type: str
    device_desc: str
    device_tag: str
    device_id: str
    device_key: str
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TASAssetMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id', 'region']


class TASAssetMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_asset_master'
    
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    device_type: typing.Optional[str] | None = None
    device_desc: typing.Optional[str] | None = None
    device_tag: typing.Optional[str] | None = None
    device_id: typing.Optional[str] | None = None
    device_key: typing.Optional[str] | None = None
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TASAssetMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id', 'region']


class TASAssetMasterGetResp(pydantic.BaseModel):
    data: typing.List[TASAssetMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Tasassetmaster_Upload_Tas_Asset_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tasassetmaster_Download_Tas_Asset_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tasassetmaster_Download_TemplateParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tasassetmaster_Download_Tas_ReportParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    action: str
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LPGAssetMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_asset_master'
    
    bu: Mapped[typing.Any] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_type: Mapped[str] = mapped_column("device_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_desc: Mapped[str] = mapped_column("device_desc", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_tag: Mapped[str] = mapped_column("device_tag", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_id: Mapped[str] = mapped_column("device_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_key: Mapped[str] = mapped_column("device_key", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class LPGAssetMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_asset_master'
    
    bu: hpcl_ceg_enum.BusinessUnit
    sap_id: str
    location_name: str
    device_type: str
    device_desc: str
    device_tag: str
    device_id: str
    device_key: str
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LPGAssetMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id', 'region']


class LPGAssetMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_asset_master'
    
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    device_type: typing.Optional[str] | None = None
    device_desc: typing.Optional[str] | None = None
    device_tag: typing.Optional[str] | None = None
    device_id: typing.Optional[str] | None = None
    device_key: typing.Optional[str] | None = None
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LPGAssetMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id', 'region']


class LPGAssetMasterGetResp(pydantic.BaseModel):
    data: typing.List[LPGAssetMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpgassetmaster_Upload_Lpg_Asset_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgassetmaster_Download_Lpg_Asset_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgassetmaster_Download_TemplateParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class assetDataCreate(pydantic.BaseModel):
    ro_id: str
    local_tank_id: typing.Optional[int] = pydantic.Field(0, **{})
    local_nozzle_id: typing.Optional[int] = pydantic.Field(0, **{})
    local_mpd_id: typing.Optional[int] = pydantic.Field(0, **{})
    local_bay_id: typing.Optional[int] = pydantic.Field(0, **{})
    alert_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None


class assetDetailsCreate(pydantic.BaseModel):
    asset_id: str
    data: typing.Optional[assetDataCreate] | None = None


class Alert_HistoryCreate(pydantic.BaseModel):
    device_data: typing.Optional[str] = pydantic.Field("", **{})
    allocated_time: typing.Optional[str] = pydantic.Field("", **{})
    processed_time: typing.Optional[str] = pydantic.Field("", **{})
    ims_datetime: typing.Optional[str] = pydantic.Field("", **{})
    prod_reqd_dt: typing.Optional[str] = pydantic.Field("", **{})
    mail_sent_to: typing.Optional[str] = pydantic.Field("", **{})
    action_by: typing.Optional[str] = pydantic.Field("", **{})
    action_type: hpcl_ceg_enum.AlertActionType
    alert_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    action_msg: str
    rca_reason: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    employee_id: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    doc_link: typing.Optional[str] = pydantic.Field("", **{})
    atr_uploaded: typing.Optional[bool] = pydantic.Field(False, )
    maintenance_exception: typing.Optional[bool] = pydantic.Field(False, )
    revocation: typing.Optional[bool] = pydantic.Field(False, )
    no_exception: typing.Optional[bool] = pydantic.Field(False, )
    is_approved: typing.Optional[bool] = pydantic.Field(False, )
    is_exc_approval_time_exp: typing.Optional[bool] = pydantic.Field(False, )
    is_raised: typing.Optional[bool] = pydantic.Field(False, )
    is_cancelled: typing.Optional[bool] = pydantic.Field(False, )
    is_allocated: typing.Optional[bool] = pydantic.Field(False, )
    is_sent_to_sap: typing.Optional[bool] = pydantic.Field(False, )
    is_order_placed: typing.Optional[bool] = pydantic.Field(False, )
    is_created: typing.Optional[bool] = pydantic.Field(False, )
    is_r1_swipe: typing.Optional[bool] = pydantic.Field(False, )
    is_r2_swipe: typing.Optional[bool] = pydantic.Field(False, )
    is_r3_swipe: typing.Optional[bool] = pydantic.Field(False, )
    is_delivered: typing.Optional[bool] = pydantic.Field(False, )
    is_tripped: typing.Optional[bool] = pydantic.Field(False, )
    is_justify: typing.Optional[bool] = pydantic.Field(False, )
    is_vts: typing.Optional[bool] = pydantic.Field(False, )
    is_blocked: typing.Optional[bool] = pydantic.Field(False, )
    is_unblocked: typing.Optional[bool] = pydantic.Field(False, )
    is_interrupt: typing.Optional[bool] = pydantic.Field(False, )
    is_extra_days: typing.Optional[bool] = pydantic.Field(False, )
    is_rejected: typing.Optional[bool] = pydantic.Field(False, )


class tagsCreate(pydantic.BaseModel):
    is_atr_uploaded: typing.Optional[bool] = pydantic.Field(False, )
    is_maintenance_exception: typing.Optional[bool] = pydantic.Field(False, )
    is_revocation: typing.Optional[bool] = pydantic.Field(False, )
    no_exception: typing.Optional[bool] = pydantic.Field(False, )
    is_approved: typing.Optional[bool] = pydantic.Field(False, )
    is_exc_approval_time_exp: typing.Optional[bool] = pydantic.Field(False, )
    is_raised: typing.Optional[bool] = pydantic.Field(False, )
    is_cancelled: typing.Optional[bool] = pydantic.Field(False, )
    is_allocated: typing.Optional[bool] = pydantic.Field(False, )
    is_sent_to_sap: typing.Optional[bool] = pydantic.Field(False, )
    is_order_placed: typing.Optional[bool] = pydantic.Field(False, )
    is_created: typing.Optional[bool] = pydantic.Field(False, )
    is_r1_swipe: typing.Optional[bool] = pydantic.Field(False, )
    is_r2_swipe: typing.Optional[bool] = pydantic.Field(False, )
    is_r3_swipe: typing.Optional[bool] = pydantic.Field(False, )
    is_vts: typing.Optional[bool] = pydantic.Field(False, )
    is_delivered: typing.Optional[bool] = pydantic.Field(False, )
    is_tripped: typing.Optional[bool] = pydantic.Field(False, )
    is_justify: typing.Optional[bool] = pydantic.Field(False, )
    is_blocked: typing.Optional[bool] = pydantic.Field(False, )
    is_un_blocked: typing.Optional[bool] = pydantic.Field(False, )
    is_interrupt: typing.Optional[bool] = pydantic.Field(False, )
    is_extra_days: typing.Optional[bool] = pydantic.Field(False, )


class InterlockSchema(UrdhvaPostgresBase):
    __tablename__ = 'interlock'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sop_id: Mapped[str] = mapped_column("sop_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    interlock_name: Mapped[typing.Optional[str]] = mapped_column("interlock_name", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_name: Mapped[typing.Optional[str]] = mapped_column("device_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_type: Mapped[typing.Optional[str]] = mapped_column("device_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_id: Mapped[typing.Optional[str]] = mapped_column("device_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    interlock_status: Mapped[typing.Optional[typing.Any]] = mapped_column("interlock_status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)


class InterlockCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'interlock'
    
    bu: str
    sap_id: str
    sop_id: str
    interlock_name: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    device_name: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    interlock_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = InterlockSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id', 'zone']


class Interlock(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'interlock'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    sop_id: typing.Optional[str] | None = None
    interlock_name: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    device_name: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    interlock_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = InterlockSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id', 'zone']


class InterlockGetResp(pydantic.BaseModel):
    data: typing.List[Interlock]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class EMLockSchema(UrdhvaPostgresBase):
    __tablename__ = 'em_lock'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    vehicle_number: Mapped[str] = mapped_column("vehicle_number", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    violation_type: Mapped[str] = mapped_column("violation_type", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    violation_count: Mapped[int] = mapped_column("violation_count", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    violation_start_date: Mapped[datetime.datetime] = mapped_column("violation_start_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    violation_history: Mapped[typing.Optional[typing.List[str]]] = mapped_column("violation_history", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Any] = mapped_column("status", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class EMLockCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'em_lock'
    
    bu: str
    sap_id: str
    location_name: str
    vehicle_number: str
    violation_type: str
    violation_count: int
    violation_start_date: datetime.datetime
    violation_history: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    status: hpcl_ceg_enum.AlertStatus

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = EMLockSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class EMLock(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'em_lock'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    vehicle_number: typing.Optional[str] | None = None
    violation_type: typing.Optional[str] | None = None
    violation_count: typing.Optional[int] | None = None
    violation_start_date: typing.Optional[datetime.datetime] | None = None
    violation_history: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = EMLockSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class EMLockGetResp(pydantic.BaseModel):
    data: typing.List[EMLock]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class VTSSchema(UrdhvaPostgresBase):
    __tablename__ = 'vts'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    vehicle_number: Mapped[str] = mapped_column("vehicle_number", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    violation_type: Mapped[str] = mapped_column("violation_type", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    violation_count: Mapped[int] = mapped_column("violation_count", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    violation_start_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("violation_start_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    violation_history: Mapped[typing.Optional[typing.List[str]]] = mapped_column("violation_history", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    block_duration: Mapped[typing.Optional[str]] = mapped_column("block_duration", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    block_msg: Mapped[typing.Optional[str]] = mapped_column("block_msg", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[typing.Any]] = mapped_column("status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    report_duration: Mapped[typing.Optional[str]] = mapped_column("report_duration", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    total_trips: Mapped[typing.Optional[int]] = mapped_column("total_trips", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)


class VTSCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'vts'
    
    bu: str
    sap_id: str
    location_name: str
    vehicle_number: str
    violation_type: str
    violation_count: int
    violation_start_date: typing.Optional[datetime.datetime] | None = None
    violation_history: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    block_duration: typing.Optional[str] = pydantic.Field("", **{})
    block_msg: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    report_duration: typing.Optional[str] = pydantic.Field("", **{})
    total_trips: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VTSSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class VTS(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'vts'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    vehicle_number: typing.Optional[str] | None = None
    violation_type: typing.Optional[str] | None = None
    violation_count: typing.Optional[int] | None = None
    violation_start_date: typing.Optional[datetime.datetime] | None = None
    violation_history: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    block_duration: typing.Optional[str] = pydantic.Field("", **{})
    block_msg: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    report_duration: typing.Optional[str] = pydantic.Field("", **{})
    total_trips: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VTSSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class VTSGetResp(pydantic.BaseModel):
    data: typing.List[VTS]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class VtsManualBlockedSchema(UrdhvaPostgresBase):
    __tablename__ = 'vts_manual_blocked'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    blocked_by: Mapped[typing.Optional[str]] = mapped_column("blocked_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    unblocked_by: Mapped[typing.Optional[str]] = mapped_column("unblocked_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    blocked_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("blocked_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    unblocked_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("unblocked_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    truck_number: Mapped[str] = mapped_column("truck_number", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transaction_number: Mapped[str] = mapped_column("transaction_number", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    blocking_status: Mapped[typing.Optional[str]] = mapped_column("blocking_status", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    blocking_flag: Mapped[typing.Optional[str]] = mapped_column("blocking_flag", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    blocking_days: Mapped[typing.Optional[int]] = mapped_column("blocking_days", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    blocking_from: Mapped[datetime.datetime] = mapped_column("blocking_from", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    blocking_to: Mapped[datetime.datetime] = mapped_column("blocking_to", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    remarks_unblocked: Mapped[typing.Optional[str]] = mapped_column("remarks_unblocked", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    file_uploaded_path: Mapped[typing.Optional[str]] = mapped_column("file_uploaded_path", String, index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(transaction_number, name="vts_manual_blocked_transaction_number"),)


class VtsManualBlockedCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'vts_manual_blocked'
    
    bu: str
    blocked_by: typing.Optional[str] = pydantic.Field("", **{})
    unblocked_by: typing.Optional[str] = pydantic.Field("", **{})
    blocked_date: typing.Optional[datetime.datetime] | None = None
    unblocked_date: typing.Optional[datetime.datetime] | None = None
    truck_number: str
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    transaction_number: str
    blocking_status: typing.Optional[str] = pydantic.Field("", **{})
    blocking_flag: typing.Optional[str] = pydantic.Field("", **{})
    blocking_days: typing.Optional[int] = pydantic.Field(0, **{})
    blocking_from: datetime.datetime
    blocking_to: datetime.datetime
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    remarks_unblocked: typing.Optional[str] = pydantic.Field("", **{})
    file_uploaded_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VtsManualBlockedSchema
        upsert_keys = ['transaction_number']


class VtsManualBlocked(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'vts_manual_blocked'
    
    bu: typing.Optional[str] | None = None
    blocked_by: typing.Optional[str] = pydantic.Field("", **{})
    unblocked_by: typing.Optional[str] = pydantic.Field("", **{})
    blocked_date: typing.Optional[datetime.datetime] | None = None
    unblocked_date: typing.Optional[datetime.datetime] | None = None
    truck_number: typing.Optional[str] | None = None
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    transaction_number: typing.Optional[str] | None = None
    blocking_status: typing.Optional[str] = pydantic.Field("", **{})
    blocking_flag: typing.Optional[str] = pydantic.Field("", **{})
    blocking_days: typing.Optional[int] = pydantic.Field(0, **{})
    blocking_from: typing.Optional[datetime.datetime] | None = None
    blocking_to: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    remarks_unblocked: typing.Optional[str] = pydantic.Field("", **{})
    file_uploaded_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VtsManualBlockedSchema
        upsert_keys = ['transaction_number']


class VtsManualBlockedGetResp(pydantic.BaseModel):
    data: typing.List[VtsManualBlocked]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class AlertStateTimingCreate(pydantic.BaseModel):
    action: hpcl_ceg_enum.AlertActionState
    action_by: typing.Optional[str] = pydantic.Field("", **{})
    acted_at: datetime.datetime


class AlertsSchema(UrdhvaPostgresBase):
    __tablename__ = 'alerts'
    
    bu: Mapped[typing.Optional[typing.Any]] = mapped_column("bu", String, index=True, nullable=True, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sop_id: Mapped[typing.Optional[str]] = mapped_column("sop_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    severity: Mapped[typing.Any] = mapped_column("severity", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    alert_category: Mapped[typing.Optional[str]] = mapped_column("alert_category", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_status: Mapped[typing.Any] = mapped_column("alert_status", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    alert_state: Mapped[typing.Any] = mapped_column("alert_state", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    unique_id: Mapped[str] = mapped_column("unique_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    alert_section: Mapped[str] = mapped_column("alert_section", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    external_id: Mapped[typing.Optional[str]] = mapped_column("external_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    interlock_name: Mapped[typing.Optional[str]] = mapped_column("interlock_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    interlock_id: Mapped[typing.Optional[str]] = mapped_column("interlock_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_id: Mapped[typing.Optional[str]] = mapped_column("device_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    equipment_id: Mapped[typing.Optional[str]] = mapped_column("equipment_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sensor_id: Mapped[typing.Optional[str]] = mapped_column("sensor_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_type: Mapped[typing.Optional[str]] = mapped_column("device_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    equipment_type: Mapped[typing.Optional[str]] = mapped_column("equipment_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_name: Mapped[typing.Optional[str]] = mapped_column("device_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    equipment_name: Mapped[typing.Optional[str]] = mapped_column("equipment_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tas_device_name: Mapped[typing.Optional[str]] = mapped_column("tas_device_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_msg: Mapped[typing.Optional[str]] = mapped_column("device_msg", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vehicle_number: Mapped[typing.Optional[str]] = mapped_column("vehicle_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    violation_type: Mapped[typing.Optional[str]] = mapped_column("violation_type", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    clear_count: Mapped[typing.Optional[bool]] = mapped_column("clear_count", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    maintenance_time: Mapped[typing.Optional[str]] = mapped_column("maintenance_time", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    closed_at: Mapped[typing.Optional[datetime.datetime]] = mapped_column("closed_at", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    cause_effect: Mapped[typing.Optional[str]] = mapped_column("cause_effect", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_closure_reason: Mapped[typing.Optional[str]] = mapped_column("alert_closure_reason", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tt_load_number: Mapped[typing.Optional[str]] = mapped_column("tt_load_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    is_flagged_false: Mapped[typing.Optional[bool]] = mapped_column("is_flagged_false", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    rca: Mapped[typing.Optional[str]] = mapped_column("rca", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    rca_type: Mapped[typing.Optional[str]] = mapped_column("rca_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_history: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("alert_history", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    last_sms_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("last_sms_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    last_mailed_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("last_mailed_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    last_escalated_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("last_escalated_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    last_notified_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("last_notified_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_to: Mapped[typing.Optional[str]] = mapped_column("assigned_to", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_to_role: Mapped[typing.Optional[str]] = mapped_column("assigned_to_role", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_users: Mapped[typing.Optional[typing.List[str]]] = mapped_column("assigned_users", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_user_roles: Mapped[typing.Optional[typing.List[str]]] = mapped_column("assigned_user_roles", ARRAY(String), index=True, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[str]] = mapped_column("sales_area", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    raw_data: Mapped[typing.Optional[dict]] = mapped_column("raw_data", JSONB, index=False, nullable=True, default=pydantic.Field(default_factory=dict), primary_key=False, unique=False)
    r1_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("r1_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    r2_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("r2_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    r3_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("r3_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    indent_status: Mapped[typing.Optional[typing.Any]] = mapped_column("indent_status", String, index=True, nullable=True, default=None, primary_key=False, unique=False)
    product_code: Mapped[typing.Optional[str]] = mapped_column("product_code", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    indent_no: Mapped[typing.Optional[str]] = mapped_column("indent_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dealer_id: Mapped[typing.Optional[str]] = mapped_column("dealer_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    workflow_instance_id: Mapped[typing.Optional[str]] = mapped_column("workflow_instance_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    workflow_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("workflow_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    workflow_url: Mapped[typing.Optional[str]] = mapped_column("workflow_url", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    workflow_port: Mapped[typing.Optional[str]] = mapped_column("workflow_port", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    terminal_plant_id: Mapped[typing.Optional[str]] = mapped_column("terminal_plant_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    terminal_plant_name: Mapped[typing.Optional[str]] = mapped_column("terminal_plant_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    servicing_plant_id: Mapped[typing.Optional[str]] = mapped_column("servicing_plant_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    servicing_plant_name: Mapped[typing.Optional[str]] = mapped_column("servicing_plant_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    progress_rate: Mapped[typing.Optional[int]] = mapped_column("progress_rate", Integer, index=True, nullable=True, default=0, primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    indent_raised_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("indent_raised_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    dry_out_in_days: Mapped[typing.Optional[str]] = mapped_column("dry_out_in_days", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    origin_altid: Mapped[typing.Optional[str]] = mapped_column("origin_altid", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_message: Mapped[typing.Optional[str]] = mapped_column("alert_message", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    external_timestamp: Mapped[typing.Optional[datetime.datetime]] = mapped_column("external_timestamp", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    atg_ack: Mapped[typing.Optional[bool]] = mapped_column("atg_ack", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    emlock_ack: Mapped[typing.Optional[bool]] = mapped_column("emlock_ack", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    vts_return: Mapped[typing.Optional[bool]] = mapped_column("vts_return", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    atg_ack_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("atg_ack_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    dry_out_start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("dry_out_start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    dry_out_end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("dry_out_end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    intra_day_dry_out_start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("intra_day_dry_out_start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    intra_day_dry_out_end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("intra_day_dry_out_end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    temporary_close: Mapped[typing.Optional[bool]] = mapped_column("temporary_close", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    permanent_close: Mapped[typing.Optional[bool]] = mapped_column("permanent_close", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    ro_offline: Mapped[typing.Optional[bool]] = mapped_column("ro_offline", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    transporter_name: Mapped[typing.Optional[str]] = mapped_column("transporter_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_code: Mapped[typing.Optional[str]] = mapped_column("transporter_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vehicle_blocked_start_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("vehicle_blocked_start_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    vehicle_blocked_end_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("vehicle_blocked_end_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    vehicle_unblocked_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("vehicle_unblocked_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    mark_as_false: Mapped[typing.Optional[bool]] = mapped_column("mark_as_false", Boolean, index=True, nullable=True, default=False, primary_key=False, unique=False)
    vts_alert_history_ids: Mapped[typing.Optional[typing.List[str]]] = mapped_column("vts_alert_history_ids", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    action_on: Mapped[typing.Optional[typing.Any]] = mapped_column("action_on", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    remarks_unblocked: Mapped[typing.Optional[str]] = mapped_column("remarks_unblocked", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    file_uploaded_path: Mapped[typing.Optional[str]] = mapped_column("file_uploaded_path", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    block_status: Mapped[typing.Optional[typing.Any]] = mapped_column("block_status", String, index=True, nullable=True, default=None, primary_key=False, unique=False)
    image_uploaded: Mapped[typing.Optional[bool]] = mapped_column("image_uploaded", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    tt_type: Mapped[typing.Optional[str]] = mapped_column("tt_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ticket_id: Mapped[typing.Optional[str]] = mapped_column("ticket_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    load_type: Mapped[typing.Optional[str]] = mapped_column("load_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    auto_close: Mapped[typing.Optional[bool]] = mapped_column("auto_close", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)


class AlertsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'alerts'
    
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    sap_id: str
    sop_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    severity: hpcl_ceg_enum.Severity
    alert_category: typing.Optional[str] = pydantic.Field("", **{})
    alert_status: hpcl_ceg_enum.AlertStatus
    alert_state: hpcl_ceg_enum.AlertState
    unique_id: str
    alert_section: str
    external_id: typing.Optional[str] = pydantic.Field("", **{})
    interlock_name: typing.Optional[str] = pydantic.Field("", **{})
    interlock_id: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    equipment_id: typing.Optional[str] = pydantic.Field("", **{})
    sensor_id: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    equipment_type: typing.Optional[str] = pydantic.Field("", **{})
    device_name: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: typing.Optional[str] = pydantic.Field("", **{})
    tas_device_name: typing.Optional[str] = pydantic.Field("", **{})
    device_msg: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_number: typing.Optional[str] = pydantic.Field("", **{})
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    clear_count: typing.Optional[bool] = pydantic.Field(False, )
    maintenance_time: typing.Optional[str] = pydantic.Field("", **{})
    closed_at: typing.Optional[datetime.datetime] | None = None
    cause_effect: typing.Optional[str] = pydantic.Field("", **{})
    alert_closure_reason: typing.Optional[str] = pydantic.Field("", **{})
    tt_load_number: typing.Optional[str] = pydantic.Field("", **{})
    is_flagged_false: typing.Optional[bool] = pydantic.Field(False, )
    rca: typing.Optional[str] = pydantic.Field("", **{})
    rca_type: typing.Optional[str] = pydantic.Field("", **{})
    alert_history: typing.Optional[typing.List[Alert_HistoryCreate]] | None = None
    last_sms_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_mailed_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_escalated_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_notified_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assigned_to: typing.Optional[str] = pydantic.Field("", **{})
    assigned_to_role: typing.Optional[str] = pydantic.Field("", **{})
    assigned_users: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assigned_user_roles: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    raw_data: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )
    r1_time: typing.Optional[datetime.datetime] | None = None
    r2_time: typing.Optional[datetime.datetime] | None = None
    r3_time: typing.Optional[datetime.datetime] | None = None
    indent_status: typing.Optional[hpcl_ceg_enum.IndentStatus] | None = None
    product_code: typing.Optional[str] = pydantic.Field("", **{})
    indent_no: typing.Optional[str] = pydantic.Field("", **{})
    dealer_id: typing.Optional[str] = pydantic.Field("", **{})
    workflow_instance_id: typing.Optional[str] = pydantic.Field("", **{})
    workflow_datetime: typing.Optional[datetime.datetime] | None = None
    workflow_url: typing.Optional[str] = pydantic.Field("", **{})
    workflow_port: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_name: typing.Optional[str] = pydantic.Field("", **{})
    servicing_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    servicing_plant_name: typing.Optional[str] = pydantic.Field("", **{})
    progress_rate: typing.Optional[int] = pydantic.Field(0, **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    indent_raised_date: typing.Optional[datetime.datetime] | None = None
    dry_out_in_days: typing.Optional[str] = pydantic.Field("", **{})
    origin_altid: typing.Optional[str] = pydantic.Field("", **{})
    alert_message: typing.Optional[str] = pydantic.Field("", **{})
    external_timestamp: typing.Optional[datetime.datetime] | None = None
    atg_ack: typing.Optional[bool] = pydantic.Field(False, )
    emlock_ack: typing.Optional[bool] = pydantic.Field(False, )
    vts_return: typing.Optional[bool] = pydantic.Field(False, )
    atg_ack_time: typing.Optional[datetime.datetime] | None = None
    dry_out_start_time: typing.Optional[datetime.datetime] | None = None
    dry_out_end_time: typing.Optional[datetime.datetime] | None = None
    intra_day_dry_out_start_time: typing.Optional[datetime.datetime] | None = None
    intra_day_dry_out_end_time: typing.Optional[datetime.datetime] | None = None
    temporary_close: typing.Optional[bool] = pydantic.Field(False, )
    permanent_close: typing.Optional[bool] = pydantic.Field(False, )
    ro_offline: typing.Optional[bool] = pydantic.Field(False, )
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    transporter_code: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_blocked_start_date: typing.Optional[datetime.datetime] | None = None
    vehicle_blocked_end_date: typing.Optional[datetime.datetime] | None = None
    vehicle_unblocked_date: typing.Optional[datetime.datetime] | None = None
    mark_as_false: typing.Optional[bool] = pydantic.Field(False, )
    vts_alert_history_ids: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    action_on: typing.Optional[hpcl_ceg_enum.MakerChecker] | None = None
    remarks_unblocked: typing.Optional[str] = pydantic.Field("", **{})
    file_uploaded_path: typing.Optional[str] = pydantic.Field("", **{})
    block_status: typing.Optional[hpcl_ceg_enum.BlockStatus] | None = None
    image_uploaded: typing.Optional[bool] = pydantic.Field(False, )
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    ticket_id: typing.Optional[str] = pydantic.Field("", **{})
    load_type: typing.Optional[str] = pydantic.Field("", **{})
    auto_close: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = AlertsSchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'sop_id', 'location_name', 'alert_section', 'alert_status', 'interlock_name', 'vehicle_number', 'device_name', 'device_id', 'device_msg', 'device_type', 'violation_type', 'rca_type', 'assigned_to', 'region', 'zone', 'indent_status', 'unique_id']
        access_key_mapping = ['bu', 'zone', 'region', 'sales_area', 'sap_id', 'terminal_plant_id:sap_id']


class Alerts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'alerts'
    
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    sap_id: typing.Optional[str] | None = None
    sop_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    severity: typing.Optional[hpcl_ceg_enum.Severity] | None = None
    alert_category: typing.Optional[str] = pydantic.Field("", **{})
    alert_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    alert_state: typing.Optional[hpcl_ceg_enum.AlertState] | None = None
    unique_id: typing.Optional[str] | None = None
    alert_section: typing.Optional[str] | None = None
    external_id: typing.Optional[str] = pydantic.Field("", **{})
    interlock_name: typing.Optional[str] = pydantic.Field("", **{})
    interlock_id: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    equipment_id: typing.Optional[str] = pydantic.Field("", **{})
    sensor_id: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    equipment_type: typing.Optional[str] = pydantic.Field("", **{})
    device_name: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: typing.Optional[str] = pydantic.Field("", **{})
    tas_device_name: typing.Optional[str] = pydantic.Field("", **{})
    device_msg: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_number: typing.Optional[str] = pydantic.Field("", **{})
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    clear_count: typing.Optional[bool] = pydantic.Field(False, )
    maintenance_time: typing.Optional[str] = pydantic.Field("", **{})
    closed_at: typing.Optional[datetime.datetime] | None = None
    cause_effect: typing.Optional[str] = pydantic.Field("", **{})
    alert_closure_reason: typing.Optional[str] = pydantic.Field("", **{})
    tt_load_number: typing.Optional[str] = pydantic.Field("", **{})
    is_flagged_false: typing.Optional[bool] = pydantic.Field(False, )
    rca: typing.Optional[str] = pydantic.Field("", **{})
    rca_type: typing.Optional[str] = pydantic.Field("", **{})
    alert_history: typing.Optional[typing.List[Alert_HistoryCreate]] | None = None
    last_sms_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_mailed_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_escalated_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_notified_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assigned_to: typing.Optional[str] = pydantic.Field("", **{})
    assigned_to_role: typing.Optional[str] = pydantic.Field("", **{})
    assigned_users: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assigned_user_roles: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    raw_data: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )
    r1_time: typing.Optional[datetime.datetime] | None = None
    r2_time: typing.Optional[datetime.datetime] | None = None
    r3_time: typing.Optional[datetime.datetime] | None = None
    indent_status: typing.Optional[hpcl_ceg_enum.IndentStatus] | None = None
    product_code: typing.Optional[str] = pydantic.Field("", **{})
    indent_no: typing.Optional[str] = pydantic.Field("", **{})
    dealer_id: typing.Optional[str] = pydantic.Field("", **{})
    workflow_instance_id: typing.Optional[str] = pydantic.Field("", **{})
    workflow_datetime: typing.Optional[datetime.datetime] | None = None
    workflow_url: typing.Optional[str] = pydantic.Field("", **{})
    workflow_port: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_name: typing.Optional[str] = pydantic.Field("", **{})
    servicing_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    servicing_plant_name: typing.Optional[str] = pydantic.Field("", **{})
    progress_rate: typing.Optional[int] = pydantic.Field(0, **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    indent_raised_date: typing.Optional[datetime.datetime] | None = None
    dry_out_in_days: typing.Optional[str] = pydantic.Field("", **{})
    origin_altid: typing.Optional[str] = pydantic.Field("", **{})
    alert_message: typing.Optional[str] = pydantic.Field("", **{})
    external_timestamp: typing.Optional[datetime.datetime] | None = None
    atg_ack: typing.Optional[bool] = pydantic.Field(False, )
    emlock_ack: typing.Optional[bool] = pydantic.Field(False, )
    vts_return: typing.Optional[bool] = pydantic.Field(False, )
    atg_ack_time: typing.Optional[datetime.datetime] | None = None
    dry_out_start_time: typing.Optional[datetime.datetime] | None = None
    dry_out_end_time: typing.Optional[datetime.datetime] | None = None
    intra_day_dry_out_start_time: typing.Optional[datetime.datetime] | None = None
    intra_day_dry_out_end_time: typing.Optional[datetime.datetime] | None = None
    temporary_close: typing.Optional[bool] = pydantic.Field(False, )
    permanent_close: typing.Optional[bool] = pydantic.Field(False, )
    ro_offline: typing.Optional[bool] = pydantic.Field(False, )
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    transporter_code: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_blocked_start_date: typing.Optional[datetime.datetime] | None = None
    vehicle_blocked_end_date: typing.Optional[datetime.datetime] | None = None
    vehicle_unblocked_date: typing.Optional[datetime.datetime] | None = None
    mark_as_false: typing.Optional[bool] = pydantic.Field(False, )
    vts_alert_history_ids: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    action_on: typing.Optional[hpcl_ceg_enum.MakerChecker] | None = None
    remarks_unblocked: typing.Optional[str] = pydantic.Field("", **{})
    file_uploaded_path: typing.Optional[str] = pydantic.Field("", **{})
    block_status: typing.Optional[hpcl_ceg_enum.BlockStatus] | None = None
    image_uploaded: typing.Optional[bool] = pydantic.Field(False, )
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    ticket_id: typing.Optional[str] = pydantic.Field("", **{})
    load_type: typing.Optional[str] = pydantic.Field("", **{})
    auto_close: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = AlertsSchema
        upsert_keys = []
        search_fields = ['bu', 'sap_id', 'sop_id', 'location_name', 'alert_section', 'alert_status', 'interlock_name', 'vehicle_number', 'device_name', 'device_id', 'device_msg', 'device_type', 'violation_type', 'rca_type', 'assigned_to', 'region', 'zone', 'indent_status', 'unique_id']
        access_key_mapping = ['bu', 'zone', 'region', 'sales_area', 'sap_id', 'terminal_plant_id:sap_id']


class AlertsGetResp(pydantic.BaseModel):
    data: typing.List[Alerts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Alerts_Alert_ActionParams(pydantic.BaseModel):
    bu: typing.Optional[str] = pydantic.Field("", **{})
    alert_section: typing.Optional[str] = pydantic.Field("", **{})
    action_type: hpcl_ceg_enum.AlertActionType
    alert_id: int
    action_msg: typing.Optional[str] = pydantic.Field("", **{})
    days: typing.Optional[int] = pydantic.Field(0, **{})
    justification_type: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    rca_reason: typing.Optional[str] = pydantic.Field("", **{})
    action_description: typing.Optional[str] = pydantic.Field("", **{})
    doc_link: typing.Optional[str] = pydantic.Field("", **{})
    acknowledged_by: typing.Optional[str] = pydantic.Field("", **{})
    load_number: typing.Optional[str] = pydantic.Field("", **{})
    fan_number: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    trip_type: typing.Optional[str] = pydantic.Field("", **{})
    event_tags: typing.Optional[tagsCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Intitiate_Vts_ExceptionParams(pydantic.BaseModel):
    alert_id: int
    excep_msg: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Get_Performance_IndexParams(pydantic.BaseModel):
    bu: str
    skip: typing.Optional[int] = pydantic.Field(0, **{})
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    filters: typing.Optional[typing.List[DataFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Add_Rca_ReasonParams(pydantic.BaseModel):
    alert_id: str
    reason: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Day_End_ClosureParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Upload_DocumentParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Stored_DocumentParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Get_Frequent_Dryout_RoParams(pydantic.BaseModel):
    start_date: typing.Optional[datetime.datetime] | None = None
    end_date: typing.Optional[datetime.datetime] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Get_Frequent_Dryout_TerminalsParams(pydantic.BaseModel):
    start_date: typing.Optional[datetime.datetime] | None = None
    end_date: typing.Optional[datetime.datetime] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Get_Closed_Alerts_DetailsParams(pydantic.BaseModel):
    bu: str
    alert_id: int
    alert_section: str
    interlock_name: str
    category: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Vts_Alert_ManagerParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Bulk_Send_To_UnblockParams(pydantic.BaseModel):
    alert_ids: typing.List[str]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Bulk_Send_To_ApproveParams(pydantic.BaseModel):
    alert_ids: typing.List[str]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Block_Vts_TruckParams(pydantic.BaseModel):
    bu: hpcl_ceg_enum.BusinessUnit
    truck_number: str
    blocking_days: int
    reason: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    check_ticket_close: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Unblock_Vts_TruckParams(pydantic.BaseModel):
    unblock_id: str
    remarks: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Unblock_Alert_TruckParams(pydantic.BaseModel):
    unique_id: str
    remarks_unblocked: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Get_Vts_Blocked_TrucksParams(pydantic.BaseModel):
    tab: str
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Get_Vts_Unblocked_TrucksParams(pydantic.BaseModel):
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Alerts_Get_Vts_QueryParams(pydantic.BaseModel):
    vehicle_number: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Attach_Alert_Blocked_FileParams(pydantic.BaseModel):
    unique_id: str
    remarks_unblocked: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Attach_Vts_Blocked_FileParams(pydantic.BaseModel):
    unblock_id: str
    remarks_unblocked: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Hqo_Blocked_VehiclesParams(pydantic.BaseModel):
    alert_status: str
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    end_date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Va_Cleanliness_SummaryParams(pydantic.BaseModel):
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Download_Excel_ReportParams(pydantic.BaseModel):
    report_model: str
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Alerts_Get_Va_Cleanliness_Last_Synced_TimeParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tasanalytics_Tas_AnalyticsParams(pydantic.BaseModel):
    analytical_model: str
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    interlock_name: typing.Optional[str] = pydantic.Field("", **{})
    alert_status: typing.Optional[str] = pydantic.Field("", **{})
    alert_severity: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    end_date: typing.Optional[str] = pydantic.Field("", **{})
    equipment_type: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: typing.Optional[str] = pydantic.Field("", **{})
    download: typing.Optional[str] = pydantic.Field("", **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    interlock_category: typing.Optional[str] = pydantic.Field("", **{})
    selected_key: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class CEMSLocationMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'cems_location_master'
    
    bu_id: Mapped[str] = mapped_column("bu_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[typing.Optional[typing.Any]] = mapped_column("bu", String, index=True, nullable=True, default=None, primary_key=False, unique=False)
    device_name: Mapped[str] = mapped_column("device_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location_id: Mapped[str] = mapped_column("location_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    source_id: Mapped[str] = mapped_column("source_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zonal_id: Mapped[str] = mapped_column("zonal_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class CEMSLocationMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'cems_location_master'
    
    bu_id: str
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    device_name: str
    location_name: str
    location_id: str
    source_id: str
    zonal_id: str
    district: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CEMSLocationMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'zone', 'region', 'location_id:sap_id']


class CEMSLocationMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'cems_location_master'
    
    bu_id: typing.Optional[str] | None = None
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    device_name: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    location_id: typing.Optional[str] | None = None
    source_id: typing.Optional[str] | None = None
    zonal_id: typing.Optional[str] | None = None
    district: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CEMSLocationMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'zone', 'region', 'location_id:sap_id']


class CEMSLocationMasterGetResp(pydantic.BaseModel):
    data: typing.List[CEMSLocationMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Cemslocationmaster_Upload_Cems_Location_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Cemslocationmaster_Download_Cems_Location_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Cemslocationmaster_Download_TemplateParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class CEMSQuantityMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'cems_quantity_master'
    
    quantity_name: Mapped[str] = mapped_column("quantity_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    quantity_id: Mapped[str] = mapped_column("quantity_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    unit: Mapped[str] = mapped_column("unit", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class CEMSQuantityMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'cems_quantity_master'
    
    quantity_name: str
    quantity_id: str
    unit: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CEMSQuantityMasterSchema
        upsert_keys = []


class CEMSQuantityMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'cems_quantity_master'
    
    quantity_name: typing.Optional[str] | None = None
    quantity_id: typing.Optional[str] | None = None
    unit: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CEMSQuantityMasterSchema
        upsert_keys = []


class CEMSQuantityMasterGetResp(pydantic.BaseModel):
    data: typing.List[CEMSQuantityMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class TagsCreate(pydantic.BaseModel):
    name: str
    value: str


class CredentialDataCreate(pydantic.BaseModel):
    host: typing.Optional[str] = pydantic.Field("", **{})
    port: typing.Optional[str] = pydantic.Field("", **{})
    access_key: typing.Optional[str] = pydantic.Field("", **{})
    secret_key: typing.Optional[urdhva_base.types.Secret] | None = None
    user_name: typing.Optional[str] = pydantic.Field("", **{})
    password: typing.Optional[urdhva_base.types.Secret] | None = None
    fingerprint: typing.Optional[str] = pydantic.Field("", **{})
    tenancy: typing.Optional[str] = pydantic.Field("", **{})
    key_file: typing.Optional[str] = pydantic.Field("", **{})
    key_content: typing.Optional[str] = pydantic.Field("", **{})
    client_id: typing.Optional[str] = pydantic.Field("", **{})
    client_secret: typing.Optional[urdhva_base.types.Secret] | None = None
    tenant_id: typing.Optional[str] = pydantic.Field("", **{})
    private_pass: typing.Optional[urdhva_base.types.Secret] | None = None
    private_key_pass: typing.Optional[urdhva_base.types.Secret] | None = None
    source_path: typing.Optional[str] = pydantic.Field("", **{})
    dest_path: typing.Optional[str] = pydantic.Field("", **{})
    api_key: typing.Optional[urdhva_base.types.Secret] | None = None
    database_name: typing.Optional[str] = pydantic.Field("", **{})
    other_details: typing.Optional[str] = pydantic.Field("", **{})


class CredsModelSchema(UrdhvaPostgresBase):
    __tablename__ = 'creds_model'
    
    name: Mapped[str] = mapped_column("name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cred_model: Mapped[str] = mapped_column("cred_model", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cred_type: Mapped[str] = mapped_column("cred_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    credentials: Mapped[typing.Any] = mapped_column("credentials", JSONB, index=False, nullable=False, default=None, primary_key=False, unique=False)


class CredsModelCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'creds_model'
    
    name: str
    cred_model: str
    cred_type: str
    credentials: CredentialDataCreate

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CredsModelSchema
        upsert_keys = []


class CredsModel(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'creds_model'
    
    name: typing.Optional[str] | None = None
    cred_model: typing.Optional[str] | None = None
    cred_type: typing.Optional[str] | None = None
    credentials: typing.Optional[CredentialDataCreate] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CredsModelSchema
        upsert_keys = []


class CredsModelGetResp(pydantic.BaseModel):
    data: typing.List[CredsModel]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Credsmodel_Create_CredentialParams(pydantic.BaseModel):
    record_id: typing.Optional[int] = pydantic.Field(0, **{})
    name: str
    cred_model: str
    cred_type: str
    tags: typing.Optional[typing.List[TagsCreate]] | None = None
    credentials: CredentialDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Credsmodel_Load_CredsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class DashboardOrderCreate(pydantic.BaseModel):
    dashboard_id: int
    display_name: str


class GroupsDataCreate(pydantic.BaseModel):
    group_id: int
    name: str
    description: typing.Optional[str] = pydantic.Field("", **{})
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    created_user: typing.Optional[str] = pydantic.Field("", **{})
    dashboard_order: typing.Optional[typing.List[DashboardOrderCreate]] | None = None
    group_order: typing.Optional[int] = pydantic.Field(0, **{})
    organization_id: int


class productsDetailsCreate(pydantic.BaseModel):
    prod_code: typing.Optional[str] = pydantic.Field("", **{})
    uom: typing.Optional[str] = pydantic.Field("", **{})
    qty: typing.Optional[str] = pydantic.Field("", **{})


class IndentDryOutDataFiltersCreate(pydantic.BaseModel):
    key: str = pydantic.Field(**{'pattern': '^[a-zA-Z0-9_.\\-=" ]+$'})
    cond: str = pydantic.Field(**{'pattern': '^([a-zA-Z0-9_.\\-=! ]+|)$'})
    value: typing.List[str]


class DryOutHistorySchema(UrdhvaPostgresBase):
    __tablename__ = 'dry_out_history'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=True, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[str] = mapped_column("name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    product_no: Mapped[str] = mapped_column("product_no", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    item_name: Mapped[str] = mapped_column("item_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    plant_id: Mapped[str] = mapped_column("plant_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    plant_name: Mapped[str] = mapped_column("plant_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Any] = mapped_column("status", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    dry_out_in_days: Mapped[typing.Optional[str]] = mapped_column("dry_out_in_days", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dry_out_start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("dry_out_start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    dry_out_end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("dry_out_end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    intra_day_dry_out_start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("intra_day_dry_out_start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    intra_day_dry_out_end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("intra_day_dry_out_end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)


class DryOutHistoryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'dry_out_history'
    
    bu: str
    sap_id: str
    name: str
    start_time: typing.Optional[datetime.datetime] | None = None
    end_time: typing.Optional[datetime.datetime] | None = None
    product_no: str
    item_name: str
    plant_id: str
    plant_name: str
    category: typing.Optional[str] = pydantic.Field("", **{})
    status: hpcl_ceg_enum.AlertStatus
    dry_out_in_days: typing.Optional[str] = pydantic.Field("", **{})
    dry_out_start_time: typing.Optional[datetime.datetime] | None = None
    dry_out_end_time: typing.Optional[datetime.datetime] | None = None
    intra_day_dry_out_start_time: typing.Optional[datetime.datetime] | None = None
    intra_day_dry_out_end_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DryOutHistorySchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class DryOutHistory(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'dry_out_history'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    name: typing.Optional[str] | None = None
    start_time: typing.Optional[datetime.datetime] | None = None
    end_time: typing.Optional[datetime.datetime] | None = None
    product_no: typing.Optional[str] | None = None
    item_name: typing.Optional[str] | None = None
    plant_id: typing.Optional[str] | None = None
    plant_name: typing.Optional[str] | None = None
    category: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    dry_out_in_days: typing.Optional[str] = pydantic.Field("", **{})
    dry_out_start_time: typing.Optional[datetime.datetime] | None = None
    dry_out_end_time: typing.Optional[datetime.datetime] | None = None
    intra_day_dry_out_start_time: typing.Optional[datetime.datetime] | None = None
    intra_day_dry_out_end_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DryOutHistorySchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class DryOutHistoryGetResp(pydantic.BaseModel):
    data: typing.List[DryOutHistory]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class CarryFwdIndentSchema(UrdhvaPostgresBase):
    __tablename__ = 'carry_fwd_indent'
    
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    terminal_plant_id: Mapped[typing.Optional[str]] = mapped_column("terminal_plant_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    indent_no: Mapped[str] = mapped_column("indent_no", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    prod_reqd_dt: Mapped[datetime.datetime] = mapped_column("prod_reqd_dt", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    reported_date: Mapped[datetime.datetime] = mapped_column("reported_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    dry_out_in_days: Mapped[typing.Optional[str]] = mapped_column("dry_out_in_days", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dried_out: Mapped[typing.Optional[bool]] = mapped_column("dried_out", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class CarryFwdIndentCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'carry_fwd_indent'
    
    sap_id: str
    terminal_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    indent_no: str
    prod_reqd_dt: datetime.datetime
    reported_date: datetime.datetime
    dry_out_in_days: typing.Optional[str] = pydantic.Field("", **{})
    dried_out: typing.Optional[bool] = pydantic.Field(False, )
    category: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CarryFwdIndentSchema
        upsert_keys = []


class CarryFwdIndent(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'carry_fwd_indent'
    
    sap_id: typing.Optional[str] | None = None
    terminal_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    indent_no: typing.Optional[str] | None = None
    prod_reqd_dt: typing.Optional[datetime.datetime] | None = None
    reported_date: typing.Optional[datetime.datetime] | None = None
    dry_out_in_days: typing.Optional[str] = pydantic.Field("", **{})
    dried_out: typing.Optional[bool] = pydantic.Field(False, )
    category: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CarryFwdIndentSchema
        upsert_keys = []


class CarryFwdIndentGetResp(pydantic.BaseModel):
    data: typing.List[CarryFwdIndent]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class IndentDryOutSchema(UrdhvaPostgresBase):
    __tablename__ = 'indent_dry_out'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=True, unique=False)
    site_id: Mapped[str] = mapped_column("site_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    fcc_code: Mapped[str] = mapped_column("fcc_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    tank_no: Mapped[str] = mapped_column("tank_no", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    product_no: Mapped[str] = mapped_column("product_no", String, index=True, nullable=False, default=None, primary_key=True, unique=False)
    item_name: Mapped[str] = mapped_column("item_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    capacity: Mapped[int] = mapped_column("capacity", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    volume: Mapped[typing.Optional[float]] = mapped_column("volume", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    ullage: Mapped[typing.Optional[float]] = mapped_column("ullage", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    avgsales_7days: Mapped[typing.Optional[float]] = mapped_column("avgsales_7days", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    stock_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("stock_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    status: Mapped[typing.Optional[int]] = mapped_column("status", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    daysstatus: Mapped[typing.Optional[int]] = mapped_column("daysstatus", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    lastrocdate: Mapped[typing.Optional[datetime.datetime]] = mapped_column("lastrocdate", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    executed_on: Mapped[typing.Optional[datetime.datetime]] = mapped_column("executed_on", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    pumpable_stock: Mapped[typing.Optional[float]] = mapped_column("pumpable_stock", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    rosapcode: Mapped[typing.Optional[int]] = mapped_column("rosapcode", Integer, index=True, nullable=True, default=0, primary_key=True, unique=False)
    product_grp: Mapped[typing.Optional[str]] = mapped_column("product_grp", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    interlock_status: Mapped[typing.Optional[typing.Any]] = mapped_column("interlock_status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    interlock_created_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("interlock_created_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    interlock_closed_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("interlock_closed_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(bu, product_no, rosapcode, name="indent_dry_out_bu_product_no_rosapcode"),)


class IndentDryOutCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'indent_dry_out'
    
    bu: str
    site_id: str
    fcc_code: str
    tank_no: str
    product_no: str
    item_name: str
    capacity: int
    volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    ullage: typing.Optional[float] = pydantic.Field(0.0, **{})
    avgsales_7days: typing.Optional[float] = pydantic.Field(0.0, **{})
    stock_date: typing.Optional[datetime.datetime] | None = None
    status: typing.Optional[int] = pydantic.Field(0, **{})
    daysstatus: typing.Optional[int] = pydantic.Field(0, **{})
    lastrocdate: typing.Optional[datetime.datetime] | None = None
    executed_on: typing.Optional[datetime.datetime] | None = None
    pumpable_stock: typing.Optional[float] = pydantic.Field(0.0, **{})
    rosapcode: typing.Optional[int] = pydantic.Field(0, **{})
    product_grp: typing.Optional[str] = pydantic.Field("", **{})
    interlock_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    interlock_created_date: typing.Optional[datetime.datetime] | None = None
    interlock_closed_date: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = IndentDryOutSchema
        upsert_keys = ['bu', 'product_no', 'rosapcode']
        access_key_mapping = ['bu', 'zone', 'region', 'sales_area', 'site_id:sap_id']


class IndentDryOut(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'indent_dry_out'
    
    bu: typing.Optional[str] | None = None
    site_id: typing.Optional[str] | None = None
    fcc_code: typing.Optional[str] | None = None
    tank_no: typing.Optional[str] | None = None
    product_no: typing.Optional[str] | None = None
    item_name: typing.Optional[str] | None = None
    capacity: typing.Optional[int] | None = None
    volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    ullage: typing.Optional[float] = pydantic.Field(0.0, **{})
    avgsales_7days: typing.Optional[float] = pydantic.Field(0.0, **{})
    stock_date: typing.Optional[datetime.datetime] | None = None
    status: typing.Optional[int] = pydantic.Field(0, **{})
    daysstatus: typing.Optional[int] = pydantic.Field(0, **{})
    lastrocdate: typing.Optional[datetime.datetime] | None = None
    executed_on: typing.Optional[datetime.datetime] | None = None
    pumpable_stock: typing.Optional[float] = pydantic.Field(0.0, **{})
    rosapcode: typing.Optional[int] = pydantic.Field(0, **{})
    product_grp: typing.Optional[str] = pydantic.Field("", **{})
    interlock_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    interlock_created_date: typing.Optional[datetime.datetime] | None = None
    interlock_closed_date: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = IndentDryOutSchema
        upsert_keys = ['bu', 'product_no', 'rosapcode']
        access_key_mapping = ['bu', 'zone', 'region', 'sales_area', 'site_id:sap_id']


class IndentDryOutGetResp(pydantic.BaseModel):
    data: typing.List[IndentDryOut]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Indentdryout_Sync_Data_From_Cris_To_CegParams(pydantic.BaseModel):
    source_connection: str
    destination_connection: str
    source_table: str
    destination_table: str
    source_schema: typing.Optional[str] = pydantic.Field("", **{})
    destination_schema: str
    conflict_columns: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Dried_Out_PlantsParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Alert_HistoryParams(pydantic.BaseModel):
    alert_id: int

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Dry_Out_StatsParams(pydantic.BaseModel):
    filters: typing.List[DataFiltersCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Indent_AnalysisParams(pydantic.BaseModel):
    filters: typing.List[DataFiltersCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Distinct_PlantParams(pydantic.BaseModel):
    bu: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Distinct_Location_DetailsParams(pydantic.BaseModel):
    bu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sales_area: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    plant: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    cat_a_dealers: typing.Optional[bool] = pydantic.Field(False, )
    dry_out_dealers: typing.Optional[bool] = pydantic.Field(False, )
    location_onboard: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Create_Dry_Out_AlertParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Sync_Ro_Daily_SalesParams(pydantic.BaseModel):
    from_date: datetime.datetime
    to_date: datetime.datetime

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Dry_Out_CountParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[IndentDryOutDataFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Filtered_Location_DataParams(pydantic.BaseModel):
    request_parameter: str
    bu: str
    filters: typing.Optional[typing.List[IndentDryOutDataFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Indent_DataParams(pydantic.BaseModel):
    filters: typing.List[DataFiltersCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Dried_Out_RoParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Dried_Out_Ro_By_ActionsParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})
    actions: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Indent_Raised_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Indent_On_Hold_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Pending_Indents_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Valid_Indent_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Cancelled_Indent_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Truck_Allocated_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Send_To_Sap_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Sales_Order_Placed_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_R2_Swipe_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Is_Invoice_Created_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_R3_Swiped_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Vts_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Delivery_Confirmation_Direct_SalesParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]
    bu_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Block_OutletParams(pydantic.BaseModel):
    block_id: str
    remarks_blocked: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Unblock_OutletParams(pydantic.BaseModel):
    unblock_id: str
    remarks_unblocked: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Block_RoParams(pydantic.BaseModel):
    ro_code: str
    remarks_blocked: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Bulk_Outlet_BlockParams(pydantic.BaseModel):
    alert_id: typing.List[str]
    reason: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Bulk_Outlet_UnblockParams(pydantic.BaseModel):
    alert_id: typing.List[str]
    reason: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Dried_Out_Ro_DataParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Distinct_Ro_NameParams(pydantic.BaseModel):
    filters: typing.List[IndentDryOutDataFiltersCreate]

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Carry_Fwd_IndentsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Get_Dryout_ReportParams(pydantic.BaseModel):
    dry_out_in_days: typing.List[str]
    action: typing.Optional[str] = pydantic.Field("", **{})
    page: typing.Optional[int] = pydantic.Field(0, **{})
    page_size: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Indentdryout_Generate_Dryout_Group_DataParams(pydantic.BaseModel):
    action: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LpgPlantOperationsSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_plant_operations'
    
    carousel: Mapped[str] = mapped_column("carousel", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    filling_head: Mapped[str] = mapped_column("filling_head", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    process_date: Mapped[datetime.datetime] = mapped_column("process_date", DateTime(timezone=True), index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[str]] = mapped_column("sales_area", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    normal_net_hours: Mapped[typing.Optional[float]] = mapped_column("normal_net_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    normal_gap_hrs: Mapped[typing.Optional[float]] = mapped_column("normal_gap_hrs", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    normal_total_production: Mapped[typing.Optional[float]] = mapped_column("normal_total_production", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    normal_productivity: Mapped[typing.Optional[float]] = mapped_column("normal_productivity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    break_net_hours: Mapped[typing.Optional[float]] = mapped_column("break_net_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    break_gap_hrs: Mapped[typing.Optional[float]] = mapped_column("break_gap_hrs", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    break_total_production: Mapped[typing.Optional[float]] = mapped_column("break_total_production", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    break_productivity: Mapped[typing.Optional[float]] = mapped_column("break_productivity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    overtime_net_hours: Mapped[typing.Optional[float]] = mapped_column("overtime_net_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    overtime_gap_hrs: Mapped[typing.Optional[float]] = mapped_column("overtime_gap_hrs", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    overtime_total_production: Mapped[typing.Optional[float]] = mapped_column("overtime_total_production", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    overtime_productivity: Mapped[typing.Optional[float]] = mapped_column("overtime_productivity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    total_net_hours: Mapped[typing.Optional[float]] = mapped_column("total_net_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    total_production: Mapped[typing.Optional[float]] = mapped_column("total_production", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    total_productivity: Mapped[typing.Optional[float]] = mapped_column("total_productivity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_handled: Mapped[typing.Optional[float]] = mapped_column("cs_handled", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_sortout: Mapped[typing.Optional[float]] = mapped_column("cs_sortout", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_rejection: Mapped[typing.Optional[float]] = mapped_column("cs_rejection", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_underfilled: Mapped[typing.Optional[float]] = mapped_column("cs_underfilled", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_overfilled: Mapped[typing.Optional[float]] = mapped_column("cs_overfilled", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_other_errors: Mapped[typing.Optional[float]] = mapped_column("cs_other_errors", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    gd_handled: Mapped[typing.Optional[float]] = mapped_column("gd_handled", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    gd_sortout: Mapped[typing.Optional[float]] = mapped_column("gd_sortout", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    gd_rejection: Mapped[typing.Optional[float]] = mapped_column("gd_rejection", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    pt_handled: Mapped[typing.Optional[float]] = mapped_column("pt_handled", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    pt_sortout: Mapped[typing.Optional[float]] = mapped_column("pt_sortout", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    pt_rejection: Mapped[typing.Optional[float]] = mapped_column("pt_rejection", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    production_14_2kg: Mapped[typing.Optional[float]] = mapped_column("production_14_2kg", Numeric, index=False, nullable=True, default=0, primary_key=False, unique=False)
    production_19kg: Mapped[typing.Optional[float]] = mapped_column("production_19kg", Numeric, index=False, nullable=True, default=0, primary_key=False, unique=False)
    fst_cyl_production: Mapped[typing.Optional[datetime.datetime]] = mapped_column("fst_cyl_production", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    lst_cyl_production: Mapped[typing.Optional[datetime.datetime]] = mapped_column("lst_cyl_production", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    total_bottling_hours: Mapped[typing.Optional[float]] = mapped_column("total_bottling_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    net_bottling_hours: Mapped[typing.Optional[float]] = mapped_column("net_bottling_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    stoppage_hours: Mapped[typing.Optional[float]] = mapped_column("stoppage_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    lpg_breakdown: Mapped[typing.Optional[float]] = mapped_column("lpg_breakdown", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    late_start: Mapped[typing.Optional[float]] = mapped_column("late_start", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    early_stop: Mapped[typing.Optional[float]] = mapped_column("early_stop", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    intervening_gaps: Mapped[typing.Optional[float]] = mapped_column("intervening_gaps", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)


class LpgPlantOperationsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_plant_operations'
    
    carousel: str
    filling_head: str
    process_date: datetime.datetime
    sap_id: str
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    normal_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_gap_hrs: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_gap_hrs: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_gap_hrs: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_underfilled: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_overfilled: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_other_errors: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    production_14_2kg: typing.Optional[float] = pydantic.Field(0, **{})
    production_19kg: typing.Optional[float] = pydantic.Field(0, **{})
    fst_cyl_production: typing.Optional[datetime.datetime] | None = None
    lst_cyl_production: typing.Optional[datetime.datetime] | None = None
    total_bottling_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    net_bottling_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    stoppage_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    lpg_breakdown: typing.Optional[float] = pydantic.Field(0.0, **{})
    late_start: typing.Optional[float] = pydantic.Field(0.0, **{})
    early_stop: typing.Optional[float] = pydantic.Field(0.0, **{})
    intervening_gaps: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgPlantOperationsSchema
        upsert_keys = []


class LpgPlantOperations(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_plant_operations'
    
    carousel: typing.Optional[str] | None = None
    filling_head: typing.Optional[str] | None = None
    process_date: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    normal_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_gap_hrs: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_gap_hrs: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_gap_hrs: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_underfilled: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_overfilled: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_other_errors: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    production_14_2kg: typing.Optional[float] = pydantic.Field(0, **{})
    production_19kg: typing.Optional[float] = pydantic.Field(0, **{})
    fst_cyl_production: typing.Optional[datetime.datetime] | None = None
    lst_cyl_production: typing.Optional[datetime.datetime] | None = None
    total_bottling_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    net_bottling_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    stoppage_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    lpg_breakdown: typing.Optional[float] = pydantic.Field(0.0, **{})
    late_start: typing.Optional[float] = pydantic.Field(0.0, **{})
    early_stop: typing.Optional[float] = pydantic.Field(0.0, **{})
    intervening_gaps: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgPlantOperationsSchema
        upsert_keys = []


class LpgPlantOperationsGetResp(pydantic.BaseModel):
    data: typing.List[LpgPlantOperations]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpgplantoperations_Check_Connection_StatusParams(pydantic.BaseModel):
    sap_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LpgPlantOperationsResyncSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_plant_operations_resync'
    
    carousel: Mapped[str] = mapped_column("carousel", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    filling_head: Mapped[str] = mapped_column("filling_head", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    process_date: Mapped[datetime.datetime] = mapped_column("process_date", DateTime(timezone=True), index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[str]] = mapped_column("sales_area", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    normal_net_hours: Mapped[typing.Optional[float]] = mapped_column("normal_net_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    normal_total_production: Mapped[typing.Optional[float]] = mapped_column("normal_total_production", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    normal_productivity: Mapped[typing.Optional[float]] = mapped_column("normal_productivity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    break_net_hours: Mapped[typing.Optional[float]] = mapped_column("break_net_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    break_total_production: Mapped[typing.Optional[float]] = mapped_column("break_total_production", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    break_productivity: Mapped[typing.Optional[float]] = mapped_column("break_productivity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    overtime_net_hours: Mapped[typing.Optional[float]] = mapped_column("overtime_net_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    overtime_total_production: Mapped[typing.Optional[float]] = mapped_column("overtime_total_production", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    overtime_productivity: Mapped[typing.Optional[float]] = mapped_column("overtime_productivity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    total_net_hours: Mapped[typing.Optional[float]] = mapped_column("total_net_hours", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    total_production: Mapped[typing.Optional[float]] = mapped_column("total_production", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    total_productivity: Mapped[typing.Optional[float]] = mapped_column("total_productivity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_handled: Mapped[typing.Optional[float]] = mapped_column("cs_handled", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_sortout: Mapped[typing.Optional[float]] = mapped_column("cs_sortout", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    cs_rejection: Mapped[typing.Optional[float]] = mapped_column("cs_rejection", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    gd_handled: Mapped[typing.Optional[float]] = mapped_column("gd_handled", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    gd_sortout: Mapped[typing.Optional[float]] = mapped_column("gd_sortout", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    gd_rejection: Mapped[typing.Optional[float]] = mapped_column("gd_rejection", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    pt_handled: Mapped[typing.Optional[float]] = mapped_column("pt_handled", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    pt_sortout: Mapped[typing.Optional[float]] = mapped_column("pt_sortout", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    pt_rejection: Mapped[typing.Optional[float]] = mapped_column("pt_rejection", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    production_14_2kg: Mapped[typing.Optional[float]] = mapped_column("production_14_2kg", Numeric, index=False, nullable=True, default=0, primary_key=False, unique=False)
    production_19kg: Mapped[typing.Optional[float]] = mapped_column("production_19kg", Numeric, index=False, nullable=True, default=0, primary_key=False, unique=False)


class LpgPlantOperationsResyncCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_plant_operations_resync'
    
    carousel: str
    filling_head: str
    process_date: datetime.datetime
    sap_id: str
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    normal_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    production_14_2kg: typing.Optional[float] = pydantic.Field(0, **{})
    production_19kg: typing.Optional[float] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgPlantOperationsResyncSchema
        upsert_keys = []


class LpgPlantOperationsResync(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_plant_operations_resync'
    
    carousel: typing.Optional[str] | None = None
    filling_head: typing.Optional[str] | None = None
    process_date: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    normal_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    normal_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    break_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    overtime_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_net_hours: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_production: typing.Optional[float] = pydantic.Field(0.0, **{})
    total_productivity: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    cs_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    gd_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_handled: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_sortout: typing.Optional[float] = pydantic.Field(0.0, **{})
    pt_rejection: typing.Optional[float] = pydantic.Field(0.0, **{})
    production_14_2kg: typing.Optional[float] = pydantic.Field(0, **{})
    production_19kg: typing.Optional[float] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgPlantOperationsResyncSchema
        upsert_keys = []


class LpgPlantOperationsResyncGetResp(pydantic.BaseModel):
    data: typing.List[LpgPlantOperationsResync]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class LpgOperationsSummarySchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_operations_summary'
    
    is_additional_carousel: Mapped[float] = mapped_column("is_additional_carousel", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    short_name: Mapped[str] = mapped_column("short_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[str] = mapped_column("name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    carousel: Mapped[float] = mapped_column("carousel", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    filling_heads: Mapped[str] = mapped_column("filling_heads", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    carousel_count: Mapped[float] = mapped_column("carousel_count", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bottling_14_2kg: Mapped[float] = mapped_column("bottling_14_2kg", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bottling_19kg: Mapped[float] = mapped_column("bottling_19kg", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bottling_total: Mapped[float] = mapped_column("bottling_total", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_normal_production: Mapped[float] = mapped_column("productivity_normal_production", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_normal_stoppages: Mapped[float] = mapped_column("productivity_normal_stoppages", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_normal_productivity: Mapped[float] = mapped_column("productivity_normal_productivity", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_break_production: Mapped[float] = mapped_column("productivity_break_production", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_break_net_hours: Mapped[float] = mapped_column("productivity_break_net_hours", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_break_productivity: Mapped[float] = mapped_column("productivity_break_productivity", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_overtime_production: Mapped[float] = mapped_column("productivity_overtime_production", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_overtime_net_hours: Mapped[float] = mapped_column("productivity_overtime_net_hours", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    productivity_overtime_productivity: Mapped[float] = mapped_column("productivity_overtime_productivity", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    rejection_eld_percent: Mapped[float] = mapped_column("rejection_eld_percent", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    rejection_ort_percent: Mapped[float] = mapped_column("rejection_ort_percent", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    rejection_cs_percent: Mapped[float] = mapped_column("rejection_cs_percent", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    process_date: Mapped[datetime.datetime] = mapped_column("process_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[str] = mapped_column("region", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    site_area: Mapped[str] = mapped_column("site_area", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgOperationsSummaryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_operations_summary'
    
    is_additional_carousel: float
    short_name: str
    name: str
    zone: str
    carousel: float
    filling_heads: str
    carousel_count: float
    bottling_14_2kg: float
    bottling_19kg: float
    bottling_total: float
    productivity_normal_production: float
    productivity_normal_stoppages: float
    productivity_normal_productivity: float
    productivity_break_production: float
    productivity_break_net_hours: float
    productivity_break_productivity: float
    productivity_overtime_production: float
    productivity_overtime_net_hours: float
    productivity_overtime_productivity: float
    rejection_eld_percent: float
    rejection_ort_percent: float
    rejection_cs_percent: float
    process_date: datetime.datetime
    bu: str
    sap_id: str
    region: str
    site_area: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgOperationsSummarySchema
        upsert_keys = []
        access_key_mapping = ['sap_id:sap_id', 'short_name:plant', 'zone:zone', 'region:region']


class LpgOperationsSummary(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_operations_summary'
    
    is_additional_carousel: typing.Optional[float] | None = None
    short_name: typing.Optional[str] | None = None
    name: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    carousel: typing.Optional[float] | None = None
    filling_heads: typing.Optional[str] | None = None
    carousel_count: typing.Optional[float] | None = None
    bottling_14_2kg: typing.Optional[float] | None = None
    bottling_19kg: typing.Optional[float] | None = None
    bottling_total: typing.Optional[float] | None = None
    productivity_normal_production: typing.Optional[float] | None = None
    productivity_normal_stoppages: typing.Optional[float] | None = None
    productivity_normal_productivity: typing.Optional[float] | None = None
    productivity_break_production: typing.Optional[float] | None = None
    productivity_break_net_hours: typing.Optional[float] | None = None
    productivity_break_productivity: typing.Optional[float] | None = None
    productivity_overtime_production: typing.Optional[float] | None = None
    productivity_overtime_net_hours: typing.Optional[float] | None = None
    productivity_overtime_productivity: typing.Optional[float] | None = None
    rejection_eld_percent: typing.Optional[float] | None = None
    rejection_ort_percent: typing.Optional[float] | None = None
    rejection_cs_percent: typing.Optional[float] | None = None
    process_date: typing.Optional[datetime.datetime] | None = None
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    region: typing.Optional[str] | None = None
    site_area: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgOperationsSummarySchema
        upsert_keys = []
        access_key_mapping = ['sap_id:sap_id', 'short_name:plant', 'zone:zone', 'region:region']


class LpgOperationsSummaryGetResp(pydantic.BaseModel):
    data: typing.List[LpgOperationsSummary]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpgoperationssummary_Get_Productions_RateParams(pydantic.BaseModel):
    dimension: str
    daywise: bool
    days: int
    top: typing.Optional[int] = pydantic.Field(0, **{})
    bottom: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgoperationssummary_Get_Productivity_RateParams(pydantic.BaseModel):
    dimension: str
    daywise: bool
    days: int
    top: typing.Optional[int] = pydantic.Field(0, **{})
    bottom: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LpgCsRejectionsSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_cs_rejections'
    
    process_date: Mapped[datetime.datetime] = mapped_column("process_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    system_id: Mapped[float] = mapped_column("system_id", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cyl_type: Mapped[str] = mapped_column("cyl_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    total: Mapped[float] = mapped_column("total", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cylfilled: Mapped[float] = mapped_column("cylfilled", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    totalsortout: Mapped[float] = mapped_column("totalsortout", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    commerrorsortout: Mapped[float] = mapped_column("commerrorsortout", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sortoutpercentage: Mapped[float] = mapped_column("sortoutpercentage", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    plant: Mapped[str] = mapped_column("plant", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    execution__date: Mapped[datetime.datetime] = mapped_column("execution__date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    max_date: Mapped[datetime.datetime] = mapped_column("max_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[str] = mapped_column("region", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgCsRejectionsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_cs_rejections'
    
    process_date: datetime.datetime
    system_id: float
    cyl_type: str
    total: float
    cylfilled: float
    totalsortout: float
    commerrorsortout: float
    sortoutpercentage: float
    plant: str
    zone: str
    execution__date: datetime.datetime
    max_date: datetime.datetime
    sap_id: str
    region: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgCsRejectionsSchema
        upsert_keys = []
        access_key_mapping = ['sap_id:sap_id', 'plant:plant', 'zone:zone', 'region:region']


class LpgCsRejections(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_cs_rejections'
    
    process_date: typing.Optional[datetime.datetime] | None = None
    system_id: typing.Optional[float] | None = None
    cyl_type: typing.Optional[str] | None = None
    total: typing.Optional[float] | None = None
    cylfilled: typing.Optional[float] | None = None
    totalsortout: typing.Optional[float] | None = None
    commerrorsortout: typing.Optional[float] | None = None
    sortoutpercentage: typing.Optional[float] | None = None
    plant: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    execution__date: typing.Optional[datetime.datetime] | None = None
    max_date: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] | None = None
    region: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgCsRejectionsSchema
        upsert_keys = []
        access_key_mapping = ['sap_id:sap_id', 'plant:plant', 'zone:zone', 'region:region']


class LpgCsRejectionsGetResp(pydantic.BaseModel):
    data: typing.List[LpgCsRejections]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class LpgGdRejectionsSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_gd_rejections'
    
    process_date: Mapped[datetime.datetime] = mapped_column("process_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    system_id: Mapped[float] = mapped_column("system_id", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cyl_type: Mapped[str] = mapped_column("cyl_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    total: Mapped[float] = mapped_column("total", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sortout: Mapped[float] = mapped_column("sortout", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sortoutpercentage: Mapped[float] = mapped_column("sortoutpercentage", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    plant: Mapped[str] = mapped_column("plant", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    execution__date: Mapped[datetime.datetime] = mapped_column("execution__date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    max_date: Mapped[datetime.datetime] = mapped_column("max_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[str] = mapped_column("region", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgGdRejectionsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_gd_rejections'
    
    process_date: datetime.datetime
    system_id: float
    cyl_type: str
    total: float
    sortout: float
    sortoutpercentage: float
    plant: str
    zone: str
    execution__date: datetime.datetime
    max_date: datetime.datetime
    sap_id: str
    region: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgGdRejectionsSchema
        upsert_keys = []
        access_key_mapping = ['sap_id:sap_id', 'plant:plant', 'zone:zone', 'region:region']


class LpgGdRejections(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_gd_rejections'
    
    process_date: typing.Optional[datetime.datetime] | None = None
    system_id: typing.Optional[float] | None = None
    cyl_type: typing.Optional[str] | None = None
    total: typing.Optional[float] | None = None
    sortout: typing.Optional[float] | None = None
    sortoutpercentage: typing.Optional[float] | None = None
    plant: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    execution__date: typing.Optional[datetime.datetime] | None = None
    max_date: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] | None = None
    region: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgGdRejectionsSchema
        upsert_keys = []
        access_key_mapping = ['sap_id:sap_id', 'plant:plant', 'zone:zone', 'region:region']


class LpgGdRejectionsGetResp(pydantic.BaseModel):
    data: typing.List[LpgGdRejections]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class LpgPtRejectionsSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_pt_rejections'
    
    process_date: Mapped[datetime.datetime] = mapped_column("process_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    system_id: Mapped[float] = mapped_column("system_id", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cyl_type: Mapped[str] = mapped_column("cyl_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    total: Mapped[float] = mapped_column("total", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sortout: Mapped[float] = mapped_column("sortout", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sortoutpercentage: Mapped[float] = mapped_column("sortoutpercentage", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    plant: Mapped[str] = mapped_column("plant", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    execution__date: Mapped[datetime.datetime] = mapped_column("execution__date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    max_date: Mapped[datetime.datetime] = mapped_column("max_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[str] = mapped_column("region", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgPtRejectionsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_pt_rejections'
    
    process_date: datetime.datetime
    system_id: float
    cyl_type: str
    total: float
    sortout: float
    sortoutpercentage: float
    plant: str
    zone: str
    execution__date: datetime.datetime
    max_date: datetime.datetime
    sap_id: str
    region: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgPtRejectionsSchema
        upsert_keys = []
        access_key_mapping = ['sap_id:sap_id', 'plant:plant', 'zone:zone', 'region:region']


class LpgPtRejections(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_pt_rejections'
    
    process_date: typing.Optional[datetime.datetime] | None = None
    system_id: typing.Optional[float] | None = None
    cyl_type: typing.Optional[str] | None = None
    total: typing.Optional[float] | None = None
    sortout: typing.Optional[float] | None = None
    sortoutpercentage: typing.Optional[float] | None = None
    plant: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    execution__date: typing.Optional[datetime.datetime] | None = None
    max_date: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] | None = None
    region: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgPtRejectionsSchema
        upsert_keys = []
        access_key_mapping = ['sap_id:sap_id', 'plant:plant', 'zone:zone', 'region:region']


class LpgPtRejectionsGetResp(pydantic.BaseModel):
    data: typing.List[LpgPtRejections]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class LpgRejectionsSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_rejections'


class LpgRejectionsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_rejections'

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgRejectionsSchema
        upsert_keys = []


class LpgRejections(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_rejections'

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgRejectionsSchema
        upsert_keys = []


class LpgRejectionsGetResp(pydantic.BaseModel):
    data: typing.List[LpgRejections]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpgrejections_Get_RejectionsParams(pydantic.BaseModel):
    dimension: str
    daywise: bool
    days: int
    top: typing.Optional[int] = pydantic.Field(0, **{})
    bottom: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgrejections_Get_Cs_RejectionsParams(pydantic.BaseModel):
    dimension: str
    daywise: bool
    days: int
    top: typing.Optional[int] = pydantic.Field(0, **{})
    bottom: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgrejections_Get_Gd_RejectionsParams(pydantic.BaseModel):
    dimension: str
    daywise: bool
    days: int
    top: typing.Optional[int] = pydantic.Field(0, **{})
    bottom: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgrejections_Get_Pt_RejectionsParams(pydantic.BaseModel):
    dimension: str
    daywise: bool
    days: int
    top: typing.Optional[int] = pydantic.Field(0, **{})
    bottom: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LpgSalesSummaryDataSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_sales_summary_data'
    
    jde_distributor_code: Mapped[int] = mapped_column("jde_distributor_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    consumer_type: Mapped[str] = mapped_column("consumer_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    is_prepaid: Mapped[str] = mapped_column("is_prepaid", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cyl_type: Mapped[str] = mapped_column("cyl_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    order_source_code: Mapped[str] = mapped_column("order_source_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_0_d: Mapped[int] = mapped_column("pending_0_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_1_d: Mapped[int] = mapped_column("pending_1_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_2_d: Mapped[int] = mapped_column("pending_2_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_3_d: Mapped[int] = mapped_column("pending_3_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_4_d: Mapped[int] = mapped_column("pending_4_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_5_d: Mapped[int] = mapped_column("pending_5_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_6_d: Mapped[int] = mapped_column("pending_6_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_7_d: Mapped[int] = mapped_column("pending_7_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_8_d: Mapped[int] = mapped_column("pending_8_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_9_d: Mapped[int] = mapped_column("pending_9_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_10_d: Mapped[int] = mapped_column("pending_10_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_11_d: Mapped[int] = mapped_column("pending_11_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_12_d: Mapped[int] = mapped_column("pending_12_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_13_d: Mapped[int] = mapped_column("pending_13_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_14_d: Mapped[int] = mapped_column("pending_14_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_15_d: Mapped[int] = mapped_column("pending_15_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending__beyond15_d: Mapped[int] = mapped_column("pending__beyond15_d", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    booking_received_yesterday: Mapped[int] = mapped_column("booking_received_yesterday", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    total_sales_yesterday: Mapped[int] = mapped_column("total_sales_yesterday", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    booking_received_today: Mapped[int] = mapped_column("booking_received_today", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    total_sales_today: Mapped[int] = mapped_column("total_sales_today", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sa_code: Mapped[int] = mapped_column("sa_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    state_code: Mapped[str] = mapped_column("state_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    district_code: Mapped[int] = mapped_column("district_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    taluka_code: Mapped[str] = mapped_column("taluka_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    city_code: Mapped[str] = mapped_column("city_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_code: Mapped[int] = mapped_column("ro_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sa_name: Mapped[str] = mapped_column("sa_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zo_code: Mapped[str] = mapped_column("zo_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_name: Mapped[str] = mapped_column("ro_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zo_name: Mapped[str] = mapped_column("zo_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    order_source_name: Mapped[str] = mapped_column("order_source_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    total__pending: Mapped[int] = mapped_column("total__pending", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_1_3_days: Mapped[int] = mapped_column("pending_1_3_days", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_4_7_days: Mapped[int] = mapped_column("pending_4_7_days", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pending_8_15_days: Mapped[int] = mapped_column("pending_8_15_days", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    execution__date: Mapped[datetime.datetime] = mapped_column("execution__date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    execution__month: Mapped[str] = mapped_column("execution__month", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    execution__year: Mapped[int] = mapped_column("execution__year", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    month__year: Mapped[str] = mapped_column("month__year", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgSalesSummaryDataCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_sales_summary_data'
    
    jde_distributor_code: int
    consumer_type: str
    is_prepaid: str
    cyl_type: str
    order_source_code: str
    pending_0_d: int
    pending_1_d: int
    pending_2_d: int
    pending_3_d: int
    pending_4_d: int
    pending_5_d: int
    pending_6_d: int
    pending_7_d: int
    pending_8_d: int
    pending_9_d: int
    pending_10_d: int
    pending_11_d: int
    pending_12_d: int
    pending_13_d: int
    pending_14_d: int
    pending_15_d: int
    pending__beyond15_d: int
    booking_received_yesterday: int
    total_sales_yesterday: int
    booking_received_today: int
    total_sales_today: int
    sa_code: int
    state_code: str
    district_code: int
    taluka_code: str
    city_code: str
    ro_code: int
    sa_name: str
    zo_code: str
    ro_name: str
    zo_name: str
    order_source_name: str
    total__pending: int
    pending_1_3_days: int
    pending_4_7_days: int
    pending_8_15_days: int
    execution__date: datetime.datetime
    execution__month: str
    execution__year: int
    month__year: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgSalesSummaryDataSchema
        upsert_keys = []
        access_key_mapping = ['JDEDistributorCode:sap_id', 'SAName:sales_area', 'ZOName:zone', 'ROName:region']


class LpgSalesSummaryData(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_sales_summary_data'
    
    jde_distributor_code: typing.Optional[int] | None = None
    consumer_type: typing.Optional[str] | None = None
    is_prepaid: typing.Optional[str] | None = None
    cyl_type: typing.Optional[str] | None = None
    order_source_code: typing.Optional[str] | None = None
    pending_0_d: typing.Optional[int] | None = None
    pending_1_d: typing.Optional[int] | None = None
    pending_2_d: typing.Optional[int] | None = None
    pending_3_d: typing.Optional[int] | None = None
    pending_4_d: typing.Optional[int] | None = None
    pending_5_d: typing.Optional[int] | None = None
    pending_6_d: typing.Optional[int] | None = None
    pending_7_d: typing.Optional[int] | None = None
    pending_8_d: typing.Optional[int] | None = None
    pending_9_d: typing.Optional[int] | None = None
    pending_10_d: typing.Optional[int] | None = None
    pending_11_d: typing.Optional[int] | None = None
    pending_12_d: typing.Optional[int] | None = None
    pending_13_d: typing.Optional[int] | None = None
    pending_14_d: typing.Optional[int] | None = None
    pending_15_d: typing.Optional[int] | None = None
    pending__beyond15_d: typing.Optional[int] | None = None
    booking_received_yesterday: typing.Optional[int] | None = None
    total_sales_yesterday: typing.Optional[int] | None = None
    booking_received_today: typing.Optional[int] | None = None
    total_sales_today: typing.Optional[int] | None = None
    sa_code: typing.Optional[int] | None = None
    state_code: typing.Optional[str] | None = None
    district_code: typing.Optional[int] | None = None
    taluka_code: typing.Optional[str] | None = None
    city_code: typing.Optional[str] | None = None
    ro_code: typing.Optional[int] | None = None
    sa_name: typing.Optional[str] | None = None
    zo_code: typing.Optional[str] | None = None
    ro_name: typing.Optional[str] | None = None
    zo_name: typing.Optional[str] | None = None
    order_source_name: typing.Optional[str] | None = None
    total__pending: typing.Optional[int] | None = None
    pending_1_3_days: typing.Optional[int] | None = None
    pending_4_7_days: typing.Optional[int] | None = None
    pending_8_15_days: typing.Optional[int] | None = None
    execution__date: typing.Optional[datetime.datetime] | None = None
    execution__month: typing.Optional[str] | None = None
    execution__year: typing.Optional[int] | None = None
    month__year: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgSalesSummaryDataSchema
        upsert_keys = []
        access_key_mapping = ['JDEDistributorCode:sap_id', 'SAName:sales_area', 'ZOName:zone', 'ROName:region']


class LpgSalesSummaryDataGetResp(pydantic.BaseModel):
    data: typing.List[LpgSalesSummaryData]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class LpgConsumersSummarySchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_consumers_summary'
    
    distributor_code: Mapped[int] = mapped_column("distributor_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    relationship_status: Mapped[str] = mapped_column("relationship_status", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    relationship_sub_status: Mapped[str] = mapped_column("relationship_sub_status", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    consumer_category: Mapped[str] = mapped_column("consumer_category", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    typeof_consumer: Mapped[int] = mapped_column("typeof_consumer", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    main_scheme_category: Mapped[int] = mapped_column("main_scheme_category", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    scheme_code: Mapped[int] = mapped_column("scheme_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    connection_type: Mapped[str] = mapped_column("connection_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cylinder_type: Mapped[str] = mapped_column("cylinder_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    consumer_count: Mapped[int] = mapped_column("consumer_count", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    e_kyc_completed: Mapped[int] = mapped_column("e_kyc_completed", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    suvidha_club: Mapped[int] = mapped_column("suvidha_club", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    hig_opt_out: Mapped[int] = mapped_column("hig_opt_out", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    subsidy_give_it_up: Mapped[int] = mapped_column("subsidy_give_it_up", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    actc_count: Mapped[int] = mapped_column("actc_count", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bctc_count: Mapped[int] = mapped_column("bctc_count", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    nctc_count: Mapped[int] = mapped_column("nctc_count", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    safety_check_pending: Mapped[int] = mapped_column("safety_check_pending", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    hp_pay_consumer_count: Mapped[int] = mapped_column("hp_pay_consumer_count", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    jde_distributor_code: Mapped[int] = mapped_column("jde_distributor_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sa_code: Mapped[int] = mapped_column("sa_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    state_code: Mapped[str] = mapped_column("state_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_code: Mapped[int] = mapped_column("ro_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sa_name: Mapped[str] = mapped_column("sa_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zo_code: Mapped[str] = mapped_column("zo_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_name: Mapped[str] = mapped_column("ro_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zo_name: Mapped[str] = mapped_column("zo_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    category: Mapped[str] = mapped_column("category", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sub_category: Mapped[str] = mapped_column("sub_category", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    category_status: Mapped[str] = mapped_column("category_status", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    e_kyc_pending: Mapped[int] = mapped_column("e_kyc_pending", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone_names: Mapped[str] = mapped_column("zone_names", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgConsumersSummaryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_consumers_summary'
    
    distributor_code: int
    relationship_status: str
    relationship_sub_status: str
    consumer_category: str
    typeof_consumer: int
    main_scheme_category: int
    scheme_code: int
    connection_type: str
    cylinder_type: str
    consumer_count: int
    e_kyc_completed: int
    suvidha_club: int
    hig_opt_out: int
    subsidy_give_it_up: int
    actc_count: int
    bctc_count: int
    nctc_count: int
    safety_check_pending: int
    hp_pay_consumer_count: int
    jde_distributor_code: int
    sa_code: int
    state_code: str
    ro_code: int
    sa_name: str
    zo_code: str
    ro_name: str
    zo_name: str
    category: str
    sub_category: str
    category_status: str
    e_kyc_pending: int
    zone_names: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgConsumersSummarySchema
        upsert_keys = []
        access_key_mapping = ['DistributorCode:sap_id', 'SAName:sales_area', 'ZOName:zone', 'ROName:region']


class LpgConsumersSummary(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_consumers_summary'
    
    distributor_code: typing.Optional[int] | None = None
    relationship_status: typing.Optional[str] | None = None
    relationship_sub_status: typing.Optional[str] | None = None
    consumer_category: typing.Optional[str] | None = None
    typeof_consumer: typing.Optional[int] | None = None
    main_scheme_category: typing.Optional[int] | None = None
    scheme_code: typing.Optional[int] | None = None
    connection_type: typing.Optional[str] | None = None
    cylinder_type: typing.Optional[str] | None = None
    consumer_count: typing.Optional[int] | None = None
    e_kyc_completed: typing.Optional[int] | None = None
    suvidha_club: typing.Optional[int] | None = None
    hig_opt_out: typing.Optional[int] | None = None
    subsidy_give_it_up: typing.Optional[int] | None = None
    actc_count: typing.Optional[int] | None = None
    bctc_count: typing.Optional[int] | None = None
    nctc_count: typing.Optional[int] | None = None
    safety_check_pending: typing.Optional[int] | None = None
    hp_pay_consumer_count: typing.Optional[int] | None = None
    jde_distributor_code: typing.Optional[int] | None = None
    sa_code: typing.Optional[int] | None = None
    state_code: typing.Optional[str] | None = None
    ro_code: typing.Optional[int] | None = None
    sa_name: typing.Optional[str] | None = None
    zo_code: typing.Optional[str] | None = None
    ro_name: typing.Optional[str] | None = None
    zo_name: typing.Optional[str] | None = None
    category: typing.Optional[str] | None = None
    sub_category: typing.Optional[str] | None = None
    category_status: typing.Optional[str] | None = None
    e_kyc_pending: typing.Optional[int] | None = None
    zone_names: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgConsumersSummarySchema
        upsert_keys = []
        access_key_mapping = ['DistributorCode:sap_id', 'SAName:sales_area', 'ZOName:zone', 'ROName:region']


class LpgConsumersSummaryGetResp(pydantic.BaseModel):
    data: typing.List[LpgConsumersSummary]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class ScreensSchema(UrdhvaPostgresBase):
    __tablename__ = 'screens'
    
    screen_title: Mapped[str] = mapped_column("screen_title", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    dashboards: Mapped[typing.List[int]] = mapped_column("dashboards", ARRAY(Integer), index=False, nullable=False, default=None, primary_key=False, unique=False)
    created_by: Mapped[typing.Optional[str]] = mapped_column("created_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    x: Mapped[typing.Optional[int]] = mapped_column("x", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    y: Mapped[typing.Optional[int]] = mapped_column("y", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    w: Mapped[typing.Optional[int]] = mapped_column("w", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    h: Mapped[typing.Optional[int]] = mapped_column("h", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    static: Mapped[typing.Optional[bool]] = mapped_column("static", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    moved: Mapped[typing.Optional[bool]] = mapped_column("moved", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)


class ScreensCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'screens'
    
    screen_title: str
    dashboards: typing.List[int]
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})
    x: typing.Optional[int] = pydantic.Field(0, **{})
    y: typing.Optional[int] = pydantic.Field(0, **{})
    w: typing.Optional[int] = pydantic.Field(0, **{})
    h: typing.Optional[int] = pydantic.Field(0, **{})
    static: typing.Optional[bool] = pydantic.Field(False, )
    moved: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ScreensSchema
        upsert_keys = []


class Screens(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'screens'
    
    screen_title: typing.Optional[str] | None = None
    dashboards: typing.Optional[typing.List[int]] | None = None
    created_by: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})
    x: typing.Optional[int] = pydantic.Field(0, **{})
    y: typing.Optional[int] = pydantic.Field(0, **{})
    w: typing.Optional[int] = pydantic.Field(0, **{})
    h: typing.Optional[int] = pydantic.Field(0, **{})
    static: typing.Optional[bool] = pydantic.Field(False, )
    moved: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ScreensSchema
        upsert_keys = []


class ScreensGetResp(pydantic.BaseModel):
    data: typing.List[Screens]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class DeviceMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'device_master'
    
    bu: Mapped[typing.Any] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_id: Mapped[typing.Optional[str]] = mapped_column("ro_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_type: Mapped[typing.Any] = mapped_column("device_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    tank_no: Mapped[typing.Optional[str]] = mapped_column("tank_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_name: Mapped[typing.Optional[str]] = mapped_column("tank_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_capacity: Mapped[typing.Optional[int]] = mapped_column("tank_capacity", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    pump_no: Mapped[typing.Optional[int]] = mapped_column("pump_no", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    du_no: Mapped[typing.Optional[int]] = mapped_column("du_no", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    nozzle_no: Mapped[typing.Optional[int]] = mapped_column("nozzle_no", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    global_nozzle_no: Mapped[typing.Optional[int]] = mapped_column("global_nozzle_no", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    product_type: Mapped[str] = mapped_column("product_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class DeviceMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'device_master'
    
    bu: hpcl_ceg_enum.BusinessUnit
    sap_id: str
    ro_id: typing.Optional[str] = pydantic.Field("", **{})
    device_type: hpcl_ceg_enum.DeviceType
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    tank_capacity: typing.Optional[int] = pydantic.Field(0, **{})
    pump_no: typing.Optional[int] = pydantic.Field(0, **{})
    du_no: typing.Optional[int] = pydantic.Field(0, **{})
    nozzle_no: typing.Optional[int] = pydantic.Field(0, **{})
    global_nozzle_no: typing.Optional[int] = pydantic.Field(0, **{})
    product_type: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DeviceMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class DeviceMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'device_master'
    
    bu: typing.Optional[hpcl_ceg_enum.BusinessUnit] | None = None
    sap_id: typing.Optional[str] | None = None
    ro_id: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[hpcl_ceg_enum.DeviceType] | None = None
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    tank_capacity: typing.Optional[int] = pydantic.Field(0, **{})
    pump_no: typing.Optional[int] = pydantic.Field(0, **{})
    du_no: typing.Optional[int] = pydantic.Field(0, **{})
    nozzle_no: typing.Optional[int] = pydantic.Field(0, **{})
    global_nozzle_no: typing.Optional[int] = pydantic.Field(0, **{})
    product_type: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DeviceMasterSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class DeviceMasterGetResp(pydantic.BaseModel):
    data: typing.List[DeviceMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class ViolationHistoryCreate(pydantic.BaseModel):
    stoppage_violations_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count_orig: typing.Optional[int] = pydantic.Field(0, **{})
    speed_violation_count: typing.Optional[int] = pydantic.Field(0, **{})
    main_supply_removal_count: typing.Optional[int] = pydantic.Field(0, **{})
    night_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    no_halt_zone_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_offline_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_tamper_count: typing.Optional[int] = pydantic.Field(0, **{})
    continuous_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    last_event_datetime: typing.Optional[str] = pydantic.Field("", **{})


class VtsAlertHistorySchema(UrdhvaPostgresBase):
    __tablename__ = 'vts_alert_history'
    
    vendor_id: Mapped[typing.Optional[str]] = mapped_column("vendor_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_id: Mapped[typing.Optional[str]] = mapped_column("location_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    base_location_id: Mapped[typing.Optional[str]] = mapped_column("base_location_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    base_zone: Mapped[typing.Optional[str]] = mapped_column("base_zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    base_location_name: Mapped[typing.Optional[str]] = mapped_column("base_location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    base_region: Mapped[typing.Optional[str]] = mapped_column("base_region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_type: Mapped[typing.Optional[str]] = mapped_column("location_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tl_number: Mapped[str] = mapped_column("tl_number", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    report_duration: Mapped[typing.Optional[str]] = mapped_column("report_duration", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vts_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("vts_start_datetime", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    vts_end_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("vts_end_datetime", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    total_trips: Mapped[typing.Optional[int]] = mapped_column("total_trips", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    stoppage_violations_count: Mapped[typing.Optional[int]] = mapped_column("stoppage_violations_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    route_deviation_count: Mapped[typing.Optional[int]] = mapped_column("route_deviation_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    route_deviation_count_orig: Mapped[typing.Optional[int]] = mapped_column("route_deviation_count_orig", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    scheduled_trip_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("scheduled_trip_start_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    scheduled_trip_end_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("scheduled_trip_end_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    speed_violation_count: Mapped[typing.Optional[int]] = mapped_column("speed_violation_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    main_supply_removal_count: Mapped[typing.Optional[int]] = mapped_column("main_supply_removal_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    night_driving_count: Mapped[typing.Optional[int]] = mapped_column("night_driving_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    no_halt_zone_count: Mapped[typing.Optional[int]] = mapped_column("no_halt_zone_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    device_offline_count: Mapped[typing.Optional[int]] = mapped_column("device_offline_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    device_tamper_count: Mapped[typing.Optional[int]] = mapped_column("device_tamper_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    continuous_driving_count: Mapped[typing.Optional[int]] = mapped_column("continuous_driving_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    approved_by: Mapped[typing.Optional[str]] = mapped_column("approved_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    auto_unblock: Mapped[typing.Optional[bool]] = mapped_column("auto_unblock", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    alert_id: Mapped[typing.Optional[str]] = mapped_column("alert_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    invoice_number: Mapped[typing.Optional[str]] = mapped_column("invoice_number", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    tt_type: Mapped[typing.Optional[str]] = mapped_column("tt_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    violation_type: Mapped[typing.Optional[typing.List[str]]] = mapped_column("violation_type", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    destination_code: Mapped[typing.Optional[str]] = mapped_column("destination_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    destination_name: Mapped[typing.Optional[str]] = mapped_column("destination_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    data_reprocessed: Mapped[typing.Optional[bool]] = mapped_column("data_reprocessed", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    violation_history: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("violation_history", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)


class VtsAlertHistoryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'vts_alert_history'
    
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    base_location_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    base_zone: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    base_location_name: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    base_region: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    tl_number: str
    report_duration: typing.Optional[str] = pydantic.Field("", **{})
    vts_start_datetime: typing.Optional[datetime.datetime] | None = None
    vts_end_datetime: typing.Optional[datetime.datetime] | None = None
    total_trips: typing.Optional[int] = pydantic.Field(0, **{})
    stoppage_violations_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count_orig: typing.Optional[int] = pydantic.Field(0, **{})
    scheduled_trip_start_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_trip_end_datetime: typing.Optional[datetime.datetime] | None = None
    speed_violation_count: typing.Optional[int] = pydantic.Field(0, **{})
    main_supply_removal_count: typing.Optional[int] = pydantic.Field(0, **{})
    night_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    no_halt_zone_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_offline_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_tamper_count: typing.Optional[int] = pydantic.Field(0, **{})
    continuous_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    approved_by: typing.Optional[str] = pydantic.Field("", **{})
    auto_unblock: typing.Optional[bool] = pydantic.Field(False, )
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    violation_type: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    destination_name: typing.Optional[str] = pydantic.Field("", **{})
    data_reprocessed: typing.Optional[bool] = pydantic.Field(False, )
    violation_history: typing.Optional[typing.List[ViolationHistoryCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VtsAlertHistorySchema
        upsert_keys = []
        access_key_mapping = ['location_id:sap_id']


class VtsAlertHistory(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'vts_alert_history'
    
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    base_location_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    base_zone: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    base_location_name: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    base_region: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    tl_number: typing.Optional[str] | None = None
    report_duration: typing.Optional[str] = pydantic.Field("", **{})
    vts_start_datetime: typing.Optional[datetime.datetime] | None = None
    vts_end_datetime: typing.Optional[datetime.datetime] | None = None
    total_trips: typing.Optional[int] = pydantic.Field(0, **{})
    stoppage_violations_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count_orig: typing.Optional[int] = pydantic.Field(0, **{})
    scheduled_trip_start_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_trip_end_datetime: typing.Optional[datetime.datetime] | None = None
    speed_violation_count: typing.Optional[int] = pydantic.Field(0, **{})
    main_supply_removal_count: typing.Optional[int] = pydantic.Field(0, **{})
    night_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    no_halt_zone_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_offline_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_tamper_count: typing.Optional[int] = pydantic.Field(0, **{})
    continuous_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    approved_by: typing.Optional[str] = pydantic.Field("", **{})
    auto_unblock: typing.Optional[bool] = pydantic.Field(False, )
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    violation_type: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    destination_name: typing.Optional[str] = pydantic.Field("", **{})
    data_reprocessed: typing.Optional[bool] = pydantic.Field(False, )
    violation_history: typing.Optional[typing.List[ViolationHistoryCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VtsAlertHistorySchema
        upsert_keys = []
        access_key_mapping = ['location_id:sap_id']


class VtsAlertHistoryGetResp(pydantic.BaseModel):
    data: typing.List[VtsAlertHistory]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class EmLockAlertHistorySchema(UrdhvaPostgresBase):
    __tablename__ = 'em_lock_alert_history'
    
    vendor_id: Mapped[typing.Optional[str]] = mapped_column("vendor_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_id: Mapped[typing.Optional[str]] = mapped_column("location_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_type: Mapped[typing.Optional[str]] = mapped_column("location_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    emlock_exception_id: Mapped[str] = mapped_column("emlock_exception_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    terminal_code: Mapped[str] = mapped_column("terminal_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    truck_number: Mapped[str] = mapped_column("truck_number", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    exception_type: Mapped[str] = mapped_column("exception_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_code: Mapped[typing.Optional[str]] = mapped_column("ro_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_datetime: Mapped[str] = mapped_column("created_datetime", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class EmLockAlertHistoryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'em_lock_alert_history'
    
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    emlock_exception_id: str
    terminal_code: str
    truck_number: str
    exception_type: str
    ro_code: typing.Optional[str] = pydantic.Field("", **{})
    created_datetime: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = EmLockAlertHistorySchema
        upsert_keys = []
        access_key_mapping = ['location_id:sap_id']


class EmLockAlertHistory(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'em_lock_alert_history'
    
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    emlock_exception_id: typing.Optional[str] | None = None
    terminal_code: typing.Optional[str] | None = None
    truck_number: typing.Optional[str] | None = None
    exception_type: typing.Optional[str] | None = None
    ro_code: typing.Optional[str] = pydantic.Field("", **{})
    created_datetime: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = EmLockAlertHistorySchema
        upsert_keys = []
        access_key_mapping = ['location_id:sap_id']


class EmLockAlertHistoryGetResp(pydantic.BaseModel):
    data: typing.List[EmLockAlertHistory]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class VaAlertHistorySchema(UrdhvaPostgresBase):
    __tablename__ = 'va_alert_history'
    
    vendor_id: Mapped[typing.Optional[str]] = mapped_column("vendor_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_id: Mapped[typing.Optional[str]] = mapped_column("location_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_type: Mapped[typing.Optional[str]] = mapped_column("location_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_id: Mapped[typing.Optional[str]] = mapped_column("alert_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_type: Mapped[typing.Optional[str]] = mapped_column("alert_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_description: Mapped[typing.Optional[str]] = mapped_column("alert_description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_id: Mapped[typing.Optional[str]] = mapped_column("device_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    video_url: Mapped[typing.Optional[str]] = mapped_column("video_url", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_timestamp: Mapped[typing.Optional[datetime.datetime]] = mapped_column("alert_timestamp", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    acknowledged_by: Mapped[typing.Optional[str]] = mapped_column("acknowledged_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    closed_at: Mapped[typing.Optional[datetime.datetime]] = mapped_column("closed_at", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    action_description: Mapped[typing.Optional[str]] = mapped_column("action_description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    action_code: Mapped[typing.Optional[str]] = mapped_column("action_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    action_reason: Mapped[typing.Optional[str]] = mapped_column("action_reason", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    action_category: Mapped[typing.Optional[str]] = mapped_column("action_category", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class VaAlertHistoryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'va_alert_history'
    
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    alert_type: typing.Optional[str] = pydantic.Field("", **{})
    alert_description: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    video_url: typing.Optional[str] = pydantic.Field("", **{})
    alert_timestamp: typing.Optional[datetime.datetime] | None = None
    status: typing.Optional[str] = pydantic.Field("", **{})
    acknowledged_by: typing.Optional[str] = pydantic.Field("", **{})
    closed_at: typing.Optional[datetime.datetime] | None = None
    action_description: typing.Optional[str] = pydantic.Field("", **{})
    action_code: typing.Optional[str] = pydantic.Field("", **{})
    action_reason: typing.Optional[str] = pydantic.Field("", **{})
    action_category: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VaAlertHistorySchema
        upsert_keys = []
        access_key_mapping = ['location_id:sap_id']


class VaAlertHistory(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'va_alert_history'
    
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    alert_type: typing.Optional[str] = pydantic.Field("", **{})
    alert_description: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    video_url: typing.Optional[str] = pydantic.Field("", **{})
    alert_timestamp: typing.Optional[datetime.datetime] | None = None
    status: typing.Optional[str] = pydantic.Field("", **{})
    acknowledged_by: typing.Optional[str] = pydantic.Field("", **{})
    closed_at: typing.Optional[datetime.datetime] | None = None
    action_description: typing.Optional[str] = pydantic.Field("", **{})
    action_code: typing.Optional[str] = pydantic.Field("", **{})
    action_reason: typing.Optional[str] = pydantic.Field("", **{})
    action_category: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VaAlertHistorySchema
        upsert_keys = []
        access_key_mapping = ['location_id:sap_id']


class VaAlertHistoryGetResp(pydantic.BaseModel):
    data: typing.List[VaAlertHistory]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class M60LevelMetaDataSchema(UrdhvaPostgresBase):
    __tablename__ = 'm60_level_meta_data'
    
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sbu__name: Mapped[typing.Optional[str]] = mapped_column("sbu__name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone__name: Mapped[typing.Optional[str]] = mapped_column("zone__name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region__name: Mapped[typing.Optional[str]] = mapped_column("region__name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sa: Mapped[typing.Optional[str]] = mapped_column("sa", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sales_area__name: Mapped[typing.Optional[str]] = mapped_column("sales_area__name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product: Mapped[typing.Optional[str]] = mapped_column("product", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product_name: Mapped[typing.Optional[str]] = mapped_column("product_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    uom: Mapped[typing.Optional[str]] = mapped_column("uom", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    invoice_dt: Mapped[typing.Optional[str]] = mapped_column("invoice_dt", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    target_qty_kl: Mapped[typing.Optional[float]] = mapped_column("target_qty_kl", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    target_qty_tmt: Mapped[typing.Optional[float]] = mapped_column("target_qty_tmt", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    fiscal_year: Mapped[typing.Optional[str]] = mapped_column("fiscal_year", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    cur_fiscal_year: Mapped[typing.Optional[str]] = mapped_column("cur_fiscal_year", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgsbucd: Mapped[typing.Optional[str]] = mapped_column("orgsbucd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgsbuname: Mapped[typing.Optional[str]] = mapped_column("orgsbuname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgzonecd: Mapped[typing.Optional[str]] = mapped_column("orgzonecd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgzonename: Mapped[typing.Optional[str]] = mapped_column("orgzonename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgrocd: Mapped[typing.Optional[str]] = mapped_column("orgrocd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgroname: Mapped[typing.Optional[str]] = mapped_column("orgroname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgsacd: Mapped[typing.Optional[str]] = mapped_column("orgsacd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgsaname: Mapped[typing.Optional[str]] = mapped_column("orgsaname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    productcode: Mapped[typing.Optional[str]] = mapped_column("productcode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    materialgroupname: Mapped[typing.Optional[str]] = mapped_column("materialgroupname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    curfiscalyear: Mapped[typing.Optional[str]] = mapped_column("curfiscalyear", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    fiscalyear: Mapped[typing.Optional[str]] = mapped_column("fiscalyear", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    yearmonth: Mapped[typing.Optional[str]] = mapped_column("yearmonth", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    netweight_uom: Mapped[typing.Optional[float]] = mapped_column("netweight_uom", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    netweight_kg: Mapped[typing.Optional[float]] = mapped_column("netweight_kg", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    netweight_tmt: Mapped[typing.Optional[float]] = mapped_column("netweight_tmt", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    total__days__till__present_day: Mapped[typing.Optional[int]] = mapped_column("total__days__till__present_day", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    number__of__sundays__till__present_day: Mapped[typing.Optional[int]] = mapped_column("number__of__sundays__till__present_day", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    target_round: Mapped[typing.Optional[int]] = mapped_column("target_round", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    actual_round: Mapped[typing.Optional[int]] = mapped_column("actual_round", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    final_sum: Mapped[typing.Optional[float]] = mapped_column("final_sum", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    final_actual_sum: Mapped[typing.Optional[float]] = mapped_column("final_actual_sum", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    max_pending_days: Mapped[typing.Optional[int]] = mapped_column("max_pending_days", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    working__days__till__present_day__without_sundays: Mapped[typing.Optional[int]] = mapped_column("working__days__till__present_day__without_sundays", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    rate__per__day__required_mmt: Mapped[typing.Optional[float]] = mapped_column("rate__per__day__required_mmt", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    rate_per_day_current_mmt: Mapped[typing.Optional[float]] = mapped_column("rate_per_day_current_mmt", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    total__days_in_fy: Mapped[typing.Optional[int]] = mapped_column("total__days_in_fy", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    pending__days: Mapped[typing.Optional[int]] = mapped_column("pending__days", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    month_year: Mapped[typing.Optional[int]] = mapped_column("month_year", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    month_name: Mapped[typing.Optional[str]] = mapped_column("month_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    fy_month: Mapped[typing.Optional[int]] = mapped_column("fy_month", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    year_monthname: Mapped[typing.Optional[datetime.date]] = mapped_column("year_monthname", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    target__quantity_tmtt: Mapped[typing.Optional[float]] = mapped_column("target__quantity_tmtt", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    prediction__value: Mapped[typing.Optional[float]] = mapped_column("prediction__value", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    act__tgt__achievement: Mapped[typing.Optional[float]] = mapped_column("act__tgt__achievement", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    zone__region__achievement: Mapped[typing.Optional[float]] = mapped_column("zone__region__achievement", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    product__achievement: Mapped[typing.Optional[float]] = mapped_column("product__achievement", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    engine_id: Mapped[typing.Optional[str]] = mapped_column("engine_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class M60LevelMetaDataCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'm60_level_meta_data'
    
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    sbu__name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    zone__name: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    region__name: typing.Optional[str] = pydantic.Field("", **{})
    sa: typing.Optional[str] = pydantic.Field("", **{})
    sales_area__name: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    uom: typing.Optional[str] = pydantic.Field("", **{})
    invoice_dt: typing.Optional[str] = pydantic.Field("", **{})
    target_qty_kl: typing.Optional[float] = pydantic.Field(0.0, **{})
    target_qty_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    fiscal_year: typing.Optional[str] = pydantic.Field("", **{})
    cur_fiscal_year: typing.Optional[str] = pydantic.Field("", **{})
    orgsbucd: typing.Optional[str] = pydantic.Field("", **{})
    orgsbuname: typing.Optional[str] = pydantic.Field("", **{})
    orgzonecd: typing.Optional[str] = pydantic.Field("", **{})
    orgzonename: typing.Optional[str] = pydantic.Field("", **{})
    orgrocd: typing.Optional[str] = pydantic.Field("", **{})
    orgroname: typing.Optional[str] = pydantic.Field("", **{})
    orgsacd: typing.Optional[str] = pydantic.Field("", **{})
    orgsaname: typing.Optional[str] = pydantic.Field("", **{})
    productcode: typing.Optional[str] = pydantic.Field("", **{})
    materialgroupname: typing.Optional[str] = pydantic.Field("", **{})
    curfiscalyear: typing.Optional[str] = pydantic.Field("", **{})
    fiscalyear: typing.Optional[str] = pydantic.Field("", **{})
    yearmonth: typing.Optional[str] = pydantic.Field("", **{})
    netweight_uom: typing.Optional[float] = pydantic.Field(0.0, **{})
    netweight_kg: typing.Optional[float] = pydantic.Field(0.0, **{})
    netweight_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    total__days__till__present_day: typing.Optional[int] = pydantic.Field(0, **{})
    number__of__sundays__till__present_day: typing.Optional[int] = pydantic.Field(0, **{})
    target_round: typing.Optional[int] = pydantic.Field(0, **{})
    actual_round: typing.Optional[int] = pydantic.Field(0, **{})
    final_sum: typing.Optional[float] = pydantic.Field(0.0, **{})
    final_actual_sum: typing.Optional[float] = pydantic.Field(0.0, **{})
    max_pending_days: typing.Optional[int] = pydantic.Field(0, **{})
    working__days__till__present_day__without_sundays: typing.Optional[int] = pydantic.Field(0, **{})
    rate__per__day__required_mmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    rate_per_day_current_mmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    total__days_in_fy: typing.Optional[int] = pydantic.Field(0, **{})
    pending__days: typing.Optional[int] = pydantic.Field(0, **{})
    month_year: typing.Optional[int] = pydantic.Field(0, **{})
    month_name: typing.Optional[str] = pydantic.Field("", **{})
    fy_month: typing.Optional[int] = pydantic.Field(0, **{})
    year_monthname: typing.Optional[datetime.date] | None = None
    target__quantity_tmtt: typing.Optional[float] = pydantic.Field(0.0, **{})
    prediction__value: typing.Optional[float] = pydantic.Field(0.0, **{})
    act__tgt__achievement: typing.Optional[float] = pydantic.Field(0.0, **{})
    zone__region__achievement: typing.Optional[float] = pydantic.Field(0.0, **{})
    product__achievement: typing.Optional[float] = pydantic.Field(0.0, **{})
    engine_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = M60LevelMetaDataSchema
        upsert_keys = []
        access_key_mapping = ['SBU_Name:bu', 'ORGZONECD:zone', 'SalesArea_Name:sales_area', 'Region_Name:region']


class M60LevelMetaData(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'm60_level_meta_data'
    
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    sbu__name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    zone__name: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    region__name: typing.Optional[str] = pydantic.Field("", **{})
    sa: typing.Optional[str] = pydantic.Field("", **{})
    sales_area__name: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    uom: typing.Optional[str] = pydantic.Field("", **{})
    invoice_dt: typing.Optional[str] = pydantic.Field("", **{})
    target_qty_kl: typing.Optional[float] = pydantic.Field(0.0, **{})
    target_qty_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    fiscal_year: typing.Optional[str] = pydantic.Field("", **{})
    cur_fiscal_year: typing.Optional[str] = pydantic.Field("", **{})
    orgsbucd: typing.Optional[str] = pydantic.Field("", **{})
    orgsbuname: typing.Optional[str] = pydantic.Field("", **{})
    orgzonecd: typing.Optional[str] = pydantic.Field("", **{})
    orgzonename: typing.Optional[str] = pydantic.Field("", **{})
    orgrocd: typing.Optional[str] = pydantic.Field("", **{})
    orgroname: typing.Optional[str] = pydantic.Field("", **{})
    orgsacd: typing.Optional[str] = pydantic.Field("", **{})
    orgsaname: typing.Optional[str] = pydantic.Field("", **{})
    productcode: typing.Optional[str] = pydantic.Field("", **{})
    materialgroupname: typing.Optional[str] = pydantic.Field("", **{})
    curfiscalyear: typing.Optional[str] = pydantic.Field("", **{})
    fiscalyear: typing.Optional[str] = pydantic.Field("", **{})
    yearmonth: typing.Optional[str] = pydantic.Field("", **{})
    netweight_uom: typing.Optional[float] = pydantic.Field(0.0, **{})
    netweight_kg: typing.Optional[float] = pydantic.Field(0.0, **{})
    netweight_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    total__days__till__present_day: typing.Optional[int] = pydantic.Field(0, **{})
    number__of__sundays__till__present_day: typing.Optional[int] = pydantic.Field(0, **{})
    target_round: typing.Optional[int] = pydantic.Field(0, **{})
    actual_round: typing.Optional[int] = pydantic.Field(0, **{})
    final_sum: typing.Optional[float] = pydantic.Field(0.0, **{})
    final_actual_sum: typing.Optional[float] = pydantic.Field(0.0, **{})
    max_pending_days: typing.Optional[int] = pydantic.Field(0, **{})
    working__days__till__present_day__without_sundays: typing.Optional[int] = pydantic.Field(0, **{})
    rate__per__day__required_mmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    rate_per_day_current_mmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    total__days_in_fy: typing.Optional[int] = pydantic.Field(0, **{})
    pending__days: typing.Optional[int] = pydantic.Field(0, **{})
    month_year: typing.Optional[int] = pydantic.Field(0, **{})
    month_name: typing.Optional[str] = pydantic.Field("", **{})
    fy_month: typing.Optional[int] = pydantic.Field(0, **{})
    year_monthname: typing.Optional[datetime.date] | None = None
    target__quantity_tmtt: typing.Optional[float] = pydantic.Field(0.0, **{})
    prediction__value: typing.Optional[float] = pydantic.Field(0.0, **{})
    act__tgt__achievement: typing.Optional[float] = pydantic.Field(0.0, **{})
    zone__region__achievement: typing.Optional[float] = pydantic.Field(0.0, **{})
    product__achievement: typing.Optional[float] = pydantic.Field(0.0, **{})
    engine_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = M60LevelMetaDataSchema
        upsert_keys = []
        access_key_mapping = ['SBU_Name:bu', 'ORGZONECD:zone', 'SalesArea_Name:sales_area', 'Region_Name:region']


class M60LevelMetaDataGetResp(pydantic.BaseModel):
    data: typing.List[M60LevelMetaData]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class MomLevelFinalMetaDataSchema(UrdhvaPostgresBase):
    __tablename__ = 'mom_level_final_meta_data'
    
    orgsbucd: Mapped[typing.Optional[str]] = mapped_column("orgsbucd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgsbuname: Mapped[typing.Optional[str]] = mapped_column("orgsbuname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgzonecd: Mapped[typing.Optional[str]] = mapped_column("orgzonecd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgzonename: Mapped[typing.Optional[str]] = mapped_column("orgzonename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgrocd: Mapped[typing.Optional[str]] = mapped_column("orgrocd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgroname: Mapped[typing.Optional[str]] = mapped_column("orgroname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgsacd: Mapped[typing.Optional[str]] = mapped_column("orgsacd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgsaname: Mapped[typing.Optional[str]] = mapped_column("orgsaname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    productcode: Mapped[typing.Optional[str]] = mapped_column("productcode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    materialgroupname: Mapped[typing.Optional[str]] = mapped_column("materialgroupname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    curfiscalyear: Mapped[typing.Optional[str]] = mapped_column("curfiscalyear", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    fiscalyear: Mapped[typing.Optional[str]] = mapped_column("fiscalyear", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    yearmonth: Mapped[typing.Optional[str]] = mapped_column("yearmonth", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    netweight_uom: Mapped[typing.Optional[float]] = mapped_column("netweight_uom", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    netweight_kg: Mapped[typing.Optional[float]] = mapped_column("netweight_kg", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    netweight_tmt: Mapped[typing.Optional[float]] = mapped_column("netweight_tmt", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    fiscal_year: Mapped[typing.Optional[str]] = mapped_column("fiscal_year", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    engine_id: Mapped[typing.Optional[str]] = mapped_column("engine_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    month_name: Mapped[typing.Optional[str]] = mapped_column("month_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class MomLevelFinalMetaDataCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'mom_level_final_meta_data'
    
    orgsbucd: typing.Optional[str] = pydantic.Field("", **{})
    orgsbuname: typing.Optional[str] = pydantic.Field("", **{})
    orgzonecd: typing.Optional[str] = pydantic.Field("", **{})
    orgzonename: typing.Optional[str] = pydantic.Field("", **{})
    orgrocd: typing.Optional[str] = pydantic.Field("", **{})
    orgroname: typing.Optional[str] = pydantic.Field("", **{})
    orgsacd: typing.Optional[str] = pydantic.Field("", **{})
    orgsaname: typing.Optional[str] = pydantic.Field("", **{})
    productcode: typing.Optional[str] = pydantic.Field("", **{})
    materialgroupname: typing.Optional[str] = pydantic.Field("", **{})
    curfiscalyear: typing.Optional[str] = pydantic.Field("", **{})
    fiscalyear: typing.Optional[str] = pydantic.Field("", **{})
    yearmonth: typing.Optional[str] = pydantic.Field("", **{})
    netweight_uom: typing.Optional[float] = pydantic.Field(0.0, **{})
    netweight_kg: typing.Optional[float] = pydantic.Field(0.0, **{})
    netweight_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    fiscal_year: typing.Optional[str] = pydantic.Field("", **{})
    engine_id: typing.Optional[str] = pydantic.Field("", **{})
    month_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = MomLevelFinalMetaDataSchema
        upsert_keys = []
        access_key_mapping = ['ORGSBUNAME:bu', 'ORGZONENAME:zone', 'ORGSANAME:sales_area']


class MomLevelFinalMetaData(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'mom_level_final_meta_data'
    
    orgsbucd: typing.Optional[str] = pydantic.Field("", **{})
    orgsbuname: typing.Optional[str] = pydantic.Field("", **{})
    orgzonecd: typing.Optional[str] = pydantic.Field("", **{})
    orgzonename: typing.Optional[str] = pydantic.Field("", **{})
    orgrocd: typing.Optional[str] = pydantic.Field("", **{})
    orgroname: typing.Optional[str] = pydantic.Field("", **{})
    orgsacd: typing.Optional[str] = pydantic.Field("", **{})
    orgsaname: typing.Optional[str] = pydantic.Field("", **{})
    productcode: typing.Optional[str] = pydantic.Field("", **{})
    materialgroupname: typing.Optional[str] = pydantic.Field("", **{})
    curfiscalyear: typing.Optional[str] = pydantic.Field("", **{})
    fiscalyear: typing.Optional[str] = pydantic.Field("", **{})
    yearmonth: typing.Optional[str] = pydantic.Field("", **{})
    netweight_uom: typing.Optional[float] = pydantic.Field(0.0, **{})
    netweight_kg: typing.Optional[float] = pydantic.Field(0.0, **{})
    netweight_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    fiscal_year: typing.Optional[str] = pydantic.Field("", **{})
    engine_id: typing.Optional[str] = pydantic.Field("", **{})
    month_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = MomLevelFinalMetaDataSchema
        upsert_keys = []
        access_key_mapping = ['ORGSBUNAME:bu', 'ORGZONENAME:zone', 'ORGSANAME:sales_area']


class MomLevelFinalMetaDataGetResp(pydantic.BaseModel):
    data: typing.List[MomLevelFinalMetaData]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class IndustryPerformanceSchema(UrdhvaPostgresBase):
    __tablename__ = 'industry_performance'
    
    prod1_1: Mapped[typing.Optional[str]] = mapped_column("prod1_1", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sbu_name: Mapped[typing.Optional[str]] = mapped_column("sbu_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    statename: Mapped[typing.Optional[str]] = mapped_column("statename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    company_name: Mapped[typing.Optional[str]] = mapped_column("company_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    productname: Mapped[typing.Optional[str]] = mapped_column("productname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    distname: Mapped[typing.Optional[str]] = mapped_column("distname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    prod2: Mapped[typing.Optional[str]] = mapped_column("prod2", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    comname: Mapped[typing.Optional[str]] = mapped_column("comname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    psu_pvt: Mapped[typing.Optional[str]] = mapped_column("psu_pvt", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    statecode: Mapped[typing.Optional[str]] = mapped_column("statecode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    orgrocd: Mapped[typing.Optional[str]] = mapped_column("orgrocd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dist: Mapped[typing.Optional[str]] = mapped_column("dist", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    prod1: Mapped[typing.Optional[str]] = mapped_column("prod1", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    total: Mapped[typing.Optional[float]] = mapped_column("total", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    distcode: Mapped[typing.Optional[str]] = mapped_column("distcode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    comcode: Mapped[typing.Optional[int]] = mapped_column("comcode", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    code: Mapped[typing.Optional[str]] = mapped_column("code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    productcode: Mapped[typing.Optional[int]] = mapped_column("productcode", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    zone_name: Mapped[typing.Optional[str]] = mapped_column("zone_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region_name: Mapped[typing.Optional[str]] = mapped_column("region_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    newcode: Mapped[typing.Optional[str]] = mapped_column("newcode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    fiscal_year: Mapped[typing.Optional[str]] = mapped_column("fiscal_year", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    coname: Mapped[typing.Optional[str]] = mapped_column("coname", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    month_name: Mapped[typing.Optional[str]] = mapped_column("month_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    netweight_tmt: Mapped[typing.Optional[float]] = mapped_column("netweight_tmt", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    com_type: Mapped[typing.Optional[str]] = mapped_column("com_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ro: Mapped[typing.Optional[str]] = mapped_column("ro", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class IndustryPerformanceCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'industry_performance'
    
    prod1_1: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    sbu_name: typing.Optional[str] = pydantic.Field("", **{})
    statename: typing.Optional[str] = pydantic.Field("", **{})
    company_name: typing.Optional[str] = pydantic.Field("", **{})
    productname: typing.Optional[str] = pydantic.Field("", **{})
    distname: typing.Optional[str] = pydantic.Field("", **{})
    prod2: typing.Optional[str] = pydantic.Field("", **{})
    comname: typing.Optional[str] = pydantic.Field("", **{})
    psu_pvt: typing.Optional[str] = pydantic.Field("", **{})
    statecode: typing.Optional[str] = pydantic.Field("", **{})
    orgrocd: typing.Optional[str] = pydantic.Field("", **{})
    dist: typing.Optional[str] = pydantic.Field("", **{})
    prod1: typing.Optional[str] = pydantic.Field("", **{})
    total: typing.Optional[float] = pydantic.Field(0.0, **{})
    distcode: typing.Optional[str] = pydantic.Field("", **{})
    comcode: typing.Optional[int] = pydantic.Field(0, **{})
    code: typing.Optional[str] = pydantic.Field("", **{})
    productcode: typing.Optional[int] = pydantic.Field(0, **{})
    zone_name: typing.Optional[str] = pydantic.Field("", **{})
    region_name: typing.Optional[str] = pydantic.Field("", **{})
    newcode: typing.Optional[str] = pydantic.Field("", **{})
    fiscal_year: typing.Optional[str] = pydantic.Field("", **{})
    coname: typing.Optional[str] = pydantic.Field("", **{})
    month_name: typing.Optional[str] = pydantic.Field("", **{})
    netweight_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    com_type: typing.Optional[str] = pydantic.Field("", **{})
    ro: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = IndustryPerformanceSchema
        upsert_keys = []
        access_key_mapping = ['ORGSBUNAME:bu', 'ORGZONENAME:zone', 'ORGSANAME:sales_area']


class IndustryPerformance(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'industry_performance'
    
    prod1_1: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    sbu_name: typing.Optional[str] = pydantic.Field("", **{})
    statename: typing.Optional[str] = pydantic.Field("", **{})
    company_name: typing.Optional[str] = pydantic.Field("", **{})
    productname: typing.Optional[str] = pydantic.Field("", **{})
    distname: typing.Optional[str] = pydantic.Field("", **{})
    prod2: typing.Optional[str] = pydantic.Field("", **{})
    comname: typing.Optional[str] = pydantic.Field("", **{})
    psu_pvt: typing.Optional[str] = pydantic.Field("", **{})
    statecode: typing.Optional[str] = pydantic.Field("", **{})
    orgrocd: typing.Optional[str] = pydantic.Field("", **{})
    dist: typing.Optional[str] = pydantic.Field("", **{})
    prod1: typing.Optional[str] = pydantic.Field("", **{})
    total: typing.Optional[float] = pydantic.Field(0.0, **{})
    distcode: typing.Optional[str] = pydantic.Field("", **{})
    comcode: typing.Optional[int] = pydantic.Field(0, **{})
    code: typing.Optional[str] = pydantic.Field("", **{})
    productcode: typing.Optional[int] = pydantic.Field(0, **{})
    zone_name: typing.Optional[str] = pydantic.Field("", **{})
    region_name: typing.Optional[str] = pydantic.Field("", **{})
    newcode: typing.Optional[str] = pydantic.Field("", **{})
    fiscal_year: typing.Optional[str] = pydantic.Field("", **{})
    coname: typing.Optional[str] = pydantic.Field("", **{})
    month_name: typing.Optional[str] = pydantic.Field("", **{})
    netweight_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})
    com_type: typing.Optional[str] = pydantic.Field("", **{})
    ro: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = IndustryPerformanceSchema
        upsert_keys = []
        access_key_mapping = ['ORGSBUNAME:bu', 'ORGZONENAME:zone', 'ORGSANAME:sales_area']


class IndustryPerformanceGetResp(pydantic.BaseModel):
    data: typing.List[IndustryPerformance]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Industryperformance_Generate_Ai_Industry_PerformanceParams(pydantic.BaseModel):
    user_prompt: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Industryperformance_List_Ai_Industry_Performance_QueriesParams(pydantic.BaseModel):
    search_text: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class ConsumerPumpTankDeliverySchema(UrdhvaPostgresBase):
    __tablename__ = 'consumer_pump_tank_delivery'
    
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    depot: Mapped[typing.Optional[str]] = mapped_column("depot", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product: Mapped[typing.Optional[str]] = mapped_column("product", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_group: Mapped[typing.Optional[str]] = mapped_column("tank_group", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    tank_no: Mapped[typing.Optional[int]] = mapped_column("tank_no", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    volume: Mapped[typing.Optional[float]] = mapped_column("volume", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    tc_volume: Mapped[typing.Optional[float]] = mapped_column("tc_volume", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    start_volume: Mapped[typing.Optional[float]] = mapped_column("start_volume", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    start_water: Mapped[typing.Optional[float]] = mapped_column("start_water", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    start_temp: Mapped[typing.Optional[float]] = mapped_column("start_temp", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    start_product_height: Mapped[typing.Optional[float]] = mapped_column("start_product_height", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    end_volume: Mapped[typing.Optional[float]] = mapped_column("end_volume", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    end_water: Mapped[typing.Optional[float]] = mapped_column("end_water", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    end_temp: Mapped[typing.Optional[float]] = mapped_column("end_temp", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    end_product_height: Mapped[typing.Optional[float]] = mapped_column("end_product_height", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    manual: Mapped[typing.Optional[bool]] = mapped_column("manual", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    delivery_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("delivery_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    truck_reg_no: Mapped[typing.Optional[str]] = mapped_column("truck_reg_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    po_number: Mapped[typing.Optional[str]] = mapped_column("po_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    verification_delivery_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("verification_delivery_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    verification_sales_order_no: Mapped[typing.Optional[str]] = mapped_column("verification_sales_order_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    actual_volume: Mapped[typing.Optional[float]] = mapped_column("actual_volume", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    actual_temp: Mapped[typing.Optional[float]] = mapped_column("actual_temp", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    density: Mapped[typing.Optional[float]] = mapped_column("density", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    pre_density: Mapped[typing.Optional[float]] = mapped_column("pre_density", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    post_density: Mapped[typing.Optional[float]] = mapped_column("post_density", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    source: Mapped[typing.Optional[str]] = mapped_column("source", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class ConsumerPumpTankDeliveryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'consumer_pump_tank_delivery'
    
    bu: typing.Optional[str] = pydantic.Field("", **{})
    depot: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    tank_group: typing.Optional[str] = pydantic.Field("", **{})
    start_time: typing.Optional[datetime.datetime] | None = None
    end_time: typing.Optional[datetime.datetime] | None = None
    tank_no: typing.Optional[int] = pydantic.Field(0, **{})
    volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    tc_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_water: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_temp: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_product_height: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_water: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_temp: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_product_height: typing.Optional[float] = pydantic.Field(0.0, **{})
    manual: typing.Optional[bool] = pydantic.Field(False, )
    delivery_date: typing.Optional[datetime.datetime] | None = None
    truck_reg_no: typing.Optional[str] = pydantic.Field("", **{})
    po_number: typing.Optional[str] = pydantic.Field("", **{})
    verification_delivery_time: typing.Optional[datetime.datetime] | None = None
    verification_sales_order_no: typing.Optional[str] = pydantic.Field("", **{})
    actual_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    actual_temp: typing.Optional[float] = pydantic.Field(0.0, **{})
    density: typing.Optional[float] = pydantic.Field(0.0, **{})
    pre_density: typing.Optional[float] = pydantic.Field(0.0, **{})
    post_density: typing.Optional[float] = pydantic.Field(0.0, **{})
    source: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumerPumpTankDeliverySchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class ConsumerPumpTankDelivery(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'consumer_pump_tank_delivery'
    
    bu: typing.Optional[str] = pydantic.Field("", **{})
    depot: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    tank_group: typing.Optional[str] = pydantic.Field("", **{})
    start_time: typing.Optional[datetime.datetime] | None = None
    end_time: typing.Optional[datetime.datetime] | None = None
    tank_no: typing.Optional[int] = pydantic.Field(0, **{})
    volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    tc_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_water: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_temp: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_product_height: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_water: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_temp: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_product_height: typing.Optional[float] = pydantic.Field(0.0, **{})
    manual: typing.Optional[bool] = pydantic.Field(False, )
    delivery_date: typing.Optional[datetime.datetime] | None = None
    truck_reg_no: typing.Optional[str] = pydantic.Field("", **{})
    po_number: typing.Optional[str] = pydantic.Field("", **{})
    verification_delivery_time: typing.Optional[datetime.datetime] | None = None
    verification_sales_order_no: typing.Optional[str] = pydantic.Field("", **{})
    actual_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    actual_temp: typing.Optional[float] = pydantic.Field(0.0, **{})
    density: typing.Optional[float] = pydantic.Field(0.0, **{})
    pre_density: typing.Optional[float] = pydantic.Field(0.0, **{})
    post_density: typing.Optional[float] = pydantic.Field(0.0, **{})
    source: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumerPumpTankDeliverySchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class ConsumerPumpTankDeliveryGetResp(pydantic.BaseModel):
    data: typing.List[ConsumerPumpTankDelivery]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class ConsumperPumpTransactionSchema(UrdhvaPostgresBase):
    __tablename__ = 'consumper_pump_transaction'
    
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    depot: Mapped[typing.Optional[str]] = mapped_column("depot", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    make: Mapped[typing.Optional[str]] = mapped_column("make", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    model: Mapped[typing.Optional[str]] = mapped_column("model", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    make_model: Mapped[typing.Optional[str]] = mapped_column("make_model", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    capacity: Mapped[typing.Optional[int]] = mapped_column("capacity", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    token_type: Mapped[typing.Optional[str]] = mapped_column("token_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transaction_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("transaction_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    transaction_type: Mapped[typing.Optional[str]] = mapped_column("transaction_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product: Mapped[typing.Optional[str]] = mapped_column("product", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    volume: Mapped[typing.Optional[float]] = mapped_column("volume", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    tank_no: Mapped[typing.Optional[int]] = mapped_column("tank_no", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    start_pump_totalizer: Mapped[typing.Optional[float]] = mapped_column("start_pump_totalizer", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    end_pump_totalizer: Mapped[typing.Optional[float]] = mapped_column("end_pump_totalizer", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    consumption_type: Mapped[typing.Optional[str]] = mapped_column("consumption_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    consumption_benchmark: Mapped[typing.Optional[int]] = mapped_column("consumption_benchmark", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    dispensing_unit: Mapped[typing.Optional[int]] = mapped_column("dispensing_unit", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    pump_no: Mapped[typing.Optional[int]] = mapped_column("pump_no", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    global_nozzle_no: Mapped[typing.Optional[int]] = mapped_column("global_nozzle_no", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    department: Mapped[typing.Optional[str]] = mapped_column("department", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class ConsumperPumpTransactionCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'consumper_pump_transaction'
    
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    depot: typing.Optional[str] = pydantic.Field("", **{})
    make: typing.Optional[str] = pydantic.Field("", **{})
    model: typing.Optional[str] = pydantic.Field("", **{})
    make_model: typing.Optional[str] = pydantic.Field("", **{})
    capacity: typing.Optional[int] = pydantic.Field(0, **{})
    token_type: typing.Optional[str] = pydantic.Field("", **{})
    transaction_time: typing.Optional[datetime.datetime] | None = None
    transaction_type: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    tank_no: typing.Optional[int] = pydantic.Field(0, **{})
    start_pump_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_pump_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    consumption_type: typing.Optional[str] = pydantic.Field("", **{})
    consumption_benchmark: typing.Optional[int] = pydantic.Field(0, **{})
    dispensing_unit: typing.Optional[int] = pydantic.Field(0, **{})
    pump_no: typing.Optional[int] = pydantic.Field(0, **{})
    global_nozzle_no: typing.Optional[int] = pydantic.Field(0, **{})
    department: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumperPumpTransactionSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class ConsumperPumpTransaction(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'consumper_pump_transaction'
    
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    depot: typing.Optional[str] = pydantic.Field("", **{})
    make: typing.Optional[str] = pydantic.Field("", **{})
    model: typing.Optional[str] = pydantic.Field("", **{})
    make_model: typing.Optional[str] = pydantic.Field("", **{})
    capacity: typing.Optional[int] = pydantic.Field(0, **{})
    token_type: typing.Optional[str] = pydantic.Field("", **{})
    transaction_time: typing.Optional[datetime.datetime] | None = None
    transaction_type: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    tank_no: typing.Optional[int] = pydantic.Field(0, **{})
    start_pump_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_pump_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    consumption_type: typing.Optional[str] = pydantic.Field("", **{})
    consumption_benchmark: typing.Optional[int] = pydantic.Field(0, **{})
    dispensing_unit: typing.Optional[int] = pydantic.Field(0, **{})
    pump_no: typing.Optional[int] = pydantic.Field(0, **{})
    global_nozzle_no: typing.Optional[int] = pydantic.Field(0, **{})
    department: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumperPumpTransactionSchema
        upsert_keys = []
        access_key_mapping = ['bu', 'sap_id']


class ConsumperPumpTransactionGetResp(pydantic.BaseModel):
    data: typing.List[ConsumperPumpTransaction]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class BuLevelGeoCoordinatesSchema(UrdhvaPostgresBase):
    __tablename__ = 'bu_level_geo_coordinates'
    
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_id: Mapped[typing.Optional[str]] = mapped_column("ro_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[str]] = mapped_column("latitude", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[str]] = mapped_column("longitude", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class BuLevelGeoCoordinatesCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'bu_level_geo_coordinates'
    
    sap_id: str
    ro_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: str
    latitude: typing.Optional[str] = pydantic.Field("", **{})
    longitude: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = BuLevelGeoCoordinatesSchema
        upsert_keys = []
        access_key_mapping = ['bu']


class BuLevelGeoCoordinates(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'bu_level_geo_coordinates'
    
    sap_id: typing.Optional[str] | None = None
    ro_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] | None = None
    latitude: typing.Optional[str] = pydantic.Field("", **{})
    longitude: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = BuLevelGeoCoordinatesSchema
        upsert_keys = []
        access_key_mapping = ['bu']


class BuLevelGeoCoordinatesGetResp(pydantic.BaseModel):
    data: typing.List[BuLevelGeoCoordinates]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Bulevelgeocoordinates_Upload_Geo_MasterParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LpgSubsidyExceptionDataSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_subsidy_exception_data'
    
    exception__code: Mapped[str] = mapped_column("exception__code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    distributor__code: Mapped[int] = mapped_column("distributor__code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    refills: Mapped[int] = mapped_column("refills", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    consumers: Mapped[int] = mapped_column("consumers", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    
    exception_code: Mapped[str] = mapped_column("exception_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    exception_description: Mapped[str] = mapped_column("exception_description", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    exception_name: Mapped[str] = mapped_column("exception_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    jde_distributor_code: Mapped[int] = mapped_column("jde_distributor_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sa_code: Mapped[str] = mapped_column("sa_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    state_code: Mapped[str] = mapped_column("state_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_code: Mapped[str] = mapped_column("ro_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sa_name: Mapped[str] = mapped_column("sa_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zo_code: Mapped[str] = mapped_column("zo_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_name: Mapped[str] = mapped_column("ro_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zo_name: Mapped[str] = mapped_column("zo_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgSubsidyExceptionDataCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_subsidy_exception_data'
    
    exception__code: str
    distributor__code: int
    refills: int
    consumers: int
    
    exception_code: str
    exception_description: str
    exception_name: str
    jde_distributor_code: int
    sa_code: str
    state_code: str
    ro_code: str
    sa_name: str
    zo_code: str
    ro_name: str
    zo_name: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgSubsidyExceptionDataSchema
        upsert_keys = []
        access_key_mapping = ['JDEDistributorCode:sap_id', 'SAName:sales_area', 'ZOName:zone', 'ROName:region']


class LpgSubsidyExceptionData(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_subsidy_exception_data'
    
    exception__code: typing.Optional[str] | None = None
    distributor__code: typing.Optional[int] | None = None
    refills: typing.Optional[int] | None = None
    consumers: typing.Optional[int] | None = None
    
    exception_code: typing.Optional[str] | None = None
    exception_description: typing.Optional[str] | None = None
    exception_name: typing.Optional[str] | None = None
    jde_distributor_code: typing.Optional[int] | None = None
    sa_code: typing.Optional[str] | None = None
    state_code: typing.Optional[str] | None = None
    ro_code: typing.Optional[str] | None = None
    sa_name: typing.Optional[str] | None = None
    zo_code: typing.Optional[str] | None = None
    ro_name: typing.Optional[str] | None = None
    zo_name: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgSubsidyExceptionDataSchema
        upsert_keys = []
        access_key_mapping = ['JDEDistributorCode:sap_id', 'SAName:sales_area', 'ZOName:zone', 'ROName:region']


class LpgSubsidyExceptionDataGetResp(pydantic.BaseModel):
    data: typing.List[LpgSubsidyExceptionData]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class LpgSubsidyFailureDataSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_subsidy_failure_data'
    
    payment_error_code: Mapped[str] = mapped_column("payment_error_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    distributor__code: Mapped[int] = mapped_column("distributor__code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    refills: Mapped[int] = mapped_column("refills", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    consumers: Mapped[int] = mapped_column("consumers", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    code: Mapped[int] = mapped_column("code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    payment_error_decription: Mapped[str] = mapped_column("payment_error_decription", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    payment_error_name: Mapped[str] = mapped_column("payment_error_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    jde_distributor_code: Mapped[int] = mapped_column("jde_distributor_code", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sa_code: Mapped[str] = mapped_column("sa_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    state_code: Mapped[str] = mapped_column("state_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_code: Mapped[str] = mapped_column("ro_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sa_name: Mapped[str] = mapped_column("sa_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zo_code: Mapped[str] = mapped_column("zo_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ro_name: Mapped[str] = mapped_column("ro_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zo_name: Mapped[str] = mapped_column("zo_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgSubsidyFailureDataCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_subsidy_failure_data'
    
    payment_error_code: str
    distributor__code: int
    refills: int
    consumers: int
    code: int
    payment_error_decription: str
    payment_error_name: str
    jde_distributor_code: int
    sa_code: str
    state_code: str
    ro_code: str
    sa_name: str
    zo_code: str
    ro_name: str
    zo_name: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgSubsidyFailureDataSchema
        upsert_keys = []
        access_key_mapping = ['JDEDistributorCode:sap_id', 'SAName:sales_area', 'ZOName:zone', 'ROName:region']


class LpgSubsidyFailureData(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_subsidy_failure_data'
    
    payment_error_code: typing.Optional[str] | None = None
    distributor__code: typing.Optional[int] | None = None
    refills: typing.Optional[int] | None = None
    consumers: typing.Optional[int] | None = None
    code: typing.Optional[int] | None = None
    payment_error_decription: typing.Optional[str] | None = None
    payment_error_name: typing.Optional[str] | None = None
    jde_distributor_code: typing.Optional[int] | None = None
    sa_code: typing.Optional[str] | None = None
    state_code: typing.Optional[str] | None = None
    ro_code: typing.Optional[str] | None = None
    sa_name: typing.Optional[str] | None = None
    zo_code: typing.Optional[str] | None = None
    ro_name: typing.Optional[str] | None = None
    zo_name: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgSubsidyFailureDataSchema
        upsert_keys = []
        access_key_mapping = ['JDEDistributorCode:sap_id', 'SAName:sales_area', 'ZOName:zone', 'ROName:region']


class LpgSubsidyFailureDataGetResp(pydantic.BaseModel):
    data: typing.List[LpgSubsidyFailureData]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class LpgOperationsRejectionsSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_operations_rejections'
    
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    plant: Mapped[str] = mapped_column("plant", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cyl_type: Mapped[str] = mapped_column("cyl_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    max_date: Mapped[datetime.datetime] = mapped_column("max_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    execution__date: Mapped[datetime.datetime] = mapped_column("execution__date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    process_date: Mapped[datetime.datetime] = mapped_column("process_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    sortoutpercentage: Mapped[float] = mapped_column("sortoutpercentage", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    system_id: Mapped[int] = mapped_column("system_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    total: Mapped[int] = mapped_column("total", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)


class LpgOperationsRejectionsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_operations_rejections'
    
    zone: str
    plant: str
    cyl_type: str
    max_date: datetime.datetime
    execution__date: datetime.datetime
    process_date: datetime.datetime
    sortoutpercentage: float
    system_id: int
    total: int

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgOperationsRejectionsSchema
        upsert_keys = []
        access_key_mapping = ['zone']


class LpgOperationsRejections(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_operations_rejections'
    
    zone: typing.Optional[str] | None = None
    plant: typing.Optional[str] | None = None
    cyl_type: typing.Optional[str] | None = None
    max_date: typing.Optional[datetime.datetime] | None = None
    execution__date: typing.Optional[datetime.datetime] | None = None
    process_date: typing.Optional[datetime.datetime] | None = None
    sortoutpercentage: typing.Optional[float] | None = None
    system_id: typing.Optional[int] | None = None
    total: typing.Optional[int] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgOperationsRejectionsSchema
        upsert_keys = []
        access_key_mapping = ['zone']


class LpgOperationsRejectionsGetResp(pydantic.BaseModel):
    data: typing.List[LpgOperationsRejections]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class ConsumerPumpTransactionsSchema(UrdhvaPostgresBase):
    __tablename__ = 'consumer_pump_transactions'
    
    unique_txn_id: Mapped[int] = mapped_column("unique_txn_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    txn_id: Mapped[typing.Optional[str]] = mapped_column("txn_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    txn_type: Mapped[typing.Optional[str]] = mapped_column("txn_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transaction_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("transaction_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    txn_start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("txn_start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    txn_end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("txn_end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    price: Mapped[typing.Optional[float]] = mapped_column("price", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    quantity: Mapped[typing.Optional[float]] = mapped_column("quantity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    amount: Mapped[typing.Optional[float]] = mapped_column("amount", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    fuel_equip_type: Mapped[typing.Optional[str]] = mapped_column("fuel_equip_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vehicle_no: Mapped[typing.Optional[str]] = mapped_column("vehicle_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product_id: Mapped[typing.Optional[str]] = mapped_column("product_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product: Mapped[typing.Optional[str]] = mapped_column("product", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_no: Mapped[typing.Optional[str]] = mapped_column("tank_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_name: Mapped[typing.Optional[str]] = mapped_column("tank_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    pump_no: Mapped[typing.Optional[str]] = mapped_column("pump_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    nozzle_id: Mapped[typing.Optional[str]] = mapped_column("nozzle_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    global_nozzle_id: Mapped[typing.Optional[str]] = mapped_column("global_nozzle_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(unique_txn_id, name="consumer_pump_transactions_unique_txn_id"),)


class ConsumerPumpTransactionsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'consumer_pump_transactions'
    
    unique_txn_id: int
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    txn_id: typing.Optional[str] = pydantic.Field("", **{})
    txn_type: typing.Optional[str] = pydantic.Field("", **{})
    transaction_date: typing.Optional[datetime.datetime] | None = None
    txn_start_time: typing.Optional[datetime.datetime] | None = None
    txn_end_time: typing.Optional[datetime.datetime] | None = None
    price: typing.Optional[float] = pydantic.Field(0.0, **{})
    quantity: typing.Optional[float] = pydantic.Field(0.0, **{})
    amount: typing.Optional[float] = pydantic.Field(0.0, **{})
    fuel_equip_type: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_no: typing.Optional[str] = pydantic.Field("", **{})
    product_id: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    pump_no: typing.Optional[str] = pydantic.Field("", **{})
    nozzle_id: typing.Optional[str] = pydantic.Field("", **{})
    global_nozzle_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumerPumpTransactionsSchema
        upsert_keys = ['unique_txn_id']
        access_key_mapping = ['ROID:sap_id']


class ConsumerPumpTransactions(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'consumer_pump_transactions'
    
    unique_txn_id: typing.Optional[int] | None = None
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    txn_id: typing.Optional[str] = pydantic.Field("", **{})
    txn_type: typing.Optional[str] = pydantic.Field("", **{})
    transaction_date: typing.Optional[datetime.datetime] | None = None
    txn_start_time: typing.Optional[datetime.datetime] | None = None
    txn_end_time: typing.Optional[datetime.datetime] | None = None
    price: typing.Optional[float] = pydantic.Field(0.0, **{})
    quantity: typing.Optional[float] = pydantic.Field(0.0, **{})
    amount: typing.Optional[float] = pydantic.Field(0.0, **{})
    fuel_equip_type: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_no: typing.Optional[str] = pydantic.Field("", **{})
    product_id: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    pump_no: typing.Optional[str] = pydantic.Field("", **{})
    nozzle_id: typing.Optional[str] = pydantic.Field("", **{})
    global_nozzle_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumerPumpTransactionsSchema
        upsert_keys = ['unique_txn_id']
        access_key_mapping = ['ROID:sap_id']


class ConsumerPumpTransactionsGetResp(pydantic.BaseModel):
    data: typing.List[ConsumerPumpTransactions]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Consumerpumptransactions_Bulk_Update_Cp_TransactionsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class ConsumerPumpTankInventorySchema(UrdhvaPostgresBase):
    __tablename__ = 'consumer_pump_tank_inventory'
    
    unique_txn_id: Mapped[int] = mapped_column("unique_txn_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    inventory_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("inventory_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    tank_id: Mapped[typing.Optional[str]] = mapped_column("tank_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_name: Mapped[typing.Optional[str]] = mapped_column("tank_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    stock_txn_code: Mapped[typing.Optional[str]] = mapped_column("stock_txn_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    stock_txn_id: Mapped[typing.Optional[str]] = mapped_column("stock_txn_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product_id: Mapped[typing.Optional[str]] = mapped_column("product_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product: Mapped[typing.Optional[str]] = mapped_column("product", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    prod_gross_qty: Mapped[typing.Optional[float]] = mapped_column("prod_gross_qty", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    tank_capacity: Mapped[typing.Optional[float]] = mapped_column("tank_capacity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    product_volume: Mapped[typing.Optional[float]] = mapped_column("product_volume", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    ullage: Mapped[typing.Optional[float]] = mapped_column("ullage", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    product_level: Mapped[typing.Optional[float]] = mapped_column("product_level", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    density: Mapped[typing.Optional[float]] = mapped_column("density", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    density_at_15: Mapped[typing.Optional[float]] = mapped_column("density_at_15", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(unique_txn_id, name="consumer_pump_tank_inventory_unique_txn_id"),)


class ConsumerPumpTankInventoryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'consumer_pump_tank_inventory'
    
    unique_txn_id: int
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    inventory_date: typing.Optional[datetime.datetime] | None = None
    tank_id: typing.Optional[str] = pydantic.Field("", **{})
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    stock_txn_code: typing.Optional[str] = pydantic.Field("", **{})
    stock_txn_id: typing.Optional[str] = pydantic.Field("", **{})
    product_id: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    prod_gross_qty: typing.Optional[float] = pydantic.Field(0.0, **{})
    tank_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    product_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    ullage: typing.Optional[float] = pydantic.Field(0.0, **{})
    product_level: typing.Optional[float] = pydantic.Field(0.0, **{})
    density: typing.Optional[float] = pydantic.Field(0.0, **{})
    density_at_15: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumerPumpTankInventorySchema
        upsert_keys = ['unique_txn_id']
        access_key_mapping = ['sap_id']


class ConsumerPumpTankInventory(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'consumer_pump_tank_inventory'
    
    unique_txn_id: typing.Optional[int] | None = None
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    inventory_date: typing.Optional[datetime.datetime] | None = None
    tank_id: typing.Optional[str] = pydantic.Field("", **{})
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    stock_txn_code: typing.Optional[str] = pydantic.Field("", **{})
    stock_txn_id: typing.Optional[str] = pydantic.Field("", **{})
    product_id: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    prod_gross_qty: typing.Optional[float] = pydantic.Field(0.0, **{})
    tank_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    product_volume: typing.Optional[float] = pydantic.Field(0.0, **{})
    ullage: typing.Optional[float] = pydantic.Field(0.0, **{})
    product_level: typing.Optional[float] = pydantic.Field(0.0, **{})
    density: typing.Optional[float] = pydantic.Field(0.0, **{})
    density_at_15: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumerPumpTankInventorySchema
        upsert_keys = ['unique_txn_id']
        access_key_mapping = ['sap_id']


class ConsumerPumpTankInventoryGetResp(pydantic.BaseModel):
    data: typing.List[ConsumerPumpTankInventory]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Consumerpumptankinventory_Bulk_Update_Cp_Tank_InventoryParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class ConsumerPumpStocksReceiptsSchema(UrdhvaPostgresBase):
    __tablename__ = 'consumer_pump_stocks_receipts'
    
    unique_txn_id: Mapped[str] = mapped_column("unique_txn_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    stock_receipt_id: Mapped[typing.Optional[str]] = mapped_column("stock_receipt_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    source: Mapped[typing.Optional[str]] = mapped_column("source", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    prod_qty_start: Mapped[typing.Optional[float]] = mapped_column("prod_qty_start", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    prod_qty_end: Mapped[typing.Optional[float]] = mapped_column("prod_qty_end", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    product_id: Mapped[typing.Optional[str]] = mapped_column("product_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product: Mapped[typing.Optional[str]] = mapped_column("product", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    quantity: Mapped[typing.Optional[float]] = mapped_column("quantity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    density: Mapped[typing.Optional[float]] = mapped_column("density", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    amount: Mapped[typing.Optional[float]] = mapped_column("amount", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    tank_no: Mapped[typing.Optional[str]] = mapped_column("tank_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_name: Mapped[typing.Optional[str]] = mapped_column("tank_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    decantation_start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("decantation_start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    decantation_end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("decantation_end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(unique_txn_id, name="consumer_pump_stocks_receipts_unique_txn_id"),)


class ConsumerPumpStocksReceiptsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'consumer_pump_stocks_receipts'
    
    unique_txn_id: str
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    stock_receipt_id: typing.Optional[str] = pydantic.Field("", **{})
    source: typing.Optional[str] = pydantic.Field("", **{})
    prod_qty_start: typing.Optional[float] = pydantic.Field(0.0, **{})
    prod_qty_end: typing.Optional[float] = pydantic.Field(0.0, **{})
    product_id: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    quantity: typing.Optional[float] = pydantic.Field(0.0, **{})
    density: typing.Optional[float] = pydantic.Field(0.0, **{})
    amount: typing.Optional[float] = pydantic.Field(0.0, **{})
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    decantation_start_time: typing.Optional[datetime.datetime] | None = None
    decantation_end_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumerPumpStocksReceiptsSchema
        upsert_keys = ['unique_txn_id']
        access_key_mapping = ['roid:sap_id']


class ConsumerPumpStocksReceipts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'consumer_pump_stocks_receipts'
    
    unique_txn_id: typing.Optional[str] | None = None
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    stock_receipt_id: typing.Optional[str] = pydantic.Field("", **{})
    source: typing.Optional[str] = pydantic.Field("", **{})
    prod_qty_start: typing.Optional[float] = pydantic.Field(0.0, **{})
    prod_qty_end: typing.Optional[float] = pydantic.Field(0.0, **{})
    product_id: typing.Optional[str] = pydantic.Field("", **{})
    product: typing.Optional[str] = pydantic.Field("", **{})
    quantity: typing.Optional[float] = pydantic.Field(0.0, **{})
    density: typing.Optional[float] = pydantic.Field(0.0, **{})
    amount: typing.Optional[float] = pydantic.Field(0.0, **{})
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    decantation_start_time: typing.Optional[datetime.datetime] | None = None
    decantation_end_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ConsumerPumpStocksReceiptsSchema
        upsert_keys = ['unique_txn_id']
        access_key_mapping = ['roid:sap_id']


class ConsumerPumpStocksReceiptsGetResp(pydantic.BaseModel):
    data: typing.List[ConsumerPumpStocksReceipts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Consumerpumpstocksreceipts_Bulk_Update_Cp_Stock_ReceiptsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class HostSickTtsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_sick_tts'
    
    load_number: Mapped[typing.Optional[int]] = mapped_column("load_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    truck_number: Mapped[typing.Optional[str]] = mapped_column("truck_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_date: Mapped[typing.Optional[datetime.date]] = mapped_column("created_date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    customer_name: Mapped[typing.Optional[str]] = mapped_column("customer_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    compartment_number: Mapped[typing.Optional[int]] = mapped_column("compartment_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    product_name: Mapped[typing.Optional[str]] = mapped_column("product_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    required_qty: Mapped[typing.Optional[int]] = mapped_column("required_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    loaded_qty: Mapped[typing.Optional[int]] = mapped_column("loaded_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sick_declared_by: Mapped[typing.Optional[str]] = mapped_column("sick_declared_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sick_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("sick_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bay_number: Mapped[typing.Optional[str]] = mapped_column("bay_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(load_number, truck_number, customer_name, compartment_number, product_name, sap_id, bcu_number, bay_number, date, name="host_sick_tts_loadn_truck_custo_compa_produ_sapid_bcunu_baynu_"),)


class HostSickTtsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_sick_tts'
    
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    created_date: typing.Optional[datetime.date] | None = None
    customer_name: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    sick_declared_by: typing.Optional[str] = pydantic.Field("", **{})
    sick_date: typing.Optional[datetime.datetime] | None = None
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostSickTtsSchema
        upsert_keys = ['load_number', 'truck_number', 'customer_name', 'compartment_number', 'product_name', 'sap_id', 'bcu_number', 'bay_number', 'date']
        search_fields = ['load_number', 'truck_number', 'customer_name', 'product_name', 'sap_id', 'bcu_number', 'bay_number']


class HostSickTts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_sick_tts'
    
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    created_date: typing.Optional[datetime.date] | None = None
    customer_name: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    sick_declared_by: typing.Optional[str] = pydantic.Field("", **{})
    sick_date: typing.Optional[datetime.datetime] | None = None
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostSickTtsSchema
        upsert_keys = ['load_number', 'truck_number', 'customer_name', 'compartment_number', 'product_name', 'sap_id', 'bcu_number', 'bay_number', 'date']
        search_fields = ['load_number', 'truck_number', 'customer_name', 'product_name', 'sap_id', 'bcu_number', 'bay_number']


class HostSickTtsGetResp(pydantic.BaseModel):
    data: typing.List[HostSickTts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Hostsicktts_Download_DataParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class HostCancelledTtsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_cancelled_tts'
    
    load_number: Mapped[typing.Optional[int]] = mapped_column("load_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    truck_number: Mapped[typing.Optional[str]] = mapped_column("truck_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("created_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    customer_name: Mapped[typing.Optional[str]] = mapped_column("customer_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product_name: Mapped[typing.Optional[str]] = mapped_column("product_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    required_qty: Mapped[typing.Optional[int]] = mapped_column("required_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    cancelled_by: Mapped[typing.Optional[str]] = mapped_column("cancelled_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    cancelled_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("cancelled_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    compartment_number: Mapped[typing.Optional[int]] = mapped_column("compartment_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    entry_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("entry_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    exit_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("exit_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(load_number, truck_number, customer_name, product_name, sap_id, compartment_number, date, name="host_cancelled_tts_loadn_truck_custo_produ_sapid_compa_date"),)


class HostCancelledTtsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_cancelled_tts'
    
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    created_date: typing.Optional[datetime.datetime] | None = None
    customer_name: typing.Optional[str] = pydantic.Field("", **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    cancelled_by: typing.Optional[str] = pydantic.Field("", **{})
    cancelled_date: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    entry_time: typing.Optional[datetime.datetime] | None = None
    exit_time: typing.Optional[datetime.datetime] | None = None
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostCancelledTtsSchema
        upsert_keys = ['load_number', 'truck_number', 'customer_name', 'product_name', 'sap_id', 'compartment_number', 'date']
        search_fields = ['load_number', 'truck_number', 'customer_name', 'product_name', 'sap_id']


class HostCancelledTts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_cancelled_tts'
    
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    created_date: typing.Optional[datetime.datetime] | None = None
    customer_name: typing.Optional[str] = pydantic.Field("", **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    cancelled_by: typing.Optional[str] = pydantic.Field("", **{})
    cancelled_date: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    entry_time: typing.Optional[datetime.datetime] | None = None
    exit_time: typing.Optional[datetime.datetime] | None = None
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostCancelledTtsSchema
        upsert_keys = ['load_number', 'truck_number', 'customer_name', 'product_name', 'sap_id', 'compartment_number', 'date']
        search_fields = ['load_number', 'truck_number', 'customer_name', 'product_name', 'sap_id']


class HostCancelledTtsGetResp(pydantic.BaseModel):
    data: typing.List[HostCancelledTts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostKFactorChangesSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_k_factor_changes'
    
    bay_number: Mapped[typing.Optional[str]] = mapped_column("bay_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    preset_number: Mapped[typing.Optional[str]] = mapped_column("preset_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    timestamp: Mapped[typing.Optional[datetime.datetime]] = mapped_column("timestamp", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    bcu_parameter: Mapped[typing.Optional[str]] = mapped_column("bcu_parameter", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    initial_setting: Mapped[typing.Optional[str]] = mapped_column("initial_setting", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    final_setting: Mapped[typing.Optional[str]] = mapped_column("final_setting", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(bcu_number, preset_number, timestamp, initial_setting, final_setting, sap_id, date, name="host_k_factor_changes_bcunu_prese_times_initi_final_sapid_date"),)


class HostKFactorChangesCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_k_factor_changes'
    
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    preset_number: typing.Optional[str] = pydantic.Field("", **{})
    timestamp: typing.Optional[datetime.datetime] | None = None
    bcu_parameter: typing.Optional[str] = pydantic.Field("", **{})
    initial_setting: typing.Optional[str] = pydantic.Field("", **{})
    final_setting: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostKFactorChangesSchema
        upsert_keys = ['bcu_number', 'preset_number', 'timestamp', 'initial_setting', 'final_setting', 'sap_id', 'date']
        search_fields = ['bay_number', 'bcu_number', 'sap_id']


class HostKFactorChanges(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_k_factor_changes'
    
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    preset_number: typing.Optional[str] = pydantic.Field("", **{})
    timestamp: typing.Optional[datetime.datetime] | None = None
    bcu_parameter: typing.Optional[str] = pydantic.Field("", **{})
    initial_setting: typing.Optional[str] = pydantic.Field("", **{})
    final_setting: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostKFactorChangesSchema
        upsert_keys = ['bcu_number', 'preset_number', 'timestamp', 'initial_setting', 'final_setting', 'sap_id', 'date']
        search_fields = ['bay_number', 'bcu_number', 'sap_id']


class HostKFactorChangesGetResp(pydantic.BaseModel):
    data: typing.List[HostKFactorChanges]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostLocalLoadedTtsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_local_loaded_tts'
    
    bay_number: Mapped[typing.Optional[str]] = mapped_column("bay_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    recipe_name: Mapped[typing.Optional[str]] = mapped_column("recipe_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    truck_number: Mapped[typing.Optional[str]] = mapped_column("truck_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    card_number: Mapped[typing.Optional[str]] = mapped_column("card_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    start_totalizer: Mapped[typing.Optional[float]] = mapped_column("start_totalizer", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    end_totalizer: Mapped[typing.Optional[float]] = mapped_column("end_totalizer", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    loaded_qty: Mapped[typing.Optional[int]] = mapped_column("loaded_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    transaction_end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("transaction_end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    compartment_number: Mapped[typing.Optional[int]] = mapped_column("compartment_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(bcu_number, recipe_name, truck_number, card_number, start_totalizer, end_totalizer, loaded_qty, sap_id, compartment_number, date, name="host_local_loaded_tts_bcunu_recip_truck_cardn_start_endto_load"),)


class HostLocalLoadedTtsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_local_loaded_tts'
    
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    recipe_name: typing.Optional[str] = pydantic.Field("", **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    card_number: typing.Optional[str] = pydantic.Field("", **{})
    start_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    transaction_end_time: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostLocalLoadedTtsSchema
        upsert_keys = ['bcu_number', 'recipe_name', 'truck_number', 'card_number', 'start_totalizer', 'end_totalizer', 'loaded_qty', 'sap_id', 'compartment_number', 'date']
        search_fields = ['bay_number', 'bcu_number', 'recipe_name', 'truck_number', 'sap_id']


class HostLocalLoadedTts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_local_loaded_tts'
    
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    recipe_name: typing.Optional[str] = pydantic.Field("", **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    card_number: typing.Optional[str] = pydantic.Field("", **{})
    start_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    transaction_end_time: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostLocalLoadedTtsSchema
        upsert_keys = ['bcu_number', 'recipe_name', 'truck_number', 'card_number', 'start_totalizer', 'end_totalizer', 'loaded_qty', 'sap_id', 'compartment_number', 'date']
        search_fields = ['bay_number', 'bcu_number', 'recipe_name', 'truck_number', 'sap_id']


class HostLocalLoadedTtsGetResp(pydantic.BaseModel):
    data: typing.List[HostLocalLoadedTts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostBayReAssignmentSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_bay_re_assignment'
    
    created_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("created_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    load_number: Mapped[typing.Optional[int]] = mapped_column("load_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    fan_number: Mapped[typing.Optional[str]] = mapped_column("fan_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    truck_number: Mapped[typing.Optional[str]] = mapped_column("truck_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    customer_name: Mapped[typing.Optional[str]] = mapped_column("customer_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    compartment_number: Mapped[typing.Optional[int]] = mapped_column("compartment_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    product_name: Mapped[typing.Optional[str]] = mapped_column("product_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    required_qty: Mapped[typing.Optional[int]] = mapped_column("required_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    loaded_qty: Mapped[typing.Optional[int]] = mapped_column("loaded_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    reassigned_bay: Mapped[typing.Optional[str]] = mapped_column("reassigned_bay", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bay_reassignment_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("bay_reassignment_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_bay: Mapped[typing.Optional[str]] = mapped_column("assigned_bay", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    reassign_loaded_qty: Mapped[typing.Optional[int]] = mapped_column("reassign_loaded_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(load_number, truck_number, customer_name, compartment_number, product_name, required_qty, loaded_qty, sap_id, assigned_bay, reassign_loaded_qty, date, name="host_bay_re_assignment_loadn_truck_custo_compa_produ_requi_loa"),)


class HostBayReAssignmentCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_bay_re_assignment'
    
    created_date: typing.Optional[datetime.datetime] | None = None
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    fan_number: typing.Optional[str] = pydantic.Field("", **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    customer_name: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    reassigned_bay: typing.Optional[str] = pydantic.Field("", **{})
    bay_reassignment_time: typing.Optional[datetime.datetime] | None = None
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    assigned_bay: typing.Optional[str] = pydantic.Field("", **{})
    reassign_loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostBayReAssignmentSchema
        upsert_keys = ['load_number', 'truck_number', 'customer_name', 'compartment_number', 'product_name', 'required_qty', 'loaded_qty', 'sap_id', 'assigned_bay', 'reassign_loaded_qty', 'date']
        search_fields = ['load_number', 'truck_number', 'customer_name', 'product_name', 'reassigned_bay', 'sap_id', 'assigned_bay']


class HostBayReAssignment(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_bay_re_assignment'
    
    created_date: typing.Optional[datetime.datetime] | None = None
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    fan_number: typing.Optional[str] = pydantic.Field("", **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    customer_name: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    reassigned_bay: typing.Optional[str] = pydantic.Field("", **{})
    bay_reassignment_time: typing.Optional[datetime.datetime] | None = None
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    assigned_bay: typing.Optional[str] = pydantic.Field("", **{})
    reassign_loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostBayReAssignmentSchema
        upsert_keys = ['load_number', 'truck_number', 'customer_name', 'compartment_number', 'product_name', 'required_qty', 'loaded_qty', 'sap_id', 'assigned_bay', 'reassign_loaded_qty', 'date']
        search_fields = ['load_number', 'truck_number', 'customer_name', 'product_name', 'reassigned_bay', 'sap_id', 'assigned_bay']


class HostBayReAssignmentGetResp(pydantic.BaseModel):
    data: typing.List[HostBayReAssignment]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostManualFanPrintedSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_manual_fan_printed'
    
    manual_fan_count: Mapped[typing.Optional[int]] = mapped_column("manual_fan_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    auto_fan_count: Mapped[typing.Optional[int]] = mapped_column("auto_fan_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    total_count: Mapped[typing.Optional[int]] = mapped_column("total_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(auto_fan_count, total_count, date, sap_id, name="host_manual_fan_printed_auto_fan_count_total_count_date_sap_id"),)


class HostManualFanPrintedCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_manual_fan_printed'
    
    manual_fan_count: typing.Optional[int] = pydantic.Field(0, **{})
    auto_fan_count: typing.Optional[int] = pydantic.Field(0, **{})
    total_count: typing.Optional[int] = pydantic.Field(0, **{})
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostManualFanPrintedSchema
        upsert_keys = ['auto_fan_count', 'total_count', 'date', 'sap_id']
        search_fields = ['manual_fan_count', 'auto_fan_count', 'total_count', 'sap_id']


class HostManualFanPrinted(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_manual_fan_printed'
    
    manual_fan_count: typing.Optional[int] = pydantic.Field(0, **{})
    auto_fan_count: typing.Optional[int] = pydantic.Field(0, **{})
    total_count: typing.Optional[int] = pydantic.Field(0, **{})
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostManualFanPrintedSchema
        upsert_keys = ['auto_fan_count', 'total_count', 'date', 'sap_id']
        search_fields = ['manual_fan_count', 'auto_fan_count', 'total_count', 'sap_id']


class HostManualFanPrintedGetResp(pydantic.BaseModel):
    data: typing.List[HostManualFanPrinted]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostUnauthorisedFlowSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_unauthorised_flow'
    
    bay_number: Mapped[typing.Optional[str]] = mapped_column("bay_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    meter_number: Mapped[typing.Optional[int]] = mapped_column("meter_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    timestamp: Mapped[typing.Optional[datetime.datetime]] = mapped_column("timestamp", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    start_totalizer: Mapped[typing.Optional[float]] = mapped_column("start_totalizer", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    end_totalizer: Mapped[typing.Optional[float]] = mapped_column("end_totalizer", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    net_totalizer: Mapped[typing.Optional[float]] = mapped_column("net_totalizer", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    nettotalizer: Mapped[typing.Optional[float]] = mapped_column("nettotalizer", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(bcu_number, meter_number, timestamp, start_totalizer, end_totalizer, net_totalizer, sap_id, date, name="host_unauthorised_flow_bcunu_meter_times_start_endto_netto_sap"),)


class HostUnauthorisedFlowCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_unauthorised_flow'
    
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    meter_number: typing.Optional[int] = pydantic.Field(0, **{})
    timestamp: typing.Optional[datetime.datetime] | None = None
    start_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    net_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None
    nettotalizer: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostUnauthorisedFlowSchema
        upsert_keys = ['bcu_number', 'meter_number', 'timestamp', 'start_totalizer', 'end_totalizer', 'net_totalizer', 'sap_id', 'date']
        search_fields = ['bay_number', 'bcu_number', 'meter_number', 'sap_id']


class HostUnauthorisedFlow(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_unauthorised_flow'
    
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    meter_number: typing.Optional[int] = pydantic.Field(0, **{})
    timestamp: typing.Optional[datetime.datetime] | None = None
    start_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    end_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    net_totalizer: typing.Optional[float] = pydantic.Field(0.0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None
    nettotalizer: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostUnauthorisedFlowSchema
        upsert_keys = ['bcu_number', 'meter_number', 'timestamp', 'start_totalizer', 'end_totalizer', 'net_totalizer', 'sap_id', 'date']
        search_fields = ['bay_number', 'bcu_number', 'meter_number', 'sap_id']


class HostUnauthorisedFlowGetResp(pydantic.BaseModel):
    data: typing.List[HostUnauthorisedFlow]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostOverLoadedTtsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_over_loaded_tts'
    
    load_number: Mapped[typing.Optional[int]] = mapped_column("load_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    truck_number: Mapped[typing.Optional[str]] = mapped_column("truck_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    compartment_number: Mapped[typing.Optional[int]] = mapped_column("compartment_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    product_name: Mapped[typing.Optional[str]] = mapped_column("product_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    required_qty: Mapped[typing.Optional[int]] = mapped_column("required_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    loaded_qty: Mapped[typing.Optional[int]] = mapped_column("loaded_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("created_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bay_number: Mapped[typing.Optional[str]] = mapped_column("bay_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(load_number, truck_number, compartment_number, product_name, required_qty, loaded_qty, sap_id, bcu_number, bay_number, date, name="host_over_loaded_tts_loadn_truck_compa_produ_requi_loade_sapid"),)


class HostOverLoadedTtsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_over_loaded_tts'
    
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    created_date: typing.Optional[datetime.datetime] | None = None
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostOverLoadedTtsSchema
        upsert_keys = ['load_number', 'truck_number', 'compartment_number', 'product_name', 'required_qty', 'loaded_qty', 'sap_id', 'bcu_number', 'bay_number', 'date']
        search_fields = ['load_number', 'truck_number', 'product_name', 'sap_id', 'bcu_number', 'bay_number']


class HostOverLoadedTts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_over_loaded_tts'
    
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    created_date: typing.Optional[datetime.datetime] | None = None
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostOverLoadedTtsSchema
        upsert_keys = ['load_number', 'truck_number', 'compartment_number', 'product_name', 'required_qty', 'loaded_qty', 'sap_id', 'bcu_number', 'bay_number', 'date']
        search_fields = ['load_number', 'truck_number', 'product_name', 'sap_id', 'bcu_number', 'bay_number']


class HostOverLoadedTtsGetResp(pydantic.BaseModel):
    data: typing.List[HostOverLoadedTts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostMFMFactorSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_mfm_factor'
    
    mfm_number: Mapped[typing.Optional[str]] = mapped_column("mfm_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    mfm_description: Mapped[typing.Optional[str]] = mapped_column("mfm_description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    stock_code: Mapped[typing.Optional[str]] = mapped_column("stock_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    current_k_factor: Mapped[typing.Optional[float]] = mapped_column("current_k_factor", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    last_k_factor: Mapped[typing.Optional[str]] = mapped_column("last_k_factor", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    last_k_factor_change_date: Mapped[typing.Optional[str]] = mapped_column("last_k_factor_change_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    current_meter_factor: Mapped[typing.Optional[float]] = mapped_column("current_meter_factor", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    last_meter_factor: Mapped[typing.Optional[float]] = mapped_column("last_meter_factor", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    last_meter_factor_change_date: Mapped[typing.Optional[str]] = mapped_column("last_meter_factor_change_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(mfm_number, stock_code, last_k_factor_change_date, last_meter_factor_change_date, sap_id, name="host_mfm_factor_mfmnu_stock_lastk_lastm_sapid"),)


class HostMFMFactorCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_mfm_factor'
    
    mfm_number: typing.Optional[str] = pydantic.Field("", **{})
    mfm_description: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    stock_code: typing.Optional[str] = pydantic.Field("", **{})
    current_k_factor: typing.Optional[float] = pydantic.Field(0.0, **{})
    last_k_factor: typing.Optional[str] = pydantic.Field("", **{})
    last_k_factor_change_date: typing.Optional[str] = pydantic.Field("", **{})
    current_meter_factor: typing.Optional[float] = pydantic.Field(0.0, **{})
    last_meter_factor: typing.Optional[float] = pydantic.Field(0.0, **{})
    last_meter_factor_change_date: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostMFMFactorSchema
        upsert_keys = ['mfm_number', 'stock_code', 'last_k_factor_change_date', 'last_meter_factor_change_date', 'sap_id']
        search_fields = ['mfm_number', 'bcu_number', 'sap_id']


class HostMFMFactor(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_mfm_factor'
    
    mfm_number: typing.Optional[str] = pydantic.Field("", **{})
    mfm_description: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    stock_code: typing.Optional[str] = pydantic.Field("", **{})
    current_k_factor: typing.Optional[float] = pydantic.Field(0.0, **{})
    last_k_factor: typing.Optional[str] = pydantic.Field("", **{})
    last_k_factor_change_date: typing.Optional[str] = pydantic.Field("", **{})
    current_meter_factor: typing.Optional[float] = pydantic.Field(0.0, **{})
    last_meter_factor: typing.Optional[float] = pydantic.Field(0.0, **{})
    last_meter_factor_change_date: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostMFMFactorSchema
        upsert_keys = ['mfm_number', 'stock_code', 'last_k_factor_change_date', 'last_meter_factor_change_date', 'sap_id']
        search_fields = ['mfm_number', 'bcu_number', 'sap_id']


class HostMFMFactorGetResp(pydantic.BaseModel):
    data: typing.List[HostMFMFactor]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class MasterStatusSchema(UrdhvaPostgresBase):
    __tablename__ = 'master_status'
    
    status: Mapped[typing.Optional[int]] = mapped_column("status", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    location_code: Mapped[typing.Optional[str]] = mapped_column("location_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    active_server_name: Mapped[str] = mapped_column("active_server_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(status, location_code, active_server_name, sap_id, date, name="master_status_statu_locat_activ_sapid_date"),)


class MasterStatusCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'master_status'
    
    status: typing.Optional[int] = pydantic.Field(0, **{})
    location_code: typing.Optional[str] = pydantic.Field("", **{})
    active_server_name: str
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = MasterStatusSchema
        upsert_keys = ['status', 'location_code', 'active_server_name', 'sap_id', 'date']


class MasterStatus(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'master_status'
    
    status: typing.Optional[int] = pydantic.Field(0, **{})
    location_code: typing.Optional[str] = pydantic.Field("", **{})
    active_server_name: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = MasterStatusSchema
        upsert_keys = ['status', 'location_code', 'active_server_name', 'sap_id', 'date']


class MasterStatusGetResp(pydantic.BaseModel):
    data: typing.List[MasterStatus]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostStandaloneTtsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_standalone_tts'
    
    load_number: Mapped[typing.Optional[int]] = mapped_column("load_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    created_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("created_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    truck_number: Mapped[typing.Optional[str]] = mapped_column("truck_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    compartment_number: Mapped[typing.Optional[int]] = mapped_column("compartment_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bay_number: Mapped[typing.Optional[str]] = mapped_column("bay_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product_name: Mapped[typing.Optional[str]] = mapped_column("product_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    required_qty: Mapped[typing.Optional[int]] = mapped_column("required_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    loaded_qty: Mapped[typing.Optional[int]] = mapped_column("loaded_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(load_number, truck_number, compartment_number, bcu_number, bay_number, product_name, required_qty, loaded_qty, sap_id, date, name="host_standalone_tts_loadn_truck_compa_bcunu_baynu_produ_requi_"),)


class HostStandaloneTtsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_standalone_tts'
    
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    created_date: typing.Optional[datetime.datetime] | None = None
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostStandaloneTtsSchema
        upsert_keys = ['load_number', 'truck_number', 'compartment_number', 'bcu_number', 'bay_number', 'product_name', 'required_qty', 'loaded_qty', 'sap_id', 'date']
        search_fields = ['load_number', 'truck_number', 'bcu_number', 'sap_id', 'product_name']


class HostStandaloneTts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_standalone_tts'
    
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    created_date: typing.Optional[datetime.datetime] | None = None
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    compartment_number: typing.Optional[int] = pydantic.Field(0, **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    required_qty: typing.Optional[int] = pydantic.Field(0, **{})
    loaded_qty: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostStandaloneTtsSchema
        upsert_keys = ['load_number', 'truck_number', 'compartment_number', 'bcu_number', 'bay_number', 'product_name', 'required_qty', 'loaded_qty', 'sap_id', 'date']
        search_fields = ['load_number', 'truck_number', 'bcu_number', 'sap_id', 'product_name']


class HostStandaloneTtsGetResp(pydantic.BaseModel):
    data: typing.List[HostStandaloneTts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostTasUserDetailsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_tas_user_details'
    
    user_name: Mapped[typing.Optional[str]] = mapped_column("user_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    password_expiry_date: Mapped[typing.Optional[str]] = mapped_column("password_expiry_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    user_group: Mapped[typing.Optional[str]] = mapped_column("user_group", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(user_name, password_expiry_date, user_group, sap_id, date, name="host_tas_user_details_usern_passw_userg_sapid_date"),)


class HostTasUserDetailsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_tas_user_details'
    
    user_name: typing.Optional[str] = pydantic.Field("", **{})
    password_expiry_date: typing.Optional[str] = pydantic.Field("", **{})
    user_group: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostTasUserDetailsSchema
        upsert_keys = ['user_name', 'password_expiry_date', 'user_group', 'sap_id', 'date']
        search_fields = ['user_name', 'user_group', 'password_expiry_date', 'sap_id']


class HostTasUserDetails(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_tas_user_details'
    
    user_name: typing.Optional[str] = pydantic.Field("", **{})
    password_expiry_date: typing.Optional[str] = pydantic.Field("", **{})
    user_group: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostTasUserDetailsSchema
        upsert_keys = ['user_name', 'password_expiry_date', 'user_group', 'sap_id', 'date']
        search_fields = ['user_name', 'user_group', 'password_expiry_date', 'sap_id']


class HostTasUserDetailsGetResp(pydantic.BaseModel):
    data: typing.List[HostTasUserDetails]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostLiveTankDetailsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_live_tank_details'
    
    tank_name: Mapped[typing.Optional[str]] = mapped_column("tank_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_mode: Mapped[typing.Optional[str]] = mapped_column("tank_mode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_code: Mapped[typing.Optional[str]] = mapped_column("tank_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    curr_level: Mapped[typing.Optional[int]] = mapped_column("curr_level", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    water_level: Mapped[typing.Optional[int]] = mapped_column("water_level", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(tank_name, tank_mode, sap_id, date, name="host_live_tank_details_tank_name_tank_mode_sap_id_date"),)


class HostLiveTankDetailsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_live_tank_details'
    
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    tank_mode: typing.Optional[str] = pydantic.Field("", **{})
    tank_code: typing.Optional[str] = pydantic.Field("", **{})
    curr_level: typing.Optional[int] = pydantic.Field(0, **{})
    water_level: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostLiveTankDetailsSchema
        upsert_keys = ['tank_name', 'tank_mode', 'sap_id', 'date']
        search_fields = ['tank_name', 'tank_name', 'sap_id']


class HostLiveTankDetails(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_live_tank_details'
    
    tank_name: typing.Optional[str] = pydantic.Field("", **{})
    tank_mode: typing.Optional[str] = pydantic.Field("", **{})
    tank_code: typing.Optional[str] = pydantic.Field("", **{})
    curr_level: typing.Optional[int] = pydantic.Field(0, **{})
    water_level: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostLiveTankDetailsSchema
        upsert_keys = ['tank_name', 'tank_mode', 'sap_id', 'date']
        search_fields = ['tank_name', 'tank_name', 'sap_id']


class HostLiveTankDetailsGetResp(pydantic.BaseModel):
    data: typing.List[HostLiveTankDetails]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostSuspectedLoadsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_suspected_loads'
    
    event_time: Mapped[typing.Optional[str]] = mapped_column("event_time", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bay_number: Mapped[typing.Optional[str]] = mapped_column("bay_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    load_number: Mapped[typing.Optional[int]] = mapped_column("load_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    truck_number: Mapped[typing.Optional[str]] = mapped_column("truck_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(event_time, bay_number, bcu_number, load_number, truck_number, sap_id, date, name="host_suspected_loads_event_baynu_bcunu_loadn_truck_sapid_date"),)


class HostSuspectedLoadsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_suspected_loads'
    
    event_time: typing.Optional[str] = pydantic.Field("", **{})
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostSuspectedLoadsSchema
        upsert_keys = ['event_time', 'bay_number', 'bcu_number', 'load_number', 'truck_number', 'sap_id', 'date']
        search_fields = ['event_time', 'bay_number', 'bcu_number', 'load_number', 'truck_number', 'sap_id']


class HostSuspectedLoads(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_suspected_loads'
    
    event_time: typing.Optional[str] = pydantic.Field("", **{})
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    load_number: typing.Optional[int] = pydantic.Field(0, **{})
    truck_number: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostSuspectedLoadsSchema
        upsert_keys = ['event_time', 'bay_number', 'bcu_number', 'load_number', 'truck_number', 'sap_id', 'date']
        search_fields = ['event_time', 'bay_number', 'bcu_number', 'load_number', 'truck_number', 'sap_id']


class HostSuspectedLoadsGetResp(pydantic.BaseModel):
    data: typing.List[HostSuspectedLoads]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostPltDetailsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_plt_details'
    
    transaction_number: Mapped[typing.Optional[int]] = mapped_column("transaction_number", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    mfm_number: Mapped[typing.Optional[str]] = mapped_column("mfm_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    stock: Mapped[typing.Optional[str]] = mapped_column("stock", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    trans_start_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("trans_start_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    trans_end_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("trans_end_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    cum_start_gross_vol_kl: Mapped[typing.Optional[int]] = mapped_column("cum_start_gross_vol_kl", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    cum_end_gross_vol_kl: Mapped[typing.Optional[int]] = mapped_column("cum_end_gross_vol_kl", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    cum_start_mass_mt: Mapped[typing.Optional[str]] = mapped_column("cum_start_mass_mt", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    cum_end_mass_mt: Mapped[typing.Optional[str]] = mapped_column("cum_end_mass_mt", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    uncorr_vol_kl: Mapped[typing.Optional[int]] = mapped_column("uncorr_vol_kl", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    mass_mt: Mapped[typing.Optional[int]] = mapped_column("mass_mt", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(transaction_number, mfm_number, stock, sap_id, date, name="host_plt_details_trans_mfmnu_stock_sapid_date"),)


class HostPltDetailsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_plt_details'
    
    transaction_number: typing.Optional[int] = pydantic.Field(0, **{})
    mfm_number: typing.Optional[str] = pydantic.Field("", **{})
    stock: typing.Optional[str] = pydantic.Field("", **{})
    trans_start_time: typing.Optional[datetime.datetime] | None = None
    trans_end_time: typing.Optional[datetime.datetime] | None = None
    cum_start_gross_vol_kl: typing.Optional[int] = pydantic.Field(0, **{})
    cum_end_gross_vol_kl: typing.Optional[int] = pydantic.Field(0, **{})
    cum_start_mass_mt: typing.Optional[str] = pydantic.Field("", **{})
    cum_end_mass_mt: typing.Optional[str] = pydantic.Field("", **{})
    uncorr_vol_kl: typing.Optional[int] = pydantic.Field(0, **{})
    mass_mt: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostPltDetailsSchema
        upsert_keys = ['transaction_number', 'mfm_number', 'stock', 'sap_id', 'date']
        search_fields = ['transaction_number', 'mfm_number', 'stock', 'sap_id']


class HostPltDetails(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_plt_details'
    
    transaction_number: typing.Optional[int] = pydantic.Field(0, **{})
    mfm_number: typing.Optional[str] = pydantic.Field("", **{})
    stock: typing.Optional[str] = pydantic.Field("", **{})
    trans_start_time: typing.Optional[datetime.datetime] | None = None
    trans_end_time: typing.Optional[datetime.datetime] | None = None
    cum_start_gross_vol_kl: typing.Optional[int] = pydantic.Field(0, **{})
    cum_end_gross_vol_kl: typing.Optional[int] = pydantic.Field(0, **{})
    cum_start_mass_mt: typing.Optional[str] = pydantic.Field("", **{})
    cum_end_mass_mt: typing.Optional[str] = pydantic.Field("", **{})
    uncorr_vol_kl: typing.Optional[int] = pydantic.Field(0, **{})
    mass_mt: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostPltDetailsSchema
        upsert_keys = ['transaction_number', 'mfm_number', 'stock', 'sap_id', 'date']
        search_fields = ['transaction_number', 'mfm_number', 'stock', 'sap_id']


class HostPltDetailsGetResp(pydantic.BaseModel):
    data: typing.List[HostPltDetails]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostDayEndDetailsSchema(UrdhvaPostgresBase):
    __tablename__ = 'host_day_end_details'
    
    bay_number: Mapped[typing.Optional[str]] = mapped_column("bay_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    stock: Mapped[typing.Optional[str]] = mapped_column("stock", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bcu_start_totalizer: Mapped[typing.Optional[int]] = mapped_column("bcu_start_totalizer", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    bcu_end_totalizer: Mapped[typing.Optional[int]] = mapped_column("bcu_end_totalizer", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    bcu_net_totalizer: Mapped[typing.Optional[int]] = mapped_column("bcu_net_totalizer", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    mfm_start_totalizer: Mapped[typing.Optional[int]] = mapped_column("mfm_start_totalizer", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    mfm_end_totalizer: Mapped[typing.Optional[int]] = mapped_column("mfm_end_totalizer", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    mfm_net_totalizer: Mapped[typing.Optional[int]] = mapped_column("mfm_net_totalizer", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    invoiced_qty: Mapped[typing.Optional[int]] = mapped_column("invoiced_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    total_tl_qty_loaded: Mapped[typing.Optional[int]] = mapped_column("total_tl_qty_loaded", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    bcu_mfm_net_totalizer_diff: Mapped[typing.Optional[int]] = mapped_column("bcu_mfm_net_totalizer_diff", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    invoiced_total_tl_qty_diff: Mapped[typing.Optional[int]] = mapped_column("invoiced_total_tl_qty_diff", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    invoiced_bcu_net_qty_diff: Mapped[typing.Optional[int]] = mapped_column("invoiced_bcu_net_qty_diff", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    topup_qty_local_mode: Mapped[typing.Optional[int]] = mapped_column("topup_qty_local_mode", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sampling_qty: Mapped[typing.Optional[int]] = mapped_column("sampling_qty", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(bay_number, bcu_number, stock, sap_id, date, name="host_day_end_details_bay_number_bcu_number_stock_sap_id_date"),)


class HostDayEndDetailsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_day_end_details'
    
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    stock: typing.Optional[str] = pydantic.Field("", **{})
    bcu_start_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    bcu_end_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    bcu_net_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    mfm_start_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    mfm_end_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    mfm_net_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    invoiced_qty: typing.Optional[int] = pydantic.Field(0, **{})
    total_tl_qty_loaded: typing.Optional[int] = pydantic.Field(0, **{})
    bcu_mfm_net_totalizer_diff: typing.Optional[int] = pydantic.Field(0, **{})
    invoiced_total_tl_qty_diff: typing.Optional[int] = pydantic.Field(0, **{})
    invoiced_bcu_net_qty_diff: typing.Optional[int] = pydantic.Field(0, **{})
    topup_qty_local_mode: typing.Optional[int] = pydantic.Field(0, **{})
    sampling_qty: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostDayEndDetailsSchema
        upsert_keys = ['bay_number', 'bcu_number', 'stock', 'sap_id', 'date']
        search_fields = ['bay_number', 'bcu_number', 'stock', 'sap_id']


class HostDayEndDetails(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_day_end_details'
    
    bay_number: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    stock: typing.Optional[str] = pydantic.Field("", **{})
    bcu_start_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    bcu_end_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    bcu_net_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    mfm_start_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    mfm_end_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    mfm_net_totalizer: typing.Optional[int] = pydantic.Field(0, **{})
    invoiced_qty: typing.Optional[int] = pydantic.Field(0, **{})
    total_tl_qty_loaded: typing.Optional[int] = pydantic.Field(0, **{})
    bcu_mfm_net_totalizer_diff: typing.Optional[int] = pydantic.Field(0, **{})
    invoiced_total_tl_qty_diff: typing.Optional[int] = pydantic.Field(0, **{})
    invoiced_bcu_net_qty_diff: typing.Optional[int] = pydantic.Field(0, **{})
    topup_qty_local_mode: typing.Optional[int] = pydantic.Field(0, **{})
    sampling_qty: typing.Optional[int] = pydantic.Field(0, **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostDayEndDetailsSchema
        upsert_keys = ['bay_number', 'bcu_number', 'stock', 'sap_id', 'date']
        search_fields = ['bay_number', 'bcu_number', 'stock', 'sap_id']


class HostDayEndDetailsGetResp(pydantic.BaseModel):
    data: typing.List[HostDayEndDetails]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HostDayEndSummarySchema(UrdhvaPostgresBase):
    __tablename__ = 'host_day_end_summary'
    
    total_loaded_tts: Mapped[typing.Optional[int]] = mapped_column("total_loaded_tts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    total_sick_tts: Mapped[typing.Optional[int]] = mapped_column("total_sick_tts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    total_cancelled_tts: Mapped[int] = mapped_column("total_cancelled_tts", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_created: Mapped[typing.Optional[bool]] = mapped_column("alert_created", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    date: Mapped[typing.Optional[datetime.date]] = mapped_column("date", DATE, index=False, nullable=True, default=None, primary_key=False, unique=False)
    date_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(total_loaded_tts, total_sick_tts, total_cancelled_tts, sap_id, date, name="host_day_end_summary_total_total_total_sapid_date"),)


class HostDayEndSummaryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'host_day_end_summary'
    
    total_loaded_tts: typing.Optional[int] = pydantic.Field(0, **{})
    total_sick_tts: typing.Optional[int] = pydantic.Field(0, **{})
    total_cancelled_tts: int
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostDayEndSummarySchema
        upsert_keys = ['total_loaded_tts', 'total_sick_tts', 'total_cancelled_tts', 'sap_id', 'date']
        search_fields = ['total_loaded_tts', 'total_cancelled_tts', 'total_sick_tts', 'sap_id']


class HostDayEndSummary(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'host_day_end_summary'
    
    total_loaded_tts: typing.Optional[int] = pydantic.Field(0, **{})
    total_sick_tts: typing.Optional[int] = pydantic.Field(0, **{})
    total_cancelled_tts: typing.Optional[int] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    alert_created: typing.Optional[bool] = pydantic.Field(False, )
    date: typing.Optional[datetime.date] | None = None
    date_time: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HostDayEndSummarySchema
        upsert_keys = ['total_loaded_tts', 'total_sick_tts', 'total_cancelled_tts', 'sap_id', 'date']
        search_fields = ['total_loaded_tts', 'total_cancelled_tts', 'total_sick_tts', 'sap_id']


class HostDayEndSummaryGetResp(pydantic.BaseModel):
    data: typing.List[HostDayEndSummary]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class TagsDataSchema(UrdhvaPostgresBase):
    __tablename__ = 'tags_data'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_type: Mapped[typing.Optional[str]] = mapped_column("device_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    count: Mapped[typing.Optional[str]] = mapped_column("count", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_count: Mapped[typing.Optional[str]] = mapped_column("device_count", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    system: Mapped[typing.Optional[str]] = mapped_column("system", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    equipment_name: Mapped[typing.Optional[str]] = mapped_column("equipment_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    mf_count: Mapped[typing.Optional[str]] = mapped_column("mf_count", String, index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(sap_id, name, device_type, zone, system, name="tags_data_sap_id_name_device_type_zone_system"),)


class TagsDataCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tags_data'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    count: typing.Optional[str] = pydantic.Field("", **{})
    device_count: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    system: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: typing.Optional[str] = pydantic.Field("", **{})
    mf_count: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TagsDataSchema
        upsert_keys = ['sap_id', 'name', 'device_type', 'zone', 'system']
        search_fields = ['sap_id', 'name', 'device_type', 'zone', 'system']


class TagsData(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tags_data'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    count: typing.Optional[str] = pydantic.Field("", **{})
    device_count: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    system: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: typing.Optional[str] = pydantic.Field("", **{})
    mf_count: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TagsDataSchema
        upsert_keys = ['sap_id', 'name', 'device_type', 'zone', 'system']
        search_fields = ['sap_id', 'name', 'device_type', 'zone', 'system']


class TagsDataGetResp(pydantic.BaseModel):
    data: typing.List[TagsData]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Tagsdata_Things_Board_Device_DataParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tagsdata_Get_Tags_DataParams(pydantic.BaseModel):
    plant: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class TasProofTestSchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_proof_test'
    
    device_name: Mapped[typing.Optional[str]] = mapped_column("device_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_id: Mapped[typing.Optional[str]] = mapped_column("device_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    interlock_name: Mapped[typing.Optional[str]] = mapped_column("interlock_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    proof_test_created_at: Mapped[typing.Optional[datetime.datetime]] = mapped_column("proof_test_created_at", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    next_proof_test_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("next_proof_test_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(sap_id, device_id, name="tas_proof_test_sap_id_device_id"),)


class TasProofTestCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_proof_test'
    
    device_name: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    interlock_name: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    proof_test_created_at: typing.Optional[datetime.datetime] | None = None
    next_proof_test_date: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasProofTestSchema
        upsert_keys = ['sap_id', 'device_id']


class TasProofTest(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_proof_test'
    
    device_name: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    interlock_name: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    proof_test_created_at: typing.Optional[datetime.datetime] | None = None
    next_proof_test_date: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasProofTestSchema
        upsert_keys = ['sap_id', 'device_id']


class TasProofTestGetResp(pydantic.BaseModel):
    data: typing.List[TasProofTest]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Tasprooftest_Prooftest_DataParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class ArchitectureDataSchema(UrdhvaPostgresBase):
    __tablename__ = 'architecture_data'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_type: Mapped[typing.Optional[str]] = mapped_column("device_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    count: Mapped[typing.Optional[str]] = mapped_column("count", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    system: Mapped[typing.Optional[str]] = mapped_column("system", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    equipment_name: Mapped[typing.Optional[str]] = mapped_column("equipment_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    total_tank_count: Mapped[typing.Optional[int]] = mapped_column("total_tank_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(sap_id, name, device_type, total_tank_count, name="architecture_data_sap_id_name_device_type_total_tank_count"),)


class ArchitectureDataCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'architecture_data'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    count: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    system: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: typing.Optional[str] = pydantic.Field("", **{})
    total_tank_count: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ArchitectureDataSchema
        upsert_keys = ['sap_id', 'name', 'device_type', 'total_tank_count']


class ArchitectureData(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'architecture_data'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    count: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    system: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: typing.Optional[str] = pydantic.Field("", **{})
    total_tank_count: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ArchitectureDataSchema
        upsert_keys = ['sap_id', 'name', 'device_type', 'total_tank_count']


class ArchitectureDataGetResp(pydantic.BaseModel):
    data: typing.List[ArchitectureData]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Architecturedata_Architecture_DetailsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Architecturedata_Architecture_DataParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class PerformanceIndexSchema(UrdhvaPostgresBase):
    __tablename__ = 'performance_index'
    
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    category: Mapped[str] = mapped_column("category", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[str] = mapped_column("region", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[str] = mapped_column("name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    score: Mapped[float] = mapped_column("score", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    is_plant: Mapped[typing.Optional[bool]] = mapped_column("is_plant", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)


class PerformanceIndexCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'performance_index'
    
    bu: str
    sap_id: str
    category: str
    zone: str
    region: str
    name: str
    score: float
    is_plant: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PerformanceIndexSchema
        upsert_keys = []


class PerformanceIndex(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'performance_index'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    category: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    region: typing.Optional[str] | None = None
    name: typing.Optional[str] | None = None
    score: typing.Optional[float] | None = None
    is_plant: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PerformanceIndexSchema
        upsert_keys = []


class PerformanceIndexGetResp(pydantic.BaseModel):
    data: typing.List[PerformanceIndex]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Performanceindex_Get_Pi_ScoreParams(pydantic.BaseModel):
    bu: str
    category: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    strategy: str
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    is_plant: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Performanceindex_Get_Pi_Score_By_CategoryParams(pydantic.BaseModel):
    bu: str
    region: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class PerformanceScoreResultsCreate(pydantic.BaseModel):
    name: str
    score: float
    weightage: float
    module: str


class PerformanceScoreCategoryCreate(pydantic.BaseModel):
    name: str
    score: float
    weightage: float
    results: typing.Optional[typing.List[PerformanceScoreResultsCreate]] | None = None


class PerformanceScoreInsightsCreate(pydantic.BaseModel):
    overall_score: float
    overall_gap: float
    improvement_potential: float
    top_priority_modules: typing.List[dict]
    critical_issues: typing.List[dict]
    recommended_actions: typing.List[dict]
    quick_wins: typing.List[dict]
    focus_areas: typing.List[dict]


class PerformanceScoreSchema(UrdhvaPostgresBase):
    __tablename__ = 'performance_score'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    timestamp: Mapped[datetime.datetime] = mapped_column("timestamp", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[str] = mapped_column("region", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[str] = mapped_column("name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    score: Mapped[float] = mapped_column("score", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    national_score: Mapped[float] = mapped_column("national_score", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    rank: Mapped[int] = mapped_column("rank", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    category: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("category", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    insights: Mapped[typing.Optional[typing.Any]] = mapped_column("insights", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(sap_id, name="performance_score_sap_id"),)


class PerformanceScoreCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'performance_score'
    
    bu: str
    sap_id: str
    timestamp: datetime.datetime
    zone: str
    region: str
    name: str
    score: float
    national_score: float
    rank: int
    category: typing.Optional[typing.List[PerformanceScoreCategoryCreate]] | None = None
    insights: typing.Optional[PerformanceScoreInsightsCreate] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PerformanceScoreSchema
        upsert_keys = ['sap_id']


class PerformanceScore(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'performance_score'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    timestamp: typing.Optional[datetime.datetime] | None = None
    zone: typing.Optional[str] | None = None
    region: typing.Optional[str] | None = None
    name: typing.Optional[str] | None = None
    score: typing.Optional[float] | None = None
    national_score: typing.Optional[float] | None = None
    rank: typing.Optional[int] | None = None
    category: typing.Optional[typing.List[PerformanceScoreCategoryCreate]] | None = None
    insights: typing.Optional[PerformanceScoreInsightsCreate] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PerformanceScoreSchema
        upsert_keys = ['sap_id']


class PerformanceScoreGetResp(pydantic.BaseModel):
    data: typing.List[PerformanceScore]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Performancescore_Get_Pi_ScoreParams(pydantic.BaseModel):
    bu: str
    category: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    strategy: str
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Performancescore_Download_Performance_ScoreParams(pydantic.BaseModel):
    bu: str
    category: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    strategy: str
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    is_plant: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Performancescore_Performance_Score_BreakdownParams(pydantic.BaseModel):
    bu: str
    score_type: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    end_date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Performancescore_Performance_Score_TrendParams(pydantic.BaseModel):
    bu: str
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Performancescore_Performance_Score_Monthly_TrendParams(pydantic.BaseModel):
    bu: str
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class PerformanceScoreHistorySchema(UrdhvaPostgresBase):
    __tablename__ = 'performance_score_history'
    
    bu: Mapped[str] = mapped_column("bu", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    timestamp: Mapped[datetime.datetime] = mapped_column("timestamp", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    region: Mapped[str] = mapped_column("region", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[str] = mapped_column("name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    score: Mapped[float] = mapped_column("score", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    national_score: Mapped[float] = mapped_column("national_score", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    rank: Mapped[int] = mapped_column("rank", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    category: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("category", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    insights: Mapped[typing.Optional[typing.Any]] = mapped_column("insights", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(sap_id, timestamp, name="performance_score_history_sap_id_timestamp"),)


class PerformanceScoreHistoryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'performance_score_history'
    
    bu: str
    sap_id: str
    timestamp: datetime.datetime
    zone: str
    region: str
    name: str
    score: float
    national_score: float
    rank: int
    category: typing.Optional[typing.List[PerformanceScoreCategoryCreate]] | None = None
    insights: typing.Optional[PerformanceScoreInsightsCreate] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PerformanceScoreHistorySchema
        upsert_keys = ['sap_id', 'timestamp']


class PerformanceScoreHistory(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'performance_score_history'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    timestamp: typing.Optional[datetime.datetime] | None = None
    zone: typing.Optional[str] | None = None
    region: typing.Optional[str] | None = None
    name: typing.Optional[str] | None = None
    score: typing.Optional[float] | None = None
    national_score: typing.Optional[float] | None = None
    rank: typing.Optional[int] | None = None
    category: typing.Optional[typing.List[PerformanceScoreCategoryCreate]] | None = None
    insights: typing.Optional[PerformanceScoreInsightsCreate] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PerformanceScoreHistorySchema
        upsert_keys = ['sap_id', 'timestamp']


class PerformanceScoreHistoryGetResp(pydantic.BaseModel):
    data: typing.List[PerformanceScoreHistory]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class CrisAlertHistorySchema(UrdhvaPostgresBase):
    __tablename__ = 'cris_alert_history'
    
    vendor_name: Mapped[typing.Optional[str]] = mapped_column("vendor_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vendor_id: Mapped[typing.Optional[str]] = mapped_column("vendor_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_id: Mapped[typing.Optional[str]] = mapped_column("location_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_type: Mapped[typing.Optional[str]] = mapped_column("location_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ro_code: Mapped[typing.Optional[str]] = mapped_column("ro_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    interlock_type: Mapped[typing.Optional[str]] = mapped_column("interlock_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    interlock_description: Mapped[typing.Optional[str]] = mapped_column("interlock_description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_name: Mapped[typing.Optional[str]] = mapped_column("device_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_id: Mapped[typing.Optional[str]] = mapped_column("device_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    severity: Mapped[typing.Optional[str]] = mapped_column("severity", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_id: Mapped[typing.Optional[str]] = mapped_column("tank_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    nozzle_id: Mapped[typing.Optional[str]] = mapped_column("nozzle_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    pump_no: Mapped[typing.Optional[str]] = mapped_column("pump_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alarm_id: Mapped[str] = mapped_column("alarm_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    occurrence_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("occurrence_date", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    closure_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("closure_date", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    indent_no: Mapped[typing.Optional[str]] = mapped_column("indent_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    products: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("products", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(alarm_id, name="cris_alert_history_alarm_id"),)


class CrisAlertHistoryCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'cris_alert_history'
    
    vendor_name: typing.Optional[str] = pydantic.Field("", **{})
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    ro_code: typing.Optional[str] = pydantic.Field("", **{})
    interlock_type: typing.Optional[str] = pydantic.Field("", **{})
    interlock_description: typing.Optional[str] = pydantic.Field("", **{})
    device_name: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    severity: typing.Optional[str] = pydantic.Field("", **{})
    tank_id: typing.Optional[str] = pydantic.Field("", **{})
    nozzle_id: typing.Optional[str] = pydantic.Field("", **{})
    pump_no: typing.Optional[str] = pydantic.Field("", **{})
    alarm_id: str
    occurrence_date: typing.Optional[datetime.datetime] | None = None
    closure_date: typing.Optional[datetime.datetime] | None = None
    indent_no: typing.Optional[str] = pydantic.Field("", **{})
    products: typing.Optional[typing.List[productsDetailsCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CrisAlertHistorySchema
        upsert_keys = ['alarm_id']
        access_key_mapping = ['location_id:sap_id']


class CrisAlertHistory(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'cris_alert_history'
    
    vendor_name: typing.Optional[str] = pydantic.Field("", **{})
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    ro_code: typing.Optional[str] = pydantic.Field("", **{})
    interlock_type: typing.Optional[str] = pydantic.Field("", **{})
    interlock_description: typing.Optional[str] = pydantic.Field("", **{})
    device_name: typing.Optional[str] = pydantic.Field("", **{})
    device_id: typing.Optional[str] = pydantic.Field("", **{})
    severity: typing.Optional[str] = pydantic.Field("", **{})
    tank_id: typing.Optional[str] = pydantic.Field("", **{})
    nozzle_id: typing.Optional[str] = pydantic.Field("", **{})
    pump_no: typing.Optional[str] = pydantic.Field("", **{})
    alarm_id: typing.Optional[str] | None = None
    occurrence_date: typing.Optional[datetime.datetime] | None = None
    closure_date: typing.Optional[datetime.datetime] | None = None
    indent_no: typing.Optional[str] = pydantic.Field("", **{})
    products: typing.Optional[typing.List[productsDetailsCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CrisAlertHistorySchema
        upsert_keys = ['alarm_id']
        access_key_mapping = ['location_id:sap_id']


class CrisAlertHistoryGetResp(pydantic.BaseModel):
    data: typing.List[CrisAlertHistory]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class DryOutAlertReportSchema(UrdhvaPostgresBase):
    __tablename__ = 'dry_out_alert_report'
    
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[str]] = mapped_column("sales_area", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    terminal_plant_id: Mapped[typing.Optional[str]] = mapped_column("terminal_plant_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tank_no: Mapped[typing.Optional[str]] = mapped_column("tank_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    capacity: Mapped[typing.Optional[int]] = mapped_column("capacity", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    tank_capacity: Mapped[typing.Optional[str]] = mapped_column("tank_capacity", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    product_code: Mapped[str] = mapped_column("product_code", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    dry_out_in_days: Mapped[typing.Optional[str]] = mapped_column("dry_out_in_days", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    avgsales_7days: Mapped[typing.Optional[float]] = mapped_column("avgsales_7days", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    avgsales_daily: Mapped[typing.Optional[float]] = mapped_column("avgsales_daily", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    dryout_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("dryout_start_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    dryout_end_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("dryout_end_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    dryout_date: Mapped[datetime.datetime] = mapped_column("dryout_date", DateTime(timezone=True), index=True, nullable=False, default=None, primary_key=False, unique=False)
    alert_status: Mapped[typing.Optional[str]] = mapped_column("alert_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(sap_id, product_code, dryout_date, name="dry_out_alert_report_sap_id_product_code_dryout_date"),)


class DryOutAlertReportCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'dry_out_alert_report'
    
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: str
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    capacity: typing.Optional[int] = pydantic.Field(0, **{})
    tank_capacity: typing.Optional[str] = pydantic.Field("", **{})
    product_code: str
    dry_out_in_days: typing.Optional[str] = pydantic.Field("", **{})
    avgsales_7days: typing.Optional[float] = pydantic.Field(0.0, **{})
    avgsales_daily: typing.Optional[float] = pydantic.Field(0.0, **{})
    dryout_start_datetime: typing.Optional[datetime.datetime] | None = None
    dryout_end_datetime: typing.Optional[datetime.datetime] | None = None
    dryout_date: datetime.datetime
    alert_status: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DryOutAlertReportSchema
        upsert_keys = ['sap_id', 'product_code', 'dryout_date']


class DryOutAlertReport(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'dry_out_alert_report'
    
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    terminal_plant_id: typing.Optional[str] = pydantic.Field("", **{})
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    capacity: typing.Optional[int] = pydantic.Field(0, **{})
    tank_capacity: typing.Optional[str] = pydantic.Field("", **{})
    product_code: typing.Optional[str] | None = None
    dry_out_in_days: typing.Optional[str] = pydantic.Field("", **{})
    avgsales_7days: typing.Optional[float] = pydantic.Field(0.0, **{})
    avgsales_daily: typing.Optional[float] = pydantic.Field(0.0, **{})
    dryout_start_datetime: typing.Optional[datetime.datetime] | None = None
    dryout_end_datetime: typing.Optional[datetime.datetime] | None = None
    dryout_date: typing.Optional[datetime.datetime] | None = None
    alert_status: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DryOutAlertReportSchema
        upsert_keys = ['sap_id', 'product_code', 'dryout_date']


class DryOutAlertReportGetResp(pydantic.BaseModel):
    data: typing.List[DryOutAlertReport]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class VendorApiAuditSchema(UrdhvaPostgresBase):
    __tablename__ = 'vendor_api_audit'
    
    method: Mapped[str] = mapped_column("method", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    vendor: Mapped[str] = mapped_column("vendor", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    url: Mapped[str] = mapped_column("url", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    payload: Mapped[typing.Optional[dict]] = mapped_column("payload", JSONB, index=False, nullable=True, default=pydantic.Field(default_factory=dict), primary_key=False, unique=False)
    alert_id: Mapped[str] = mapped_column("alert_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    request_no: Mapped[typing.Optional[str]] = mapped_column("request_no", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    response: Mapped[str] = mapped_column("response", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    response_msg: Mapped[typing.Optional[str]] = mapped_column("response_msg", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    request_datetime: Mapped[datetime.datetime] = mapped_column("request_datetime", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    api_ack: Mapped[typing.Optional[str]] = mapped_column("api_ack", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    api_ack_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("api_ack_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(alert_id, name="vendor_api_audit_alert_id"),)


class VendorApiAuditCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'vendor_api_audit'
    
    method: str
    vendor: str
    url: str
    payload: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )
    alert_id: str
    request_no: typing.Optional[str] = pydantic.Field("", **{})
    response: str
    response_msg: typing.Optional[str] = pydantic.Field("", **{})
    request_datetime: datetime.datetime
    api_ack: typing.Optional[str] = pydantic.Field("", **{})
    api_ack_datetime: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VendorApiAuditSchema
        upsert_keys = ['alert_id']


class VendorApiAudit(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'vendor_api_audit'
    
    method: typing.Optional[str] | None = None
    vendor: typing.Optional[str] | None = None
    url: typing.Optional[str] | None = None
    payload: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )
    alert_id: typing.Optional[str] | None = None
    request_no: typing.Optional[str] = pydantic.Field("", **{})
    response: typing.Optional[str] | None = None
    response_msg: typing.Optional[str] = pydantic.Field("", **{})
    request_datetime: typing.Optional[datetime.datetime] | None = None
    api_ack: typing.Optional[str] = pydantic.Field("", **{})
    api_ack_datetime: typing.Optional[datetime.datetime] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VendorApiAuditSchema
        upsert_keys = ['alert_id']


class VendorApiAuditGetResp(pydantic.BaseModel):
    data: typing.List[VendorApiAudit]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class VtsTruckHistoryCreate(pydantic.BaseModel):
    violated_date: typing.Optional[str] = pydantic.Field("", **{})
    transporter_code: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    stoppage_violations_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count: typing.Optional[int] = pydantic.Field(0, **{})
    route_deviation_count_orig: typing.Optional[int] = pydantic.Field(0, **{})
    speed_violation_count: typing.Optional[int] = pydantic.Field(0, **{})
    main_supply_removal_count: typing.Optional[int] = pydantic.Field(0, **{})
    night_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    no_halt_zone_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_offline_count: typing.Optional[int] = pydantic.Field(0, **{})
    device_tamper_count: typing.Optional[int] = pydantic.Field(0, **{})
    continuous_driving_count: typing.Optional[int] = pydantic.Field(0, **{})
    last_violated_date: typing.Optional[str] = pydantic.Field("", **{})


class VtsTruckDetailsSchema(UrdhvaPostgresBase):
    __tablename__ = 'vts_truck_details'
    
    truck_regno: Mapped[str] = mapped_column("truck_regno", String, index=True, nullable=False, default=None, primary_key=True, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    truck_status: Mapped[typing.Optional[str]] = mapped_column("truck_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    violation_type: Mapped[typing.Optional[str]] = mapped_column("violation_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    block_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("block_start_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    block_end_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("block_end_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    instance_1: Mapped[typing.Optional[int]] = mapped_column("instance_1", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    instance_2: Mapped[typing.Optional[int]] = mapped_column("instance_2", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    instance_3: Mapped[typing.Optional[int]] = mapped_column("instance_3", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    instance_4: Mapped[typing.Optional[int]] = mapped_column("instance_4", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    instance_5: Mapped[typing.Optional[int]] = mapped_column("instance_5", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    instance_6: Mapped[typing.Optional[int]] = mapped_column("instance_6", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    alert_id: Mapped[typing.Optional[str]] = mapped_column("alert_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    blacklist: Mapped[typing.Optional[bool]] = mapped_column("blacklist", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    truck_history: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("truck_history", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(truck_regno, name="vts_truck_details_truck_regno"),)


class VtsTruckDetailsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'vts_truck_details'
    
    truck_regno: str
    sap_id: str
    bu: typing.Optional[str] = pydantic.Field("", **{})
    truck_status: typing.Optional[str] = pydantic.Field("", **{})
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    block_start_datetime: typing.Optional[datetime.datetime] | None = None
    block_end_datetime: typing.Optional[datetime.datetime] | None = None
    instance_1: typing.Optional[int] = pydantic.Field(0, **{})
    instance_2: typing.Optional[int] = pydantic.Field(0, **{})
    instance_3: typing.Optional[int] = pydantic.Field(0, **{})
    instance_4: typing.Optional[int] = pydantic.Field(0, **{})
    instance_5: typing.Optional[int] = pydantic.Field(0, **{})
    instance_6: typing.Optional[int] = pydantic.Field(0, **{})
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    blacklist: typing.Optional[bool] = pydantic.Field(False, )
    truck_history: typing.Optional[typing.List[VtsTruckHistoryCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VtsTruckDetailsSchema
        upsert_keys = ['truck_regno']


class VtsTruckDetails(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'vts_truck_details'
    
    truck_regno: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    bu: typing.Optional[str] = pydantic.Field("", **{})
    truck_status: typing.Optional[str] = pydantic.Field("", **{})
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    block_start_datetime: typing.Optional[datetime.datetime] | None = None
    block_end_datetime: typing.Optional[datetime.datetime] | None = None
    instance_1: typing.Optional[int] = pydantic.Field(0, **{})
    instance_2: typing.Optional[int] = pydantic.Field(0, **{})
    instance_3: typing.Optional[int] = pydantic.Field(0, **{})
    instance_4: typing.Optional[int] = pydantic.Field(0, **{})
    instance_5: typing.Optional[int] = pydantic.Field(0, **{})
    instance_6: typing.Optional[int] = pydantic.Field(0, **{})
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    blacklist: typing.Optional[bool] = pydantic.Field(False, )
    truck_history: typing.Optional[typing.List[VtsTruckHistoryCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VtsTruckDetailsSchema
        upsert_keys = ['truck_regno']


class VtsTruckDetailsGetResp(pydantic.BaseModel):
    data: typing.List[VtsTruckDetails]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class DryOutRoLossSchema(UrdhvaPostgresBase):
    __tablename__ = 'dry_out_ro_loss'
    
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    tank_no: Mapped[typing.Optional[str]] = mapped_column("tank_no", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    product_name: Mapped[typing.Optional[str]] = mapped_column("product_name", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    loss_month: Mapped[typing.Optional[str]] = mapped_column("loss_month", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    estimated_loss: Mapped[typing.Optional[float]] = mapped_column("estimated_loss", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    estimated_loss_amount: Mapped[typing.Optional[float]] = mapped_column("estimated_loss_amount", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    dryout_days: Mapped[typing.Optional[str]] = mapped_column("dryout_days", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    avg_daily_sales: Mapped[typing.Optional[float]] = mapped_column("avg_daily_sales", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    avg_daily_sales_amount: Mapped[typing.Optional[float]] = mapped_column("avg_daily_sales_amount", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[str]] = mapped_column("sales_area", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(zone, tank_no, sap_id, product_name, loss_month, name="dry_out_ro_loss_zone_tank_no_sap_id_product_name_loss_month"),)


class DryOutRoLossCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'dry_out_ro_loss'
    
    zone: typing.Optional[str] = pydantic.Field("", **{})
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    loss_month: typing.Optional[str] = pydantic.Field("", **{})
    estimated_loss: typing.Optional[float] = pydantic.Field(0.0, **{})
    estimated_loss_amount: typing.Optional[float] = pydantic.Field(0.0, **{})
    dryout_days: typing.Optional[str] = pydantic.Field("", **{})
    avg_daily_sales: typing.Optional[float] = pydantic.Field(0.0, **{})
    avg_daily_sales_amount: typing.Optional[float] = pydantic.Field(0.0, **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DryOutRoLossSchema
        upsert_keys = ['zone', 'tank_no', 'sap_id', 'product_name', 'loss_month']


class DryOutRoLoss(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'dry_out_ro_loss'
    
    zone: typing.Optional[str] = pydantic.Field("", **{})
    tank_no: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    product_name: typing.Optional[str] = pydantic.Field("", **{})
    loss_month: typing.Optional[str] = pydantic.Field("", **{})
    estimated_loss: typing.Optional[float] = pydantic.Field(0.0, **{})
    estimated_loss_amount: typing.Optional[float] = pydantic.Field(0.0, **{})
    dryout_days: typing.Optional[str] = pydantic.Field("", **{})
    avg_daily_sales: typing.Optional[float] = pydantic.Field(0.0, **{})
    avg_daily_sales_amount: typing.Optional[float] = pydantic.Field(0.0, **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DryOutRoLossSchema
        upsert_keys = ['zone', 'tank_no', 'sap_id', 'product_name', 'loss_month']


class DryOutRoLossGetResp(pydantic.BaseModel):
    data: typing.List[DryOutRoLoss]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class RoMasterDataSchema(UrdhvaPostgresBase):
    __tablename__ = 'ro_master_data'
    
    interlock: Mapped[str] = mapped_column("interlock", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    threshold: Mapped[str] = mapped_column("threshold", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    threshold_value: Mapped[int] = mapped_column("threshold_value", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    monthly_quota: Mapped[str] = mapped_column("monthly_quota", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sales_officer_quota: Mapped[int] = mapped_column("sales_officer_quota", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sales_officer_instance: Mapped[int] = mapped_column("sales_officer_instance", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    regional_manager_quota: Mapped[int] = mapped_column("regional_manager_quota", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    regional_manager_instance: Mapped[int] = mapped_column("regional_manager_instance", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zonal_head_quota: Mapped[int] = mapped_column("zonal_head_quota", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zonal_head_instance: Mapped[int] = mapped_column("zonal_head_instance", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)


class RoMasterDataCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'ro_master_data'
    
    interlock: str
    threshold: str
    threshold_value: int
    monthly_quota: str
    sales_officer_quota: int
    sales_officer_instance: int
    regional_manager_quota: int
    regional_manager_instance: int
    zonal_head_quota: int
    zonal_head_instance: int

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = RoMasterDataSchema
        upsert_keys = []


class RoMasterData(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'ro_master_data'
    
    interlock: typing.Optional[str] | None = None
    threshold: typing.Optional[str] | None = None
    threshold_value: typing.Optional[int] | None = None
    monthly_quota: typing.Optional[str] | None = None
    sales_officer_quota: typing.Optional[int] | None = None
    sales_officer_instance: typing.Optional[int] | None = None
    regional_manager_quota: typing.Optional[int] | None = None
    regional_manager_instance: typing.Optional[int] | None = None
    zonal_head_quota: typing.Optional[int] | None = None
    zonal_head_instance: typing.Optional[int] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = RoMasterDataSchema
        upsert_keys = []


class RoMasterDataGetResp(pydantic.BaseModel):
    data: typing.List[RoMasterData]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Romasterdata_Update_Ro_Master_DataParams(pydantic.BaseModel):
    record_id: str
    interlock: str
    threshold: str
    threshold_value: int
    monthly_quota: str
    sales_officer_quota: int
    sales_officer_instance: int
    regional_manager_quota: int
    regional_manager_instance: int
    zonal_head_quota: int
    zonal_head_instance: int

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class TASMonthlyOIScoresSchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_monthly_oi_scores'
    
    location_id: Mapped[typing.Optional[str]] = mapped_column("location_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    module_name: Mapped[typing.Optional[str]] = mapped_column("module_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    rule_name: Mapped[typing.Optional[str]] = mapped_column("rule_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    year: Mapped[typing.Optional[int]] = mapped_column("year", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    month: Mapped[typing.Optional[int]] = mapped_column("month", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    score: Mapped[typing.Optional[float]] = mapped_column("score", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    weightage: Mapped[typing.Optional[float]] = mapped_column("weightage", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(location_id, module_name, rule_name, year, month, name="tas_monthly_oi_scores_locat_modul_rulen_year_month"),)


class TASMonthlyOIScoresCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_monthly_oi_scores'
    
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    module_name: typing.Optional[str] = pydantic.Field("", **{})
    rule_name: typing.Optional[str] = pydantic.Field("", **{})
    year: typing.Optional[int] = pydantic.Field(0, **{})
    month: typing.Optional[int] = pydantic.Field(0, **{})
    score: typing.Optional[float] = pydantic.Field(0.0, **{})
    weightage: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TASMonthlyOIScoresSchema
        upsert_keys = ['location_id', 'module_name', 'rule_name', 'year', 'month']


class TASMonthlyOIScores(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_monthly_oi_scores'
    
    location_id: typing.Optional[str] = pydantic.Field("", **{})
    module_name: typing.Optional[str] = pydantic.Field("", **{})
    rule_name: typing.Optional[str] = pydantic.Field("", **{})
    year: typing.Optional[int] = pydantic.Field(0, **{})
    month: typing.Optional[int] = pydantic.Field(0, **{})
    score: typing.Optional[float] = pydantic.Field(0.0, **{})
    weightage: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TASMonthlyOIScoresSchema
        upsert_keys = ['location_id', 'module_name', 'rule_name', 'year', 'month']


class TASMonthlyOIScoresGetResp(pydantic.BaseModel):
    data: typing.List[TASMonthlyOIScores]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class SodInfraDataCreate(pydantic.BaseModel):
    unique_id: str
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    region_ppac: typing.Optional[str] = pydantic.Field("", **{})
    ms: typing.Optional[int] = pydantic.Field(0, **{})
    sko: typing.Optional[int] = pydantic.Field(0, **{})
    hsd: typing.Optional[int] = pydantic.Field(0, **{})
    total: typing.Optional[int] = pydantic.Field(0, **{})
    mode_of_receipt: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})


class SodInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'sod_infra'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    type: Mapped[typing.Optional[str]] = mapped_column("type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region_ppac: Mapped[typing.Optional[str]] = mapped_column("region_ppac", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ms: Mapped[typing.Optional[int]] = mapped_column("ms", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sko: Mapped[typing.Optional[int]] = mapped_column("sko", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    hsd: Mapped[typing.Optional[int]] = mapped_column("hsd", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    total: Mapped[typing.Optional[int]] = mapped_column("total", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    mode_of_receipt: Mapped[typing.Optional[str]] = mapped_column("mode_of_receipt", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[float]] = mapped_column("latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[float]] = mapped_column("longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    filename: Mapped[typing.Optional[str]] = mapped_column("filename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class SodInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'sod_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    region_ppac: typing.Optional[str] = pydantic.Field("", **{})
    ms: typing.Optional[int] = pydantic.Field(0, **{})
    sko: typing.Optional[int] = pydantic.Field(0, **{})
    hsd: typing.Optional[int] = pydantic.Field(0, **{})
    total: typing.Optional[int] = pydantic.Field(0, **{})
    mode_of_receipt: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SodInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class SodInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'sod_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    region_ppac: typing.Optional[str] = pydantic.Field("", **{})
    ms: typing.Optional[int] = pydantic.Field(0, **{})
    sko: typing.Optional[int] = pydantic.Field(0, **{})
    hsd: typing.Optional[int] = pydantic.Field(0, **{})
    total: typing.Optional[int] = pydantic.Field(0, **{})
    mode_of_receipt: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SodInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class SodInfraGetResp(pydantic.BaseModel):
    data: typing.List[SodInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Sodinfra_Upload_Sod_FileParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_All_Sod_Lpg_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_Count_Company_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_Sod_Lpg_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_Distinct_Sod_Lpg_InfraParams(pydantic.BaseModel):
    sbu: str
    company: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    district: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    location_name: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_All_Sod_InfraParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Download_TemplateParams(pydantic.BaseModel):
    sbu: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_Sales_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_Sales_Officer_InfraParams(pydantic.BaseModel):
    sbu: str
    sap_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_Download_DataParams(pydantic.BaseModel):
    sbu: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Update_Sod_DataParams(pydantic.BaseModel):
    sod_data: SodInfraDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Add_Sod_DataParams(pydantic.BaseModel):
    sod_data: SodInfraDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Delete_Sod_DataParams(pydantic.BaseModel):
    unique_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Sodinfra_Get_Updated_By_InfraParams(pydantic.BaseModel):
    sbu: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LpgInfraDataCreate(pydantic.BaseModel):
    unique_id: str
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    installed_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    operating_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    ccoe_tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    time_of_commissioning: typing.Optional[str] = pydantic.Field("", **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    supply: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})


class LPGInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_infra'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    installed_bottling_capacity: Mapped[typing.Optional[float]] = mapped_column("installed_bottling_capacity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    operating_bottling_capacity: Mapped[typing.Optional[float]] = mapped_column("operating_bottling_capacity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    ccoe_tankage: Mapped[typing.Optional[float]] = mapped_column("ccoe_tankage", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    time_of_commissioning: Mapped[typing.Optional[str]] = mapped_column("time_of_commissioning", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    mode: Mapped[typing.Optional[str]] = mapped_column("mode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    supply: Mapped[typing.Optional[str]] = mapped_column("supply", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[float]] = mapped_column("latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[float]] = mapped_column("longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    filename: Mapped[typing.Optional[str]] = mapped_column("filename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class LPGInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    installed_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    operating_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    ccoe_tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    time_of_commissioning: typing.Optional[str] = pydantic.Field("", **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    supply: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LPGInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class LPGInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    installed_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    operating_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    ccoe_tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    time_of_commissioning: typing.Optional[str] = pydantic.Field("", **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    supply: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LPGInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class LPGInfraGetResp(pydantic.BaseModel):
    data: typing.List[LPGInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpginfra_Upload_Lpg_FileParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpginfra_Get_All_Lpg_InfraParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpginfra_Update_Lpg_DataParams(pydantic.BaseModel):
    lpg_data: LpgInfraDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpginfra_Add_Lpg_DataParams(pydantic.BaseModel):
    lpg_data: LpgInfraDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpginfra_Delete_Lpg_DataParams(pydantic.BaseModel):
    unique_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class AviationInfraDataCreate(pydantic.BaseModel):
    unique_id: str
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    operation_status: typing.Optional[str] = pydantic.Field("", **{})
    tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    pincode: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})


class AVIATIONInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'aviation_infra'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    operation_status: Mapped[typing.Optional[str]] = mapped_column("operation_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tankage: Mapped[typing.Optional[float]] = mapped_column("tankage", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    mode: Mapped[typing.Optional[str]] = mapped_column("mode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    pincode: Mapped[typing.Optional[str]] = mapped_column("pincode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[float]] = mapped_column("latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[float]] = mapped_column("longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    filename: Mapped[typing.Optional[str]] = mapped_column("filename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class AVIATIONInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'aviation_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    operation_status: typing.Optional[str] = pydantic.Field("", **{})
    tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    pincode: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = AVIATIONInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class AVIATIONInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'aviation_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    operation_status: typing.Optional[str] = pydantic.Field("", **{})
    tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    pincode: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = AVIATIONInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class AVIATIONInfraGetResp(pydantic.BaseModel):
    data: typing.List[AVIATIONInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Aviationinfra_Upload_Aviation_FileParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Aviationinfra_Get_All_Aviation_InfraParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Aviationinfra_Update_Aviation_DataParams(pydantic.BaseModel):
    aviation_data: AviationInfraDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Aviationinfra_Add_Aviation_DataParams(pydantic.BaseModel):
    aviation_data: AviationInfraDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Aviationinfra_Delete_Aviation_DataParams(pydantic.BaseModel):
    unique_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LubesInfraDataCreate(pydantic.BaseModel):
    unique_id: str
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    base_oil_tankages: typing.Optional[float] = pydantic.Field(0.0, **{})
    landline: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})


class LUBESInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'lubes_infra'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    base_oil_tankages: Mapped[typing.Optional[float]] = mapped_column("base_oil_tankages", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    landline: Mapped[typing.Optional[str]] = mapped_column("landline", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[float]] = mapped_column("latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[float]] = mapped_column("longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    filename: Mapped[typing.Optional[str]] = mapped_column("filename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class LUBESInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lubes_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    base_oil_tankages: typing.Optional[float] = pydantic.Field(0.0, **{})
    landline: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LUBESInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class LUBESInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lubes_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    base_oil_tankages: typing.Optional[float] = pydantic.Field(0.0, **{})
    landline: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LUBESInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class LUBESInfraGetResp(pydantic.BaseModel):
    data: typing.List[LUBESInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lubesinfra_Upload_Lubes_FileParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lubesinfra_Get_All_Lubes_InfraParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lubesinfra_Update_Lubes_DataParams(pydantic.BaseModel):
    lubes_data: LubesInfraDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lubesinfra_Add_Lubes_DataParams(pydantic.BaseModel):
    lubes_data: LubesInfraDataCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lubesinfra_Delete_Lubes_DataParams(pydantic.BaseModel):
    unique_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class HistoricSodInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'historic_sod_infra'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    type: Mapped[typing.Optional[str]] = mapped_column("type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region_ppac: Mapped[typing.Optional[str]] = mapped_column("region_ppac", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ms: Mapped[typing.Optional[int]] = mapped_column("ms", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    sko: Mapped[typing.Optional[int]] = mapped_column("sko", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    hsd: Mapped[typing.Optional[int]] = mapped_column("hsd", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    total: Mapped[typing.Optional[int]] = mapped_column("total", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    mode_of_receipt: Mapped[typing.Optional[str]] = mapped_column("mode_of_receipt", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[float]] = mapped_column("latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[float]] = mapped_column("longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    filename: Mapped[typing.Optional[str]] = mapped_column("filename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class HistoricSodInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'historic_sod_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    region_ppac: typing.Optional[str] = pydantic.Field("", **{})
    ms: typing.Optional[int] = pydantic.Field(0, **{})
    sko: typing.Optional[int] = pydantic.Field(0, **{})
    hsd: typing.Optional[int] = pydantic.Field(0, **{})
    total: typing.Optional[int] = pydantic.Field(0, **{})
    mode_of_receipt: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricSodInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class HistoricSodInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'historic_sod_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    type: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    region_ppac: typing.Optional[str] = pydantic.Field("", **{})
    ms: typing.Optional[int] = pydantic.Field(0, **{})
    sko: typing.Optional[int] = pydantic.Field(0, **{})
    hsd: typing.Optional[int] = pydantic.Field(0, **{})
    total: typing.Optional[int] = pydantic.Field(0, **{})
    mode_of_receipt: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricSodInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class HistoricSodInfraGetResp(pydantic.BaseModel):
    data: typing.List[HistoricSodInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HistoricLPGInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'historic_lpg_infra'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    installed_bottling_capacity: Mapped[typing.Optional[float]] = mapped_column("installed_bottling_capacity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    operating_bottling_capacity: Mapped[typing.Optional[float]] = mapped_column("operating_bottling_capacity", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    ccoe_tankage: Mapped[typing.Optional[float]] = mapped_column("ccoe_tankage", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    time_of_commissioning: Mapped[typing.Optional[str]] = mapped_column("time_of_commissioning", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    mode: Mapped[typing.Optional[str]] = mapped_column("mode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    supply: Mapped[typing.Optional[str]] = mapped_column("supply", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[float]] = mapped_column("latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[float]] = mapped_column("longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    filename: Mapped[typing.Optional[str]] = mapped_column("filename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class HistoricLPGInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'historic_lpg_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    installed_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    operating_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    ccoe_tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    time_of_commissioning: typing.Optional[str] = pydantic.Field("", **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    supply: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricLPGInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class HistoricLPGInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'historic_lpg_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    installed_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    operating_bottling_capacity: typing.Optional[float] = pydantic.Field(0.0, **{})
    ccoe_tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    time_of_commissioning: typing.Optional[str] = pydantic.Field("", **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    supply: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricLPGInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class HistoricLPGInfraGetResp(pydantic.BaseModel):
    data: typing.List[HistoricLPGInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HistoricAVIATIONInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'historic_aviation_infra'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    operation_status: Mapped[typing.Optional[str]] = mapped_column("operation_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tankage: Mapped[typing.Optional[float]] = mapped_column("tankage", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    mode: Mapped[typing.Optional[str]] = mapped_column("mode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    pincode: Mapped[typing.Optional[str]] = mapped_column("pincode", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[float]] = mapped_column("latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[float]] = mapped_column("longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    filename: Mapped[typing.Optional[str]] = mapped_column("filename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class HistoricAVIATIONInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'historic_aviation_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    operation_status: typing.Optional[str] = pydantic.Field("", **{})
    tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    pincode: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricAVIATIONInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class HistoricAVIATIONInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'historic_aviation_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    operation_status: typing.Optional[str] = pydantic.Field("", **{})
    tankage: typing.Optional[float] = pydantic.Field(0.0, **{})
    mode: typing.Optional[str] = pydantic.Field("", **{})
    pincode: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricAVIATIONInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class HistoricAVIATIONInfraGetResp(pydantic.BaseModel):
    data: typing.List[HistoricAVIATIONInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class HistoricLUBESInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'historic_lubes_infra'
    
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    address: Mapped[typing.Optional[str]] = mapped_column("address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    base_oil_tankages: Mapped[typing.Optional[float]] = mapped_column("base_oil_tankages", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    landline: Mapped[typing.Optional[str]] = mapped_column("landline", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[float]] = mapped_column("latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[float]] = mapped_column("longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    filename: Mapped[typing.Optional[str]] = mapped_column("filename", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_by: Mapped[typing.Optional[str]] = mapped_column("updated_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class HistoricLUBESInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'historic_lubes_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    base_oil_tankages: typing.Optional[float] = pydantic.Field(0.0, **{})
    landline: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricLUBESInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class HistoricLUBESInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'historic_lubes_infra'
    
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    address: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    base_oil_tankages: typing.Optional[float] = pydantic.Field(0.0, **{})
    landline: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    filename: typing.Optional[str] = pydantic.Field("", **{})
    updated_by: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HistoricLUBESInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone', 'region', 'sap_id']


class HistoricLUBESInfraGetResp(pydantic.BaseModel):
    data: typing.List[HistoricLUBESInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class PlantRoInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'plant_ro_infra'
    
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ro_status: Mapped[typing.Optional[str]] = mapped_column("ro_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    retail_outlet: Mapped[typing.Optional[float]] = mapped_column("retail_outlet", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    ros_commissioned: Mapped[typing.Optional[float]] = mapped_column("ros_commissioned", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    ros_decommissioned: Mapped[typing.Optional[float]] = mapped_column("ros_decommissioned", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    start_date: Mapped[typing.Optional[str]] = mapped_column("start_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    to_date: Mapped[typing.Optional[str]] = mapped_column("to_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class PlantRoInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'plant_ro_infra'
    
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    ro_status: typing.Optional[str] = pydantic.Field("", **{})
    retail_outlet: typing.Optional[float] = pydantic.Field(0.0, **{})
    ros_commissioned: typing.Optional[float] = pydantic.Field(0.0, **{})
    ros_decommissioned: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    to_date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PlantRoInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone']


class PlantRoInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'plant_ro_infra'
    
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    ro_status: typing.Optional[str] = pydantic.Field("", **{})
    retail_outlet: typing.Optional[float] = pydantic.Field(0.0, **{})
    ros_commissioned: typing.Optional[float] = pydantic.Field(0.0, **{})
    ros_decommissioned: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    to_date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PlantRoInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone']


class PlantRoInfraGetResp(pydantic.BaseModel):
    data: typing.List[PlantRoInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Plantroinfra_Upload_Plant_Ro_FileParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantroinfra_Get_All_Plant_Ro_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantroinfra_Get_Plant_Ro_Count_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantroinfra_Get_Retail_Company_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantroinfra_Get_Distinct_Ro_Retail_InfraParams(pydantic.BaseModel):
    sbu: str
    company: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    status: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    ro_status: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantroinfra_Get_Top_Five_Ro_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantroinfra_Get_Zone_Wise_Ro_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantroinfra_Get_Ro_Status_Ro_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantroinfra_Get_Zone_Table_Ro_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class PlantCngInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'plant_cng_infra'
    
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    cng_outlet: Mapped[typing.Optional[float]] = mapped_column("cng_outlet", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    ros_commissioned: Mapped[typing.Optional[float]] = mapped_column("ros_commissioned", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    ros_decommissioned: Mapped[typing.Optional[float]] = mapped_column("ros_decommissioned", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    start_date: Mapped[typing.Optional[str]] = mapped_column("start_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    to_date: Mapped[typing.Optional[str]] = mapped_column("to_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class PlantCngInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'plant_cng_infra'
    
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    cng_outlet: typing.Optional[float] = pydantic.Field(0.0, **{})
    ros_commissioned: typing.Optional[float] = pydantic.Field(0.0, **{})
    ros_decommissioned: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    to_date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PlantCngInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone']


class PlantCngInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'plant_cng_infra'
    
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    cng_outlet: typing.Optional[float] = pydantic.Field(0.0, **{})
    ros_commissioned: typing.Optional[float] = pydantic.Field(0.0, **{})
    ros_decommissioned: typing.Optional[float] = pydantic.Field(0.0, **{})
    start_date: typing.Optional[str] = pydantic.Field("", **{})
    to_date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PlantCngInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone']


class PlantCngInfraGetResp(pydantic.BaseModel):
    data: typing.List[PlantCngInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Plantcnginfra_Upload_Plant_Cng_FileParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantcnginfra_Get_Plant_Cng_Count_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantcnginfra_Get_Distinct_Cng_Retail_InfraParams(pydantic.BaseModel):
    sbu: str
    company: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    status: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantcnginfra_Get_Retail_Company_Cng_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantcnginfra_Get_Top_Five_Cng_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantcnginfra_Get_Zone_Wise_Cng_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class PlantEvInfraSchema(UrdhvaPostgresBase):
    __tablename__ = 'plant_ev_infra'
    
    sbu: Mapped[typing.Optional[str]] = mapped_column("sbu", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    company: Mapped[typing.Optional[str]] = mapped_column("company", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    category: Mapped[typing.Optional[str]] = mapped_column("category", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ro_name: Mapped[typing.Optional[str]] = mapped_column("ro_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    battery_swapping_stations: Mapped[typing.Optional[float]] = mapped_column("battery_swapping_stations", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    vehicle_charging_stations: Mapped[typing.Optional[float]] = mapped_column("vehicle_charging_stations", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    fame_status: Mapped[typing.Optional[str]] = mapped_column("fame_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    non_fame_status: Mapped[typing.Optional[str]] = mapped_column("non_fame_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    date: Mapped[typing.Optional[str]] = mapped_column("date", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class PlantEvInfraCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'plant_ev_infra'
    
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    ro_name: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    battery_swapping_stations: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_charging_stations: typing.Optional[float] = pydantic.Field(0.0, **{})
    fame_status: typing.Optional[str] = pydantic.Field("", **{})
    non_fame_status: typing.Optional[str] = pydantic.Field("", **{})
    date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PlantEvInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone']


class PlantEvInfra(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'plant_ev_infra'
    
    sbu: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    company: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    ro_name: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    battery_swapping_stations: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_charging_stations: typing.Optional[float] = pydantic.Field(0.0, **{})
    fame_status: typing.Optional[str] = pydantic.Field("", **{})
    non_fame_status: typing.Optional[str] = pydantic.Field("", **{})
    date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PlantEvInfraSchema
        upsert_keys = []
        access_key_mapping = ['sbu', 'zone']


class PlantEvInfraGetResp(pydantic.BaseModel):
    data: typing.List[PlantEvInfra]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Plantevinfra_Upload_Plant_Ev_FileParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantevinfra_Get_Plant_Ev_Count_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantevinfra_Get_All_Ev_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantevinfra_Get_Ev_Company_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantevinfra_Get_Distinct_Ev_Retail_InfraParams(pydantic.BaseModel):
    sbu: str
    company: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    status: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Plantevinfra_Get_Zone_Wise_Ev_InfraParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    time_grain: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Zone_History_CountsCreate(pydantic.BaseModel):
    zone: typing.Optional[str] = pydantic.Field("", **{})
    count: typing.Optional[str] = pydantic.Field("", **{})


class DryOutDailyReportSchema(UrdhvaPostgresBase):
    __tablename__ = 'dry_out_daily_report'
    
    dry_out_date: Mapped[typing.Optional[str]] = mapped_column("dry_out_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dry_out_count: Mapped[typing.Optional[str]] = mapped_column("dry_out_count", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dry_out_zone: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("dry_out_zone", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    dry_out_alert_ids: Mapped[typing.Optional[typing.List[str]]] = mapped_column("dry_out_alert_ids", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)


class DryOutDailyReportCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'dry_out_daily_report'
    
    dry_out_date: typing.Optional[str] = pydantic.Field("", **{})
    dry_out_count: typing.Optional[str] = pydantic.Field("", **{})
    dry_out_zone: typing.Optional[typing.List[Zone_History_CountsCreate]] | None = None
    dry_out_alert_ids: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DryOutDailyReportSchema
        upsert_keys = []


class DryOutDailyReport(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'dry_out_daily_report'
    
    dry_out_date: typing.Optional[str] = pydantic.Field("", **{})
    dry_out_count: typing.Optional[str] = pydantic.Field("", **{})
    dry_out_zone: typing.Optional[typing.List[Zone_History_CountsCreate]] | None = None
    dry_out_alert_ids: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DryOutDailyReportSchema
        upsert_keys = []


class DryOutDailyReportGetResp(pydantic.BaseModel):
    data: typing.List[DryOutDailyReport]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class RoInterlockDisableSchema(UrdhvaPostgresBase):
    __tablename__ = 'ro_interlock_disable'
    
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    interlock_name: Mapped[str] = mapped_column("interlock_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    is_sales_officer_approved: Mapped[typing.Optional[bool]] = mapped_column("is_sales_officer_approved", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    is_regional_manager_approved: Mapped[typing.Optional[bool]] = mapped_column("is_regional_manager_approved", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    is_zonal_head_approved: Mapped[typing.Optional[bool]] = mapped_column("is_zonal_head_approved", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)


class RoInterlockDisableCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'ro_interlock_disable'
    
    sap_id: str
    interlock_name: str
    bu: str
    is_sales_officer_approved: typing.Optional[bool] = pydantic.Field(False, )
    is_regional_manager_approved: typing.Optional[bool] = pydantic.Field(False, )
    is_zonal_head_approved: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = RoInterlockDisableSchema
        upsert_keys = []


class RoInterlockDisable(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'ro_interlock_disable'
    
    sap_id: typing.Optional[str] | None = None
    interlock_name: typing.Optional[str] | None = None
    bu: typing.Optional[str] | None = None
    is_sales_officer_approved: typing.Optional[bool] = pydantic.Field(False, )
    is_regional_manager_approved: typing.Optional[bool] = pydantic.Field(False, )
    is_zonal_head_approved: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = RoInterlockDisableSchema
        upsert_keys = []


class RoInterlockDisableGetResp(pydantic.BaseModel):
    data: typing.List[RoInterlockDisable]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Rointerlockdisable_Get_Service_Request_Raise_DetailsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Rointerlockdisable_Submit_Service_RequestParams(pydantic.BaseModel):
    vendor_name: typing.Optional[str] = pydantic.Field("", **{})
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    location_id: str
    sap_id: str
    location_type: str
    violation_type: str
    interlock_description: typing.Optional[str] = pydantic.Field("", **{})
    device_name: str
    device_id: str
    action_type: hpcl_ceg_enum.AlertActionType
    action_msg: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    rca_reason: typing.Optional[str] = pydantic.Field("", **{})
    action_description: typing.Optional[str] = pydantic.Field("", **{})
    doc_link: typing.Optional[str] = pydantic.Field("", **{})
    severity: typing.Optional[str] = pydantic.Field("", **{})
    alarm_id: typing.Optional[str] = pydantic.Field("", **{})
    tank_id: typing.Optional[str] = pydantic.Field("", **{})
    nozzle_id: typing.Optional[str] = pydantic.Field("", **{})
    pump_no: typing.Optional[str] = pydantic.Field("", **{})
    occurrence_date: typing.Optional[str] = pydantic.Field("", **{})
    closure_date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class EMLockStatusSchema(UrdhvaPostgresBase):
    __tablename__ = 'em_lock_status'
    
    event_id: Mapped[str] = mapped_column("event_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    vendor_id: Mapped[str] = mapped_column("vendor_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location_type: Mapped[str] = mapped_column("location_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    emlock_exception_id: Mapped[typing.Optional[str]] = mapped_column("emlock_exception_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    terminal_code: Mapped[typing.Optional[str]] = mapped_column("terminal_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    truck_number: Mapped[typing.Optional[str]] = mapped_column("truck_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    swipein_l1: Mapped[typing.Optional[bool]] = mapped_column("swipein_l1", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    swipein_l2: Mapped[typing.Optional[bool]] = mapped_column("swipein_l2", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    swipeout_l1: Mapped[typing.Optional[bool]] = mapped_column("swipeout_l1", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    swipeout_l2: Mapped[typing.Optional[bool]] = mapped_column("swipeout_l2", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    l1_id: Mapped[typing.Optional[str]] = mapped_column("l1_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    l2_id: Mapped[typing.Optional[str]] = mapped_column("l2_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    created_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("created_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    invoice_number: Mapped[typing.Optional[str]] = mapped_column("invoice_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class EMLockStatusCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'em_lock_status'
    
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

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = EMLockStatusSchema
        upsert_keys = []


class EMLockStatus(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'em_lock_status'
    
    event_id: typing.Optional[str] | None = None
    vendor_id: typing.Optional[str] | None = None
    location_type: typing.Optional[str] | None = None
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

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = EMLockStatusSchema
        upsert_keys = []


class EMLockStatusGetResp(pydantic.BaseModel):
    data: typing.List[EMLockStatus]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class TransporterDetailsCreate(pydantic.BaseModel):
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    transporter_email: typing.Optional[str] = pydantic.Field("", **{})


class NotificationAuditLogSchema(UrdhvaPostgresBase):
    __tablename__ = 'notification_audit_log'
    
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    alert_section: Mapped[str] = mapped_column("alert_section", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    interlock_name: Mapped[str] = mapped_column("interlock_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    vehicle_number: Mapped[typing.Optional[str]] = mapped_column("vehicle_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    officers_username: Mapped[typing.Optional[str]] = mapped_column("officers_username", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    notification_type: Mapped[typing.Optional[str]] = mapped_column("notification_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    template_path: Mapped[typing.Optional[str]] = mapped_column("template_path", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_id: Mapped[typing.Optional[str]] = mapped_column("alert_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_details: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("transporter_details", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)


class NotificationAuditLogCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'notification_audit_log'
    
    bu: str
    sap_id: str
    alert_section: str
    interlock_name: str
    vehicle_number: typing.Optional[str] = pydantic.Field("", **{})
    officers_username: typing.Optional[str] = pydantic.Field("", **{})
    notification_type: typing.Optional[str] = pydantic.Field("", **{})
    template_path: typing.Optional[str] = pydantic.Field("", **{})
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_details: typing.Optional[typing.List[TransporterDetailsCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NotificationAuditLogSchema
        upsert_keys = []


class NotificationAuditLog(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'notification_audit_log'
    
    bu: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    alert_section: typing.Optional[str] | None = None
    interlock_name: typing.Optional[str] | None = None
    vehicle_number: typing.Optional[str] = pydantic.Field("", **{})
    officers_username: typing.Optional[str] = pydantic.Field("", **{})
    notification_type: typing.Optional[str] = pydantic.Field("", **{})
    template_path: typing.Optional[str] = pydantic.Field("", **{})
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_details: typing.Optional[typing.List[TransporterDetailsCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NotificationAuditLogSchema
        upsert_keys = []


class NotificationAuditLogGetResp(pydantic.BaseModel):
    data: typing.List[NotificationAuditLog]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class EmailMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'email_master'
    
    user: Mapped[typing.Optional[str]] = mapped_column("user", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    section: Mapped[typing.Optional[str]] = mapped_column("section", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_name: Mapped[typing.Optional[str]] = mapped_column("transporter_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_code: Mapped[typing.Optional[str]] = mapped_column("transporter_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_address: Mapped[typing.Optional[str]] = mapped_column("transporter_address", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_email1: Mapped[typing.Optional[str]] = mapped_column("transporter_email1", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_email2: Mapped[typing.Optional[str]] = mapped_column("transporter_email2", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_officer: Mapped[typing.Optional[str]] = mapped_column("location_officer", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zonal_transport_officer: Mapped[typing.Optional[str]] = mapped_column("zonal_transport_officer", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zonal_head: Mapped[typing.Optional[str]] = mapped_column("zonal_head", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    hqo1: Mapped[typing.Optional[str]] = mapped_column("hqo1", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    hqo2: Mapped[typing.Optional[str]] = mapped_column("hqo2", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    hqo3: Mapped[typing.Optional[str]] = mapped_column("hqo3", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    hqo4: Mapped[typing.Optional[str]] = mapped_column("hqo4", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    others: Mapped[typing.Optional[str]] = mapped_column("others", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    driver_name: Mapped[typing.Optional[str]] = mapped_column("driver_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    driver_number: Mapped[typing.Optional[str]] = mapped_column("driver_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class EmailMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'email_master'
    
    user: typing.Optional[str] = pydantic.Field("", **{})
    section: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    transporter_code: typing.Optional[str] = pydantic.Field("", **{})
    transporter_address: typing.Optional[str] = pydantic.Field("", **{})
    transporter_email1: typing.Optional[str] = pydantic.Field("", **{})
    transporter_email2: typing.Optional[str] = pydantic.Field("", **{})
    location_officer: typing.Optional[str] = pydantic.Field("", **{})
    zonal_transport_officer: typing.Optional[str] = pydantic.Field("", **{})
    zonal_head: typing.Optional[str] = pydantic.Field("", **{})
    hqo1: typing.Optional[str] = pydantic.Field("", **{})
    hqo2: typing.Optional[str] = pydantic.Field("", **{})
    hqo3: typing.Optional[str] = pydantic.Field("", **{})
    hqo4: typing.Optional[str] = pydantic.Field("", **{})
    others: typing.Optional[str] = pydantic.Field("", **{})
    driver_name: typing.Optional[str] = pydantic.Field("", **{})
    driver_number: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = EmailMasterSchema
        upsert_keys = []


class EmailMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'email_master'
    
    user: typing.Optional[str] = pydantic.Field("", **{})
    section: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    transporter_code: typing.Optional[str] = pydantic.Field("", **{})
    transporter_address: typing.Optional[str] = pydantic.Field("", **{})
    transporter_email1: typing.Optional[str] = pydantic.Field("", **{})
    transporter_email2: typing.Optional[str] = pydantic.Field("", **{})
    location_officer: typing.Optional[str] = pydantic.Field("", **{})
    zonal_transport_officer: typing.Optional[str] = pydantic.Field("", **{})
    zonal_head: typing.Optional[str] = pydantic.Field("", **{})
    hqo1: typing.Optional[str] = pydantic.Field("", **{})
    hqo2: typing.Optional[str] = pydantic.Field("", **{})
    hqo3: typing.Optional[str] = pydantic.Field("", **{})
    hqo4: typing.Optional[str] = pydantic.Field("", **{})
    others: typing.Optional[str] = pydantic.Field("", **{})
    driver_name: typing.Optional[str] = pydantic.Field("", **{})
    driver_number: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = EmailMasterSchema
        upsert_keys = []


class EmailMasterGetResp(pydantic.BaseModel):
    data: typing.List[EmailMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class SalesTripsTillDateSchema(UrdhvaPostgresBase):
    __tablename__ = 'sales_trips_till_date'
    
    sbu_cd: Mapped[typing.Optional[str]] = mapped_column("sbu_cd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sbu_nm: Mapped[typing.Optional[str]] = mapped_column("sbu_nm", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    plant_cd: Mapped[typing.Optional[str]] = mapped_column("plant_cd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    plant_nm: Mapped[typing.Optional[str]] = mapped_column("plant_nm", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone_cd: Mapped[typing.Optional[str]] = mapped_column("zone_cd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone_nm: Mapped[typing.Optional[str]] = mapped_column("zone_nm", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state_cd: Mapped[typing.Optional[str]] = mapped_column("state_cd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state_nm: Mapped[typing.Optional[str]] = mapped_column("state_nm", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_type: Mapped[typing.Optional[str]] = mapped_column("location_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    division: Mapped[typing.Optional[str]] = mapped_column("division", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    material_group_cd: Mapped[typing.Optional[str]] = mapped_column("material_group_cd", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    material_group_nm: Mapped[typing.Optional[str]] = mapped_column("material_group_nm", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    item_no: Mapped[typing.Optional[str]] = mapped_column("item_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    item_nm: Mapped[typing.Optional[str]] = mapped_column("item_nm", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    customer: Mapped[typing.Optional[str]] = mapped_column("customer", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    cust_nm: Mapped[typing.Optional[str]] = mapped_column("cust_nm", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    invoice_no: Mapped[typing.Optional[str]] = mapped_column("invoice_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    invoice_type: Mapped[typing.Optional[str]] = mapped_column("invoice_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    invoice_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("invoice_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    load_status: Mapped[typing.Optional[str]] = mapped_column("load_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    qty_shortage: Mapped[typing.Optional[float]] = mapped_column("qty_shortage", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    route: Mapped[typing.Optional[str]] = mapped_column("route", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    load_no: Mapped[typing.Optional[str]] = mapped_column("load_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vehicle_id: Mapped[typing.Optional[str]] = mapped_column("vehicle_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    carrier_no: Mapped[typing.Optional[str]] = mapped_column("carrier_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    date_shipped: Mapped[typing.Optional[datetime.datetime]] = mapped_column("date_shipped", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    load_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("load_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    created_on: Mapped[typing.Optional[datetime.datetime]] = mapped_column("created_on", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    load_dt: Mapped[typing.Optional[datetime.datetime]] = mapped_column("load_dt", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    engine_id: Mapped[typing.Optional[str]] = mapped_column("engine_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class SalesTripsTillDateCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'sales_trips_till_date'
    
    sbu_cd: typing.Optional[str] = pydantic.Field("", **{})
    sbu_nm: typing.Optional[str] = pydantic.Field("", **{})
    plant_cd: typing.Optional[str] = pydantic.Field("", **{})
    plant_nm: typing.Optional[str] = pydantic.Field("", **{})
    zone_cd: typing.Optional[str] = pydantic.Field("", **{})
    zone_nm: typing.Optional[str] = pydantic.Field("", **{})
    state_cd: typing.Optional[str] = pydantic.Field("", **{})
    state_nm: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    division: typing.Optional[str] = pydantic.Field("", **{})
    material_group_cd: typing.Optional[str] = pydantic.Field("", **{})
    material_group_nm: typing.Optional[str] = pydantic.Field("", **{})
    item_no: typing.Optional[str] = pydantic.Field("", **{})
    item_nm: typing.Optional[str] = pydantic.Field("", **{})
    customer: typing.Optional[str] = pydantic.Field("", **{})
    cust_nm: typing.Optional[str] = pydantic.Field("", **{})
    invoice_no: typing.Optional[str] = pydantic.Field("", **{})
    invoice_type: typing.Optional[str] = pydantic.Field("", **{})
    invoice_date: typing.Optional[datetime.datetime] | None = None
    load_status: typing.Optional[str] = pydantic.Field("", **{})
    qty_shortage: typing.Optional[float] = pydantic.Field(0.0, **{})
    route: typing.Optional[str] = pydantic.Field("", **{})
    load_no: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_id: typing.Optional[str] = pydantic.Field("", **{})
    carrier_no: typing.Optional[str] = pydantic.Field("", **{})
    date_shipped: typing.Optional[datetime.datetime] | None = None
    load_date: typing.Optional[datetime.datetime] | None = None
    created_on: typing.Optional[datetime.datetime] | None = None
    load_dt: typing.Optional[datetime.datetime] | None = None
    engine_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SalesTripsTillDateSchema
        upsert_keys = []


class SalesTripsTillDate(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'sales_trips_till_date'
    
    sbu_cd: typing.Optional[str] = pydantic.Field("", **{})
    sbu_nm: typing.Optional[str] = pydantic.Field("", **{})
    plant_cd: typing.Optional[str] = pydantic.Field("", **{})
    plant_nm: typing.Optional[str] = pydantic.Field("", **{})
    zone_cd: typing.Optional[str] = pydantic.Field("", **{})
    zone_nm: typing.Optional[str] = pydantic.Field("", **{})
    state_cd: typing.Optional[str] = pydantic.Field("", **{})
    state_nm: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    division: typing.Optional[str] = pydantic.Field("", **{})
    material_group_cd: typing.Optional[str] = pydantic.Field("", **{})
    material_group_nm: typing.Optional[str] = pydantic.Field("", **{})
    item_no: typing.Optional[str] = pydantic.Field("", **{})
    item_nm: typing.Optional[str] = pydantic.Field("", **{})
    customer: typing.Optional[str] = pydantic.Field("", **{})
    cust_nm: typing.Optional[str] = pydantic.Field("", **{})
    invoice_no: typing.Optional[str] = pydantic.Field("", **{})
    invoice_type: typing.Optional[str] = pydantic.Field("", **{})
    invoice_date: typing.Optional[datetime.datetime] | None = None
    load_status: typing.Optional[str] = pydantic.Field("", **{})
    qty_shortage: typing.Optional[float] = pydantic.Field(0.0, **{})
    route: typing.Optional[str] = pydantic.Field("", **{})
    load_no: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_id: typing.Optional[str] = pydantic.Field("", **{})
    carrier_no: typing.Optional[str] = pydantic.Field("", **{})
    date_shipped: typing.Optional[datetime.datetime] | None = None
    load_date: typing.Optional[datetime.datetime] | None = None
    created_on: typing.Optional[datetime.datetime] | None = None
    load_dt: typing.Optional[datetime.datetime] | None = None
    engine_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SalesTripsTillDateSchema
        upsert_keys = []


class SalesTripsTillDateGetResp(pydantic.BaseModel):
    data: typing.List[SalesTripsTillDate]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class VtsOngoingTripsSchema(UrdhvaPostgresBase):
    __tablename__ = 'vts_ongoing_trips'
    
    violation_type: Mapped[typing.Optional[str]] = mapped_column("violation_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    event_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("event_start_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    event_end_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("event_end_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    destination_code: Mapped[typing.Optional[str]] = mapped_column("destination_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_type: Mapped[typing.Optional[str]] = mapped_column("location_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tt_type: Mapped[typing.Optional[str]] = mapped_column("tt_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tt_number: Mapped[typing.Optional[str]] = mapped_column("tt_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    trip_id: Mapped[typing.Optional[str]] = mapped_column("trip_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_id: Mapped[typing.Optional[str]] = mapped_column("transporter_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    transporter_name: Mapped[typing.Optional[str]] = mapped_column("transporter_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    invoice_no: Mapped[typing.Optional[str]] = mapped_column("invoice_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    load_no: Mapped[typing.Optional[str]] = mapped_column("load_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    route_no: Mapped[typing.Optional[str]] = mapped_column("route_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    driver_name: Mapped[typing.Optional[str]] = mapped_column("driver_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    scheduled_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("scheduled_start_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    scheduled_end_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("scheduled_end_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    actual_trip_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("actual_trip_start_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    actual_end_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("actual_end_start_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    vehicle_latitude: Mapped[typing.Optional[float]] = mapped_column("vehicle_latitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    vehicle_longitude: Mapped[typing.Optional[float]] = mapped_column("vehicle_longitude", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)
    vehicle_location: Mapped[typing.Optional[str]] = mapped_column("vehicle_location", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    trip_completed_time: Mapped[typing.Optional[datetime.datetime]] = mapped_column("trip_completed_time", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    trip_status: Mapped[typing.Optional[str]] = mapped_column("trip_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vts_status: Mapped[typing.Optional[str]] = mapped_column("vts_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    ims_status: Mapped[typing.Optional[str]] = mapped_column("ims_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    destination_name: Mapped[typing.Optional[str]] = mapped_column("destination_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class VtsOngoingTripsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'vts_ongoing_trips'
    
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    event_start_datetime: typing.Optional[datetime.datetime] | None = None
    event_end_datetime: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_number: typing.Optional[str] = pydantic.Field("", **{})
    trip_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    invoice_no: typing.Optional[str] = pydantic.Field("", **{})
    load_no: typing.Optional[str] = pydantic.Field("", **{})
    route_no: typing.Optional[str] = pydantic.Field("", **{})
    driver_name: typing.Optional[str] = pydantic.Field("", **{})
    scheduled_start_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_end_datetime: typing.Optional[datetime.datetime] | None = None
    actual_trip_start_datetime: typing.Optional[datetime.datetime] | None = None
    actual_end_start_datetime: typing.Optional[datetime.datetime] | None = None
    vehicle_latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_location: typing.Optional[str] = pydantic.Field("", **{})
    trip_completed_time: typing.Optional[datetime.datetime] | None = None
    trip_status: typing.Optional[str] = pydantic.Field("", **{})
    vts_status: typing.Optional[str] = pydantic.Field("", **{})
    ims_status: typing.Optional[str] = pydantic.Field("", **{})
    destination_name: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VtsOngoingTripsSchema
        upsert_keys = []


class VtsOngoingTrips(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'vts_ongoing_trips'
    
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    event_start_datetime: typing.Optional[datetime.datetime] | None = None
    event_end_datetime: typing.Optional[datetime.datetime] | None = None
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    destination_code: typing.Optional[str] = pydantic.Field("", **{})
    location_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    tt_number: typing.Optional[str] = pydantic.Field("", **{})
    trip_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter_name: typing.Optional[str] = pydantic.Field("", **{})
    invoice_no: typing.Optional[str] = pydantic.Field("", **{})
    load_no: typing.Optional[str] = pydantic.Field("", **{})
    route_no: typing.Optional[str] = pydantic.Field("", **{})
    driver_name: typing.Optional[str] = pydantic.Field("", **{})
    scheduled_start_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_end_datetime: typing.Optional[datetime.datetime] | None = None
    actual_trip_start_datetime: typing.Optional[datetime.datetime] | None = None
    actual_end_start_datetime: typing.Optional[datetime.datetime] | None = None
    vehicle_latitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_longitude: typing.Optional[float] = pydantic.Field(0.0, **{})
    vehicle_location: typing.Optional[str] = pydantic.Field("", **{})
    trip_completed_time: typing.Optional[datetime.datetime] | None = None
    trip_status: typing.Optional[str] = pydantic.Field("", **{})
    vts_status: typing.Optional[str] = pydantic.Field("", **{})
    ims_status: typing.Optional[str] = pydantic.Field("", **{})
    destination_name: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = VtsOngoingTripsSchema
        upsert_keys = []


class VtsOngoingTripsGetResp(pydantic.BaseModel):
    data: typing.List[VtsOngoingTrips]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class ViolationHistoryVtsSchema(UrdhvaPostgresBase):
    __tablename__ = 'violation_history_vts'
    
    vendor_id: Mapped[typing.Optional[str]] = mapped_column("vendor_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vehicle_number: Mapped[str] = mapped_column("vehicle_number", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sop_id: Mapped[typing.Optional[str]] = mapped_column("sop_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    unique_id: Mapped[str] = mapped_column("unique_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    report_duration: Mapped[typing.Optional[str]] = mapped_column("report_duration", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_section: Mapped[str] = mapped_column("alert_section", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    severity: Mapped[typing.Any] = mapped_column("severity", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    scheduled_trip_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("scheduled_trip_start_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    scheduled_trip_end_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("scheduled_trip_end_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    vts_start_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("vts_start_datetime", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    vts_end_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("vts_end_datetime", DateTime(timezone=False), index=False, nullable=True, default=None, primary_key=False, unique=False)
    total_trips: Mapped[typing.Optional[int]] = mapped_column("total_trips", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    violation_name: Mapped[typing.Optional[str]] = mapped_column("violation_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    violation_type: Mapped[typing.Optional[str]] = mapped_column("violation_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    violation_count: Mapped[typing.Optional[int]] = mapped_column("violation_count", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    alert_status: Mapped[typing.Optional[typing.Any]] = mapped_column("alert_status", String, index=False, nullable=True, default=None, primary_key=False, unique=False)
    approved_status: Mapped[typing.Optional[bool]] = mapped_column("approved_status", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    alert_id: Mapped[typing.Optional[str]] = mapped_column("alert_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    invoice_number: Mapped[typing.Optional[str]] = mapped_column("invoice_number", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    tt_type: Mapped[typing.Optional[str]] = mapped_column("tt_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    workflow_instance_id: Mapped[typing.Optional[str]] = mapped_column("workflow_instance_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    workflow_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("workflow_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    workflow_url: Mapped[typing.Optional[str]] = mapped_column("workflow_url", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    workflow_port: Mapped[typing.Optional[str]] = mapped_column("workflow_port", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    district: Mapped[typing.Optional[str]] = mapped_column("district", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    state: Mapped[typing.Optional[str]] = mapped_column("state", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    city: Mapped[typing.Optional[str]] = mapped_column("city", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[str]] = mapped_column("sales_area", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_history: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("alert_history", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    alert_state_timing: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("alert_state_timing", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    last_sms_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("last_sms_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    last_mailed_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("last_mailed_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    last_escalated_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("last_escalated_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    last_notified_to: Mapped[typing.Optional[typing.List[str]]] = mapped_column("last_notified_to", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_to: Mapped[typing.Optional[str]] = mapped_column("assigned_to", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_to_role: Mapped[typing.Optional[str]] = mapped_column("assigned_to_role", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_users: Mapped[typing.Optional[typing.List[str]]] = mapped_column("assigned_users", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    assigned_user_roles: Mapped[typing.Optional[typing.List[str]]] = mapped_column("assigned_user_roles", ARRAY(String), index=True, nullable=True, default="", primary_key=False, unique=False)


class ViolationHistoryVtsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'violation_history_vts'
    
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_number: str
    sop_id: typing.Optional[str] = pydantic.Field("", **{})
    unique_id: str
    report_duration: typing.Optional[str] = pydantic.Field("", **{})
    alert_section: str
    severity: hpcl_ceg_enum.Severity
    scheduled_trip_start_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_trip_end_datetime: typing.Optional[datetime.datetime] | None = None
    vts_start_datetime: typing.Optional[datetime.datetime] | None = None
    vts_end_datetime: typing.Optional[datetime.datetime] | None = None
    total_trips: typing.Optional[int] = pydantic.Field(0, **{})
    violation_name: typing.Optional[str] = pydantic.Field("", **{})
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    violation_count: typing.Optional[int] = pydantic.Field(0, **{})
    alert_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    approved_status: typing.Optional[bool] = pydantic.Field(False, )
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    workflow_instance_id: typing.Optional[str] = pydantic.Field("", **{})
    workflow_datetime: typing.Optional[datetime.datetime] | None = None
    workflow_url: typing.Optional[str] = pydantic.Field("", **{})
    workflow_port: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    alert_history: typing.Optional[typing.List[Alert_HistoryCreate]] | None = None
    alert_state_timing: typing.Optional[typing.List[AlertStateTimingCreate]] | None = None
    last_sms_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_mailed_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_escalated_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_notified_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assigned_to: typing.Optional[str] = pydantic.Field("", **{})
    assigned_to_role: typing.Optional[str] = pydantic.Field("", **{})
    assigned_users: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assigned_user_roles: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ViolationHistoryVtsSchema
        upsert_keys = []


class ViolationHistoryVts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'violation_history_vts'
    
    vendor_id: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_number: typing.Optional[str] | None = None
    sop_id: typing.Optional[str] = pydantic.Field("", **{})
    unique_id: typing.Optional[str] | None = None
    report_duration: typing.Optional[str] = pydantic.Field("", **{})
    alert_section: typing.Optional[str] | None = None
    severity: typing.Optional[hpcl_ceg_enum.Severity] | None = None
    scheduled_trip_start_datetime: typing.Optional[datetime.datetime] | None = None
    scheduled_trip_end_datetime: typing.Optional[datetime.datetime] | None = None
    vts_start_datetime: typing.Optional[datetime.datetime] | None = None
    vts_end_datetime: typing.Optional[datetime.datetime] | None = None
    total_trips: typing.Optional[int] = pydantic.Field(0, **{})
    violation_name: typing.Optional[str] = pydantic.Field("", **{})
    violation_type: typing.Optional[str] = pydantic.Field("", **{})
    violation_count: typing.Optional[int] = pydantic.Field(0, **{})
    alert_status: typing.Optional[hpcl_ceg_enum.AlertStatus] | None = None
    approved_status: typing.Optional[bool] = pydantic.Field(False, )
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    tt_type: typing.Optional[str] = pydantic.Field("", **{})
    workflow_instance_id: typing.Optional[str] = pydantic.Field("", **{})
    workflow_datetime: typing.Optional[datetime.datetime] | None = None
    workflow_url: typing.Optional[str] = pydantic.Field("", **{})
    workflow_port: typing.Optional[str] = pydantic.Field("", **{})
    district: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    state: typing.Optional[str] = pydantic.Field("", **{})
    city: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    alert_history: typing.Optional[typing.List[Alert_HistoryCreate]] | None = None
    alert_state_timing: typing.Optional[typing.List[AlertStateTimingCreate]] | None = None
    last_sms_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_mailed_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_escalated_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    last_notified_to: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assigned_to: typing.Optional[str] = pydantic.Field("", **{})
    assigned_to_role: typing.Optional[str] = pydantic.Field("", **{})
    assigned_users: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    assigned_user_roles: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = ViolationHistoryVtsSchema
        upsert_keys = []


class ViolationHistoryVtsGetResp(pydantic.BaseModel):
    data: typing.List[ViolationHistoryVts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Violationhistoryvts_Alert_Action_VtsParams(pydantic.BaseModel):
    bu: typing.Optional[str] = pydantic.Field("", **{})
    alert_section: typing.Optional[str] = pydantic.Field("", **{})
    action_type: hpcl_ceg_enum.AlertActionType
    alert_id: int
    action_msg: typing.Optional[str] = pydantic.Field("", **{})
    days: typing.Optional[int] = pydantic.Field(0, **{})
    justification_type: typing.Optional[str] = pydantic.Field("", **{})
    category: typing.Optional[str] = pydantic.Field("", **{})
    rca_reason: typing.Optional[str] = pydantic.Field("", **{})
    action_description: typing.Optional[str] = pydantic.Field("", **{})
    doc_link: typing.Optional[str] = pydantic.Field("", **{})
    acknowledged_by: typing.Optional[str] = pydantic.Field("", **{})
    load_number: typing.Optional[str] = pydantic.Field("", **{})
    fan_number: typing.Optional[str] = pydantic.Field("", **{})
    invoice_number: typing.Optional[str] = pydantic.Field("", **{})
    trip_type: typing.Optional[str] = pydantic.Field("", **{})
    event_tags: typing.Optional[tagsCreate] | None = None

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Violationhistoryvts_Get_Closed_Alerts_Details_VtsParams(pydantic.BaseModel):
    bu: str
    alert_id: int
    alert_section: str
    interlock_name: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LpgDataPostingAuditSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_data_posting_audit'
    
    request_id: Mapped[typing.Optional[str]] = mapped_column("request_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vehicle_number: Mapped[typing.Optional[str]] = mapped_column("vehicle_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    remark: Mapped[typing.Optional[str]] = mapped_column("remark", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_date: Mapped[typing.Optional[str]] = mapped_column("updated_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    updated_time: Mapped[typing.Optional[str]] = mapped_column("updated_time", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class LpgDataPostingAuditCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_data_posting_audit'
    
    request_id: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_number: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    remark: typing.Optional[str] = pydantic.Field("", **{})
    updated_date: typing.Optional[str] = pydantic.Field("", **{})
    updated_time: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgDataPostingAuditSchema
        upsert_keys = []


class LpgDataPostingAudit(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_data_posting_audit'
    
    request_id: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_number: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    remark: typing.Optional[str] = pydantic.Field("", **{})
    updated_date: typing.Optional[str] = pydantic.Field("", **{})
    updated_time: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgDataPostingAuditSchema
        upsert_keys = []


class LpgDataPostingAuditGetResp(pydantic.BaseModel):
    data: typing.List[LpgDataPostingAudit]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpgdatapostingaudit_Get_Erp_StatusParams(pydantic.BaseModel):
    request_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class NoticesCreate(pydantic.BaseModel):
    doc_type: typing.Optional[str] = pydantic.Field("", **{})
    uploaded_date: typing.Optional[datetime.datetime] | None = None
    uploaded_by: typing.Optional[str] = pydantic.Field("", **{})
    uploaded_name: typing.Optional[str] = pydantic.Field("", **{})
    file_path: typing.Optional[str] = pydantic.Field("", **{})
    report_type: typing.Optional[str] = pydantic.Field("", **{})


class NoticesVTSSchema(UrdhvaPostgresBase):
    __tablename__ = 'notices_vts'
    
    alert_id: Mapped[typing.Optional[str]] = mapped_column("alert_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    alert_type: Mapped[typing.Optional[str]] = mapped_column("alert_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    notices: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("notices", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)


class NoticesVTSCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'notices_vts'
    
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    alert_type: typing.Optional[str] = pydantic.Field("", **{})
    notices: typing.Optional[typing.List[NoticesCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NoticesVTSSchema
        upsert_keys = []


class NoticesVTS(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'notices_vts'
    
    alert_id: typing.Optional[str] = pydantic.Field("", **{})
    alert_type: typing.Optional[str] = pydantic.Field("", **{})
    notices: typing.Optional[typing.List[NoticesCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NoticesVTSSchema
        upsert_keys = []


class NoticesVTSGetResp(pydantic.BaseModel):
    data: typing.List[NoticesVTS]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Noticesvts_Download_NoticeParams(pydantic.BaseModel):
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Noticesvts_Upload_NoticeParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class DeviceInstallationSchema(UrdhvaPostgresBase):
    __tablename__ = 'device_installation'
    
    sap_tt_no: Mapped[typing.Optional[str]] = mapped_column("sap_tt_no", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    tt_chassis_no: Mapped[typing.Optional[str]] = mapped_column("tt_chassis_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tt_engine_no: Mapped[typing.Optional[str]] = mapped_column("tt_engine_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    select_business: Mapped[typing.Optional[str]] = mapped_column("select_business", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location: Mapped[typing.Optional[str]] = mapped_column("location", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    transporter: Mapped[typing.Optional[str]] = mapped_column("transporter", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device: Mapped[typing.Optional[str]] = mapped_column("device", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vehicle_installed_by: Mapped[typing.Optional[str]] = mapped_column("vehicle_installed_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    vehicle_installation_date: Mapped[typing.Optional[str]] = mapped_column("vehicle_installation_date", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_installation_approved_by: Mapped[typing.Optional[str]] = mapped_column("device_installation_approved_by", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    contract_valid_upto: Mapped[typing.Optional[str]] = mapped_column("contract_valid_upto", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    certificate: Mapped[typing.Optional[str]] = mapped_column("certificate", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    reason_for_cancel: Mapped[typing.Optional[str]] = mapped_column("reason_for_cancel", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status_decommissioning: Mapped[typing.Optional[str]] = mapped_column("status_decommissioning", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sap_id: Mapped[typing.Optional[str]] = mapped_column("sap_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    commissioning_status: Mapped[typing.Optional[str]] = mapped_column("commissioning_status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    commissioning_status_code: Mapped[typing.Optional[str]] = mapped_column("commissioning_status_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    commissioning_responses: Mapped[typing.Optional[str]] = mapped_column("commissioning_responses", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    commissioned_at: Mapped[typing.Optional[str]] = mapped_column("commissioned_at", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    commissioning_responses_2: Mapped[typing.Optional[str]] = mapped_column("commissioning_responses_2", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    de_commissioning_responses: Mapped[typing.Optional[str]] = mapped_column("de_commissioning_responses", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    aot_status: Mapped[typing.Optional[str]] = mapped_column("aot_status", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    aot_sap_tt_no: Mapped[typing.Optional[str]] = mapped_column("aot_sap_tt_no", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    aot_request_type: Mapped[typing.Optional[str]] = mapped_column("aot_request_type", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    expiry_alert_created: Mapped[typing.Optional[bool]] = mapped_column("expiry_alert_created", Boolean, index=True, nullable=True, default=False, primary_key=False, unique=False)
    tibco_expiry_date: Mapped[typing.Optional[str]] = mapped_column("tibco_expiry_date", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone_code: Mapped[typing.Optional[str]] = mapped_column("zone_code", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class DeviceInstallationCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'device_installation'
    
    sap_tt_no: typing.Optional[str] = pydantic.Field("", **{})
    tt_chassis_no: typing.Optional[str] = pydantic.Field("", **{})
    tt_engine_no: typing.Optional[str] = pydantic.Field("", **{})
    select_business: typing.Optional[str] = pydantic.Field("", **{})
    location: typing.Optional[str] = pydantic.Field("", **{})
    transporter: typing.Optional[str] = pydantic.Field("", **{})
    device: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_installed_by: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_installation_date: typing.Optional[str] = pydantic.Field("", **{})
    device_installation_approved_by: typing.Optional[str] = pydantic.Field("", **{})
    contract_valid_upto: typing.Optional[str] = pydantic.Field("", **{})
    certificate: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    reason_for_cancel: typing.Optional[str] = pydantic.Field("", **{})
    status_decommissioning: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    commissioning_status: typing.Optional[str] = pydantic.Field("", **{})
    commissioning_status_code: typing.Optional[str] = pydantic.Field("", **{})
    commissioning_responses: typing.Optional[str] = pydantic.Field("", **{})
    commissioned_at: typing.Optional[str] = pydantic.Field("", **{})
    commissioning_responses_2: typing.Optional[str] = pydantic.Field("", **{})
    de_commissioning_responses: typing.Optional[str] = pydantic.Field("", **{})
    aot_status: typing.Optional[str] = pydantic.Field("", **{})
    aot_sap_tt_no: typing.Optional[str] = pydantic.Field("", **{})
    aot_request_type: typing.Optional[str] = pydantic.Field("", **{})
    expiry_alert_created: typing.Optional[bool] = pydantic.Field(False, )
    tibco_expiry_date: typing.Optional[str] = pydantic.Field("", **{})
    zone_code: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DeviceInstallationSchema
        upsert_keys = []
        search_fields = ['sap_tt_no', 'sap_id', 'location', 'status', 'status_decommissioning', 'AOT_status']
        access_key_mapping = ['select_business:bu', 'sap_id']


class DeviceInstallation(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'device_installation'
    
    sap_tt_no: typing.Optional[str] = pydantic.Field("", **{})
    tt_chassis_no: typing.Optional[str] = pydantic.Field("", **{})
    tt_engine_no: typing.Optional[str] = pydantic.Field("", **{})
    select_business: typing.Optional[str] = pydantic.Field("", **{})
    location: typing.Optional[str] = pydantic.Field("", **{})
    transporter: typing.Optional[str] = pydantic.Field("", **{})
    device: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_installed_by: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_installation_date: typing.Optional[str] = pydantic.Field("", **{})
    device_installation_approved_by: typing.Optional[str] = pydantic.Field("", **{})
    contract_valid_upto: typing.Optional[str] = pydantic.Field("", **{})
    certificate: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    reason_for_cancel: typing.Optional[str] = pydantic.Field("", **{})
    status_decommissioning: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    commissioning_status: typing.Optional[str] = pydantic.Field("", **{})
    commissioning_status_code: typing.Optional[str] = pydantic.Field("", **{})
    commissioning_responses: typing.Optional[str] = pydantic.Field("", **{})
    commissioned_at: typing.Optional[str] = pydantic.Field("", **{})
    commissioning_responses_2: typing.Optional[str] = pydantic.Field("", **{})
    de_commissioning_responses: typing.Optional[str] = pydantic.Field("", **{})
    aot_status: typing.Optional[str] = pydantic.Field("", **{})
    aot_sap_tt_no: typing.Optional[str] = pydantic.Field("", **{})
    aot_request_type: typing.Optional[str] = pydantic.Field("", **{})
    expiry_alert_created: typing.Optional[bool] = pydantic.Field(False, )
    tibco_expiry_date: typing.Optional[str] = pydantic.Field("", **{})
    zone_code: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DeviceInstallationSchema
        upsert_keys = []
        search_fields = ['sap_tt_no', 'sap_id', 'location', 'status', 'status_decommissioning', 'AOT_status']
        access_key_mapping = ['select_business:bu', 'sap_id']


class DeviceInstallationGetResp(pydantic.BaseModel):
    data: typing.List[DeviceInstallation]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Deviceinstallation_Update_Device_InstallationParams(pydantic.BaseModel):
    sap_tt_no: str
    tt_chassis_no: typing.Optional[str] = pydantic.Field("", **{})
    tt_engine_no: typing.Optional[str] = pydantic.Field("", **{})
    select_business: typing.Optional[str] = pydantic.Field("", **{})
    location: typing.Optional[str] = pydantic.Field("", **{})
    transporter: typing.Optional[str] = pydantic.Field("", **{})
    device: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_installed_by: typing.Optional[str] = pydantic.Field("", **{})
    vehicle_installation_date: typing.Optional[str] = pydantic.Field("", **{})
    device_installation_approved_by: typing.Optional[str] = pydantic.Field("", **{})
    contract_valid_upto: typing.Optional[str] = pydantic.Field("", **{})
    certificate: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Deviceinstallation_Validate_Aot_DetailsParams(pydantic.BaseModel):
    sap_tt_no: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[str] = pydantic.Field("", **{})
    transporter: typing.Optional[str] = pydantic.Field("", **{})
    contract_valid_upto: typing.Optional[str] = pydantic.Field("", **{})
    select_business: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Deviceinstallation_Action_Device_VtsParams(pydantic.BaseModel):
    payload: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Deviceinstallation_Action_DecommissioningParams(pydantic.BaseModel):
    payload: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Deviceinstallation_Action_Decommissioning_RejectedParams(pydantic.BaseModel):
    payload: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class CreateUserCreate(pydantic.BaseModel):
    username: typing.Optional[str] = pydantic.Field("", **{})
    email: typing.Optional[str] = pydantic.Field("", **{})
    password: typing.Optional[str] = pydantic.Field("", **{})
    first_name: typing.Optional[str] = pydantic.Field("", **{})
    last_name: typing.Optional[str] = pydantic.Field("", **{})
    employee_id: typing.Optional[str] = pydantic.Field("", **{})
    sap_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sales_area: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    system_role: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    novex_role: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    bu: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    contact_number: typing.Optional[str] = pydantic.Field("", **{})
    is_ad_user: typing.Optional[bool] = pydantic.Field(False, )
    status: typing.Optional[bool] = pydantic.Field(False, )
    lock_for_auto_sync: typing.Optional[bool] = pydantic.Field(False, )
    file_path: typing.Optional[str] = pydantic.Field("", **{})


class UpdateUserCreate(pydantic.BaseModel):
    username: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sap_id: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    first_name: typing.Optional[str] = pydantic.Field("", **{})
    last_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    region: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    state: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    sales_area: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    novex_role: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    contact_number: typing.Optional[str] = pydantic.Field("", **{})
    lock_for_auto_sync: typing.Optional[bool] = pydantic.Field(False, )


class Usermaster_Create_UserParams(pydantic.BaseModel):
    data: CreateUserCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Usermaster_Update_UserParams(pydantic.BaseModel):
    data: UpdateUserCreate

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Usermaster_Delete_UserParams(pydantic.BaseModel):
    username: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Usermaster_File_UploadParams(pydantic.BaseModel):
    username: str
    bu: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class SystemAuditLogSchema(UrdhvaPostgresBase):
    __tablename__ = 'system_audit_log'
    
    employee_id: Mapped[typing.Optional[str]] = mapped_column("employee_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    role: Mapped[typing.Optional[typing.List[str]]] = mapped_column("role", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    email: Mapped[typing.Optional[str]] = mapped_column("email", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    action: Mapped[typing.Optional[str]] = mapped_column("action", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    action_model: Mapped[typing.Optional[str]] = mapped_column("action_model", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    section: Mapped[typing.Optional[str]] = mapped_column("section", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    raw_data: Mapped[typing.Optional[dict]] = mapped_column("raw_data", JSONB, index=False, nullable=True, default=pydantic.Field(default_factory=dict), primary_key=False, unique=False)


class SystemAuditLogCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'system_audit_log'
    
    employee_id: typing.Optional[str] = pydantic.Field("", **{})
    role: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    email: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    action: typing.Optional[str] = pydantic.Field("", **{})
    action_model: typing.Optional[str] = pydantic.Field("", **{})
    section: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    raw_data: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SystemAuditLogSchema
        upsert_keys = []


class SystemAuditLog(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'system_audit_log'
    
    employee_id: typing.Optional[str] = pydantic.Field("", **{})
    role: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    email: typing.Optional[str] = pydantic.Field("", **{})
    bu: typing.Optional[str] = pydantic.Field("", **{})
    action: typing.Optional[str] = pydantic.Field("", **{})
    action_model: typing.Optional[str] = pydantic.Field("", **{})
    section: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    raw_data: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = SystemAuditLogSchema
        upsert_keys = []


class SystemAuditLogGetResp(pydantic.BaseModel):
    data: typing.List[SystemAuditLog]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class CrisDryOutSyncSchema(UrdhvaPostgresBase):
    __tablename__ = 'cris_dry_out_sync'
    
    run_id: Mapped[str] = mapped_column("run_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    total_dryouts: Mapped[int] = mapped_column("total_dryouts", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ms_hsd_dryouts: Mapped[typing.Optional[int]] = mapped_column("ms_hsd_dryouts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    ms_dryouts: Mapped[typing.Optional[int]] = mapped_column("ms_dryouts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    hsd_dryouts: Mapped[typing.Optional[int]] = mapped_column("hsd_dryouts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    turbo_dryouts: Mapped[typing.Optional[int]] = mapped_column("turbo_dryouts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    e20_dryouts: Mapped[typing.Optional[int]] = mapped_column("e20_dryouts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    power95_dryouts: Mapped[typing.Optional[int]] = mapped_column("power95_dryouts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    power99_dryouts: Mapped[typing.Optional[int]] = mapped_column("power99_dryouts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    power100_dryouts: Mapped[typing.Optional[int]] = mapped_column("power100_dryouts", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    dry_out_in_days: Mapped[str] = mapped_column("dry_out_in_days", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    file_path: Mapped[typing.Optional[str]] = mapped_column("file_path", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class CrisDryOutSyncCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'cris_dry_out_sync'
    
    run_id: str
    total_dryouts: int
    ms_hsd_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    ms_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    hsd_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    turbo_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    e20_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    power95_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    power99_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    power100_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    dry_out_in_days: str
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CrisDryOutSyncSchema
        upsert_keys = []


class CrisDryOutSync(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'cris_dry_out_sync'
    
    run_id: typing.Optional[str] | None = None
    total_dryouts: typing.Optional[int] | None = None
    ms_hsd_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    ms_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    hsd_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    turbo_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    e20_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    power95_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    power99_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    power100_dryouts: typing.Optional[int] = pydantic.Field(0, **{})
    dry_out_in_days: typing.Optional[str] | None = None
    file_path: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = CrisDryOutSyncSchema
        upsert_keys = []


class CrisDryOutSyncGetResp(pydantic.BaseModel):
    data: typing.List[CrisDryOutSync]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


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


class HyperLocalSchema(UrdhvaPostgresBase):
    __tablename__ = 'hyper_local'
    
    report_date: Mapped[datetime.date] = mapped_column("report_date", DATE, index=True, nullable=False, default=None, primary_key=False, unique=False)
    total_reviews: Mapped[int] = mapped_column("total_reviews", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    positive_reviews: Mapped[int] = mapped_column("positive_reviews", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    negative_reviews: Mapped[int] = mapped_column("negative_reviews", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    neutral_reviews: Mapped[int] = mapped_column("neutral_reviews", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone_summary: Mapped[typing.List[typing.Any]] = mapped_column("zone_summary", JSONB, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sentiment_of_reviews: Mapped[typing.List[typing.Any]] = mapped_column("sentiment_of_reviews", JSONB, index=False, nullable=False, default=None, primary_key=False, unique=False)


class HyperLocalCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'hyper_local'
    
    report_date: datetime.date
    total_reviews: int
    positive_reviews: int
    negative_reviews: int
    neutral_reviews: int
    zone_summary: typing.List[HyperLocalZoneSummaryCreate]
    sentiment_of_reviews: typing.List[ReviewsSentimentCreate]

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HyperLocalSchema
        upsert_keys = []


class HyperLocal(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'hyper_local'
    
    report_date: typing.Optional[datetime.date] | None = None
    total_reviews: typing.Optional[int] | None = None
    positive_reviews: typing.Optional[int] | None = None
    negative_reviews: typing.Optional[int] | None = None
    neutral_reviews: typing.Optional[int] | None = None
    zone_summary: typing.Optional[typing.List[HyperLocalZoneSummaryCreate]] | None = None
    sentiment_of_reviews: typing.Optional[typing.List[ReviewsSentimentCreate]] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = HyperLocalSchema
        upsert_keys = []


class HyperLocalGetResp(pydantic.BaseModel):
    data: typing.List[HyperLocal]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class NozzleSalesSchema(UrdhvaPostgresBase):
    __tablename__ = 'nozzle_sales'
    
    transaction_date: Mapped[datetime.datetime] = mapped_column("transaction_date", DateTime(timezone=True), index=True, nullable=False, default=None, primary_key=False, unique=False)
    site_id: Mapped[str] = mapped_column("site_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[typing.Optional[str]] = mapped_column("location_name", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    sales_area: Mapped[typing.Optional[str]] = mapped_column("sales_area", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    product_grp: Mapped[str] = mapped_column("product_grp", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    sales_volume: Mapped[float] = mapped_column("sales_volume", Numeric, index=True, nullable=False, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(transaction_date, sap_id, product_grp, sales_volume, name="nozzle_sales_transaction_date_sap_id_product_grp_sales_volume"),)


class NozzleSalesCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'nozzle_sales'
    
    transaction_date: datetime.datetime
    site_id: str
    sap_id: str
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    product_grp: str
    sales_volume: float

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NozzleSalesSchema
        upsert_keys = ['transaction_date', 'sap_id', 'product_grp', 'sales_volume']


class NozzleSales(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'nozzle_sales'
    
    transaction_date: typing.Optional[datetime.datetime] | None = None
    site_id: typing.Optional[str] | None = None
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    sales_area: typing.Optional[str] = pydantic.Field("", **{})
    product_grp: typing.Optional[str] | None = None
    sales_volume: typing.Optional[float] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NozzleSalesSchema
        upsert_keys = ['transaction_date', 'sap_id', 'product_grp', 'sales_volume']


class NozzleSalesGetResp(pydantic.BaseModel):
    data: typing.List[NozzleSales]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class FaultyHistoryCreate(pydantic.BaseModel):
    user_name: str
    updated_at: str
    status: str
    role: typing.List[str]
    remarks: str


class TasFaultySchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_faulty'
    
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    device_type: Mapped[str] = mapped_column("device_type", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    device_category: Mapped[str] = mapped_column("device_category", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    equipment_name: Mapped[str] = mapped_column("equipment_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    selecting_areas: Mapped[str] = mapped_column("selecting_areas", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_name: Mapped[str] = mapped_column("device_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    alert_id: Mapped[str] = mapped_column("alert_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    vendor_name: Mapped[str] = mapped_column("vendor_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    faulty_history: Mapped[typing.List[typing.Any]] = mapped_column("faulty_history", JSONB, index=False, nullable=False, default=None, primary_key=False, unique=False)
    user_remarks: Mapped[typing.Optional[str]] = mapped_column("user_remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    tas_faulty_unique_id: Mapped[str] = mapped_column("tas_faulty_unique_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    vendor_remarks: Mapped[typing.Optional[str]] = mapped_column("vendor_remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    workflow_instance_id: Mapped[typing.Optional[str]] = mapped_column("workflow_instance_id", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    faulty_date: Mapped[datetime.datetime] = mapped_column("faulty_date", DateTime(timezone=True), index=False, nullable=False, default=None, primary_key=False, unique=False)
    certificate: Mapped[typing.Optional[str]] = mapped_column("certificate", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    status: Mapped[str] = mapped_column("status", String, index=True, nullable=False, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(tas_faulty_unique_id, name="tas_faulty_tas_faulty_unique_id"),)


class TasFaultyCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_faulty'
    
    sap_id: str
    location_name: str
    device_type: str
    device_category: str
    zone: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: str
    selecting_areas: str
    device_name: str
    alert_id: str
    vendor_name: str
    faulty_history: typing.List[FaultyHistoryCreate]
    user_remarks: typing.Optional[str] = pydantic.Field("", **{})
    tas_faulty_unique_id: str
    vendor_remarks: typing.Optional[str] = pydantic.Field("", **{})
    workflow_instance_id: typing.Optional[str] = pydantic.Field("", **{})
    faulty_date: datetime.datetime
    certificate: typing.Optional[str] = pydantic.Field("", **{})
    status: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasFaultySchema
        upsert_keys = ['tas_faulty_unique_id']


class TasFaulty(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_faulty'
    
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    device_type: typing.Optional[str] | None = None
    device_category: typing.Optional[str] | None = None
    zone: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: typing.Optional[str] | None = None
    selecting_areas: typing.Optional[str] | None = None
    device_name: typing.Optional[str] | None = None
    alert_id: typing.Optional[str] | None = None
    vendor_name: typing.Optional[str] | None = None
    faulty_history: typing.Optional[typing.List[FaultyHistoryCreate]] | None = None
    user_remarks: typing.Optional[str] = pydantic.Field("", **{})
    tas_faulty_unique_id: typing.Optional[str] | None = None
    vendor_remarks: typing.Optional[str] = pydantic.Field("", **{})
    workflow_instance_id: typing.Optional[str] = pydantic.Field("", **{})
    faulty_date: typing.Optional[datetime.datetime] | None = None
    certificate: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasFaultySchema
        upsert_keys = ['tas_faulty_unique_id']


class TasFaultyGetResp(pydantic.BaseModel):
    data: typing.List[TasFaulty]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Tasfaulty_Tas_Faulty_CreateParams(pydantic.BaseModel):
    sap_id: str
    location_name: str
    device_type: str
    device_category: str
    zone: typing.Optional[str] = pydantic.Field("", **{})
    equipment_name: str
    selecting_areas: str
    device_name: str
    alert_id: str
    vendor_name: str
    user_remarks: str
    faulty_date: datetime.datetime
    certificate: typing.Optional[str] = pydantic.Field("", **{})
    status: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tasfaulty_Update_FaultyParams(pydantic.BaseModel):
    transaction_id: str
    vendor_remarks: typing.Optional[str] = pydantic.Field("", **{})
    user_remarks: typing.Optional[str] = pydantic.Field("", **{})
    resolved: bool

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tasfaulty_Get_InfoParams(pydantic.BaseModel):
    sap_id: str
    equipment_name: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class TasSealDateFormSchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_seal_date_form'
    
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    bcu_number: Mapped[typing.Optional[str]] = mapped_column("bcu_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    mfm_number: Mapped[typing.Optional[str]] = mapped_column("mfm_number", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    device_type: Mapped[str] = mapped_column("device_type", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    remarks: Mapped[typing.Optional[str]] = mapped_column("remarks", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    actual_w_and_m_seal_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("actual_w_and_m_seal_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    next_due_date: Mapped[typing.Optional[datetime.datetime]] = mapped_column("next_due_date", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    certificate: Mapped[typing.List[str]] = mapped_column("certificate", ARRAY(String), index=False, nullable=False, default=None, primary_key=False, unique=False)
    status: Mapped[typing.Optional[str]] = mapped_column("status", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    present_k_factor: Mapped[typing.Optional[str]] = mapped_column("present_k_factor", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    past_k_factor: Mapped[typing.Optional[str]] = mapped_column("past_k_factor", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class TasSealDateFormCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_seal_date_form'
    
    sap_id: str
    location_name: str
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    mfm_number: typing.Optional[str] = pydantic.Field("", **{})
    device_type: str
    zone: str
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    actual_w_and_m_seal_date: typing.Optional[datetime.datetime] | None = None
    next_due_date: typing.Optional[datetime.datetime] | None = None
    certificate: typing.List[str]
    status: typing.Optional[str] = pydantic.Field("", **{})
    present_k_factor: typing.Optional[str] = pydantic.Field("", **{})
    past_k_factor: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasSealDateFormSchema
        upsert_keys = []
        search_fields = ['location_name', 'sap_id', 'zone', 'device_type']


class TasSealDateForm(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_seal_date_form'
    
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    mfm_number: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    actual_w_and_m_seal_date: typing.Optional[datetime.datetime] | None = None
    next_due_date: typing.Optional[datetime.datetime] | None = None
    certificate: typing.Optional[typing.List[str]] | None = None
    status: typing.Optional[str] = pydantic.Field("", **{})
    present_k_factor: typing.Optional[str] = pydantic.Field("", **{})
    past_k_factor: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasSealDateFormSchema
        upsert_keys = []
        search_fields = ['location_name', 'sap_id', 'zone', 'device_type']


class TasSealDateFormGetResp(pydantic.BaseModel):
    data: typing.List[TasSealDateForm]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Tassealdateform_Tas_Seal_Date_Form_CreateParams(pydantic.BaseModel):
    sap_id: str
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    bcu_number: typing.Optional[str] = pydantic.Field("", **{})
    mfm_number: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    remarks: typing.Optional[str] = pydantic.Field("", **{})
    actual_w_and_m_seal_date: typing.Optional[datetime.datetime] | None = None
    next_due_date: typing.Optional[datetime.datetime] | None = None
    certificate: typing.List[str]
    status: typing.Optional[str] = pydantic.Field("", **{})
    present_k_factor: typing.Optional[str] = pydantic.Field("", **{})
    past_k_factor: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Tassealdateform_Get_Filtered_Mfm_DataParams(pydantic.BaseModel):
    sap_id: str
    location_name: typing.Optional[str] = pydantic.Field("", **{})
    device_type: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class TasFireEngineTestSchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_fire_engine_test'
    
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    device_name: Mapped[str] = mapped_column("device_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    fire_engine_on_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("fire_engine_on_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    fire_engine_off_datetime: Mapped[typing.Optional[datetime.datetime]] = mapped_column("fire_engine_off_datetime", DateTime(timezone=True), index=False, nullable=True, default=None, primary_key=False, unique=False)
    total_run_time: Mapped[typing.Optional[str]] = mapped_column("total_run_time", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class TasFireEngineTestCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_fire_engine_test'
    
    sap_id: str
    device_name: str
    location_name: str
    zone: str
    fire_engine_on_datetime: typing.Optional[datetime.datetime] | None = None
    fire_engine_off_datetime: typing.Optional[datetime.datetime] | None = None
    total_run_time: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasFireEngineTestSchema
        upsert_keys = []


class TasFireEngineTest(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_fire_engine_test'
    
    sap_id: typing.Optional[str] | None = None
    device_name: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    fire_engine_on_datetime: typing.Optional[datetime.datetime] | None = None
    fire_engine_off_datetime: typing.Optional[datetime.datetime] | None = None
    total_run_time: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasFireEngineTestSchema
        upsert_keys = []


class TasFireEngineTestGetResp(pydantic.BaseModel):
    data: typing.List[TasFireEngineTest]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class TerminalWiseDryoutCountsSchema(UrdhvaPostgresBase):
    __tablename__ = 'terminal_wise_dryout_counts'
    
    run_id: Mapped[str] = mapped_column("run_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    terminal_id: Mapped[typing.Optional[str]] = mapped_column("terminal_id", String, index=True, nullable=True, default="", primary_key=False, unique=False)
    terminal_name: Mapped[typing.Optional[str]] = mapped_column("terminal_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    outlets: Mapped[typing.Optional[typing.List[str]]] = mapped_column("outlets", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    dryout_ros: Mapped[typing.Optional[int]] = mapped_column("dryout_ros", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    outlets_with_valid_indents: Mapped[typing.Optional[int]] = mapped_column("outlets_with_valid_indents", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    valid_pending_indents_last_3days: Mapped[typing.Optional[int]] = mapped_column("valid_pending_indents_last_3days", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    pending_indents_last_3days: Mapped[typing.Optional[int]] = mapped_column("pending_indents_last_3days", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(run_id, zone, terminal_id, region, name="terminal_wise_dryout_counts_run_id_zone_terminal_id_region"),)


class TerminalWiseDryoutCountsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'terminal_wise_dryout_counts'
    
    run_id: str
    zone: typing.Optional[str] = pydantic.Field("", **{})
    terminal_id: typing.Optional[str] = pydantic.Field("", **{})
    terminal_name: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    outlets: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    dryout_ros: typing.Optional[int] = pydantic.Field(0, **{})
    outlets_with_valid_indents: typing.Optional[int] = pydantic.Field(0, **{})
    valid_pending_indents_last_3days: typing.Optional[int] = pydantic.Field(0, **{})
    pending_indents_last_3days: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TerminalWiseDryoutCountsSchema
        upsert_keys = ['run_id', 'zone', 'terminal_id', 'region']


class TerminalWiseDryoutCounts(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'terminal_wise_dryout_counts'
    
    run_id: typing.Optional[str] | None = None
    zone: typing.Optional[str] = pydantic.Field("", **{})
    terminal_id: typing.Optional[str] = pydantic.Field("", **{})
    terminal_name: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    outlets: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    dryout_ros: typing.Optional[int] = pydantic.Field(0, **{})
    outlets_with_valid_indents: typing.Optional[int] = pydantic.Field(0, **{})
    valid_pending_indents_last_3days: typing.Optional[int] = pydantic.Field(0, **{})
    pending_indents_last_3days: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TerminalWiseDryoutCountsSchema
        upsert_keys = ['run_id', 'zone', 'terminal_id', 'region']


class TerminalWiseDryoutCountsGetResp(pydantic.BaseModel):
    data: typing.List[TerminalWiseDryoutCounts]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class NonReportingDevicesSchema(UrdhvaPostgresBase):
    __tablename__ = 'non_reporting_devices'
    
    truck_regno: Mapped[str] = mapped_column("truck_regno", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    last_check_date: Mapped[datetime.date] = mapped_column("last_check_date", DATE, index=False, nullable=False, default=None, primary_key=False, unique=False)
    last_check_time: Mapped[str] = mapped_column("last_check_time", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    latitude: Mapped[typing.Optional[str]] = mapped_column("latitude", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    longitude: Mapped[typing.Optional[str]] = mapped_column("longitude", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    location: Mapped[str] = mapped_column("location", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    device_working: Mapped[str] = mapped_column("device_working", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    completed_trip: Mapped[str] = mapped_column("completed_trip", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    completed_trip_auto_dc: Mapped[str] = mapped_column("completed_trip_auto_dc", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    card_date: Mapped[datetime.datetime] = mapped_column("card_date", DateTime(timezone=False), index=False, nullable=False, default=None, primary_key=False, unique=False)
    card_time: Mapped[str] = mapped_column("card_time", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    card_datetime: Mapped[datetime.datetime] = mapped_column("card_datetime", DateTime(timezone=False), index=False, nullable=False, default=None, primary_key=False, unique=False)
    reader_id: Mapped[str] = mapped_column("reader_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    loaded_on: Mapped[datetime.datetime] = mapped_column("loaded_on", DateTime(timezone=False), index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(truck_regno, last_check_date, last_check_time, location, name="non_reporting_devices_truck_lastc_lastc_locat"),)


class NonReportingDevicesCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'non_reporting_devices'
    
    truck_regno: str
    last_check_date: datetime.date
    last_check_time: str
    latitude: typing.Optional[str] = pydantic.Field("", **{})
    longitude: typing.Optional[str] = pydantic.Field("", **{})
    location: str
    location_name: str
    device_working: str
    completed_trip: str
    completed_trip_auto_dc: str
    card_date: datetime.datetime
    card_time: str
    card_datetime: datetime.datetime
    reader_id: str
    loaded_on: datetime.datetime
    bu: str
    zone: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NonReportingDevicesSchema
        upsert_keys = ['truck_regno', 'last_check_date', 'last_check_time', 'location']


class NonReportingDevices(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'non_reporting_devices'
    
    truck_regno: typing.Optional[str] | None = None
    last_check_date: typing.Optional[datetime.date] | None = None
    last_check_time: typing.Optional[str] | None = None
    latitude: typing.Optional[str] = pydantic.Field("", **{})
    longitude: typing.Optional[str] = pydantic.Field("", **{})
    location: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    device_working: typing.Optional[str] | None = None
    completed_trip: typing.Optional[str] | None = None
    completed_trip_auto_dc: typing.Optional[str] | None = None
    card_date: typing.Optional[datetime.datetime] | None = None
    card_time: typing.Optional[str] | None = None
    card_datetime: typing.Optional[datetime.datetime] | None = None
    reader_id: typing.Optional[str] | None = None
    loaded_on: typing.Optional[datetime.datetime] | None = None
    bu: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NonReportingDevicesSchema
        upsert_keys = ['truck_regno', 'last_check_date', 'last_check_time', 'location']


class NonReportingDevicesGetResp(pydantic.BaseModel):
    data: typing.List[NonReportingDevices]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class TasHelpDeskVendorMailsSchema(UrdhvaPostgresBase):
    __tablename__ = 'tas_help_desk_vendor_mails'
    
    sap_id: Mapped[str] = mapped_column("sap_id", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    zone: Mapped[str] = mapped_column("zone", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    vendor_name: Mapped[str] = mapped_column("vendor_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    level1: Mapped[str] = mapped_column("level1", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    level2: Mapped[str] = mapped_column("level2", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    level3: Mapped[str] = mapped_column("level3", String, index=False, nullable=False, default=None, primary_key=False, unique=False)


class TasHelpDeskVendorMailsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tas_help_desk_vendor_mails'
    
    sap_id: str
    location_name: str
    zone: str
    vendor_name: str
    level1: str
    level2: str
    level3: str

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasHelpDeskVendorMailsSchema
        upsert_keys = []


class TasHelpDeskVendorMails(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tas_help_desk_vendor_mails'
    
    sap_id: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    zone: typing.Optional[str] | None = None
    vendor_name: typing.Optional[str] | None = None
    level1: typing.Optional[str] | None = None
    level2: typing.Optional[str] | None = None
    level3: typing.Optional[str] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TasHelpDeskVendorMailsSchema
        upsert_keys = []


class TasHelpDeskVendorMailsGetResp(pydantic.BaseModel):
    data: typing.List[TasHelpDeskVendorMails]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class LpgOperationsInsightsSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_operations_insights'


class LpgOperationsInsightsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_operations_insights'

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgOperationsInsightsSchema
        upsert_keys = []


class LpgOperationsInsights(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_operations_insights'

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgOperationsInsightsSchema
        upsert_keys = []


class LpgOperationsInsightsGetResp(pydantic.BaseModel):
    data: typing.List[LpgOperationsInsights]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpgoperationsinsights_Lpg_Plants_InsightsParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    metric_type: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgoperationsinsights_Lpg_Car_DownloadParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    drill_state: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class NaturalGasGVConnectionsSchema(UrdhvaPostgresBase):
    __tablename__ = 'natural_gas_gv_connections'
    
    gv_name: Mapped[str] = mapped_column("gv_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    conn_date: Mapped[datetime.date] = mapped_column("conn_date", DATE, index=True, nullable=False, default=None, primary_key=False, unique=False)
    ga_name: Mapped[str] = mapped_column("ga_name", String, index=True, nullable=False, default=None, primary_key=False, unique=False)
    achieved_count: Mapped[int] = mapped_column("achieved_count", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    day_wise_target: Mapped[typing.Optional[int]] = mapped_column("day_wise_target", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    backlog_lmc: Mapped[typing.Optional[int]] = mapped_column("backlog_lmc", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    backlog_ngc: Mapped[typing.Optional[int]] = mapped_column("backlog_ngc", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)

    __table_args__ = (UniqueConstraint(gv_name, conn_date, ga_name, name="natural_gas_gv_connections_gv_name_conn_date_ga_name"),)


class NaturalGasGVConnectionsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'natural_gas_gv_connections'
    
    gv_name: str
    conn_date: datetime.date
    ga_name: str
    achieved_count: int
    day_wise_target: typing.Optional[int] = pydantic.Field(0, **{})
    backlog_lmc: typing.Optional[int] = pydantic.Field(0, **{})
    backlog_ngc: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NaturalGasGVConnectionsSchema
        upsert_keys = ['gv_name', 'conn_date', 'ga_name']


class NaturalGasGVConnections(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'natural_gas_gv_connections'
    
    gv_name: typing.Optional[str] | None = None
    conn_date: typing.Optional[datetime.date] | None = None
    ga_name: typing.Optional[str] | None = None
    achieved_count: typing.Optional[int] | None = None
    day_wise_target: typing.Optional[int] = pydantic.Field(0, **{})
    backlog_lmc: typing.Optional[int] = pydantic.Field(0, **{})
    backlog_ngc: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = NaturalGasGVConnectionsSchema
        upsert_keys = ['gv_name', 'conn_date', 'ga_name']


class NaturalGasGVConnectionsGetResp(pydantic.BaseModel):
    data: typing.List[NaturalGasGVConnections]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Naturalgasgvconnections_Upload_Connection_DataParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Naturalgasgvconnections_Confirm_Data_SyncParams(pydantic.BaseModel):
    ack_id: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class SqlAggregationSpecCreate(pydantic.BaseModel):
    output_alias: str
    aggregate_fn: str
    column: str


class SqlOrderBySpecCreate(pydantic.BaseModel):
    column: str
    direction: str


class Tableanalytics_Generate_Data_AggregationsParams(pydantic.BaseModel):
    table: str
    base_table_alias: typing.Optional[str] = pydantic.Field("", **{})
    joins: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    group_by: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    filters: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )
    date_column: typing.Optional[str] = pydantic.Field("", **{})
    date_from: typing.Optional[str] = pydantic.Field("", **{})
    date_to: typing.Optional[str] = pydantic.Field("", **{})
    date_after_now_interval: typing.Optional[str] = pydantic.Field("", **{})
    date_before_now_interval: typing.Optional[str] = pydantic.Field("", **{})
    aggregations: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    detail_fields: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    order_by: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    skip: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class TankDiaDetailsSchema(UrdhvaPostgresBase):
    __tablename__ = 'tank_dia_details'
    
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    state: Mapped[str] = mapped_column("state", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location_name: Mapped[str] = mapped_column("location_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location_sap_code: Mapped[str] = mapped_column("location_sap_code", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    tank_no: Mapped[str] = mapped_column("tank_no", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    product: Mapped[str] = mapped_column("product", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    type: Mapped[str] = mapped_column("type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    gross_capacity_kl: Mapped[float] = mapped_column("gross_capacity_kl", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    peso_capacity_kl: Mapped[float] = mapped_column("peso_capacity_kl", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    pumpable_volume_kl: Mapped[float] = mapped_column("pumpable_volume_kl", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    dead_stock_kl: Mapped[float] = mapped_column("dead_stock_kl", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    diameter: Mapped[float] = mapped_column("diameter", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    height: Mapped[float] = mapped_column("height", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    location_specific_limitations: Mapped[str] = mapped_column("location_specific_limitations", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    kl_per_mm: Mapped[float] = mapped_column("kl_per_mm", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)


class TankDiaDetailsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'tank_dia_details'
    
    zone: str
    state: str
    location_name: str
    location_sap_code: str
    tank_no: str
    product: str
    type: str
    gross_capacity_kl: float
    peso_capacity_kl: float
    pumpable_volume_kl: float
    dead_stock_kl: float
    diameter: float
    height: float
    location_specific_limitations: str
    kl_per_mm: float

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TankDiaDetailsSchema
        upsert_keys = []


class TankDiaDetails(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'tank_dia_details'
    
    zone: typing.Optional[str] | None = None
    state: typing.Optional[str] | None = None
    location_name: typing.Optional[str] | None = None
    location_sap_code: typing.Optional[str] | None = None
    tank_no: typing.Optional[str] | None = None
    product: typing.Optional[str] | None = None
    type: typing.Optional[str] | None = None
    gross_capacity_kl: typing.Optional[float] | None = None
    peso_capacity_kl: typing.Optional[float] | None = None
    pumpable_volume_kl: typing.Optional[float] | None = None
    dead_stock_kl: typing.Optional[float] | None = None
    diameter: typing.Optional[float] | None = None
    height: typing.Optional[float] | None = None
    location_specific_limitations: typing.Optional[str] | None = None
    kl_per_mm: typing.Optional[float] | None = None

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = TankDiaDetailsSchema
        upsert_keys = []


class TankDiaDetailsGetResp(pydantic.BaseModel):
    data: typing.List[TankDiaDetails]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Tankdetails_Get_Tank_DetailsParams(pydantic.BaseModel):
    filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    action: str
    drill_state: typing.Optional[str] = pydantic.Field("", **{})
    cross_filters: typing.Optional[typing.List[WidgetFiltersCreate]] | None = None
    limit: typing.Optional[int] = pydantic.Field(0, **{})
    payload: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class DailyEmailNotificationUsersSchema(UrdhvaPostgresBase):
    __tablename__ = 'daily_email_notification_users'
    
    email_type: Mapped[str] = mapped_column("email_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[str] = mapped_column("bu", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    subject: Mapped[typing.Optional[str]] = mapped_column("subject", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    description: Mapped[typing.Optional[str]] = mapped_column("description", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    enabled: Mapped[typing.Optional[bool]] = mapped_column("enabled", Boolean, index=False, nullable=True, default=True, primary_key=False, unique=False)
    audience: Mapped[typing.Optional[str]] = mapped_column("audience", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    to_recipients: Mapped[typing.Optional[typing.List[str]]] = mapped_column("to_recipients", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    cc_recipients: Mapped[typing.Optional[typing.List[str]]] = mapped_column("cc_recipients", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    bcc_recipients: Mapped[typing.Optional[typing.List[str]]] = mapped_column("bcc_recipients", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)


class DailyEmailNotificationUsersCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'daily_email_notification_users'
    
    email_type: str
    bu: str
    name: typing.Optional[str] = pydantic.Field("", **{})
    subject: typing.Optional[str] = pydantic.Field("", **{})
    description: typing.Optional[str] = pydantic.Field("", **{})
    enabled: typing.Optional[bool] = pydantic.Field(True, )
    audience: typing.Optional[str] = pydantic.Field("", **{})
    to_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    cc_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    bcc_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DailyEmailNotificationUsersSchema
        upsert_keys = []


class DailyEmailNotificationUsers(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'daily_email_notification_users'
    
    email_type: typing.Optional[str] | None = None
    bu: typing.Optional[str] | None = None
    name: typing.Optional[str] = pydantic.Field("", **{})
    subject: typing.Optional[str] = pydantic.Field("", **{})
    description: typing.Optional[str] = pydantic.Field("", **{})
    enabled: typing.Optional[bool] = pydantic.Field(True, )
    audience: typing.Optional[str] = pydantic.Field("", **{})
    to_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    cc_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    bcc_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = DailyEmailNotificationUsersSchema
        upsert_keys = []


class DailyEmailNotificationUsersGetResp(pydantic.BaseModel):
    data: typing.List[DailyEmailNotificationUsers]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Dailyemailnotificationusers_Add_RecipientsParams(pydantic.BaseModel):
    email_type: str
    bu: str
    name: str
    subject: typing.Optional[str] = pydantic.Field("", **{})
    description: typing.Optional[str] = pydantic.Field("", **{})
    enabled: typing.Optional[bool] = pydantic.Field(False, )
    audience: typing.Optional[str] = pydantic.Field("", **{})
    to_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    cc_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    bcc_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    action: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Dailyemailnotificationusers_Get_Email_AudienceParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class MasterDailyReportSchema(UrdhvaPostgresBase):
    __tablename__ = 'master_daily_report'
    
    zone: Mapped[str] = mapped_column("zone", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    bu: Mapped[typing.Optional[str]] = mapped_column("bu", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    factor_type: Mapped[str] = mapped_column("factor_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    product_grp: Mapped[typing.Optional[str]] = mapped_column("product_grp", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    value: Mapped[float] = mapped_column("value", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    year: Mapped[typing.Optional[int]] = mapped_column("year", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    month: Mapped[typing.Optional[int]] = mapped_column("month", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    date: Mapped[typing.Optional[str]] = mapped_column("date", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class MasterDailyReportCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'master_daily_report'
    
    zone: str
    bu: typing.Optional[str] = pydantic.Field("", **{})
    factor_type: str
    product_grp: typing.Optional[str] = pydantic.Field("", **{})
    value: float
    year: typing.Optional[int] = pydantic.Field(0, **{})
    month: typing.Optional[int] = pydantic.Field(0, **{})
    date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = MasterDailyReportSchema
        upsert_keys = []


class MasterDailyReport(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'master_daily_report'
    
    zone: typing.Optional[str] | None = None
    bu: typing.Optional[str] = pydantic.Field("", **{})
    factor_type: typing.Optional[str] | None = None
    product_grp: typing.Optional[str] = pydantic.Field("", **{})
    value: typing.Optional[float] | None = None
    year: typing.Optional[int] = pydantic.Field(0, **{})
    month: typing.Optional[int] = pydantic.Field(0, **{})
    date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = MasterDailyReportSchema
        upsert_keys = []


class MasterDailyReportGetResp(pydantic.BaseModel):
    data: typing.List[MasterDailyReport]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Masterdailyreport_Insert_DataParams(pydantic.BaseModel):
    zone: str
    bu: typing.Optional[str] = pydantic.Field("", **{})
    factor_type: str
    product_grp: typing.Optional[str] = pydantic.Field("", **{})
    value: float
    year: typing.Optional[int] = pydantic.Field(0, **{})
    month: typing.Optional[int] = pydantic.Field(0, **{})
    date: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class PrimarySalesAOPTargetSchema(UrdhvaPostgresBase):
    __tablename__ = 'primary_sales_aop_target'
    
    year: Mapped[int] = mapped_column("year", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    month: Mapped[int] = mapped_column("month", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    target_aop_tmt: Mapped[float] = mapped_column("target_aop_tmt", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ms_target_tmt: Mapped[float] = mapped_column("ms_target_tmt", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    hsd_target_tmt: Mapped[float] = mapped_column("hsd_target_tmt", Numeric, index=False, nullable=False, default=None, primary_key=False, unique=False)
    annual_planned_tmt: Mapped[typing.Optional[float]] = mapped_column("annual_planned_tmt", Numeric, index=False, nullable=True, default=0.0, primary_key=False, unique=False)


class PrimarySalesAOPTargetCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'primary_sales_aop_target'
    
    year: int
    month: int
    target_aop_tmt: float
    ms_target_tmt: float
    hsd_target_tmt: float
    annual_planned_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PrimarySalesAOPTargetSchema
        upsert_keys = []


class PrimarySalesAOPTarget(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'primary_sales_aop_target'
    
    year: typing.Optional[int] | None = None
    month: typing.Optional[int] | None = None
    target_aop_tmt: typing.Optional[float] | None = None
    ms_target_tmt: typing.Optional[float] | None = None
    hsd_target_tmt: typing.Optional[float] | None = None
    annual_planned_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = PrimarySalesAOPTargetSchema
        upsert_keys = []


class PrimarySalesAOPTargetGetResp(pydantic.BaseModel):
    data: typing.List[PrimarySalesAOPTarget]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Primarysalesaoptarget_Insert_DataParams(pydantic.BaseModel):
    year: int
    month: int
    target_aop_tmt: float
    ms_target_tmt: float
    hsd_target_tmt: float
    annual_planned_tmt: typing.Optional[float] = pydantic.Field(0.0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class ShiftHrsCreate(pydantic.BaseModel):
    shift_name: str
    start_time: str
    stop_time: str
    description: typing.Optional[str] = pydantic.Field("", **{})


class BreakHrsCreate(pydantic.BaseModel):
    shift_name: str
    start_time: str
    stop_time: str
    description: typing.Optional[str] = pydantic.Field("", **{})


class LpgCarousalsSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_carousals'
    
    sap_id: Mapped[int] = mapped_column("sap_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    carousal_id: Mapped[int] = mapped_column("carousal_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    heads: Mapped[int] = mapped_column("heads", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    rated_productivity: Mapped[int] = mapped_column("rated_productivity", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    production_hrs: Mapped[typing.List[typing.Any]] = mapped_column("production_hrs", JSONB, index=False, nullable=False, default=None, primary_key=False, unique=False)
    breaks: Mapped[typing.List[typing.Any]] = mapped_column("breaks", JSONB, index=False, nullable=False, default=None, primary_key=False, unique=False)
    min_productivity: Mapped[typing.Optional[int]] = mapped_column("min_productivity", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    max_productivity: Mapped[typing.Optional[int]] = mapped_column("max_productivity", Integer, index=False, nullable=True, default=0, primary_key=False, unique=False)
    skip_zero_performance_score: Mapped[typing.Optional[bool]] = mapped_column("skip_zero_performance_score", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)


class LpgCarousalsCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_carousals'
    
    sap_id: int
    carousal_id: int
    heads: int
    rated_productivity: int
    production_hrs: typing.List[ShiftHrsCreate]
    breaks: typing.List[BreakHrsCreate]
    min_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    max_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    skip_zero_performance_score: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgCarousalsSchema
        upsert_keys = []


class LpgCarousals(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_carousals'
    
    sap_id: typing.Optional[int] | None = None
    carousal_id: typing.Optional[int] | None = None
    heads: typing.Optional[int] | None = None
    rated_productivity: typing.Optional[int] | None = None
    production_hrs: typing.Optional[typing.List[ShiftHrsCreate]] | None = None
    breaks: typing.Optional[typing.List[BreakHrsCreate]] | None = None
    min_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    max_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    skip_zero_performance_score: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgCarousalsSchema
        upsert_keys = []


class LpgCarousalsGetResp(pydantic.BaseModel):
    data: typing.List[LpgCarousals]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpgcarousals_Create_CarousalParams(pydantic.BaseModel):
    sap_id: int
    carousal_id: int
    heads: int
    rated_productivity: int
    production_hrs: typing.List[ShiftHrsCreate]
    breaks: typing.List[BreakHrsCreate]
    min_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    max_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    skip_zero_performance_score: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgcarousals_Update_CarousalParams(pydantic.BaseModel):
    sap_id: int
    carousal_id: int
    heads: typing.Optional[int] = pydantic.Field(0, **{})
    rated_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    production_hrs: typing.Optional[typing.List[ShiftHrsCreate]] | None = None
    breaks: typing.Optional[typing.List[BreakHrsCreate]] | None = None
    min_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    max_productivity: typing.Optional[int] = pydantic.Field(0, **{})
    skip_zero_performance_score: typing.Optional[bool] = pydantic.Field(False, )

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgcarousals_Delete_CarousalParams(pydantic.BaseModel):
    sap_id: int
    carousal_id: int

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class LpgPlantsMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'lpg_plants_master'
    
    sap_id: Mapped[int] = mapped_column("sap_id", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    ip_address: Mapped[str] = mapped_column("ip_address", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    port_no: Mapped[int] = mapped_column("port_no", Integer, index=False, nullable=False, default=None, primary_key=False, unique=False)
    username: Mapped[str] = mapped_column("username", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    password: Mapped[urdhva_base.types.Secret] = mapped_column("password", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    db_name: Mapped[str] = mapped_column("db_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    db_type: Mapped[str] = mapped_column("db_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    name: Mapped[typing.Optional[str]] = mapped_column("name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    plant_name: Mapped[typing.Optional[str]] = mapped_column("plant_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    region: Mapped[typing.Optional[str]] = mapped_column("region", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    zone: Mapped[typing.Optional[str]] = mapped_column("zone", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    mail_recipients: Mapped[typing.Optional[typing.List[str]]] = mapped_column("mail_recipients", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    day_end_cutoff: Mapped[typing.Optional[str]] = mapped_column("day_end_cutoff", String, index=False, nullable=True, default="", primary_key=False, unique=False)


class LpgPlantsMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'lpg_plants_master'
    
    sap_id: int
    ip_address: str
    port_no: int
    username: str
    password: urdhva_base.types.Secret
    db_name: str
    db_type: str
    name: typing.Optional[str] = pydantic.Field("", **{})
    plant_name: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    mail_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    day_end_cutoff: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgPlantsMasterSchema
        upsert_keys = []


class LpgPlantsMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'lpg_plants_master'
    
    sap_id: typing.Optional[int] | None = None
    ip_address: typing.Optional[str] | None = None
    port_no: typing.Optional[int] | None = None
    username: typing.Optional[str] | None = None
    password: typing.Optional[urdhva_base.types.Secret] | None = None
    db_name: typing.Optional[str] | None = None
    db_type: typing.Optional[str] | None = None
    name: typing.Optional[str] = pydantic.Field("", **{})
    plant_name: typing.Optional[str] = pydantic.Field("", **{})
    region: typing.Optional[str] = pydantic.Field("", **{})
    zone: typing.Optional[str] = pydantic.Field("", **{})
    mail_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    day_end_cutoff: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        collection_name = 'data_flow'
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields
        schema_class = LpgPlantsMasterSchema
        upsert_keys = []


class LpgPlantsMasterGetResp(pydantic.BaseModel):
    data: typing.List[LpgPlantsMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Lpgplantsmaster_Create_LocationParams(pydantic.BaseModel):
    sap_id: int
    ip_address: str
    port_no: int
    username: str
    password: urdhva_base.types.Secret
    db_name: str
    db_type: str
    name: typing.Optional[str] = pydantic.Field("", **{})
    mail_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    day_end_cutoff: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgplantsmaster_Update_LocationParams(pydantic.BaseModel):
    sap_id: int
    ip_address: typing.Optional[str] = pydantic.Field("", **{})
    port_no: typing.Optional[int] = pydantic.Field(0, **{})
    username: typing.Optional[str] = pydantic.Field("", **{})
    password: typing.Optional[urdhva_base.types.Secret] | None = None
    db_name: typing.Optional[str] = pydantic.Field("", **{})
    db_type: typing.Optional[str] = pydantic.Field("", **{})
    name: typing.Optional[str] = pydantic.Field("", **{})
    mail_recipients: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    day_end_cutoff: typing.Optional[str] = pydantic.Field("", **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgplantsmaster_Delete_LocationParams(pydantic.BaseModel):
    sap_id: int

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgplantsmaster_Plant_DetailsParams(pydantic.BaseModel):
    sap_id: typing.Optional[int] = pydantic.Field(0, **{})

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgplantsmaster_Test_ConnectionParams(pydantic.BaseModel):
    sap_id: typing.Optional[int] = pydantic.Field(0, **{})
    ip_address: str
    port_no: int
    username: str
    password: typing.Optional[urdhva_base.types.Secret] | None = None
    db_name: str
    db_type: str

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields


class Lpgplantsmaster_Download_Plant_And_Carousal_DetailsParams(pydantic.BaseModel):
    pass

    class Config:
        if urdhva_base.settings.disable_api_extra_inputs:
            extra = "forbid"  # Disallow extra fields