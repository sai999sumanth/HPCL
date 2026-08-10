Cris_Alert_Mapping = {
    "RO": {
        "Low Product": {
            "name": "Product Low Level",
            "sop_id": "SOP294",
            "severity": "Critical",
            "period": "monthly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 3,
                    "0": "Sales Officer RO",
                    "escalation_time": "PT6H",
                    "disabling_hrs": "6"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 5,
                    "0": "Sales Officer RO",                                    # 0 Assign Role
                    "1": "Regional Manager RO",                                 # 1 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",               # 3 Notification
                    "escalation_time": "PT6H",
                    "disabling_hrs": "6"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 5,
                    "0": "Sales Officer RO",                                        # 0 Assign Role 
                    "1": "Regional Manager RO",                                     # 1 Assign Role
                    "2": "Zonal Head RO",                                           # 2 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",                   # 3 Notification
                    "4": "Sales Officer RO, Regional Manager RO, Zonal Head RO",    # 4 Notification
                    "escalation_time": "PT12H",
                    "disabling_hrs": "12"
                }
            }
        },
        "High Water": {
            "name": "High Water Level",
            "sop_id": "SOP295",
            "severity": "Critical",
            "period": "monthly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 3,
                    "0": "Sales Officer RO",
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 6,
                    "0": "Sales Officer RO",                                    # 0 Assign Role
                    "1": "Regional Manager RO",                                 # 1 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",               # 3 Notification
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 6,
                    "0": "Sales Officer RO",                                        # 0 Assign Role 
                    "1": "Regional Manager RO",                                     # 1 Assign Role
                    "2": "Zonal Head RO",                                           # 2 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",                   # 3 Notification
                    "4": "Sales Officer RO, Regional Manager RO, Zonal Head RO",    # 4 Notification
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                }
            }
        },
        "TT Receipt": {
            "name": "TT Receipt",
            "sop_id": "SOP296",
            "severity": "Critical",
            "period": "monthly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 2,
                    "0": "Sales Officer RO",
                    "escalation_time": "P1D",
                    "disabling_hrs": "24"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 6,
                    "0": "Sales Officer RO",                                    # 0 Assign Role
                    "1": "Regional Manager RO",                                 # 1 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",               # 3 Notification
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 6,
                    "0": "Sales Officer RO",                                        # 0 Assign Role 
                    "1": "Regional Manager RO",                                     # 1 Assign Role
                    "2": "Zonal Head RO",                                           # 2 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",                   # 3 Notification
                    "4": "Sales Officer RO, Regional Manager RO, Zonal Head RO",    # 4 Notification
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                }
            }
        },
        "Decantation": {
            "name": "Decantation",
            "sop_id": "SOP297",
            "severity": "Critical",
            "period": "monthly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 3,
                    "0": "Sales Officer RO",
                    "escalation_time": "P1D",
                    "disabling_hrs": "24"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 7,
                    "0": "Sales Officer RO",                                    # 0 Assign Role
                    "1": "Regional Manager RO",                                 # 1 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",               # 3 Notification
                    "escalation_time": "P1D",
                    "disabling_hrs": "24"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 7,
                    "0": "Sales Officer RO",                                        # 0 Assign Role 
                    "1": "Regional Manager RO",                                     # 1 Assign Role
                    "2": "Zonal Head RO",                                           # 2 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",                   # 3 Notification
                    "4": "Sales Officer RO, Regional Manager RO, Zonal Head RO",    # 4 Notification
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                }
            }
        },
        "NANF": {
            "name": "NANF",
            "sop_id": "SOP298",
            "severity": "High",
            "period": "monthly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 2,
                    "0": "Sales Officer RO",
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 5,
                    "0": "Sales Officer RO",                                    # 0 Assign Role
                    "1": "Regional Manager RO",                                 # 1 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",               # 3 Notification
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 5,
                    "0": "Sales Officer RO",                                        # 0 Assign Role 
                    "1": "Regional Manager RO",                                     # 1 Assign Role
                    "2": "Zonal Head RO",                                           # 2 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",                   # 3 Notification
                    "4": "Sales Officer RO, Regional Manager RO, Zonal Head RO",    # 4 Notification
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                }
            }
        },
        "Pump Test": {
            "name": "No Pump Test",
            "sop_id": "SOP299",
            "severity": "High",
            "period": "monthly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 3,
                    "0": "Sales Officer RO",
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 7,
                    "0": "Sales Officer RO",                                    # 0 Assign Role
                    "1": "Regional Manager RO",                                 # 1 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",               # 3 Notification
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 7,
                    "0": "Sales Officer RO",                                        # 0 Assign Role 
                    "1": "Regional Manager RO",                                     # 1 Assign Role
                    "2": "Zonal Head RO",                                           # 2 Assign Role
                    "3": "Sales Officer RO, Regional Manager RO",                   # 3 Notification
                    "4": "Sales Officer RO, Regional Manager RO, Zonal Head RO",    # 4 Notification
                    "escalation_time": "P6D",
                    "disabling_hrs": "144"
                }
            }
        },
        "Restroom Cleaning Evidence Missing": {
            "name": "Restroom Cleaning Evidence Missing",
            "sop_id": "SOP023",
            "severity": "High",
            "period": "monthly",
            "escalations": {
                "level - 1": {
                    "condition": "<",
                    "value": 3,
                    "0": "Sales Officer RO",
                    "1": "Sales Officer RO",
                    "2": "Sales Officer RO",
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 2": {
                    "condition": "<>",
                    "value": 7,
                    "0": "Sales Officer RO",
                    "1": "Sales Officer RO",
                    "2": "Sales Officer RO",
                    "escalation_time": "P2D",
                    "disabling_hrs": "48"
                },
                "level - 3": {
                    "condition": ">",
                    "value": 7,
                    "0": "Sales Officer RO",
                    "1": "Sales Officer RO",
                    "2": "Sales Officer RO",
                    "escalation_time": "P6D",
                    "disabling_hrs": "144"
                }
            }
        }
    }
}
