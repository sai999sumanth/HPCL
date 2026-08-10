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
import DBCredsModel_enum

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import *
from sqlalchemy.orm import *
from urdhva_base.postgresmodel import UrdhvaPostgresBase


class DBCredsInternalCreate(pydantic.BaseModel):
    skiprows: typing.Optional[int] = pydantic.Field(0, **{})
    skipfooter: typing.Optional[int] = pydantic.Field(0, **{})
    sheetno: typing.Optional[int] = pydantic.Field(0, **{})
    delimiter: typing.Optional[str] = pydantic.Field("", **{})
    load_type: typing.Optional[str] = pydantic.Field("", **{})


class DBCredsModelSchema(UrdhvaPostgresBase):
    __tablename__ = 'db_creds_model'
    
    name: Mapped[str] = mapped_column("name", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cred_model: Mapped[str] = mapped_column("cred_model", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    cred_type: Mapped[str] = mapped_column("cred_type", String, index=False, nullable=False, default=None, primary_key=False, unique=False)
    host: Mapped[typing.Optional[str]] = mapped_column("host", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    port: Mapped[typing.Optional[str]] = mapped_column("port", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    username: Mapped[typing.Optional[str]] = mapped_column("username", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    password: Mapped[typing.Optional[str]] = mapped_column("password", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    database: Mapped[typing.Optional[str]] = mapped_column("database", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    service_name: Mapped[typing.Optional[str]] = mapped_column("service_name", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    sid: Mapped[typing.Optional[str]] = mapped_column("sid", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    security_token: Mapped[typing.Optional[str]] = mapped_column("security_token", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    domain: Mapped[typing.Optional[str]] = mapped_column("domain", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    enabled: Mapped[typing.Optional[bool]] = mapped_column("enabled", Boolean, index=False, nullable=True, default=False, primary_key=False, unique=False)
    private_pass: Mapped[typing.Optional[str]] = mapped_column("private_pass", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    private_key_pass: Mapped[typing.Optional[str]] = mapped_column("private_key_pass", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    source_path: Mapped[typing.Optional[str]] = mapped_column("source_path", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    dest_path: Mapped[typing.Optional[str]] = mapped_column("dest_path", String, index=False, nullable=True, default="", primary_key=False, unique=False)
    file_pattern: Mapped[typing.Optional[typing.List[str]]] = mapped_column("file_pattern", ARRAY(String), index=False, nullable=True, default="", primary_key=False, unique=False)
    params: Mapped[typing.Optional[typing.Any]] = mapped_column("params", JSONB, index=False, nullable=True, default=None, primary_key=False, unique=False) 


class DBCredsModelCreate(urdhva_base.postgresmodel.BasePostgresModel):
    __tablename__ = 'db_creds_model'
    
    name: str
    cred_model: str
    cred_type: str
    host: typing.Optional[str] = pydantic.Field("", **{})
    port: typing.Optional[str] = pydantic.Field("", **{})
    username: typing.Optional[str] = pydantic.Field("", **{})
    password: typing.Optional[str] = pydantic.Field("", **{})
    database: typing.Optional[str] = pydantic.Field("", **{})
    service_name: typing.Optional[str] = pydantic.Field("", **{})
    sid: typing.Optional[str] = pydantic.Field("", **{})
    security_token: typing.Optional[str] = pydantic.Field("", **{})
    domain: typing.Optional[str] = pydantic.Field("", **{})
    enabled: typing.Optional[bool] = pydantic.Field(False, )
    private_pass: typing.Optional[str] = pydantic.Field("", **{})
    private_key_pass: typing.Optional[str] = pydantic.Field("", **{})
    source_path: typing.Optional[str] = pydantic.Field("", **{})
    dest_path: typing.Optional[str] = pydantic.Field("", **{})
    file_pattern: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    params: typing.Optional[DBCredsInternalCreate] | None = None

    class Config:
        collection_name = 'db_creds_model'
        schema_class = DBCredsModelSchema


class DBCredsModel(urdhva_base.postgresmodel.PostgresModel):
    __tablename__ = 'db_creds_model'
    
    name: typing.Optional[str]
    cred_model: typing.Optional[str]
    cred_type: typing.Optional[str]
    host: typing.Optional[str] = pydantic.Field("", **{})
    port: typing.Optional[str] = pydantic.Field("", **{})
    username: typing.Optional[str] = pydantic.Field("", **{})
    password: typing.Optional[str] = pydantic.Field("", **{})
    database: typing.Optional[str] = pydantic.Field("", **{})
    service_name: typing.Optional[str] = pydantic.Field("", **{})
    sid: typing.Optional[str] = pydantic.Field("", **{})
    security_token: typing.Optional[str] = pydantic.Field("", **{})
    domain: typing.Optional[str] = pydantic.Field("", **{})
    enabled: typing.Optional[bool] = pydantic.Field(False, )
    private_pass: typing.Optional[str] = pydantic.Field("", **{})
    private_key_pass: typing.Optional[str] = pydantic.Field("", **{})
    source_path: typing.Optional[str] = pydantic.Field("", **{})
    dest_path: typing.Optional[str] = pydantic.Field("", **{})
    file_pattern: typing.Optional[typing.List[str]] = pydantic.Field("", **{})
    params: typing.Optional[DBCredsInternalCreate] | None = None

    class Config:
        collection_name = 'db_creds_model'
        schema_class = DBCredsModelSchema


class DBCredsModelGetResp(pydantic.BaseModel):
    data: typing.List[DBCredsModel]
    total: int = pydantic.Field(0)
    count: int = pydantic.Field(0)


class Dbcredsmodel_Load_DbcredsParams(pydantic.BaseModel):
    pass
    
