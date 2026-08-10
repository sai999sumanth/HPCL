import urdhva_base
import hpcl_ceg_model
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import json
import fastapi

router = fastapi.APIRouter(prefix='/lpgcarousals')


# Action create_carousal
@router.post('/create_carousal', tags=['LpgCarousals'])
async def lpgcarousals_create_carousal(data: Lpgcarousals_Create_CarousalParams):
    try:
        rpt = urdhva_base.context.context.get("rpt", {})
        query = f"sap_id={data.sap_id} and carousal_id={data.carousal_id}"
        existing = await hpcl_ceg_model.LpgCarousals.get_all(urdhva_base.QueryParams(q=query), resp_type="plain")
        if existing.get("data"):
            return {
                "status": False,
                "message": f"Carousal {data.carousal_id} already exists for SAP ID {data.sap_id}",
                "data": None
            }
        resp = await hpcl_ceg_model.LpgCarousalsCreate(**data.__dict__).create()
        plant = await hpcl_ceg_model.LpgPlantsMaster.get_all(urdhva_base.QueryParams(q=f"sap_id={data.sap_id}"), resp_type="plain")
        if plant.get("data"):
            plant_name = plant["data"][0].get("plant_name", "Unknown")
        if resp:
            await hpcl_ceg_model.SystemAuditLogCreate(
                **{
                    "employee_id": rpt.get("username"),
                    "role": rpt.get("novex_role", []),
                    "email": rpt.get("email", ""),
                    "bu": "LPG",
                    "action": "CREATE",
                    "section": "LPG Action",
                    "action_model": "LpgCarousals",
                    "remarks": (
                        f"Carousel {data.carousal_id} created for "
                        f"Plant {plant_name} [SAP ID: {data.sap_id}]"
                    ),
                    "raw_data": {
                        "new_data": data.__dict__
                    }
                }
            ).create()

        return {
            "status": True,
            "message": "Carousal created successfully",
            "data": resp
        }

    except Exception as e:
        return {
            "status": False,
            "message": str(e),
            "data": None
        }


# Action update_carousal
@router.post('/update_carousal', tags=['LpgCarousals'])
async def lpgcarousals_update_carousal(data: Lpgcarousals_Update_CarousalParams):
    try:
        rpt = urdhva_base.context.context.get("rpt", {})
        existing = await hpcl_ceg_model.LpgCarousals.get_all(urdhva_base.QueryParams(q=f"sap_id={data.sap_id} and carousal_id={data.carousal_id}"), resp_type="plain")

        if not existing.get("data"):
            return {
                "status": False,
                "message": "Carousal not found",
                "data": None
            }

        record = existing["data"][0]
        old_data = record.copy()
        changes = []
        plant = await hpcl_ceg_model.LpgPlantsMaster.get_all(urdhva_base.QueryParams(q=f"sap_id={data.sap_id}"), resp_type="plain")
        plant_name = (plant["data"][0].get("plant_name") if plant.get("data") else "Unknown")

        for key, value in data.__dict__.items():
            if value is None:
                continue
            old_value = record.get(key)
            # Handle production_hrs and breaks
            if key in ["production_hrs", "breaks"]:
                new_value = [item.dict() if hasattr(item, "dict") else item for item in value]
                old_json = json.dumps(old_value, sort_keys=True, default=str)
                new_json = json.dumps(new_value, sort_keys=True, default=str)
                if old_json != new_json:
                    changes.append(f"{key.replace('_', ' ').title()} updated")
                    record[key] = new_value
                continue
            # Normal fields
            if old_value != value:
                changes.append(f"{key.replace('_', ' ').title()} changed from '{old_value}' to '{value}'")
                record[key] = value

        if not changes:
            return {
                "status": True,
                "message": "No changes detected",
                "data": existing["data"][0]
            }

        resp = await hpcl_ceg_model.LpgCarousals(**record).modify()
        if resp:
            await hpcl_ceg_model.SystemAuditLogCreate(
                **{
                    "employee_id": rpt.get("username"),
                    "role": rpt.get("novex_role", []),
                    "email": rpt.get("email", ""),
                    "bu": "LPG",
                    "action": "UPDATE",
                    "section": "LPG Action",
                    "action_model": "LpgCarousals",
                    "remarks": (
                        f"Carousel {data.carousal_id} for "
                        f"Plant {plant_name} [SAP ID: {data.sap_id}] updated. "
                        f"Changes: {'; '.join(changes)}"
                    ),
                    "raw_data": {
                        "old_data": old_data,
                        "new_data": record
                    }
                }
            ).create()

        return {
            "status": True,
            "message": "Carousal updated successfully",
            "data": resp
        }

    except Exception as e:
        return {
            "status": False,
            "message": str(e),
            "data": None
        }

# Action delete_carousal
@router.post('/delete_carousal', tags=['LpgCarousals'])
async def lpgcarousals_delete_carousal(data: Lpgcarousals_Delete_CarousalParams):
    try:
        rpt = urdhva_base.context.context.get("rpt", {})
        resp = await hpcl_ceg_model.LpgCarousals.get_all(urdhva_base.QueryParams(q=f"sap_id={data.sap_id} and carousal_id={data.carousal_id}"), resp_type="plain")
        if not resp.get("data"):
            return {
                "status": False,
                "message": "Carousal not found",
                "data": None
            }

        old_data = resp["data"][0].copy()
        plant = await hpcl_ceg_model.LpgPlantsMaster.get_all(urdhva_base.QueryParams(q=f"sap_id={data.sap_id}"), resp_type="plain")
        plant_name = (plant["data"][0].get("plant_name") if plant.get("data") else "Unknown")

        await hpcl_ceg_model.LpgCarousals.delete(old_data["id"])

        await hpcl_ceg_model.SystemAuditLogCreate(
            **{
                "employee_id": rpt.get("username"),
                "role": rpt.get("novex_role", []),
                "email": rpt.get("email", ""),
                "bu": "LPG",
                "action": "DELETE",
                "section": "LPG Action",
                "action_model": "LpgCarousals",
                "remarks": (
                    f"Carousel {data.carousal_id} deleted from "
                    f"Plant {plant_name} [SAP ID: {data.sap_id}]"
                ),
                "raw_data": {
                    "old_data": old_data
                }
            }
        ).create()

        return {
            "status": True,
            "message": "Carousal deleted successfully",
            "data": None
        }

    except Exception as e:
        return {
            "status": False,
            "message": str(e),
            "data": None
        }