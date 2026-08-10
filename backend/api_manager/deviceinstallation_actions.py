import os
import httpx
import urdhva_base
import json
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
from fastapi import UploadFile, File, Depends
import urdhva_base.queryparams as queryparams
import utilities.minio_connector as minio_connector
import utilities.zone_code_mapping as zone_code_mapping
import fastapi
import datetime

router = fastapi.APIRouter(prefix="/deviceinstallation", tags=["DeviceInstallation"])




def _format_date(value):
    if isinstance(value, datetime.datetime):
        return value.strftime("%Y-%m-%d")
    elif isinstance(value, datetime.date):
        return value.strftime("%Y-%m-%d")
    elif isinstance(value, str):
        return value
    return None


async def call_commissioning_api(payload: dict):
    async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.post(urdhva_base.settings.commisioning_url,
                                             json=payload,
                                             headers={"Content-Type": "application/json"})
                if response.status_code // 100 != 2:
                    return False, {
                        "status_code": response.status_code, "body": response.text,
                        "message": "Error to get the link"
                    }

                return True, response.json()
            except httpx.RequestError as e:
                return False, {"error": f"Network error: {str(e)}"}
            except Exception as e:
                return False, {"error": str(e)}
            
async def call_decommissioning_api(payload: dict):
    async with httpx.AsyncClient(timeout=60) as client:
            try:
                response = await client.post(urdhva_base.settings.decommisioning_url,
                                             json=payload,
                                             headers={"Content-Type": "application/json"})
                if response.status_code // 100 != 2:
                    return False, {
                        "status_code": response.status_code, "body": response.text,
                        "message": "Error to get the link"
                    }

                return True, response.json()
            except httpx.RequestError as e:
                return False, {"error": f"Network error: {str(e)}"}
            except Exception as e:
                return False, {"error": str(e)}
      


# Action validate_aot_details
@router.post('/validate_aot_details', tags=['DeviceInstallation'])
async def deviceinstallation_validate_aot_details(data: Deviceinstallation_Validate_Aot_DetailsParams):
    """
    Create device installation record and perform commissioning
    """
    try:
        payload = data.dict()
 
        initial_payload = {
            "sap_tt_no": payload.get("sap_tt_no"),
            "sap_id": payload.get("sap_id"),
            "transporter": payload.get("transporter"),
            "contract_valid_upto": payload.get("contract_valid_upto"),
            "select_business": payload.get("select_business"),
            "status": "REQUESTED"
        }
        
                
        record = DeviceInstallationCreate(**initial_payload)
        result = await record.create()

        record_dict = result if isinstance(result, dict) else result.__dict__
        device_id = record_dict.get("id")

        # print(f"Device record created with ID: {device_id}")

        # STEP 2: Build commissioning payload
        comm_payload = {
            "id": device_id,
            "created_at": _format_date(record_dict.get("created_at")),
            "sap_tt_no": record_dict.get("sap_tt_no"),
            "location": record_dict.get("sap_id"),
            "transporter": record_dict.get("transporter"),
            "reason_for_cancel": "",
            "contract_valid_upto": record_dict.get("contract_valid_upto"),
            "status": "REQUESTED",
            "remarks": "Device installation requested"
        }

        print("Commissioning payload:", comm_payload)

        # STEP 3: Call commissioning API       
        comm_success, comm_response = await call_commissioning_api(comm_payload)

        status_messages = comm_response.get("statusMessages", "")
        if isinstance(status_messages, list):
            status_messages = ", ".join(status_messages)

        final_status = comm_response.get("status", "")
        status_code = comm_response.get("statusCode")

        # STEP 4: FAILURE CASE        
        if not comm_success or  status_code == 1:
            await DeviceInstallation(**{
                "id": device_id,
                "commissioning_status": final_status,
                "commissioning_responses": status_messages
            }).modify()

            return {
                "status": False, "message": f"Device installation failed {status_messages}",
                "data": {
                    "device_id": device_id,
                    "commissioning": {
                        "success": False, "status": final_status, "response": comm_response
                    }
                }
            }

        # STEP 5: SUCCESS CASE        
        if comm_success and status_code == 0:
        
            await DeviceInstallation(**{
                "id": device_id, "commissioning_status": final_status,
                "commissioning_responses": status_messages
            }).modify()

            return {
                "status": True, "message": f"The {status_messages}",
                "data": {
                    "device_id": device_id,
                    "commissioning": {
                        "success": True,
                        "status": final_status, "status_code": status_code, "response": comm_response
                    }
                }
            }

    except Exception as e:
        print(f"Exception in update_device_installation: {str(e)}")
        return {
            "status": False,
            "message": f"Failed to process device installation: {str(e)}", "data": {}
        }   


