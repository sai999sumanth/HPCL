import fastapi
import urdhva_base
import hpcl_ceg_ticketing_model
from datetime import datetime

router = fastapi.APIRouter(prefix='/alertcategorymaster')

def get_login_user():
    rpt = urdhva_base.context.context.get('rpt') or {}
    return rpt.get('username') or "Novex"

# Action add_category
@router.post('/add_category', tags=['AlertCategoryMaster'])
async def alertcategorymaster_add_category(data: hpcl_ceg_ticketing_model.Alertcategorymaster_Add_CategoryParams):


    user_name = get_login_user()
    print("LOGIN USER →", user_name)
    
    res = await hpcl_ceg_ticketing_model.AlertCategoryMaster.get_all(resp_type="plain")
    rows = res.get("data", [])

    if not rows:
        return {"message": "Master not created"}

    row = rows[0]
    existing_categories = row.get("category") or []

    if data.category in existing_categories:
        return {"message": "Category already exists"}

    updated_categories = existing_categories + [data.category]

    history = row.get("created_history") or []

    history.append({
        "updated_by": user_name,
        "updated_time": datetime.now().isoformat(),
        "action":"Added_Category",
        "category": data.category,
        "sub_category": None
    })
    await hpcl_ceg_ticketing_model.AlertCategoryMaster(
        id=row["id"],
        created_by=user_name,
        category=updated_categories,
        created_history=history
    ).modify()

    return {"message": "Category added successfully"}


# Action add_sub_category
@router.post('/add_sub_category', tags=['AlertCategoryMaster'])
async def alertcategorymaster_add_sub_category(data: hpcl_ceg_ticketing_model.Alertcategorymaster_Add_Sub_CategoryParams):

    user_name = get_login_user()

    res = await hpcl_ceg_ticketing_model.AlertCategoryMaster.get_all(resp_type="plain")
    rows = res.get("data", [])

    if not rows:
        return {"message": "Master not created"}

    row = rows[0]
    existing = row.get("sub_category") or []

    if data.sub_category in existing:
        return {"message": "Sub Category already exists"}

    updated = existing + [data.sub_category]

    history = row.get("created_history") or []

    history.append({
        "updated_by": user_name,
        "updated_time": datetime.now().isoformat(),
        "action":"Added_SubCategory",
        "category": None,
        "sub_category": data.sub_category
    })

    await hpcl_ceg_ticketing_model.AlertCategoryMaster(
        id=row["id"],
        created_by=user_name,
        sub_category=updated,
        created_history=history
    ).modify()

    return {"message": "Sub Category added successfully"}


# Action delete_category
@router.post('/delete_category', tags=['AlertCategoryMaster'])
async def alertcategorymaster_delete_category(data: hpcl_ceg_ticketing_model.Alertcategorymaster_Delete_CategoryParams):

    user_name = get_login_user()

    res = await hpcl_ceg_ticketing_model.AlertCategoryMaster.get_all(resp_type="plain")
    rows = res.get("data", [])

    if not rows:
        return {"message": "Master not created"}

    row = rows[0]
    existing = row.get("category") or []

    if data.category not in existing:
        return {"message": "Category not found"}

    updated = [c for c in existing if c != data.category]

    history = row.get("created_history") or []

    history.append({
        "updated_by": user_name,
        "updated_time": datetime.now().isoformat(),
        "action":"Deleted_Category",
        "category": data.category,
        "sub_category": None
    })

    await hpcl_ceg_ticketing_model.AlertCategoryMaster(
        id=row["id"],
        created_by=user_name,
        category=updated,
        created_history=history
    ).modify()

    return {"message": "Category deleted successfully"}


# Action delete_sub_category
@router.post('/delete_sub_category', tags=['AlertCategoryMaster'])
async def alertcategorymaster_delete_sub_category(data: hpcl_ceg_ticketing_model.Alertcategorymaster_Delete_Sub_CategoryParams):

    user_name = get_login_user()

    res = await hpcl_ceg_ticketing_model.AlertCategoryMaster.get_all(resp_type="plain")
    rows = res.get("data", [])

    if not rows:
        return {"message": "Master not created"}

    row = rows[0]
    existing = row.get("sub_category") or []

    if data.sub_category not in existing:
        return {"message": "Sub Category not found"}

    updated = [sc for sc in existing if sc != data.sub_category]

    history = row.get("created_history") or []

    history.append({
        "updated_by": user_name,
        "updated_time": datetime.now().isoformat(),
        "action":"Deleted_SubCategory",
        "category": None,
        "sub_category": data.sub_category
    })
    await hpcl_ceg_ticketing_model.AlertCategoryMaster(
        id=row["id"],
        created_by=user_name,
        sub_category=updated,
        created_history=history
    ).modify()

    return {"message": "Sub Category deleted successfully"}
