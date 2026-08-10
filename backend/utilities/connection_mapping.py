import urdhva_base

connection_mapping = urdhva_base.settings.db_connection_config
# connection_mapping = {
#     "ims": "3",
#     "hpcl_ceg": "1",
#     "cris": "2"
# }

schema_mapping = {
    "cris": "HPCL_HOS",
    "ims": "IMS_SAP",
    "hpcl_ceg": "HPCL_HOS"
}

table_mapping = {
    "dry_out": "sch_inventory_forecast_dashboard",
    "indent_req": "INDENT_REQUEST",
    "indent_prod": "INDENT_PRODUCTS",
    "indent_pattern": "INDENT_PATTERN",
    "truck_swipe": "TRUCK_SWIPE_ENTRY_SAP",
}

camunda_listener_mapping = urdhva_base.settings.camunda_url_config
camunda_listener_va_mapping = urdhva_base.settings.camunda_url_va_config

# camunda_listener_mapping = {
#     "camunda_dryout_01": {"host": "10.90.38.167", "port": 9080},
#     "camunda_dryout_02": {"host": "10.90.38.167", "port": 9081},
#     "camunda_dryout_03": {"host": "10.90.38.167", "port": 9082},
#     "camunda_dryout_04": {"host": "10.90.38.167", "port": 9083},
#     "camunda_dryout_05": {"host": "10.90.38.167", "port": 9084},
#     "camunda_dryout_06": {"host": "10.90.38.167", "port": 9085},
#     "camunda_dryout_07": {"host": "10.90.38.167", "port": 9086},
#     "camunda_dryout_08": {"host": "10.90.38.167", "port": 9087},
#     "camunda_dryout_09": {"host": "10.90.38.167", "port": 9088},
#     "camunda_dryout_10": {"host": "10.90.38.167", "port": 9089}
# }

dry_out_top_x_axis = [{"name": "Indent Not Raised", "group": "not_raised"},
                  {"name": "Indent On Hold", "group": "pending"}, {"name": "Pending Indents", "group": "pending"},
                  {"name": "Truck Allocated", "group": "wip"},
                  {"name": "Sent to SAP", "group": "wip"}, {"name": "Sales Order Placed", "group": "wip"},
                  {"name": "R2 Swiped", "group": "wip"}, {"name": "Invoice Created", "group": "wip"},
                  {"name": "R3 Swiped", "group": "wip"}, {"name": "Transit(TAS→RO)", "group": "wip"},
                  {"name": "ATG Ack", "group": "delivered"}, {"name": "Delivery Confirmation", "group": "delivered"},
                  {"name": "EMLock", "group": "delivered"}, {"name": "VTS Return", "group": "delivered"},
                  {"name": "Trip Completed", "group": "delivered"}]

truck_details = ["Dealer TT", "TT Available", "Empty Dealer TT Return", "Empty Transporter Return"]

dryout_aging = ["DryOut < 2 Days", "DryOut < 7 Days", "DryOut < 15 Days", "DryOut < 30 Days"]

dry_out_bottom_x_axis = [
        "Dealer", "SO\nRM", "SO\nCO", "SO", "SO\nRM", "SO\nRM", "PO\nRM", "PO\nRM", "PO\nRM", "PO\nRM", "SO\nRM"
    ]

creds_type = urdhva_base.settings.db_connection_mapping

# creds_type = {
#     "2": {"cred_model": "Databases", 'cred_type': "PostgreSQL"},
#     "3": {"cred_model": "Databases", 'cred_type': "Oracle"},
#     "1": {"cred_model": "Databases", 'cred_type': "PostgreSQL"}
# }

product_code_mapping = {
    "MS": "2811000",
    "HSD": "2812000",
    "TURBO": "3912000",
    "E20": "2822000",
    "POWER 95": "3672000",
    "POWER 99": "2816000",
    "POWER 100": "3373000"
}

item_name_mapping = {
    "2811000": "MS",
    "2812000": "HSD",
    "3912000": "TURBO",
    "2822000": "E20",
    "3672000": "POWER 95",
    "2816000": "POWER 99",
    "3373000": "POWER 100"
}

