from dashboard_studio_enum import *
from dashboard_studio_model import *
import fastapi
import urdhva_base
from orchestrator.dashboard.chart_factory import charts_functions
router = fastapi.APIRouter(prefix='/dashboards')


# Action save_dashboards
@router.post('/save_dashboards', tags=['DashBoards'])
async def dashboards_save_dashboards(data: Dashboards_Save_DashboardsParams):
    """
        Description:
            This function will save the dashboard if no id and update the dashboard if id and also create the group if group id is 0 else update the group
        Input:
            Dashboards_Save_DashboardsParams
        Returns:
            A dictionary of status, message and data
        Output:
            {"status":True, "message": "Dashboard created", "data":[]}
    """
    if urdhva_base.context.context.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}
    created_by = rpt.get('email', 'system')
    created_user = rpt.get('given_name', 'Zolix') + ' ' + rpt.get('family_name', 'Engine')
    data.created_by = created_by
    data.created_user = created_user

    for grp_ind, grp_id in enumerate(data.group_id):
        if grp_id == 0:
            grp_data = DashboardGroupsCreate(**{"name": data.group_name[grp_ind], "created_by": data.created_by,
                                       "created_user": data.created_user, "organization_id": data.organization_id})
            collected  = await grp_data.create()
            print("collected create: ", collected)
            print("Groups created")
            data.group_id = [collected['id']] if isinstance(collected, dict) else [collected.id]
        else:
            grp_data = DashboardGroups(**{"id": grp_id, "name": data.group_name[grp_ind],
                                 "created_by": data.created_by, "created_user": data.created_user,
                                          "organization_id": data.organization_id
                                })
            await grp_data.modify()
            collected = grp_data
            print("collected modified: ", collected)
            print("Groups modified")

    if data.record_id:
        changed_by = rpt.get('given_name', 'Zolix') + ' ' + rpt.get('family_name', 'Engine')
        dashboard_data = data.dict()
        dashboard_data.update({"id": data.record_id, "changed_by": changed_by})
        print("dashboard_data: ",dashboard_data)
        dashboard_data = DashBoards(**dashboard_data)
        await dashboard_data.modify()
        message = "Dashboard modified"
    else:
        created_by = rpt.get('email', 'system')
        created_user = rpt.get('given_name', 'Zolix') + ' ' + rpt.get('family_name', 'Engine')
        dashboard_data = data.dict()
        print('dashboard group id: ',dashboard_data['group_id'])
        dashboard_data.update({"created_by": created_by, "changed_by": created_by, "created_user":created_user})
        dashboard_data = DashBoardsCreate(**dashboard_data)
        resp = await dashboard_data.create()
        dashboard_data = dashboard_data.dict()
        dashboard_data.update({"id": resp['id']})
        message = "Dashboard created"
    return {"status": True, "message": message, "data": dashboard_data}


# Action get_dashboard_details
@router.post('/get_dashboard_details', tags=['DashBoards'])
async def dashboards_get_dashboard_details(data: Dashboards_Get_Dashboard_DetailsParams):
    """
        Description:
            This function will provide the dashboard data associated with given name and value
        Input:
            {
                "name": "dashboard_status",
                "value": "Published"
            }
        Returns:
            A List of dashboard data
    """
    return await charts_functions.fetch_dashboard_details(data.organization_id, data.name, data.value)


# Action get_dashboard_groups
@router.post('/get_dashboard_groups', tags=['DashBoards'])
async def dashboards_get_dashboard_groups(data: Dashboards_Get_Dashboard_GroupsParams):
    """
        Description:
            This function will provide groups and number of dashboards associated with that groups.
            If group id is not given, it returns every group's counts else returns only the given group
        Input:
            {
                "organization_id": 6,
                "group_id": 1
            }
        Returns:
            A List of dictionary
        Output:
            [
                {
                    "group_name": "test"
                    "dashboard_count": 2
                }
            ]
    """
    return await charts_functions.fetch_dashboard_group_details(data.organization_id, data.group_id)


# Action get_dashboard_uri
@router.post('/get_dashboard_uri', tags=['DashBoards'])
async def dashboards_get_dashboard_uri(data: Dashboards_Get_Dashboard_UriParams):
    ...
