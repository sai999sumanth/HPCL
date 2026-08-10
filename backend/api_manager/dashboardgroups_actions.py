from dashboard_studio_enum import *
from dashboard_studio_model import *
import fastapi
from orchestrator.dashboard.chart_factory import charts_functions

router = fastapi.APIRouter(prefix='/dashboardgroups')


# Action update_dashboard_groups
@router.post('/update_dashboard_groups', tags=['DashboardGroups'])
async def dashboardgroups_update_dashboard_groups(data: Dashboardgroups_Update_Dashboard_GroupsParams):
    grp_data = DashboardGroups(**{"id": data.record_id, "name": data.name,
                                  "created_by": data.created_by, "created_user": data.created_user,
                                  "dashboard_order": data.dashboard_order
                                  })
    await grp_data.modify()
    return "Group Modified"


# Action update_dashboard_group_order
@router.post('/update_dashboard_group_order', tags=['DashboardGroups'])
async def dashboardgroups_update_dashboard_group_order(data: Dashboardgroups_Update_Dashboard_Group_OrderParams):
    async_session = await charts_functions.check_db("db")
    session = async_session()
    try:
        grp_order_query = """UPDATE dashboard_groups\nSET group_order = CASE id\n"""
        for grp in data.group_orders:
            grp_order_query += f"    WHEN {grp.group_id} THEN {grp.group_order}\n"
        grp_order_query += "END;"
        print(grp_order_query)
        await session.execute(text(grp_order_query))
        await session.commit()
        return grp_order_query
    except Exception as e:
        print(e)
        return str(e)
    finally:
        await session.close()