# Action update_device_installation
@router.post('/update_device_installation', tags=['DeviceInstallation'])
async def update_device_installation(
    data: Deviceinstallation_Update_Device_InstallationParams = Depends(
        Deviceinstallation_Update_Device_InstallationParams
    ),certificate_file: UploadFile | None = File(None)
):
    """
    Update device installation record safely
    """
    try:
        # Get only fields sent by client
        payload = data.dict(exclude_unset=True)

        sap_tt_no = payload.get("sap_tt_no")
        sap_id = payload.get("sap_id")
        zone = payload.get("zone")

        # Get zone_code from zone_code_mapp
        zone_code = zone_code_mapping.get_zone_code(sap_id, zone) if zone else ""

        params = urdhva_base.queryparams.QueryParams()
        params.q = (
            f"sap_id='{sap_id}' "
            f"AND sap_tt_no='{sap_tt_no}' "
            f"AND commissioning_status = 'SUCCESS' "
        )
        params.limit = 1
        params.fields = []

        result = await DeviceInstallation.get_all(params, resp_type="plain")
        rows = result.get("data", [])
        
        if not rows:
            return {
                "status": False, "message": "Not able to update to the record"
            }

        device_id = rows[0]["id"]
        
        # CERTIFICATE UPLOAD
        if certificate_file:
            upload_dir = os.path.join(
                urdhva_base.settings.uploads,
                "device_installation"
            )
            os.makedirs(upload_dir, exist_ok=True)

            file_path = os.path.join(upload_dir, certificate_file.filename)
            with open(file_path, "wb") as f:
                f.write(await certificate_file.read())

            status, minio_path = minio_connector.upload_to_minio(
                "VTS",
                "Device_Installation_Certificates",sap_tt_no,file_path
            )

            if not status:
                return {
                    "status": False, "message": "MinIO upload failed", "error": minio_path
                }

            payload["certificate"] = minio_path

            try:
                os.remove(file_path)
            except Exception:
                pass

        # Build update data (do NOT overwrite missing fields)
        update_data = {"id": device_id}
        for key, value in payload.items():
            if value is not None:
                update_data[key] = value

        # Add zone_code if available
        if zone_code:
            update_data["zone_code"] = zone_code

        # Update record
        await DeviceInstallation(**update_data).modify()

        return {
            "status": True,
            "message": "Record updated successfully",
            "data": {
                "device_id": device_id,
                "updated_fields": list(update_data.keys())
            }
        }

    except Exception as e:
        return {
            "status": False, "message": str(e), "data": {}
        }


# Action action_device_vts
@router.post('/action_device_vts', tags=['DeviceInstallation'])
async def deviceinstallation_action_device_vts(payload :dict):
    """
    If only sap_tt_no given → return row from DB (no update)
    """
    try:
        id = payload.get("id")
        status = payload.get("status")
        remarks = payload.get("remarks")
        
        if not status or not remarks:
            return {"status": False,"message": "status and remarks are required", "data": {}}

        params = urdhva_base.queryparams.QueryParams()
        params.q = f"id='{id}'"
        params.limit = 1
        params.fields = []   # all fields

        existing = await DeviceInstallation.get_all(params, resp_type="plain")

        rows = existing.get("data")
        if not rows:
            return {"status": False,"message": f"No record found for SAP TT No","data": []}

        row = rows[0]

        status = "Approved" if status == "Accepted" else "Rejected"
        device_id = row.get("id")

        # update dict from existing row
        data_dict = dict(row)
        data_dict.pop("id", None)
        data_dict["status"] = status
        data_dict["remarks"] = remarks

        await DeviceInstallation(id=device_id, **data_dict).modify()
        updated = await DeviceInstallation.get_all(params, resp_type="plain")
        updated_rows = updated.get("data")

        if isinstance(updated_rows, list) :
            record_dict = updated_rows[0]

        device_id = record_dict.get("id")

        # BUILD COMMISSIONING PAYLOAD
        comm_payload_2 = {
            "id": device_id,
            "created_at": _format_date(record_dict.get("updated_at")),
            "contract_valid_upto": record_dict.get("contract_valid_upto"),
            "location": record_dict.get("sap_id"),
            "reason_for_cancel": "",
            "sap_tt_no": record_dict.get("sap_tt_no"),
            "transporter": record_dict.get("transporter"),
            "status":"PENDING",
            "remarks" :record_dict.get("remarks"),
        }

        # CALL COMMISSIONING API
        comm_success, comm_response = await call_commissioning_api(comm_payload_2)
        status_messages = comm_response.get("statusMessages")

        if isinstance(status_messages, list):
            status_messages = ", ".join(status_messages)

        await DeviceInstallation(**{
            "id": device_id,
            "commissioning_responses_2": status_messages,
        }).modify()

        return {
            "status": True,
            "message":  f"Device installation of {status_messages}",
            "data": {
                "commissioning": {
                    "success": comm_success,
                    "response": comm_response
                }
            }
        }

    except Exception as e:
        print("Exception in action_device_vts:", str(e))
        return {"status": False,"message": str(e),"data": [] }


