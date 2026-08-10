import urdhva_base
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi

router = fastapi.APIRouter(prefix='/userloginaudit')


# Action fetch_login_audit
@router.post('/fetch_login_audit', tags=['UserLoginAudit'])
async def userloginaudit_fetch_login_audit(data: Userloginaudit_Fetch_Login_AuditParams):
    query = ""
    rpt = urdhva_base.context.context.get('rpt', {})
    roles = rpt.get("novex_role")
    username = rpt.get("username")
    if not any(role in ["admin", "superadmin"] for role in roles):
        query = f"""employee_id='{username}' """
    params = urdhva_base.queryparams.QueryParams()
    params.q = query
    params.skip = data.skip
    params.limit = data.limit
    params.sort = {"created_at": "desc"}
    params.search_text = data.search_string
    audit = await UserLoginAudit.get_all(params, resp_type='plain')
    return {"status": True, "message": "success", "data": audit["data"]}
