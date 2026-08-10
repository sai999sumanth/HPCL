import urdhva_base
import ssl
import uuid
import json
import typing
import asyncio
import warnings
import pydantic
import traceback
import elasticsearch
import urdhva_base.types
import urdhva_base.settings
import urdhva_base.utilities
import urdhva_base.redispool
import urdhva_base.queryparams
import urdhva_base.espandas_async
from pydantic.fields import Field
from datetime import datetime, date
from elasticsearch import AsyncElasticsearch
from starlette.responses import JSONResponse
from fastapi.encoders import jsonable_encoder


def jsondefault(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()


es_logger = elasticsearch.logger
es_logger.setLevel(elasticsearch.logging.ERROR)

logger = urdhva_base.Logger.getInstance("elasticinterfaceapi")

# Ignoring python warnings
warnings.filterwarnings("ignore")
# There should be only one ElasticClient instance per cluster per application instance
# for connection pooling.
# For now to start with there will be only one mongo cluster that will be used, so this
# should be fine. When scaling if there are multiple clusters then we need to have a
# cache lookup based on say partnerId or something and a default one for generic data
# like Country,etc. Don't think twice when the time comes for change!!!
domain_mapping = {}


# Getting Elastic Pandas Connection
async def getEspandasConnection(domain):
    es_client = await get_elasticsearch_client(domain)
    ins = urdhva_base.espandas_async.EsPandas(es_client)
    await ins.initialize()
    return ins


async def get_elasticsearch_client(domain) -> AsyncElasticsearch:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    if hasattr(urdhva_base.settings, 'db_urls') and urdhva_base.settings.db_urls.get("elastic"):
        db_url = urdhva_base.settings.db_urls["elastic"][0]
        els_url = f"{db_url.scheme}://{db_url.user}:{db_url.password}@{db_url.host}:{db_url.port}"
    else:
        els_url = "https://admin:admin@localhost:9200"
    return AsyncElasticsearch(els_url, verify_certs=False, ssl_context=ssl_context, maxsize=1)


class BaseElasticModel(pydantic.BaseModel):
    # NOTE: Handling of _id was based on https://github.com/tiangolo/fastapi/issues/1515

    @classmethod
    async def client(cls, domain=None) -> AsyncElasticsearch:
        return await get_elasticsearch_client(domain)

    @classmethod
    async def collection_name(cls, domain=None) -> str:
        # Converting collection name to session domain index
        if not domain:
            domain = urdhva_base.ctx["entity_id"]
        if cls.__config__.collection_name:
            temp = cls.__config__.collection_name.split(f"{urdhva_base.settings.default_index}_")
            domain = f"{domain}_{temp[-1]}_{urdhva_base.settings.default_index}"
        else:
            domain = f"{domain}_{cls.__name__.lower()}_{urdhva_base.settings.default_index}"
        return domain

    @classmethod
    def from_elastic(cls, data: dict):
        """We must convert _id into "id". """
        if not data:
            return data
        return cls(**dict(data))

    def to_elastic(self, **kwargs):
        exclude_unset = kwargs.pop('exclude_unset', True)
        exclude_defaults = kwargs.pop('exclude_defaults', False)
        by_alias = kwargs.pop('by_alias', True)
        exclude = kwargs.pop('exclude', set())
        exclude.union({'created', 'updated', 'tenantId'})

        parsed = json.loads(self.json(
            exclude_unset=exclude_unset,
            exclude_defaults=exclude_defaults,
            by_alias=by_alias,
            exclude=exclude,
            **kwargs,
        ))
        return parsed

    @classmethod
    def getclassname(cls) -> str:
        return cls.__name__.lower()

    @classmethod
    def getFormatedKeys(cls, keyslist):
        filteredKeys = []
        if not keyslist:
            return filteredKeys
        for key, details in cls.schema()['properties'].items():
            if details.get("format") and details["format"] in keyslist:
                filteredKeys.append(key)
        return filteredKeys

    @classmethod
    def validateAuditLog(cls, action):
        if not urdhva_base.settings.auditlog_enabled:
            return False, ""
        if not urdhva_base.ctx.exists():
            return False, ""
        if hasattr(cls.__config__, "auditlog_methods") and action in cls.__config__.auditlog_methods:
            return True, cls.__name__
        return False, ""

    @classmethod
    def getdefaultquery(cls) -> str:
        if hasattr(cls.__config__, 'def_query') and cls.__config__.def_query:
            try:
                return cls.__config__.def_query
            except:
                pass
        cls_name = cls.getclassname()
        return json.dumps({"query": {"bool": {"should": [{"match": {"_type_.keyword": cls_name}},
                                                         {"match": {"_type_.keyword": cls_name + "create"}}]}}})

    @classmethod
    def isChangeLogEnabled(cls) -> bool:
        if hasattr(cls.__config__, 'changeLogEnabled') and cls.__config__.changeLogEnabled:
            return True
        else:
            return False

    @classmethod
    def isFilterEnabled(cls) -> str:
        if hasattr(cls.__config__, 'filterkey'):
            return cls.__config__.filterkey
        return 'companyRef.id.keyword'

    @classmethod
    def accesscheck(self, data):
        filterkey = self.isFilterEnabled()
        rpt = urdhva_base.context.context.get('rpt', {})
        includes = rpt.get('includes', '')
        excludes = rpt.get('excludes', '')
        inc = []
        exc = []
        if includes:
            inc = [x.strip() for x in includes.split(',') if x.strip()]
        if excludes:
            exc = [x.strip() for x in excludes.split(',') if x.strip()]

        if (not inc) and (not exc):
            return True
        if filterkey == '':
            return True
        elif filterkey == '_id':
            _id = data['_id']
            if inc and _id not in inc:
                return False
            if exc and _id in exc:
                return False
        elif "companyRef" not in filterkey:
            companyrefid = data.get(filterkey.replace(".keyword", ""), '')
            if companyrefid:
                # Example companyid as list and if than one discarding delete
                if isinstance(companyrefid, list):
                    if len(companyrefid) > 1:
                        return False
                    elif len(companyrefid) == 1:
                        companyrefid = companyrefid[0]
                if inc and companyrefid not in inc:
                    return False
                if exc and companyrefid in exc:
                    return False
        else:
            companyref = data.get('companyRef', {})
            if not companyref:
                # todo:- need to move this condition to settings
                if data.get('_type_') in ['agent', 'agentcreate']:
                    if data.get("agent_type") == 4:
                        return True
                return False
            if isinstance(companyref, list):
                compref = []
                for x in companyref:
                    if inc and x['id'] in inc:
                        compref.append(x)
                    if exc and x['id'] not in exc:
                        compref.append(x)
                if not compref:
                    print("No ids available data:%s" % data)
                    return False
            elif isinstance(companyref, dict):
                companyrefid = companyref.get('id', '')
                if companyrefid:
                    if inc and companyrefid not in inc:
                        return False
                    if exc and companyrefid in exc:
                        return False
        return True

    @classmethod
    async def update_auditlog(cls, classname, action, newdata, olddata={}, action_by="", entity_id="", changes=None,
                              comment=None):
        if not urdhva_base.settings.auditlog_enabled:
            return
        try:
            # Not allowing if entity_id or userinfo missing and session not available
            def default(o):
                if isinstance(o, (date, datetime)):
                    return o.isoformat()

            if not action_by or not entity_id:
                if not urdhva_base.ctx.exists():
                    return
                rpt = urdhva_base.context.context.get('rpt', {})
                if not action_by:
                    action_by = rpt.get("email", "-")
                if not entity_id:
                    entity_id = urdhva_base.ctx["entity_id"]
            audit_data = {"entity_id": entity_id, "classname": classname, "action": action,
                          "action_by": action_by, "action_time": datetime.utcnow(), "newdata": newdata,
                          "olddata": olddata, "changes": changes, "comment": comment}
            queue_ins = urdhva_base.redispool.RedisQueue(urdhva_base.settings.auditlog_queue_name)
            await queue_ins.put(json.dumps(audit_data, default=default))
        except Exception as e:
            print(f"Exception in auditlog updation {e} TraceBack:- {traceback.format_exc()}")

    async def create(self, entity_id=None, forceRefresh=False, skipFormatedKeys=[]):
        auditlog_enabled, class_name = self.validateAuditLog("create")
        discardedKeys = self.getFormatedKeys(skipFormatedKeys)
        try:
            if not entity_id:
                filterkey = self.isFilterEnabled()
                rpt = urdhva_base.context.context.get('rpt', {})
                includes = rpt.get('includes', '')
                excludes = rpt.get('excludes', '')
                if filterkey == '_id' and (includes or excludes):
                    return {'_id': "Not allowed"}

            indexName = await self.collection_name(entity_id)
            data = self.to_elastic(exclude_unset=False, exclude_none=True)
            data['c'] = data['u'] = datetime.utcnow()
            data['_type_'] = self.getclassname()
            datauuid = str(uuid.uuid4())
            if "_id" in data:
                datauuid = data["_id"]
                del data["_id"]
            client = await self.client(entity_id)

            uid = str(datauuid)
            for _ in range(3):
                try:
                    inserted_doc = await client.create(
                        indexName, uid, body=data, refresh=True if not entity_id or forceRefresh else False,
                        timeout='45s', request_timeout=60
                    )
                    break
                except elasticsearch.exceptions.ConnectionTimeout as e:
                    logger.error(f"Timeout error {e}. Retrying_create_{indexName}")
                    await asyncio.sleep(2)

            id = inserted_doc['_id']
            resp = await client.get(index=indexName, id=id)
            inserted_doc = {**resp["_source"], **{"_id": resp['_id']}}
            if discardedKeys:
                inserted_doc = {key: value for key, value in inserted_doc.items() if key not in discardedKeys}
            if auditlog_enabled:
                await self.update_auditlog(class_name, "CREATE", inserted_doc, {}, entity_id=entity_id)
            return inserted_doc
        except elasticsearch.ElasticsearchException as e:
            print(f"Exception in record create {e}")

    async def update(self, entity_id=None, forceRefresh=False, skipFormatedKeys=[]):
        auditlog_enabled, class_name = self.validateAuditLog("update")
        discardedKeys = self.getFormatedKeys(skipFormatedKeys)
        indexName = await self.collection_name(entity_id)
        discard_securekeys = [key for key, value in vars(self).items() if isinstance(value, urdhva_base.types.Secret)]
        try:
            data = self.to_elastic(exclude_unset=True, exclude_none=True)
            data['u'] = datetime.utcnow()
            data['_type_'] = self.getclassname()
            for key in discard_securekeys:
                # Deleting Secure Keys if they are empty
                if not urdhva_base.types.Secret(data[key]).get_secret(entity_id):
                    del data[key]
            id = data['_id']
            del data['_id']
            client = await self.client(entity_id)
            olddata = await client.get(index=indexName, id=id)
            olddata = {**olddata["_source"], **{"_id": olddata['_id']}}

            if not entity_id:
                if not self.accesscheck(olddata):
                    return self.from_elastic({'_id': "Not Allowed"})

            for _ in range(3):
                try:
                    updated_doc = await client.update(
                        index=indexName, id=id, body={"doc": data},
                        refresh=True if not entity_id or forceRefresh else False
                    )
                    break
                except elasticsearch.exceptions.ConnectionTimeout as e:
                    logger.error(f"Timeout error {e}. Retrying_update_{indexName}")
                    await asyncio.sleep(2)

            resp = await client.get(index=indexName, id=id, request_timeout=90)
            if discardedKeys:
                resp["_source"] = {key: value for key, value in resp["_source"].items() if key not in discardedKeys}
            if auditlog_enabled:
                await self.update_auditlog(class_name, "UPDATE", {**resp["_source"], **{"_id": resp['_id']}}, olddata,
                                           entity_id=entity_id)
            return self.from_elastic({**resp["_source"], **{"_id": resp['_id']}})
        except elasticsearch.ElasticsearchException as e:
            print(f"Exception in record update {e}")

    @classmethod
    async def get(cls, element_id, entity_id=None, skipFormatedKeys=[]):
        # auditlog_enabled, class_name = cls.validateAuditLog("get")
        discardedKeys = cls.getFormatedKeys(skipFormatedKeys)
        indexName = await cls.collection_name(entity_id)
        client = await cls.client(entity_id)
        olddata = await client.get(index=indexName, id=element_id, request_timeout=90)
        olddata = {**olddata["_source"], **{"_id": olddata['_id']}}
        if not entity_id:
            if not cls.accesscheck(olddata):
                return cls.from_elastic({'_id': "Not Allowed"})
        if discardedKeys:
            olddata = {key: value for key, value in olddata.items() if key not in discardedKeys}
        return cls.from_elastic(olddata)

    @classmethod
    async def get_all(cls, params: urdhva_base.queryparams.QueryParams, entity_id=None, skip_jsonencode=False,
                      skipFormatedKeys=[]):
        # auditlog_enabled, class_name = cls.validateAuditLog("get")
        # starttime = round(datetime.utcnow().timestamp() * 1000)
        discardedKeys = cls.getFormatedKeys(skipFormatedKeys)
        try:
            indexName = await cls.collection_name(entity_id)
            if not params.q:
                params.q = cls.getdefaultquery()
            query = json.loads(params.q)
            query['size'] = params.limit
            query['from'] = params.limit * params.skip
            api_fields_limited = False
            if params.fields:
                if isinstance(params.fields, list):
                    query["_source"] = {"includes": params.fields}
                elif isinstance(params.fields, str):
                    try:
                        query["_source"] = {"includes": json.loads(params.fields)}
                        if len(query['_source']):
                            api_fields_limited = True
                    except:
                        pass
            if discardedKeys:
                if not query.get("_source"):
                    query["_source"] = {}
                query['_source']["excludes"] = discardedKeys
            if not params.sort:
                params.sort = json.dumps([{"u": {"order": "desc"}}])
            if params.sort:
                order_by = []
                for record in json.loads(params.sort):
                    record_ = {}
                    for key, value in record.items():
                        if key == '_script':
                            record_[key] = value
                        elif value.get('order'):
                            record_[key] = {**value, **{"unmapped_type": "string"}}
                    if record_:
                        order_by.append(record_)
                if order_by:
                    query['sort'] = order_by
                # query['sort'] = params.sort

            query['track_total_hits'] = True
            if not entity_id:
                filterkey = cls.isFilterEnabled()
                if filterkey:
                    rpt = urdhva_base.context.context.get('rpt', {})
                    includes = rpt.get('includes', '')
                    excludes = rpt.get('excludes', '')
                    must_not = query['query']['bool'].get('must_not', [])
                    # For Global Rules Where companyref.id mustnot exists
                    if must_not:
                        if {"exists": {"field": f"{filterkey.replace('.keyword', '')}.keyword"}} in must_not:
                            includes = excludes = []
                    if includes:
                        inc = {"terms": {filterkey: [x.strip() for x in includes.split(',') if x.strip()]}}
                        inc['terms'][filterkey].append("*")
                        query["query"]["bool"]["must"].append(inc)
                    if excludes:
                        exc = {"terms": {filterkey: [x.strip() for x in excludes.split(',') if x.strip()]}}
                        if 'must_not' not in query["query"]["bool"]:
                            query["query"]["bool"]['must_not'] = []
                        query["query"]["bool"]["must_not"].append(exc)
            must_marked_for_del = False
            if query.get("query", {}).get("bool", {}).get("must", []):
                for mquery in query["query"]["bool"]["must"]:
                    if "ccns_marked_for_delete" in mquery.get("match", {}):
                        must_marked_for_del = True
                        break
            if not must_marked_for_del and not query.get("query", {}).get("ids", {}).get("values", {}):
                must_not = query['query']['bool'].get('must_not', [])
                if not must_not:
                    must_not = []
                must_not.append({"match": {"ccns_marked_for_delete": True}})
                query['query']['bool']["must_not"] = must_not
            client = await cls.client(entity_id)
            if query["from"] + query["size"] <= 10000 and not params.scroll_id:
                response = await client.search(index=indexName, body=query, request_timeout=90)
                total = response.get('hits', {}).get('total', {}).get('value', 0)
                if response.get('hits', {}).get('total', {}).get('relation', '') == 'gte':
                    q = json.loads(params.q)
                    if "_source" in q:
                        del q['_source']
                    if "size" in q:
                        del q["size"]
                    total_count = await client.count(index=indexName, body=q)
                    if isinstance(total_count, dict) and total_count.get('count', 0) > total:
                        total = total_count['count']
                count = len(response.get('hits', {}).get("hits", []))
                resp_data = {"data": [{**record['_source'], **{"_id": record["_id"]}} for record in
                                      response.get('hits', {}).get("hits", [])], "total": total, "count": count}
                if not skip_jsonencode and urdhva_base.ctx.exists() and api_fields_limited:
                    json_compatiable_data = jsonable_encoder(resp_data)
                    return JSONResponse(content=json_compatiable_data)
                else:
                    return resp_data
            else:
                if not entity_id:
                    entity_id = urdhva_base.ctx["entity_id"]
                redis_ins = await urdhva_base.redispool.get_redis_connection()
                size = query['size']
                sort = []
                for rec in query['sort']:
                    sort.extend(list(rec.keys()))
                page = query["from"]
                data = []
                remove = ['size', 'from', 'sort', 'track_total_hits']
                for rem in remove:
                    del query[rem]
                fields = {}
                if query.get('_source', []):
                    fields.update(query['_source'])
                    del query['_source']
                total_count = await client.count(index=indexName, body=query)
                total = 0
                count = 0
                if isinstance(total_count, dict) and total_count.get('count', 0) > total:
                    total = total_count['count']
                if params.scroll_id:
                    if params.limit and params.limit % 10000 != 0:
                        print("Only Multiples of 10000 are allowed")
                        return {"data": [], "total": 0, "count": 0, "scroll_id": "Only Multiples of 10000 are allowed"}
                    params.scroll_id = ""
                if params.scroll_id:
                    scroll_id = params.scroll_id
                    size = await redis_ins.get(f"{entity_id}_scroll_id_{scroll_id}")
                    if not size:
                        size = params.limit
                    else:
                        size = int(size)
                    await redis_ins.setex(f"{entity_id}_scroll_id_{scroll_id}", 180, size)
                    publish_results = True
                    scroll_size = size
                    while scroll_size > 0:
                        try:
                            response = await client.scroll(scroll_id=scroll_id, scroll='3m')
                            scroll_id = response['_scroll_id']
                            scroll_size = len(response['hits']['hits'])
                            count += scroll_size
                            data.extend(
                                [{**result['_source'], **{'_id': result['_id']}} for result in
                                 response['hits']['hits']])
                            if count >= params.limit:
                                break
                        except:
                            if len(data) == 0:
                                publish_results = False
                                break
                    if publish_results:
                        resp_data = {"data": data[0:size], "total": total, "count": len(data[0:size]),
                                     "scroll_id": scroll_id}
                        if not skip_jsonencode and urdhva_base.ctx.exists() and api_fields_limited:
                            json_compatiable_data = jsonable_encoder(resp_data)
                            return JSONResponse(content=json_compatiable_data)
                        else:
                            return resp_data
                else:
                    size = params.limit

                base_size = 10000 if (page * size) + size > 10000 else (page * size) + size
                scroll_resp = await client.search(index=indexName, body=query, scroll='3m', size=base_size, sort=sort,
                                                  _source_excludes=fields.get("excludes", []),
                                                  _source_includes=fields.get("includes", []))
                scroll_id = scroll_resp['_scroll_id']
                await redis_ins.setex(f"{entity_id}_scroll_id_{scroll_id}", 180, size)
                scroll_size = len(scroll_resp['hits']['hits'])
                if scroll_size:
                    data.extend([{**x['_source'], **{'_id': x['_id']}} for x in scroll_resp['hits']['hits']])
                    if len(data) < (page * size) + size:
                        while scroll_size > 0:
                            response = await client.scroll(scroll_id=scroll_id, scroll='3m')
                            scroll_id = response['_scroll_id']
                            scroll_size = len(response['hits']['hits'])
                            count += scroll_size
                            data.extend(
                                [{**result['_source'], **{'_id': result['_id']}} for result in
                                 response['hits']['hits']])
                            if count >= size + page:
                                break
                resp_data = {"data": data[page:page + size], "total": total, "count": len(data[page:page + size]),
                             "scroll_id": scroll_id}
                if not skip_jsonencode and urdhva_base.ctx.exists() and api_fields_limited:
                    json_compatiable_data = jsonable_encoder(resp_data)
                    return JSONResponse(content=json_compatiable_data)
                else:
                    return resp_data
        finally:
            ...

    @classmethod
    async def _scrollApi(cls, client, indexName, query, maxSize):
        try:
            query_ = query.copy()
            query_["_source"] = ["_id"]
            query_["size"] = 10000
            res = await client.search(index=indexName, body=query_, scroll='2m')
            sid = res['_scroll_id']
            scroll_size = len(res['hits']['hits'])
            tmpData = []
            for q in res['hits']['hits']:
                tmpData.append(q["_id"])
            while (scroll_size > 0):
                res = await client.scroll(scroll_id=sid, scroll='2m')
                sid = res['_scroll_id']
                scroll_size = len(res['hits']['hits'])
                for p in res['hits']['hits']:
                    tmpData.append(p["_id"])
                if len(tmpData) >= maxSize:
                    break
            return True, tmpData
        except Exception as e:
            print("the exception which fetching the data is ", str(e))
            return False, "the exception which fetching the data is " + str(e)

    @classmethod
    async def delete(cls, id, entity_id=None, forceRefresh=False, enable_audit=True):
        auditlog_enabled, class_name = cls.validateAuditLog("delete")
        indexName = await cls.collection_name(entity_id)
        client = await cls.client(entity_id)
        olddata = await client.get(index=indexName, id=id)
        olddata = {**olddata["_source"], **{"_id": olddata['_id']}}
        # checking if this id is accessible
        if not entity_id:
            if not cls.accesscheck(olddata):
                return False
        resp = await client.delete(index=indexName, id=id, refresh=True if not entity_id or forceRefresh else False,
                                   request_timeout=60, timeout='60s')

        email = ""
        try:
            email = urdhva_base.context.context.get('rpt', {}).get("email", "-")
        except:
            pass
        # await cls.upload_r2(entity_id, id, olddata, email, class_name);
        logger.error(f"the_delete_record for entity_id {entity_id} id {id} email {email}")
        if enable_audit and auditlog_enabled:
            await cls.update_auditlog(class_name, "DELETE", {}, olddata, entity_id=entity_id)
        return True


    @classmethod
    async def delete_bulk(cls, condition, entity_id=None, forceRefresh=False):
        # auditlog_enabled, class_name = cls.validateAuditLog("delete")
        indexName = await cls.collection_name(entity_id)
        class_name = cls.__name__.lower()
        query = {"query": {"bool": {"must": [{"match": condition},
                                             {"terms": {"_type_.keyword": [class_name, class_name + "create"]}}]}}}
        client = await cls.client(entity_id)
        await client.delete_by_query(index=indexName, body=query, refresh=True, request_timeout=30, scroll='30s')
        return True

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
        }
        collection_name: str = ""


class ElasticModel(BaseElasticModel):
    id: typing.Optional[str] = Field(alias='_id')
    created: typing.Optional[datetime] = Field(alias='c')
    updated: typing.Optional[datetime] = Field(alias='u')
    org_id: typing.Optional[str] = Field(alias='entity_id')