alert_action_category = {
    "VA": {
        "Safety": "Safety",
        "Security": "Security",
        "Operations": "Operations",
        "FalseAlert": "FalseAlert",
        "InvalidAlert": "InvalidAlert",
        "Quality": "Quality",
        "Other": "Other"
    },
    "VTS": {
        "Safety": "Safety",
        "Pilferage": "Pilferage",
        "Operations": "Operations"
    }
}

alert_action_rca_reason = {
    "VTS": [
        "Health Issue",
        "Person Issue",
        "Equipment issue",
        "Location/Outlet Near by",
        "Other"
    ],
    "VA": [
        "Person issue",
        "Equipment issue",
        "Lack of Awareness",
        "InvalidAlert",
        "FalseAlert",
        "Maintenance Issue",
        "Calibration Issue",
        "Other"
    ]
}

rca_reason = {
    "FIRE/SMOKE": [
        "Short circuit or electrical fault.",
        "Equipment overheating.",
        "Unauthorized fire-related activities.",
        "Negligence during operations.",
        "Others"
    ],
    "ABSENCE OF EARTHING": [
        "Equipment not properly grounded.",
        "Earthing mechanism damaged or removed.",
        "Neglect in routine earthing checks.",
        "Others"
    ],
    "ABSENCE OF WHEELCHOCK": [
        "Misplaced after previous use.",
        "Insufficient wheel chocks allocated.",
        "Lack of awareness or training.",
        "Others"
    ],
    "ALIGHT FROM TWO WHEELER": [
        "Unsafe behavior or oversight by personnel.",
        "Lack of adherence to safety guidelines.",
        "Lack of proper monitoring.",
        "Others"
    ],
    "UNAUTHORIZED FILLING OF CONTAINER": [
        "Negligence or lack of training.",
        "Absence of supervision in sensitive areas.",
        "Deliberate violation of procedures.",
        "Others"
    ],
    "ABSENCE OF FIRE EXTINGUISHER DECANTATION": [
        "Fire extinguisher removed for emergency use.",
        "Neglect in replacing after usage.",
        "Lack of periodic safety checks.",
        "Others"
    ],
    "Person not wearing Safety Helmet": [
        "Person not wearing helmets due to oversight.",
        "Helmets damaged or unavailable.",
        "Lack of training on PPE compliance.",
        "Others"
    ],
    "LINE OF FIRE": [
        "Personnel entering restricted or unsafe zones.",
        "Lack of awareness about safety protocols.",
        "Poor supervision or monitoring.",
        "Others"
    ],
    "ABSENCE OF SAFETY HARNESS": [
        "Safety harness not available at the site.",
        "Personnel neglecting safety protocols.",
        "Damaged or unusable harness not replaced.",
        "Others"
    ],
    "Fire-Extinguisher": [
        "Routine maintenance or refill pending.",
        "Misplacement during an emergency.",
        "Delay in procurement of replacements.",
        "Others"
    ],
    "Wheel-Chock": [
        "Chock not placed due to negligence.",
        "Damaged chock not replaced.",
        "Lack of proper storage or tracking.",
        "Others"
    ],
    "Intrusion-PersonAtPerimeter": [
        "Unauthorized entry due to lack of monitoring.",
        "Security personnel not alert.",
        "Malfunctioning perimeter systems.",
        "Others"
    ],
    "LPGLeak-FillingGun": [
        "Damaged or malfunctioning filling gun.",
        "Improper handling during operations.",
        "Lack of routine equipment checks.",
        "Others"
    ],
    "LPGLeak-Detection": [
        "Faulty or uncalibrated detection systems.",
        "Lack of routine maintenance.",
        "Leakage caused by improper operations.",
        "Others"
    ],
    "PPE-Compliance": [
        "Personnel unaware of PPE guidelines.",
        "Unavailability or damage to PPE equipment.",
        "Neglect in wearing mandatory PPE.",
        "Others"
    ],
    "MAINTENANCE": [
        "Insufficient spare parts inventory.",
        "Others"
    ],
    "HIGH-LEVEL ALARM": [
        "Exceeded operational limits",
        "Faulty level sensors.",
        "Incorrect calibration of setpoints.",
        "Blocked or restricted process flow.",
        "Others"
    ],
    "HCD ALARM": [
        "Misconfigured alarm thresholds.",
        "Process fluctuations beyond normal range.",
        "Sensor drift or errors.",
        "Others"
    ],
    "HCD FAULT": [
        "Loose wiring or connection fault.",
        "Power supply interruption.",
        "System software or firmware issues.",
        "Others"
    ]
}