# Action action_decommissioning
@router.post('/action_decommissioning', tags=['DeviceInstallation'])
async def deviceinstallation_action_decommissioning(payload: dict):
    """
    1. If reason_for_cancel provided → Create new record with status_decommissioning
    2. If status_decommissioning='Accepted' → Update existing record and call de-commissioning API
    """
    try:

        device_id = int(payload.get("id"))

        status_decommissioning = payload.get("status_decommissioning")
        reason_for_cancel = payload.get("reason_for_cancel")

        params = urdhva_base.queryparams.QueryParams()
        params.q = f"id='{device_id}'"
        params.limit = 1
        params.fields = []  # all fields

        existing = await DeviceInstallation.get_all(params, resp_type="plain")
        rows = existing.get("data", [])

        if not rows:
            return {
                "status": False,
                "message": f"No record found for ID: {device_id}",
                "data": {}
            }

        row = rows[0]
        # print(f'Found existing record: {row.get("sap_tt_no")}')

        # CREATE NEW RECORD
        if reason_for_cancel and not status_decommissioning:

            # Copy data from existing record
            data_dict = dict(row)
            data_dict.pop("id", None)

            columns_to_clear = ["aot_request_type","aot_status","certificate","expiry_alert_created","vehcile_installation_date"]
            for column in columns_to_clear:
                if column in data_dict:
                    data_dict.pop(column)

            data_dict["reason_for_cancel"] = reason_for_cancel
            data_dict["status_decommissioning"] = "Request For Approval"

            record = DeviceInstallationCreate(**data_dict)
            new_record = await record.create()

            # Convert to dict if needed
            record_dict = new_record if isinstance(new_record, dict) else new_record.__dict__
            # new_device_id = record_dict.get("id")

            return {
                "status": True, "message": "decommissioning requested",
                "data": {
                    "reason_for_cancel": reason_for_cancel,
                    "status_decommissioning": "Request For Approval"
                }
            }

        else:
            # status_decommissioning and status_decommissioning.lower() == 'accepted':
            params = urdhva_base.queryparams.QueryParams()
            params.q = f"id='{device_id}'"
            params.limit = 1
            params.fields = []   # all fields

            existing = await DeviceInstallation.get_all(params, resp_type="plain")

            rows = existing.get("data")
            row = rows[0]
            # update dict from existing row
            
            # Store original status before conversion
            # original_status = status_decommissioning
            status_decommissioning = "Approved" if status_decommissioning == "Accepted" else "Rejected"
           
            
            data_dict = dict(row)
            data_dict.pop("id", None)
            data_dict["status_decommissioning"] = status_decommissioning

            await DeviceInstallation(id=device_id, **data_dict).modify()
            updated = await DeviceInstallation.get_all(params, resp_type="plain")
            updated_rows = updated.get("data")

            if isinstance(updated_rows, list) :
                record_dict = updated_rows[0]

            device_id = record_dict.get("id")

            # Only call decommissioning API if status was "Approved"
            if status_decommissioning == "Approved":
                
                de_comm_payload = {
                    "id": device_id,
                    "created_at": _format_date(record_dict.get("updated_at")),
                    "sap_tt_no": record_dict.get("sap_tt_no"),
                    "location": record_dict.get("sap_id"),
                    "transporter": record_dict.get("transporter"),
                    "reason_for_cancel": record_dict.get("reason_for_cancel"),
                    "status": "PENDING",
                    "remarks": "",
                    "contract_valid_upto": record_dict.get("contract_valid_upto")
                }

                # print(f'De-commissioning payload: {de_comm_payload}')

                comm_success, comm_response = await call_decommissioning_api(de_comm_payload)

    

                # Extract status messages from successful response
                status_messages = comm_response.get("statusMessages", "")
                if isinstance(status_messages, list):
                    status_messages = ", ".join(status_messages)
                    
                final_status = comm_response.get("status", "")
                status_code = comm_response.get("statusCode")

                       
                if not comm_success or  status_code == 1:
                    await DeviceInstallation(**{
                        "id": device_id,
                        "de_commissioning_responses": status_messages,
                        "status_decommissioning": "Request For Approval",
                    }).modify()

                    return {
                        "status": False, "message": f"{status_messages}",
                        "data": {
                            "device_id": device_id,
                            "status_decommissioning": "Request For Approval",
                            "commissioning": {
                                "success": False, "status": final_status, "response": comm_response
                            }
                        }
                    }

                # STEP 5: SUCCESS CASE                        
                if comm_success and status_code == 0:            
                    await DeviceInstallation(**{
                        "id": device_id,
                        "de_commissioning_responses": status_messages
                    }).modify()

                    return {
                        "status": True, "message": f"The {status_messages}",
                        "data": {
                            "device_id": device_id,
                            "commissioning": {
                                "success": True,
                                "status": final_status, "status_code": status_code, "response": comm_response
                            }
                        }
                    }
            else:
                return {
                    "status": True, "message": f"Status updated to {status_decommissioning}",
                    "data": {
                        "device_id": device_id
                    }
                }

    except Exception as e:
        print(f"Exception in update_device_installation: {str(e)}")

        return {
            "status": False,
            "message": f"Failed to process device installation: {str(e)}", "data": {}
        }





