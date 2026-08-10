import re
import json
import time
import typing
import asyncio
import pydantic
import datetime
import traceback
import collections
import urdhva_base
import urdhva_base.settings
import urdhva_base.redispool
import urdhva_base.queryparams
import urdhva_base.utilities as utils
from sqlalchemy.pool import NullPool
from starlette.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.dialects.postgresql import insert

from sqlalchemy import (
    BigInteger,
    TIMESTAMP,
    DateTime,
    func,
    Identity,
    select,
    String,
    text
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    MappedAsDataclass,
    mapped_column,
    undefer
)


# Define Base class for declarative base
class Base(MappedAsDataclass, DeclarativeBase, dataclass_callable=pydantic.dataclasses.dataclass):
    class Config:
        orm_mode = True


# Define base model for Postgresql
class UrdhvaPostgresBase(Base):
    __abstract__ = True

    id: Mapped[int] = mapped_column("id", BigInteger, autoincrement=True, primary_key=True,
                                                     init=False, server_default=Identity(minvalue=1), unique=True)
    created_at: Mapped[typing.Optional[datetime.datetime]] = mapped_column("created_at", TIMESTAMP,
                                                                           server_default=func.now(), init=False)
    updated_at: Mapped[typing.Optional[datetime.datetime]] = mapped_column("updated_at", TIMESTAMP,
                                                                           server_default=func.now(),
                                                                           onupdate=func.now(), init=False)
    entity_id: Mapped[typing.Optional[str]] = mapped_column("entity_id", String, index=True)


class DatabaseManager:
    def __init__(self, database_url):
        # BUG-FIX: NullPool creates a new TCP connection per query → asyncio
        # CancelledError / TimeoutError under any real load. Replaced with a
        # real QueuePool with a 10-second asyncpg connect timeout and pre-ping.
        self.engine = create_async_engine(
            database_url,
            pool_size=5,
            max_overflow=10,
            pool_timeout=20,
            pool_recycle=300,
            pool_pre_ping=True,
            connect_args={'timeout': 10},
        )
        self.async_session = async_sessionmaker(self.engine, expire_on_commit=False)

    async def get_session(self):
        return self.async_session()

    async def create_all(self):
        async with self.engine.begin() as conn:
            # Sorting all tables to make sure non-dependent one should configure first
            tables = Base.metadata.sorted_tables
            await conn.run_sync(Base.metadata.create_all, tables=tables)


manager = DatabaseManager(str(urdhva_base.settings.db_urls["postgres_async"][0]))


# --------------------------------------------------------------------------------------
# Create tables (once per application)
# --------------------------------------------------------------------------------------
async def create_tables():
    await manager.create_all()