vts_alert_section = {
    "TAS": {
        "VTS": {
            "alert_section": "VTS",
            "close_alert_func": "vts_alert_closer",
            "actions": {
                "Justify": {
                    "name": "Justification",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Maintenance Officer SOD", "Plant In-Charge SOD", 
                              "Planning Officer SOD", "Zonal Transport Officer SOD", "Location In-Charge SOD"]
                },
                "Accept Violation": {
                    "name": "AcceptViolation",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Maintenance Officer SOD", "Plant In-Charge SOD", 
                              "Planning Officer SOD", "Location In-Charge SOD", "Zonal Transport Officer SOD"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge SOD", "Zonal Transport Officer SOD", "Zonal Head SOD"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge SOD", "Zonal Transport Officer SOD", "Zonal Head SOD"]
                },
                "False Violation": {
                    "name": "FalseViolation",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Maintenance Officer SOD", "Plant In-Charge SOD", 
                              "Planning Officer SOD", "Location In-Charge SOD", "Zonal Transport Officer SOD"]
                }
            },
            "rca_reason": [
                "Health Issue",
                "Person Issue",
                "Equipment issue",
                "Location/Outlet Near by",
                "Other"
            ]
        }
    },
    "LPG": {
        "VTS": {
            "alert_section": "VTS",
            "close_alert_func": "vts_alert_closer",
            "actions": {
                "Justify": {
                    "name": "Justification",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer LPG","Location In-Charge LPG", "Zonal HSE LPG",
                              "Zonal Operations Head LPG", "HQO HSE LPG", "HQO Operations LPG"]
                },
                "Accept Violation": {
                    "name": "AcceptViolation",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer LPG","Location In-Charge LPG", "Zonal HSE LPG",
                              "Zonal Operations Head LPG", "HQO HSE LPG", "HQO Operations LPG"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge LPG", "Zonal HSE LPG", "Zonal Operations Head LPG",
                              "HQO HSE LPG", "HQO Operations LPG"]
                },
                "False Violation": {
                    "name": "FalseViolation",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer LPG","Location In-Charge LPG", "Zonal HSE LPG",
                              "Zonal Operations Head LPG", "HQO HSE LPG", "HQO Operations LPG"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge LPG", "Zonal HSE LPG", "Zonal Operations Head LPG",
                              "HQO HSE LPG", "HQO Operations LPG"]
                }
            },
            "category": {
                "Safety": "Safety",
                "Pilferage": "Pilferage",
                "Operations": "Operations"
            },
            "rca_reason": [
                "Health Issue",
                "Person Issue",
                "Equipment issue",
                "Location/Outlet Near by",
                "Other"
            ]
        }
    }
}