# Action action_decommissioning_rejected
@router.post('/action_decommissioning_rejected', tags=['DeviceInstallation'])
async def deviceinstallation_action_decommissioning_rejected(payload: dict):
    try:

        device_id = int(payload.get("id"))

        status_decommissioning = payload.get("status_decommissioning")
        reason_for_cancel = payload.get("reason_for_cancel")

        params = urdhva_base.queryparams.QueryParams()
        params.q = f"id='{device_id}'"
        params.limit = 1
        params.fields = []  # all fields

        existing = await DeviceInstallation.get_all(params, resp_type="plain")
        rows = existing.get("data", [])

        if not rows:
            return {
                "status": False,
                "message": f"No record found for ID: {device_id}",
                "data": {}
            }

        row = rows[0]
        # print(f'Found existing record: {row.get("sap_tt_no")}')
        
        
        # CREATE NEW RECORD
        if reason_for_cancel and  status_decommissioning:

            # Copy data from existing record
            data_dict = dict(row)
            data_dict.pop("id", None)

            columns_to_clear = ["aot_request_type","aot_status","certificate","expiry_alert_created","vehcile_installation_date","reason_for_cancel","status_decommissioning"]
            for column in columns_to_clear:
                if column in data_dict:
                    data_dict.pop(column)

            data_dict["reason_for_cancel"] = reason_for_cancel
            data_dict["status_decommissioning"] = "Request For Approval"

            record = DeviceInstallationCreate(**data_dict)
            new_record = await record.create()

            # Convert to dict if needed
            record_dict = new_record if isinstance(new_record, dict) else new_record.__dict__
            # new_device_id = record_dict.get("id")

            return {
                "status": True, "message": "Decommissioning requested",
                "data": {
                    "reason_for_cancel": reason_for_cancel,
                    "status_decommissioning": "Request For Approval"
                }
            }

        

    except Exception as e:
        print(f"Exception in update_device_installation: {str(e)}")

        return {
            "status": False,
            "message": f"Failed to process device installation: {str(e)}", "data": {}
        }
