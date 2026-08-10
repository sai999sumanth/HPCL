emlock_vehicle_mapping = {
    "TAS": {
        "FanNotGenerated": {
            "interlock_name": "Fan Number Not Generated",
            "sop_id": "SOP055",
            "severity": "HIGH",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        },
        "SwipeInCountExceeded": {
            "interlock_name": "Swipe In Count Exceeded",
            "sop_id": "SOP056",
            "severity": "HIGH",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        },
        "TToutsideTerminalRadius": {
            "interlock_name": "TT outside Terminal Radius",
            "sop_id": "SOP057",
            "severity": "Critical",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        },
        "SwipeOutCountExceeded": {
            "interlock_name": "Swipe Out Count Limit Exceed",
            "sop_id": "SOP058",
            "severity": "HIGH",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        },
        "InvoiceNotGenerated": {
            "interlock_name": "Invoice Not Generated",
            "sop_id": "SOP059",
            "severity": "Low",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        },
        "ShipmentNumberNotGenerated": {
            "interlock_name": "Shipment Number Not Generated",
            "sop_id": "SOP060",
            "severity": "Low",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        },
        "TToutsideRoRadius": {
            "interlock_name": "TT outside RO radius",
            "sop_id": "SOP061",
            "severity": "Critical",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        },
        "PreDecantationRequestExceeded": {
            "interlock_name": "Pre Decantation Request Exceed",
            "sop_id": "SOP062",
            "severity": "HIGH",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        },
        "PostDecantationRequestExceeded": {
            "interlock_name": "Post Decantation Request Exceed",
            "sop_id": "SOP063",
            "severity": "Medium",
            "period": "weekly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 0,
                    "assign_role": "Location In-Charge SOD",
                    "escalation_role": "Location In-Charge SOD",
                    "escalation_time": ""
                }
            }
        }
    },
    "RO": {
        "TToutsideRoRadius": {"interlock_name": "TT outside RO radius","sop_id": "SOP020","severity": "Critical"},
        "PreDecantationRequestExceeded": {"interlock_name": "Pre Decantation Request Exceed","sop_id": "SOP021","severity": "HIGH"},
        "PostDecantationRequestExceeded": {"interlock_name": "Post Decantation Request Exceed","sop_id": "SOP022","severity": "Medium"}
    }
}