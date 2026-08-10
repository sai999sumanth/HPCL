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
import ceg_role_master_enum

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import *
from sqlalchemy.orm import *
from urdhva_base.postgresmodel import UrdhvaPostgresBase


class ui_interface_dataCreate(pydantic.BaseModel):
    ui_component: typing.Optional[str] = pydantic.Field("", **{})
    is_component_display: typing.Optional[bool] = pydantic.Field(False, )


class api_task_dataCreate(pydantic.BaseModel):
    api_display_name: typing.Optional[str] = pydantic.Field("", **{})
    api_name: typing.Optional[str] = pydantic.Field("", **{})


class DNCRoleMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'dnc_role_master'
    
    role_id: Mapped[str] = mapped_column("role_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    role_name: Mapped[str] = mapped_column("role_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    source_system: Mapped[typing.List[str]] = mapped_column("source_system", ARRAY(String), index=False, nullable=False, default=None, primary_key=False, unique=False)
    parent_ui_interface: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("parent_ui_interface", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    child_ui_interface: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("child_ui_interface", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    tasks: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("tasks", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    conditions: Mapped[typing.Optional[dict]] = mapped_column("conditions", JSONB, index=False, nullable=True, default=pydantic.Field(default_factory=dict), primary_key=False, unique=False)


class DNCRoleMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'dnc_role_master'
    
    role_id: str
    role_name: str
    source_system: typing.List[str]
    parent_ui_interface: typing.Optional[typing.List[ui_interface_dataCreate]] | None = None
    child_ui_interface: typing.Optional[typing.List[ui_interface_dataCreate]] | None = None
    tasks: typing.Optional[typing.List[api_task_dataCreate]] | None = None
    conditions: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        collection_name = 'data_flow'
        schema_class = DNCRoleMasterSchema
        upsert_keys = []


class DNCRoleMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'dnc_role_master'
    
    role_id: typing.Optional[str] | None = None
    role_name: typing.Optional[str] | None = None
    source_system: typing.Optional[typing.List[str]] | None = None
    parent_ui_interface: typing.Optional[typing.List[ui_interface_dataCreate]] | None = None
    child_ui_interface: typing.Optional[typing.List[ui_interface_dataCreate]] | None = None
    tasks: typing.Optional[typing.List[api_task_dataCreate]] | None = None
    conditions: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        collection_name = 'data_flow'
        schema_class = DNCRoleMasterSchema
        upsert_keys = []


class DNCRoleMasterGetResp(pydantic.BaseModel):
    data: typing.List[DNCRoleMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Dncrolemaster_Get_Dnc_Role_MasterParams(pydantic.BaseModel):
    role_id: str
    source_system: str


class Dncrolemaster_Download_Dnc_Role_MasterParams(pydantic.BaseModel):
    condition: dict


class Dncrolemaster_Upload_Dnc_Role_MasterParams(pydantic.BaseModel):
    pass


class CEGRoleMasterSchema(UrdhvaPostgresBase):
    __tablename__ = 'ceg_role_master'
    
    role_id: Mapped[str] = mapped_column("role_id", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    role_name: Mapped[str] = mapped_column("role_name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    source_system: Mapped[typing.List[str]] = mapped_column("source_system", ARRAY(String), index=False, nullable=False, default=None, primary_key=False, unique=False)
    parent_ui_interface: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("parent_ui_interface", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    child_ui_interface: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("child_ui_interface", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    tasks: Mapped[typing.Optional[typing.List[typing.Any]]] = mapped_column("tasks", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False)
    conditions: Mapped[typing.Optional[dict]] = mapped_column("conditions", JSONB, index=False, nullable=True, default=pydantic.Field(default_factory=dict), primary_key=False, unique=False)


class CEGRoleMasterCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'ceg_role_master'
    
    role_id: str
    role_name: str
    source_system: typing.List[str]
    parent_ui_interface: typing.Optional[typing.List[ui_interface_dataCreate]] | None = None
    child_ui_interface: typing.Optional[typing.List[ui_interface_dataCreate]] | None = None
    tasks: typing.Optional[typing.List[api_task_dataCreate]] | None = None
    conditions: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        collection_name = 'data_flow'
        schema_class = CEGRoleMasterSchema
        upsert_keys = []


class CEGRoleMaster(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'ceg_role_master'
    
    role_id: typing.Optional[str] | None = None
    role_name: typing.Optional[str] | None = None
    source_system: typing.Optional[typing.List[str]] | None = None
    parent_ui_interface: typing.Optional[typing.List[ui_interface_dataCreate]] | None = None
    child_ui_interface: typing.Optional[typing.List[ui_interface_dataCreate]] | None = None
    tasks: typing.Optional[typing.List[api_task_dataCreate]] | None = None
    conditions: typing.Optional[dict] = pydantic.Field(pydantic.Field(default_factory=dict), )

    class Config:
        collection_name = 'data_flow'
        schema_class = CEGRoleMasterSchema
        upsert_keys = []


class CEGRoleMasterGetResp(pydantic.BaseModel):
    data: typing.List[CEGRoleMaster]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Cegrolemaster_Get_Ceg_Role_MasterParams(pydantic.BaseModel):
    role_id: str
    source_system: str


class Cegrolemaster_Download_Ceg_Role_MasterParams(pydantic.BaseModel):
    condition: dict


class Cegrolemaster_Upload_Dnc_Role_MasterParams(pydantic.BaseModel):
    pass
    