# Define base model for Pydantic
class BasePostgresModel(pydantic.BaseModel):
    __tablename__ = ""

    @classmethod
    async def cleanup_session(cls, session):
        try:
            session.rollback()
        except:
            ...
        try:
            session.close()
        except:
            ...

    @classmethod
    async def _apply_acls(cls):
        ...

    @classmethod
    async def get_clause_conditions(cls, formated=False, extra_key_mapping=None, default_mapping=None):
        where_clause = []
        if urdhva_base.ctx.exists() and hasattr(cls.Config, "access_key_mapping"):
            key_mapping = cls.Config.access_key_mapping
            mapped_data = {
                key.split(":")[0].strip(): key.split(":")[1].strip() if ":" in key else key.split(":")[0].strip()
                for key in key_mapping
            }
            # Generating OR Conditions for mapped keys
            or_condition_keys = {}
            for key in [item for item, count in collections.Counter(list(mapped_data.values())).items() if count > 1]:
                for key_, value in mapped_data.items():
                    if value == key:
                        if key not in or_condition_keys:
                            or_condition_keys[key] = []
                        or_condition_keys[key].append(key_)
            # Cleaning if key matching or_conditions and not equals to base key
            for base_key, mapped_keys in or_condition_keys.items():
                for mapped_key in mapped_keys:
                    if mapped_key != base_key and mapped_key in mapped_data:
                        del mapped_data[mapped_key]
            rpt = urdhva_base.context.context.get('rpt', {})
            # Removing BU incase if SAP_ID was available and restricted
            # Todo:- Need to verify in multiple conditions
            if 'bu' in mapped_data and 'sap_id' in mapped_data:
                if rpt.get('bu') and rpt.get('sap_id'):
                    del mapped_data['bu']
            # Generating query Conditions
            for key, value in mapped_data.items():
                if extra_key_mapping and key in extra_key_mapping:
                    key = extra_key_mapping[key]
                # Incase if we need to map extra details like bu for supply chain
                if default_mapping and key in default_mapping:
                    value = default_mapping[key]
                if value in rpt and rpt.get(value):
                    if isinstance(rpt[value], list):
                        if len(rpt[value]) == 1:
                            if formated:
                                where_clause.append({'key': key, "cond": 'equals', "value": rpt[value][0]})
                            else:
                                if key in or_condition_keys:
                                    # conditions = [f"{k}='{rpt[value][0]}'" for k in or_condition_keys[key]]
                                    # BUG-FIX: nested f-strings reusing the same quote char (") inside
                                    # another f-string are invalid on Python < 3.12 and raised
                                    # "SyntaxError: f-string: unmatched '['" at import time. Building
                                    # the quoted/joined value list as a plain variable first avoids
                                    # nesting f-strings entirely and works on any Python version.
                                    quoted_values = ', '.join("'" + str(v) + "'" for v in rpt[value])
                                    conditions = [
                                            f"{k} IN ({quoted_values})"
                                            for k in or_condition_keys[key]
                                    ]
                                    where_clause.append(f"({' OR '.join(conditions)})")
                                else:
                                    # where_clause.append(f"{key}='{rpt[value][0]}'")
                                    # BUG-FIX: same nested f-string quote collision as above.
                                    quoted_values = ', '.join("'" + str(v) + "'" for v in rpt[value])
                                    where_clause.append(f"{key} IN ({quoted_values})")
                        else:
                            if formated:
                                # where_clause.append({'key': key, "cond": ' ', "value": rpt[value]})
                                where_clause.append({'key': key, "cond": ' ', "value": ",".join(rpt[value])})
                            else:
                                if key in or_condition_keys:
                                    conditions = [f"{k} in {tuple(rpt[value])}" for k in or_condition_keys[key]]
                                    where_clause.append(f"({' OR '.join(conditions)})")
                                else:
                                    where_clause.append(f"{key} in {tuple(rpt[value])}")
                    else:
                        if formated:
                            where_clause.append({'key': key, "cond": 'equals', "value": rpt[value]})
                        else:
                            where_clause.append(f"{key}='{rpt[value]}'")
        return where_clause

    @classmethod
    async def _get_entity_id(cls, entity_id=None):
        if urdhva_base.ctx.exists():
            return urdhva_base.ctx['entity_id']
        return entity_id

    @classmethod
    async def get(cls, row_id, entity_id=None, skip_secrets=False):
        """
        For Getting specific record
        :param row_id: record id
        :param entity_id: entity id
        :return: record if exists else null
        """
        # entity_id = cls._get_entity_id(entity_id)
        # if not entity_id:
        #     raise "missing context information"
        session = await manager.get_session()
        result = await session.execute(
            select(cls.Config.schema_class).where(cls.Config.schema_class.id == int(row_id))
        )
        resp = result.scalars().first()
        await asyncio.shield(session.close())
        return resp

    @classmethod
    async def count(cls, params: urdhva_base.queryparams.QueryParams = None, entity_id=None, count_query=None):
        """

        :param params:
        :param entity_id:
        :return:
        """
        # entity_id = cls._get_entity_id(entity_id)
        # if not entity_id:
        #     raise "missing context information"
        query = [f"select count('*') from {cls.__tablename__}"]
        if not count_query or not isinstance(count_query, list):
            query_params = [f"{cls.__tablename__}.entity_id = '{entity_id}'"] if entity_id else []
            # todo:- need to implement this for all keys, both permitted and prohibited
            if urdhva_base.ctx.exists() and urdhva_base.context.context.get('rpt', {}):
                rpt = urdhva_base.context.context.get('rpt', {})
                key = f"access_restrictions_{urdhva_base.ctx['entity_id']}"
                redis_client = await urdhva_base.redispool.get_redis_connection()
                if await redis_client.hexists(key, rpt['email']):
                    data = json.loads(await redis_client.hget(f"access_restrictions_{urdhva_base.ctx['entity_id']}",
                                                              rpt['email']))
                    # todo:- Temporary fix for ACL'S
                    if data.get("organizations_permitted"):
                        permitted_org = data['organizations_permitted'].split(",")
                        if len(permitted_org) == 1:
                            permitted_org = f"('{permitted_org[0]}')"
                        if cls.__tablename__ == "organization":
                            query_params.append(f"id in {permitted_org}")
                        else:
                            query_params.append(f"organization_id in {permitted_org}")
            if hasattr(cls.Config, 'standard_query'):
                query_params.append(cls.Config.standard_query)
            query_params.extend(await cls.get_clause_conditions())
            if params and params.q and len(params.q) > 0:
                query_params.append(params.q)
            if len(query_params):
                query.append("where " + " AND ".join(query_params))
        else:
            query.extend(count_query[1:])
        session = await manager.get_session()
        total = await session.scalar(text(" ".join(query)))
        await asyncio.shield(session.close())
        return total

    @classmethod
    async def update_by_query(cls, query, entity_id=None):
        last_exc = None
        for _attempt in range(2):  # retry once on transient DB failures
            session = await manager.get_session()
            try:
                if limit:
                    query_ = f"{query} LIMIT {limit} OFFSET {limit * skip}"
                else:
                    query_ = f"{query}"
                if not query_.strip().upper().startswith("WITH ") and not query_.strip().upper().startswith("SELECT"):
                    query_ = f"select {query_}"
                result = await session.execute(text(query_))
                resp = result.all()
                # Getting key columns from results
                columns = [key for key in result.keys()]
                results = [{columns[index]: value for index, value in enumerate(row)} for row in resp]
                # Fetching total available records for the given query
                total = len(results)
                if not skip_total:
                    try:
                        total = await session.scalar(text(f"select COUNT(*) FROM(SELECT {query}) AS subquery"))
                    except:
                        ...
                results_data = {"data": results, "count": len(results), "total": total}
                return results_data
            except Exception as e:
                last_exc = e
                print(f"get_aggr_data attempt {_attempt + 1} failed: {e}")
                if _attempt == 0:
                    await asyncio.sleep(0.5)
            finally:
                try:
                    await asyncio.shield(session.close())
                except Exception:
                    pass
        raise Exception(f"Exception while running aggregation query {last_exc}") from last_exc

    @classmethod
    async def execute_query(cls, query):
        try:
            session = await manager.get_session()
            result = await session.execute(text(query))
            print(f"Rows committed {result.rowcount}")
            await session.commit()

            return {"status": True, "message": f"{query} Executed successfully"}
        except Exception as e:
            return {"status": False, "message": f"Failed to {query}, Exception: {str(e)}"}
        finally:
            await asyncio.shield(session.close())

    @classmethod
    async def get_aggr_data(cls, query, limit=100, skip=0, skip_total=True):
        """
        @Description: For getting aggregated data, Join queries
        :param query: Query string to execute
        :param limit:
        :param skip:
        :return:
        """
        last_exc = None
        for _attempt in range(2):  # retry once on transient DB failures
            session = await manager.get_session()
            try:
                if limit:
                    query_ = f"{query} LIMIT {limit} OFFSET {limit * skip}"
                else:
                    query_ = f"{query}"
                if not query_.strip().upper().startswith("WITH ") and not query_.strip().upper().startswith("SELECT"):
                    query_ = f"select {query_}"
                result = await session.execute(text(query_))
                resp = result.all()
                # Getting key columns from results
                columns = [key for key in result.keys()]
                results = [{columns[index]: value for index, value in enumerate(row)} for row in resp]
                # Fetching total available records for the given query
                total = len(results)
                if not skip_total:
                    try:
                        total = await session.scalar(text(f"select COUNT(*) FROM(SELECT {query}) AS subquery"))
                    except Exception:
                        pass
                results_data = {"data": results, "count": len(results), "total": total}
                return results_data
            except Exception as e:
                last_exc = e
                print(f"get_aggr_data attempt {_attempt + 1} failed: {e}")
                if _attempt == 0:
                    await asyncio.sleep(0.5)
            finally:
                try:
                    await asyncio.shield(session.close())
                except Exception:
                    pass
        raise Exception(f"Exception while running aggregation query {last_exc}") from last_exc

    @classmethod
    async def create_database_table(cls):
        await manager.create_all()

    @classmethod
    async def get_all(cls, params: urdhva_base.queryparams.QueryParams = None, entity_id=None, resp_type="encoded",
                      skip_secrets=False):
        """
        @Description: For getting aggregated data, Join queries
        :param params: Query Params
        :param entity_id: Entity ID, If not provided will fetch from session context
        :param resp_type: encoded/plain
        :return:
        """
        # entity_id = cls._get_entity_id(entity_id)
        # if not entity_id:
        #     raise "missing context information"

        # If empty params, configuring default params.
        if not params:
            params = urdhva_base.queryparams.QueryParams(q="", fields='["*"]', skip=0, limit=100)
        # Generating Postgres query from QueryParams

        # ******************** For Specific Fields Start ******************** #
        fields = params.fields if params and params.fields else '["*"]'
        if isinstance(fields, str):
            fields = json.loads(fields)

        # Added if field incase if its missing
        if fields and "*" not in fields and "id" not in fields:
            fields.append("id")

        # Removing duplicate fields from fields
        if fields and isinstance(fields, list):
            fields = list(set(fields))
            
        # ******************** For Specific Fields End ******************** #

        query = [f"select {','.join(fields)} from {cls.__tablename__}"]
        query_params = [f"{cls.__tablename__}.entity_id = '{entity_id}'"] if entity_id else []

        # todo:- need to implement this for all keys, both permitted and prohibited
        if urdhva_base.ctx.exists() and urdhva_base.context.context.get('rpt', {}):
            rpt = urdhva_base.context.context.get('rpt', {})
            key = f"access_restrictions_{urdhva_base.ctx['entity_id']}"
            redis_client = await urdhva_base.redispool.get_redis_connection()
            if await redis_client.hexists(key, rpt['email']):
                data = json.loads(await redis_client.hget(f"access_restrictions_{urdhva_base.ctx['entity_id']}",
                                                          rpt['email']))
                #todo:- Temporary fix for ACL'S
                if data.get("organizations_permitted"):
                    permitted_org = data['organizations_permitted'].split(",")
                    if len(permitted_org) == 1:
                        permitted_org = f"('{permitted_org[0]}')"
                    if cls.__tablename__ == "organization":
                        query_params.append(f"id in {permitted_org}")
                    else:
                        query_params.append(f"organization_id in {permitted_org}")
        # Incase if there was a standard_query, appending it to the base query(Queries which are mandated in
        # Specific class)

        if hasattr(cls.Config, 'standard_query'):
            query_params.append(cls.Config.standard_query)
        if params and params.q and len(params.q) > 0:
            query_params.append(params.q)
        # if params and params.q:
        #     search_conditions = []
        #     if hasattr(cls.Config, 'search_fields') and cls.Config.search_fields:
        #         for field in cls.Config.search_fields:
        #             if params.search_text:
        #                 search_conditions.append(f"{cls.__tablename__}.{field} ILIKE '%{params.search_text}%'")
                
        #         if search_conditions:
        #             print("search_conditions --> ", search_conditions)
        #             query_params.append(f"({' OR '.join(search_conditions)})")
        
        if params and params.search_text and isinstance(params.search_text, str) and params.search_text.strip():
            search_conditions = []
            if hasattr(cls.Config, 'search_fields') and cls.Config.search_fields:
                for field in cls.Config.search_fields:
                    search_text = params.search_text.strip()  # Strip leading/trailing whitespace
                    # print("search text --> ", search_text)
                    search_conditions.append(f"{cls.__tablename__}.{field}::text ILIKE '%{search_text}%'")

            if search_conditions:
                # print("search_conditions --> ", search_conditions)
                query_params.append(f"({' OR '.join(search_conditions)})")        
        
        # Commented by Shrihari
        # query_params.extend(await cls.get_clause_conditions())
        # Added to remove the duplicate condition of bu
        _extra_condition = await cls.get_clause_conditions()
        pattern = r"\s*bu\s*=\s*'[^']+'\s*(\s*)?"
        cleaned_conditions = []
        for cond in _extra_condition:
            new_cond = re.sub(pattern, '', cond).strip()
            if new_cond:
                cleaned_conditions.append(new_cond.rstrip("AND").rstrip("and"))
        query_params.extend(cleaned_conditions)
        if len(query_params):
            query.append("where " + " AND ".join(query_params))
        count_query = [rec for rec in query]

        # ******************** For Data Sorting Params Start ******************** #
        if params.sort:
            try:
                order_by = json.loads(params.sort) if isinstance(params.sort, str) else params.sort
                for key, value in order_by.items():
                    order = 'ASC' if 'asc' in value.lower() else 'DESC'  
                    query.append(f"ORDER BY {key} {order}")
                    break
            except Exception as e:
                print(f"Exception in order by {e}")
        else:
            query.append(f"ORDER BY updated_at DESC")
        # ******************** For Data Sorting Params End ******************** #

        if params.limit:
            query.append(f"LIMIT {params.limit}")
        if params.skip:
            query.append(f"OFFSET {params.skip * params.limit}")
        session = await manager.get_session()
        try:
            result = await session.scalars(select(cls.Config.schema_class).from_statement(text(" ".join(query))))
            resp = result.all()
            results = [{key: value for key, value in row.__dict__.items() if not key.startswith("_")} for row in resp]
            total = await cls.count(params, entity_id, count_query) if len(results) > 0 else 0
            results_data = {"data": results, "count": len(results), "total": total}
            if resp_type == "encoded":
                return JSONResponse(content=jsonable_encoder(results_data))
            return results_data
        except Exception as e:
            print(f"Exception in get_all {e}")
            raise f"Exception while running get_all query {e}"
            # return {"data": [], "count": 0, "total": 0}
        finally:
            await asyncio.shield(session.close())

    @classmethod
    def convert_to_dict(cls, input_data):
        return {key: value for key, value in input_data.__dict__.items() if not key.startswith("_")}

    @classmethod
    async def delete(cls, row_id, entity_id=None):
        """

        :param row_id:
        :param entity_id:
        :return:
        """
        # entity_id = cls._get_entity_id(entity_id)
        # if not entity_id:
        #     raise "missing context information"
        session = await manager.get_session()
        result = await session.execute(
            select(cls.Config.schema_class).where(cls.Config.schema_class.id == int(row_id))
        )

        if result.scalars().first() is not None:
            status = await session.execute(
                cls.Config.schema_class.__table__.delete().where(cls.Config.schema_class.id == int(row_id))
            )
            
            await session.commit()
            await asyncio.shield(session.close())
            return True, "Success"
        return False, "Fail"

    async def create(self, entity_id=None, upsert=False, upsert_skip_keys=[]):
        """

        :param entity_id:
        :param upsert:
        :return:
        """
        # entity_id = self._get_entity_id(entity_id)
        # if not entity_id:
        #     raise "missing context information"
        if not upsert_skip_keys:
            upsert_skip_keys = ["id", "entity_id", "created_at", "updated_at"]
        else:
            upsert_skip_keys = list(set(upsert_skip_keys + ["id", "entity_id", "created_at", "updated_at"]))

        # await manager.create_all()
        session = await manager.get_session()
        try:
            if not upsert:
                schema_class = self.Config.schema_class(**{**json.loads(self.model_dump_json()), "entity_id": entity_id})
                session.add(schema_class)
                await session.commit()
                await session.refresh(schema_class)
                return {"id": schema_class.id, **{key: value for key, value in schema_class.__dict__.items() if not key.startswith("_")}}
            else:
                ins_resp = insert(self.Config.schema_class).values([{**json.loads(self.model_dump_json()),
                                                                     "entity_id": entity_id}])
                conflict_dict = {exc.key: exc for exc in ins_resp.excluded if exc.key not in upsert_skip_keys}
                ins_resp = ins_resp.on_conflict_do_update(
                    index_elements=self.Config.upsert_keys, set_=conflict_dict
                )
                resp = await session.execute(ins_resp)
                id = resp.scalar()
                return {"id": id, **{key: value for key, value in resp.__dict__.items() if not key.startswith("_")}}
        except Exception as e:
            print(f"Exception in {'create' if not upsert else 'upsert'} {e}")
            return None
        finally:
            # await session.commit()
            await asyncio.shield(session.close())
        return None

    async def modify(self, entity_id=None):
        """

        :param entity_id:
        :return:
        """
        # entity_id = self._get_entity_id(entity_id)
        # if not entity_id:
        #     raise "missing context information"
        session = await manager.get_session()
        result = await session.execute(
            select(self.Config.schema_class).where(self.Config.schema_class.id == int(self.id))
        )
        record = result.one()
        if len(record):
            for key, value in self.model_dump(exclude_none=True, exclude_unset=True).items():
                if key == 'updated_at':
                    continue
                setattr(record[0], key, value)
            await session.commit()
            await asyncio.shield(session.close())
            return True, "updated"
        return False, "Record Not Found"
        # record = await session.get(self.Config.schema_class, self.id)
        # print(record)

    @classmethod
    async def bulk_update(cls, records, entity_id=None, upsert=False, upsert_skip_keys = []):
        """

        :param records: list of records to insert as bulk into database
        :param entity_id:
        :param upsert:
        :return:
        """
        # entity_id = cls._get_entity_id(entity_id)
        # if not entity_id:
        #     raise "missing context information"
        if not upsert_skip_keys:
            upsert_skip_keys = ["id", "entity_id", "created_at", "updated_at"]
        else:
            upsert_skip_keys = list(set(upsert_skip_keys + ["id", "entity_id", "created_at", "updated_at"]))

        # await manager.create_all()
        session = await manager.get_session()
        try:
            if not upsert:
                tasks = [cls.Config.schema_class(**{**json.loads(json.dumps(rec,
                                                                            default=utils.datetime_serializer)),
                                                    "entity_id": entity_id}) for rec in records]
                session.add_all(tasks)
                await session.commit()  # Commit the transaction
                try:
                    await session.refresh(tasks[0])
                except:
                    ...
                await session.close()
            else:
                # Calculating max records to send for upsert operation by considering max columns limit 32767
                max_limit = int(32767 / (len(records[0]) + 1)) - 1
                for index in range(0, len(records), max_limit):
                    ins_resp = insert(cls.Config.schema_class).values([{**rec, "entity_id": entity_id}
                                                                       for rec in records[index:index+max_limit]])
                    conflict_dict = {exc.key: exc for exc in ins_resp.excluded if exc.key not in upsert_skip_keys}
                    ins_resp = ins_resp.on_conflict_do_update(
                        index_elements=cls.Config.upsert_keys, set_=conflict_dict
                    )
                    await session.execute(ins_resp)
                    await session.commit()  # Commit the transaction
                    try:
                        schema_class = cls.Config.schema_class(**{**records[0],
                                                                  "entity_id": entity_id})
                        await session.refresh(schema_class)
                    except:
                        ...
                    await session.close()
        except Exception as e:
            print(f"Exception in bulk update {e}")
            print(f"Traceback {traceback.format_exc()}")
        finally:
            try:
                await session.commit()  # Commit the transaction
            except:
                ...
            try:
                await asyncio.shield(session.close())
            except:
                ...
        return True, "Data inserted"

    class Config:
        populate_by_name = True
        json_encoders = {
        }
        from_attributes = True
        # BUG-FIX: was `collection_name: urdhva_base.settings.default_index` — a bare
        # type annotation that evaluated settings.default_index at class definition time.
        # settings.default_index never existed, so every import raised:
        #   AttributeError: 'Settings' object has no attribute 'default_index'
        # Fixed to a proper string field with a safe empty default.
        collection_name: str = ""
        schema_class: Base
        search_fields: []
        upsert_keys: []


# Define concrete model
class PostgresModel(BasePostgresModel):
    id: typing.Optional[int]
    created_at: typing.Optional[datetime.datetime] | None = None
    updated_at: typing.Optional[datetime.datetime] | None = None
    entity_id: typing.Optional[str] | None = None
