from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import json
import glob
import fastapi
import importlib

router = fastapi.APIRouter(prefix='/credsmodel')


# Action create_credential
@router.post('/create_credential', tags=['CredsModel'])
async def credsmodel_create_credential(data: Credsmodel_Create_CredentialParams):
    """
        Creates a new credential in the credential vault.

        Args:
            data (Credentialvault_Create_CredentialParams): The parameters required to create a new credential.

        Returns:
            tuple: A boolean indicating the success of the operation and a corresponding message.
        """
    module_path = f"orchestrator.connection_vault.{data.cred_model.lower()}.{data.cred_type.lower()}"
    name = data.cred_type

    if data.cred_model.lower() == "databases":
        action = 'test_connection'
        module = importlib.import_module(module_path)
        klass = getattr(module, name.title().replace("_", ""))
        klass = klass(data.credentials.__dict__)
        function = getattr(klass, action)
        result = await function()
        if result['status']:
            if data.connection_id:
                creds_data = CredsModel(
                    **{
                        "name": data.name,
                        "cred_model": data.cred_model,
                        "cred_type": data.cred_type,
                        "credentials": data.credentials,
                        "organization_id": data.organization_id
                    }
                )
                resp = await creds_data.modify()
                return {
                    "status": True, "message": "Successfully updated credential", "data": resp
                }

            creds_data = CredsModelCreate(
                **{
                    "name": data.name,
                    "cred_model": data.cred_model,
                    "cred_type": data.cred_type,
                    "credentials": data.credentials,
                    "organization_id": data.organization_id
                }
            )
            resp = await creds_data.create()

            return {
                "status": True, "message": "Successfully saved credential", "data": resp
            }
        else:
            return {
                "status": False, "message": "Unable to connect database.", "data": []
            }

    if data.connection_id:
        creds_data = await CredsModel(
            **{
                "name": data.name,
                "cred_model": data.cred_model,
                "cred_type": data.cred_type,
                "credentials": data.credentials,
                "organization_id": data.organization_id
            }
        )
        resp = await creds_data.modify()
        return {
            "status": True, "message": "Successfully updated credential", "data": resp
        }

    creds_data = CredsModelCreate(
        **{
            "name": data.name,
            "cred_model": data.cred_model,
            "cred_type": data.cred_type,
            "credentials": data.credentials,
            "organization_id": data.organization_id
        }
    )
    resp = await creds_data.create()
    return {
        "status": True, "message": "Successfully saved credential", "data": resp
    }


# Action load_creds
@router.post('/load_creds', tags=['CredsModel'])
async def credsmodel_load_creds(data: Credsmodel_Load_CredsParams):
    _creds_list = []
    _section_list = dict()
    for each_json in glob.glob("../orchestrator/connection_vault/objects/*.json"):
        _creds_dict = dict()
        json_file = open(each_json)
        json_data = json.load(json_file)
        if json_data['vault_configuration']:
            section = each_json.split("/")[-2]
            section = json_data['section'].replace("_", " ")
            if section not in _section_list.keys():
                _section_list[section] = []
            # _creds_dict[os.path.basename(each_json).replace(".json", '')] = json_data['vault_configuration']
            _creds_dict[json_data['name'].replace('_', " ")] = json_data['vault_configuration']
            _section_list[section].append(_creds_dict)
    _creds_list.append(_section_list)
    return {"status": True, "message": "Success", "data": _creds_list}