alert_action = {
    "TAS": {
        "TAS": {
            "alert_section": "TAS",
            "close_alert_func": "",
            "actions": {
                "Justify": {
                    "name": "Justification",
                    "close_alert": False,
                    "roles": ["Admin", "Planning Officer SOD", "Safety Officer SOD", "Maintenance Officer SOD", "TAS Officer", "Zonal TAS Officer"]
                },
                "Maintenance": {
                    "name": "Maintenance",
                    "close_alert": False,
                    "roles": ["Admin", "Planning Officer SOD", "Safety Officer SOD", "Maintenance Officer SOD", "TAS Officer", "Zonal TAS Officer"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin", "Plant In-Charge SOD","Location In-Charge SOD"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin", "Plant In-Charge SOD","Location In-Charge SOD"]
                }
            },
            "category": {
                "Safety": "Safety",
                "Process": "Process"
            },
            "rca_reason": [
                "Equipment issue",
                "Other"
            ]
        },
        "VA": {
            "alert_section": "VA",
            "close_alert_func": "va_alert_closer",
            "actions": {
                "Accept & Close": {
                    "name": "AcceptClose",
                    "close_alert": True,
                    "roles": ["Admin", "Safety Officer SOD", "Maintenance Officer SOD", "Location In-Charge SOD", "Plant In-Charge SOD", "Planning Officer SOD",
                              "Zonal SOD", "Zonal Manager SOD", "Zonal Transport Officer SOD", "Zonal Chief Manager SOD", "Zonal Executive Officer SOD",
                              "Distribution Manager SOD", "HQO Manager SOD", "HQO Supply Officer SOD", "HQO HSE SOD"]
                },
                "FalseAlert": {
                    "name": "FalseAlert",
                    "close_alert": True,
                    "roles": ["Admin", "Safety Officer SOD", "Maintenance Officer SOD", "Location In-Charge SOD", "Plant In-Charge SOD", "Planning Officer SOD",
                              "Zonal SOD", "Zonal Manager SOD", "Zonal Transport Officer SOD", "Zonal Chief Manager SOD", "Zonal Executive Officer SOD",
                              "Distribution Manager SOD", "HQO Manager SOD", "HQO Supply Officer SOD", "HQO HSE SOD"]
                }
            },
            "category": {
                "Safety": "Safety",
                "Security": "Security",
                "Operations": "Operations",
                "FalseAlert": "FalseAlert",
                "InvalidAlert": "InvalidAlert",
                "Quality": "Quality",
                "Other": "Other"
            },
            "rca_reason": [
                "Person issue",
                "Equipment issue",
                "Lack of Awareness",
                "InvalidAlert",
                "FalseAlert",
                "Other"
            ]
        },
        "VTS": {
            "alert_section": "VTS",
            "close_alert_func": "vts_alert_closer",
            "actions": {
                "UnBlock": {
                    "name": "Justification",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Maintenance Officer SOD", "Plant In-Charge SOD", 
                              "Planning Officer SOD", "Zonal Transport Officer SOD", "Location In-Charge SOD"]
                },
                "Accept & Block": {
                    "name": "AcceptClose",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Maintenance Officer SOD", "Plant In-Charge SOD", 
                              "Planning Officer SOD", "Location In-Charge SOD", "Zonal Transport Officer SOD"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Zonal Transport Officer SOD", "Zonal Head SOD"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge SOD", "Zonal Transport Officer SOD", "Zonal Head SOD"]
                },
                "Send It Back": {
                    "name": "SendItBack",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge SOD", "Zonal Transport Officer SOD", "Zonal Head SOD"]
                }
            },
            "category": {
                "Attributable to Transporter": [
                    "Reason RCA", 
                    "Route Deviation without Stoppage",
                    "TT crew issue",
                    "Location/Outlet Nearby"
                    ],
                "Non-Attributable to Transporter": [
                    "Network Issue", "Equipment Issue", 
                    "Route deviation - Administrative orders",
                    "Route Deviation without Stoppage",
                    "TT crew issue",
                    "Location/Outlet Nearby"
                    ]
            }
        },
        "EMLock": {
            "alert_section": "EMLock",
            "close_alert_func": "emlock_alert_closer",
            "actions": {
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Planning Officer SOD"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Planning Officer SOD"]
                }
            },
            "category": {
                "Other": "Other"
            },
            "rca_reason": [
                "Other"
            ]
        }
    },
    "LPG": {
        "LPG": {
            "alert_section": "LPG",
            "close_alert_func": "",
            "actions": {
                "Justify": {
                    "name": "Justification",
                    "close_alert": False,
                    "roles": ["Admin","Safety Officer LPG", "Location In-Charge LPG", "Maintenance Officer LPG", "Planning Officer LPG",
                              "Zonal HSE LPG", "Zonal Operations Chief Manager LPG", "Zonal Head LPG","Zonal Officer LPG", "Zonal Operations Head LPG",
                              "Zonal Operations LPG", "HQO LPG", "HQO Head LPG", "HQO Sale General Manager", "HQO Operations LPG","HQO HSE LPG"]
                },
                "Accept & Close": {
                    "name": "AcceptClose",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer LPG", "Location In-Charge LPG", "Maintenance Officer LPG", "Planning Officer LPG",
                              "Zonal HSE LPG", "Zonal Operations Chief Manager LPG", "Zonal Head LPG","Zonal Officer LPG", "Zonal Operations Head LPG",
                              "Zonal Operations LPG", "HQO LPG", "HQO Head LPG", "HQO Sale General Manager", "HQO Operations LPG","HQO HSE LPG"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin","Safety Officer LPG", "Location In-Charge LPG", "Maintenance Officer LPG", "Planning Officer LPG",
                              "Zonal HSE LPG", "Zonal Operations Chief Manager LPG", "Zonal Head LPG","Zonal Officer LPG", "Zonal Operations Head LPG",
                              "Zonal Operations LPG", "HQO LPG", "HQO Head LPG", "HQO Sale General Manager", "HQO Operations LPG","HQO HSE LPG"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin","Safety Officer LPG", "Location In-Charge LPG", "Maintenance Officer LPG", "Planning Officer LPG",
                              "Zonal HSE LPG", "Zonal Operations Chief Manager LPG", "Zonal Head LPG","Zonal Officer LPG", "Zonal Operations Head LPG",
                              "Zonal Operations LPG", "HQO LPG", "HQO Head LPG", "HQO Sale General Manager", "HQO Operations LPG","HQO HSE LPG"]
                }
            },
            "category": {
                "Safety": "Safety",
                "Security": "Security",
                "Operations": "Operations",
                "FalseAlert": "FalseAlert",
                "InvalidAlert": "InvalidAlert",
                "Quality": "Quality",
                "Other": "Other"
            },
            "rca_reason": [
                "Equipment issue",
                "Lack of Awareness",
                "InvalidAlert",
                "FalseAlert",
                "Maintenance Issue",
                "Calibration Issue",
                "Other"
            ]
        },
        "VA": {
            "alert_section": "VA",
            "close_alert_func": "va_alert_closer",
            "actions": {
                "Accept & Close": {
                    "name": "AcceptClose",
                    "close_alert": True,
                    "roles": ["Admin", "Safety Officer LPG", "Location In-Charge LPG", "Maintenance Officer LPG", "Planning Officer LPG",
                              "Zonal HSE LPG", "Zonal Operations Chief Manager LPG", "Zonal Head LPG","Zonal Officer LPG",
                              "Zonal Operations LPG", "HQO LPG", "HQO Head LPG", "HQO Sale General Manager", "HQO Operations LPG","HQO HSE LPG"]
                },
                "FalseAlert": {
                    "name": "FalseAlert",
                    "close_alert": True,
                    "roles": ["Admin", "Safety Officer LPG", "Location In-Charge LPG", "Maintenance Officer LPG", "Planning Officer LPG",
                              "Zonal HSE LPG", "Zonal Operations Chief Manager LPG", "Zonal Head LPG","Zonal Officer LPG",
                              "Zonal Operations LPG", "HQO LPG", "HQO Head LPG", "HQO Sale General Manager", "HQO Operations LPG","HQO HSE LPG"]
                }
            },
            "category": {
                "Safety": "Safety",
                "Security": "Security",
                "Operations": "Operations",
                "FalseAlert": "FalseAlert",
                "InvalidAlert": "InvalidAlert",
                "Quality": "Quality",
                "Other": "Other"
            },
            "rca_reason": [
                "Person issue",
                "Equipment issue",
                "Lack of Awareness",
                "InvalidAlert",
                "FalseAlert",
                "Maintenance Issue",
                "Calibration Issue",
                "Other"
            ]
        },
        "VTS": {
            "alert_section": "VTS",
            "close_alert_func": "vts_alert_closer",
            "actions": {
                "UnBlock": {
                    "name": "Justification",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer LPG", "Maintenance Officer LPG", "Planning Officer LPG",
                              "Location In-Charge LPG", "Zonal Distributions Head LPG"]
                },
                "Accept & Block": {
                    "name": "AcceptClose",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer LPG", "Maintenance Officer LPG", "Planning Officer LPG",
                              "Location In-Charge LPG", "Zonal Distributions Head LPG"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge LPG", "Zonal Distributions Head LPG", "Zonal Head LPG", "Zonal Operations LPG"]
                },
                "Send It Back": {
                    "name": "SendItBack",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge LPG", "Zonal Distributions Head LPG", "Zonal Head LPG", "Zonal Operations LPG"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge LPG", "Zonal Distributions Head LPG", "Zonal Head LPG", "Zonal Operations LPG"]
                }
            },
            "category": {
                "Attributable to Transporter": [
                    "Reason RCA", 
                    "Route Deviation without Stoppage",
                    "TT crew issue",
                    "Location/Outlet Nearby"
                    ],
                "Non-Attributable to Transporter": [
                    "Network Issue", "Equipment Issue", 
                    "Route deviation - Administrative orders",
                    "Route Deviation without Stoppage",
                    "TT crew issue",
                    "Location/Outlet Nearby"
                    ]
            }
        },
        "EMLock": {
            "alert_section": "EMLock",
            "close_alert_func": "emlock_alert_closer",
            "actions": {
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Planning Officer SOD"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Planning Officer SOD"]
                }
            },
            "category": {
                "Other": "Other"
            },
            "rca_reason": [
                "Other"
            ]
        }
    },
    "RO": {
        "RO": {
            "alert_section": "RO",
            "close_alert_func": "",
            "create_workflow_func": "execute_workflow_ro",
            "actions": {
                "Raise Request": {
                    "name": "Raised",
                    "close_alert": False,
                    "create_workflow": True,
                    "roles": ["Admin", "RO Dealer"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": False,
                    "roles": ["Admin", "Sales Officer RO", "Regional Manager RO", "Zonal Head RO"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin", "Sales Officer RO", "Regional Manager RO", "Zonal Head RO"]
                }
            },
            "category": {
                "Other": "Other"
            },
            "rca_reason": [
                "Other"
            ]
        },
        "VA": {
            "alert_section": "VA",
            "close_alert_func": "va_alert_closer",
            "actions": {
                "Justify": {
                    "name": "Justification",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Safety Officer LPG", "TAS Officer", "Zonal TAS Officer"]
                },
                "Accept & Close": {
                    "name": "AcceptClose",
                    "close_alert": True,
                    "roles": ["Admin", "Safety Officer SOD", "Safety Officer LPG", "TAS Officer", "Zonal TAS Officer"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Location In-Charge LPG", "Zonal Safety Officer SOD", "Zonal Operations Head", "Zonal SOD Head", "HQO TAS Coordinator", "HQO Operations Team", "HQO HSSE Team"]
                },
                "FalseAlert": {
                    "name": "FalseAlert",
                    "close_alert": True,
                    "roles": ["Admin", "Safety Officer SOD", "Safety Officer LPG", "TAS Officer", "Zonal TAS Officer"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge SOD", "Location In-Charge LPG", "Zonal Safety Officer SOD", "Zonal Operations Head", "Zonal SOD Head", "HQO TAS Coordinator", "HQO Operations Team", "HQO HSSE Team"]
                }
            },
            "category": {
                "Safety": "Safety",
                "Security": "Security",
                "Operations": "Operations",
                "FalseAlert": "FalseAlert",
                "InvalidAlert": "InvalidAlert",
                "Quality": "Quality",
                "Other": "Other"
            },
            "rca_reason": [
                "Person issue",
                "Equipment issue",
                "Lack of Awareness",
                "InvalidAlert",
                "FalseAlert",
                "Other"
            ]
        },
        "VTS": {
            "alert_section": "VTS",
            "close_alert_func": "vts_alert_closer",
            "actions": {
                "Justify": {
                    "name": "Justification",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Safety Officer LPG", "TAS Officer", "Zonal TAS Officer"]
                },
                "Accept & Close": {
                    "name": "AcceptClose",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Safety Officer LPG", "TAS Officer", "Zonal TAS Officer"]
                },
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Location In-Charge LPG", "Zonal Safety Officer SOD", "Zonal Operations Head", "Zonal SOD Head", "HQO TAS Coordinator", "HQO Operations Team", "HQO HSSE Team"]
                },
                "FalseAlert": {
                    "name": "FalseAlert",
                    "close_alert": False,
                    "roles": ["Admin", "Safety Officer SOD", "Safety Officer LPG", "TAS Officer", "Zonal TAS Officer"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": False,
                    "roles": ["Admin", "Location In-Charge SOD", "Location In-Charge LPG", "Zonal Safety Officer SOD", "Zonal Operations Head", "Zonal SOD Head", "HQO TAS Coordinator", "HQO Operations Team", "HQO HSSE Team"]
                }
            },
            "category": {
                "Safety": "Safety",
                "Pilferage": "Pilferage",
                "Operations": "Operations"
            },
            "rca_reason": [
                "Health Issue",
                "Person Issue",
                "Equipment issue",
                "Location/Outlet Near by",
                "Other"
            ]
        },
        "EMLock": {
            "alert_section": "EMLock",
            "close_alert_func": "emlock_alert_closer",
            "actions": {
                "Approve": {
                    "name": "Approved",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Planning Officer SOD"]
                },
                "Reject": {
                    "name": "Rejected",
                    "close_alert": True,
                    "roles": ["Admin", "Location In-Charge SOD", "Planning Officer SOD"]
                }
            },
            "category": {
                "Other": "Other"
            },
            "rca_reason": [
                "Other"
            ]
        }
    }
}

dry_out_query = f"""SELECT
                        "title",
                        "value" AS "Site_Count",
                        "prodvalue",
                        "tankvalue",
                        SUM("value") OVER (PARTITION BY 1) AS "totalvalue"
                    FROM (
                        SELECT
                            CASE
                                WHEN status = 1 THEN 'DRY OUT'
                                WHEN status = 2 THEN 'INTRADAY DRY OUT'
                                WHEN status = 3 THEN '1-3 Days'
                                WHEN status = 4 THEN '4-6 Days'
                            END AS "title",
                            status AS seqno,
                            COUNT(DISTINCT site_id || fcc_code) AS "value",
                            COUNT(DISTINCT site_id || fcc_code || item_name) AS "prodvalue",
                            SUM(tank_cnt) AS "tankvalue"
                        FROM (
                            SELECT
                                site_id,
                                fcc_code,
                                product_grp AS item_name,
                                COUNT(DISTINCT tank_no) AS tank_cnt,
                                CASE
                                    WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= 0 THEN 1
                                    WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) < (SUM(sch.avgsales_7days) / 7) THEN 2
                                    WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) >= (SUM(sch.avgsales_7days) / 7)
                                         AND SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= (SUM(sch.avgsales_7days) / 7) * 3 THEN 3
                                    WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) > (SUM(sch.avgsales_7days) / 7) * 3
                                         AND SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= (SUM(sch.avgsales_7days) / 7) * 6 THEN 4
                                    ELSE 6
                                END AS status
                            FROM "HPCL_HOS".sch_inventory_forecast_dashboard as sch
                            WHERE sch.volume > 0
                            GROUP BY site_id, fcc_code, product_grp
                            ORDER BY site_id, fcc_code, product_grp
                        ) AS result1
                        WHERE status < 6
                        GROUP BY status
                        ORDER BY seqno
                    ) AS result2"""
