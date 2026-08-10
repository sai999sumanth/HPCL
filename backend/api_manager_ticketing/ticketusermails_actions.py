from hpcl_ceg_ticketing_enum import *
from hpcl_ceg_ticketing_model import *
import fastapi
import ticketing_actions as ticketing_actions
router = fastapi.APIRouter(prefix='/ticketusermails')


# Action get_ticket_mails
@router.post('/get_ticket_mails', tags=['TicketUserMails'])
async def ticketusermails_get_ticket_mails(
    data: Ticketusermails_Get_Ticket_MailsParams
):

    sap_ids = data.sap_id or []
    zone = data.zone
    category = data.category
    
    functional_area = ticketing_actions.CATEGORY_FUNCTIONAL_MAP.get(category)
    if not functional_area:
        return {"error": f"Invalid category: {category}"}
    
    users = []

    if sap_ids:
        clean_sap_ids = [s.strip() for s in sap_ids if s.strip()]
        if clean_sap_ids:
            sap_values = ",".join(f"'{s}'" for s in clean_sap_ids)

            params = urdhva_base.queryparams.QueryParams(q=f"sap_id IN ({sap_values}) AND level='Location'", limit=0)
            params.fields = ["employee_name", "email_id", "role","employee_id"]
            users_rec = await TicketUserMails.get_all(params=params, resp_type="plain")
            records = users_rec.get("data", [])
            if records:
                users.extend(records)

    #roles = [f"{zone}-{functional_area}", f"{zone}-ZonalHead", "HQO"]
    #role_values = ",".join(f"'{r}'" for r in roles)
    roles = []

    if isinstance(zone, list):
        for z in zone:
            roles.append(f"{z}-{functional_area}")
            roles.append(f"{z}-ZonalHead")
    else:
        roles.append(f"{zone}-{functional_area}")
        roles.append(f"{zone}-ZonalHead")

    roles.append("HQO")

    role_values = ",".join(f"'{r}'" for r in roles)

    params = urdhva_base.queryparams.QueryParams(q=f"role IN ({role_values})", limit=0)
    params.fields = ["employee_name", "email_id", "role","employee_id"]

    users_rec = await TicketUserMails.get_all(params=params, resp_type="plain")
    records = users_rec.get("data", [])
    if users_rec:
        users.extend(records)

    return {"data": users}
