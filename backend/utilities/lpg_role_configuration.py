lpg_role_mapping={
    "LPG": {
        "Check Scale Rejection": {
            "name": "Check Scale Rejection",
            "severity": "Critical",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 5,
                    "assign_role": "Safety Officer LPG,Location In-Charge LPG,Maintenance Officer LPG,Planning Officer LPG",
                    "escalation_role": "Safety Officer LPG,Location In-Charge LPG,Maintenance Officer LPG,Planning Officer LPG",
                    "escalation_time": "PT24H"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 10,
                    "assign_role": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                    "escalation_role": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                    "escalation_time": "PT24H"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 10,
                    "assign_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_time": "PT24H"
                },
                "level - 4": {
                    "condition": ">",
                    "value": 10,
                    "assign_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_time": "PT24H"
                }
            }
        },
        "Valve Leak Rejection": {
            "name": "Valve Leak Rejection",
            "severity": "Critical",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 5,
                    "assign_role": "Safety Officer LPG,Location In-Charge LPG,Maintenance Officer LPG,Planning Officer LPG",
                    "escalation_role": "Safety Officer LPG,Location In-Charge LPG,Maintenance Officer LPG,Planning Officer LPG",
                    "escalation_time": "PT24H"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 10,
                    "assign_role": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                    "escalation_role": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                    "escalation_time": "PT24H"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 10,
                    "assign_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_time": "PT24H"
                },
                "level - 4": {
                    "condition": ">",
                    "value": 10,
                    "assign_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_time": "PT24H"
                }
            }
        },
        "O-Ring Leak Rejection": {
            "name": "O-Ring Leak Rejection",
            "severity": "Critical",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 5,
                    "assign_role": "Safety Officer LPG,Location In-Charge LPG,Maintenance Officer LPG,Planning Officer LPG",
                    "escalation_role": "Safety Officer LPG,Location In-Charge LPG,Maintenance Officer LPG,Planning Officer LPG",
                    "escalation_time": "PT24H"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 10,
                    "assign_role": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                    "escalation_role": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                    "escalation_time": "PT24H"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 10,
                    "assign_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_time": "PT24H"
                },
                "level - 4": {
                    "condition": ">",
                    "value": 10,
                    "assign_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_role": "HQO LPG,HQO Head LPG,HQO Sale General Manager,HQO Operations LPG,HQO HSE LPG",
                    "escalation_time": "PT24H"
                }
            }
        }
    }
}