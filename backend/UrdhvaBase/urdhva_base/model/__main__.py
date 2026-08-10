import textx
import textx.scoping.providers
import importlib
import pkg_resources
import argparse
from . import helpers
import json

parser = argparse.ArgumentParser(description='Parse Model & generate code for a target language.')
parser.add_argument('-g', '--gen', default='python', choices=['python', 'go', 'svelte'],
                    help='Generate code for the language.')
parser.add_argument('-f', '--file', required=True, help='Input model file.')
parser.add_argument('-d', '--db', default="mongo", choices=['mongo', 'elastic', 'postgres'],
                    help='Database to be used for the models.')

args = parser.parse_args()

modelSpec = pkg_resources.resource_string(__name__, "model.tx")

mm = textx.metamodel_from_str(modelSpec.decode(),
                              auto_init_attributes=False,
                              classes=[helpers.Model,
                                       helpers.Attr,
                                       helpers.IntSpec,
                                       helpers.FloatSpec,
                                       helpers.StrSpec,
                                       helpers.BoolSpec,
                                       helpers.DictSpec,
                                       helpers.EmailSpec,
                                       helpers.DatetimeWithoutTimeZone,
                                       helpers.Datetime,
                                       helpers.Date,
                                       helpers.Time,
                                       helpers.IpAddressv4,
                                       helpers.IpAddressv6,
                                       helpers.Secret,
                                       helpers.Index,
                                       helpers.FieldOrder,
                                       helpers.Unique,
                                       helpers.Reference,
                                       helpers.Enum,
                                       helpers.Action
                                       ]
                              )

# Resolve the fields relative to the Model
# 1) In case of Index resolve fields relative to the model
# 2) In case of Reference resolve fields relative to the reference model
mm.register_scope_providers({
    "FieldOrder.field": textx.scoping.providers.RelativeName("parent.parent.attrs"),
    "Reference.attrs": textx.scoping.providers.RelativeName("model.attrs"),
})

mm.model_param_defs.add(
    'gen',
    'The code generation target programming language.'
)
mm.model_param_defs.add(
    'file',
    'input file used for code generation.'
)
mm.model_param_defs.add(
    'db',
    'Database to be used for '
)

m = mm.model_from_file(args.file, gen=args.gen, file=args.file, db=args.db)

for model in m.models:
    model.resolveReferences()

mod = importlib.import_module("urdhva_base.model." + args.gen + "gen")
getattr(mod, "generate")(m)


def generate_keycloak_authz(m):
    authz = {
        "allowRemoteResourceManagement": True,
        "policyEnforcementMode": "ENFORCING",
        "decisionStrategy": "AFFIRMATIVE",
        "resources": [],
        "policies": [
            {
                "name": "superAdminPolicy",
                "type": "role",
                "logic": "POSITIVE",
                "decisionStrategy": "UNANIMOUS",
                "config": {
                    "roles": "[{\"id\":\"superAdmin\",\"required\":false}]"
                }
            },
            {
                "name": "superAdminPermission",
                "type": "resource",
                "logic": "POSITIVE",
                "decisionStrategy": "UNANIMOUS",
                "config": {
                    "defaultResourceType": "all",
                    "applyPolicies": "[\"superAdminPolicy\"]"
                }
            },
            {
                "name": "readOnlyPolicy",
                "type": "role",
                "logic": "POSITIVE",
                "decisionStrategy": "UNANIMOUS",
                "config": {
                    "roles": "[{\"id\":\"readOnly\",\"required\":false}]"
                }
            },
            {
                "name": "readOnlyPermission",
                "type": "resource",
                "logic": "POSITIVE",
                "decisionStrategy": "UNANIMOUS",
                "config": {
                    "defaultResourceType": "readOnly",
                    "applyPolicies": "[\"readOnlyPolicy\"]"
                }
            },
            {
                "name": "adminPolicy",
                "type": "role",
                "logic": "POSITIVE",
                "decisionStrategy": "UNANIMOUS",
                "config": {
                    "roles": "[{\"id\":\"admin\",\"required\":false}]"
                }
            },
            {
                "name": "adminPermission",
                "type": "resource",
                "logic": "POSITIVE",
                "decisionStrategy": "UNANIMOUS",
                "config": {
                    "defaultResourceType": "admin",
                    "applyPolicies": "[\"adminPolicy\"]"
                }
            }
        ],
        "scopes": [
            {
                "name": "create",
                "displayName": "create"
            },
            {
                "name": "update",
                "displayName": "update"
            },
            {
                "name": "read",
                "displayName": "read"
            },
            {
                "name": "delete",
                "displayName": "delete"
            }
        ]
    }
    for model in m.models:
        if not model.is_internal:
            resource_spec = {
                "name": model.name.lower(),
                "type": "all",
                "ownerManagedAccess": False,
                "displayName": model.name,
                "attributes": {},
                "uris": [
                    f"/api/{model.name.lower()}/*"
                ],
                "scopes": [
                    {
                        "name": "create"
                    },
                    {
                        "name": "update"
                    },
                    {
                        "name": "read"
                    },
                    {
                        "name": "delete"
                    }
                ]
            }
            resource_spec_admin = {
                "name": model.name.lower() + "_admin",
                "type": "admin",
                "ownerManagedAccess": False,
                "displayName": model.name + "_admin",
                "attributes": {},
                "uris": [
                    f"/api/{model.name.lower()}/*"
                ],
                "scopes": [
                    {
                        "name": "create"
                    },
                    {
                        "name": "update"
                    },
                    {
                        "name": "read"
                    },
                    {
                        "name": "delete"
                    }
                ]
            }
            resource_spec_read = {
                "name": model.name.lower() + "_readOnly",
                "type": "readOnly",
                "ownerManagedAccess": False,
                "displayName": model.name + "_readOnly",
                "attributes": {},
                "uris": [
                    f"/api/{model.name.lower()}/*"
                ],
                "scopes": [
                    {
                        "name": "read"
                    }
                ]
            }
            for action in model.actions:
                authz['scopes'].append({"name": action.name.lower(), "displayName": action.name.lower()})
                resource_spec['scopes'].append({"name": action.name.lower()})
                resource_spec_admin['scopes'].append({"name": action.name.lower()})
                if action.name.lower().startswith("get") or action.name.lower().startswith("search"):
                    resource_spec_read['scopes'].append({"name": action.name.lower()})
            authz['resources'].append(resource_spec)
            authz['resources'].append(resource_spec_read)
            authz['resources'].append(resource_spec_admin)
    return authz


with open(args.file.split(".")[0] + "_roles.json", "w+") as f:
    f.write(json.dumps(generate_keycloak_authz(m), indent=4))
