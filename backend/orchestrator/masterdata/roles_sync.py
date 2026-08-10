import urdhva_base
import asyncio
import hpcl_ceg_model


async def sync_user_roles():
    role_mapping = {
    "Zonal Operations SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Head SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Head SOD Ticketing": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "SOD & LPG Operations":{
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "Pro Dash"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    }
                ]
            }
        ],
        "status": True
    },
    "C&MD":{
        "allowed_pages": [
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Industry",
                        "allowed_sub_menus": [
                            {
                                "title": "Retail Industry Performance"
                            },
                            {
                                "title": "Lpg Industry Performance"
                            }
                        ]
                    },
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                            {
                                "title": "Retail Insights"
                            },
                            {
                                "title": "LPG Insights"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            },
                            {
                                "title": "TAS Insights",
                                "allowed_sub_menus": [
                                    {
                                        "title": "BCU Dosing Alerts"
                                    },
                                    {
                                        "title": "BAY Analytics"
                                    },
                                    {
                                        "title": "BCU Critical Parameter"
                                    }
                                ]
                            },
                            {
                                "title": "Bay Caliberation Module"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "Retail Governance",
                        "allowed_sub_menus": [
                            {
                                "title": "Sanitation Compliance"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "Pro Dash"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    }
                ]
            },
            {
                "menu_name": "Direct Sales",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Insights"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "I&C Insights"
                    },
                    {
                        "title": "I&C Campaign"
                    }
                ]
            },
            {
                "menu_name": "VA",
                "allowed_sub_menus": [
                    {
                        "title": "VA Home"
                    },
                    {
                        "title": "SOD Video Analytics"
                    },
                    {
                        "title": "LPG Video Analytics"
                    },
                    {
                        "title": "RO Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            },
            {
                "menu_name": "Pipeline",
                "allowed_sub_menus": []
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    },
                    {
                        "title": "Locations"
                    },
                    {
                        "title": "RO Esc Matrix"
                    }
                ]
            },
            {
                "menu_name": "Collapse Sidebar",
            }
        ],
        "status": True
    },
    "SSO Demo":{
        "allowed_pages": [
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                            {
                                "title": "Marketing Summary"
                            },
                            {
                                "title": "Retail Insights"
                            },
                            {
                                "title": "LPG Insights"
                            }
                        ]
                    }
                ]
            }
        ],
        "status": True
    },
    "Creator SOD":{
        "allowed_pages": [
              {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    },
                ]
            }  
        ],
        "name": "SOD",
        "status": True
    },
    "Creator LPG":{
        "allowed_pages": [
              {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    },
                ]
            }  
        ],
        "name": "LPG",
        "status": True
    },
    "MRAP":{
        "allowed_pages": [
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Industry",
                        "allowed_sub_menus": [
                            {
                                "title": "Industry Performance"
                            },
                            {
                                "title": "Retail Industry Performance"
                            },
                            {
                                "title": "Lpg Industry Performance"
                            },
                            {
                                "title": "I&C Industry Performance"
                            }
                        ]
                    },
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                            {
                                "title": "Marketing Summary"
                            },
                            {
                                "title": "Retail Insights"
                            },
                            {
                                "title": "LPG Insights"
                            },
                            {
                                "title": "I&C Insights"
                            },
                            {
                                "title": "I&C Campaign"
                            },
                            {
                                "title": "Lubes Insights"
                            },
                            {
                                "title": "Aviation Insights"
                            },
                            {
                                "title": "PetChem Insights"
                            },
                            {
                                "title": "GAS Insights"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            },
                            {
                                "title": "TAS Insights",
                                "allowed_sub_menus": [
                                    {
                                        "title": "BCU Dosing Alerts"
                                    },
                                    {
                                        "title": "BAY Analytics"
                                    },
                                    {
                                        "title": "BCU Critical Parameter"
                                    }
                                ]
                            },
                            {
                                "title": "Bay Caliberation Module"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "Retail Governance",
                        "allowed_sub_menus": [
                            {
                                "title": "Sanitation Compliance"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "Pro Dash"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    }
                ]
            },
            {
                "menu_name": "Direct Sales",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Insights"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "I&C Insights"
                    },
                    {
                        "title": "I&C Campaign"
                    }
                ]
            },
            {
                "menu_name": "VA",
                "allowed_sub_menus": [
                    {
                        "title": "VA Home"
                    },
                    {
                        "title": "SOD Video Analytics"
                    },
                    {
                        "title": "LPG Video Analytics"
                    },
                    {
                        "title": "RO Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            },
            {
                "menu_name": "Pipeline",
                "allowed_sub_menus": []
            },
            {
                "menu_name": "Collapse Sidebar",
            }
        ],
        "status": True
    },
    "Lubes HQO": {
        "allowed_pages": [
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                            {
                                "title": "Lubes Insights"
                            },
                            {
                                "title": "Lubes Bazaar"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "NG HQO": {
        "allowed_pages": [
           {
                "menu_name": "Natural Gas",
                "allowed_sub_menus": [
                    {
                        "title": "NGC Progress MIS"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "status": True
    },
    "IS User":{
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "Pro Dash"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    }
                ]
            },
            {
                "menu_name": "VA",
                "allowed_sub_menus": [
                    {
                        "title": "VA Home"
                    },
                    {
                        "title": "SOD Video Analytics"
                    },
                    {
                        "title": "LPG Video Analytics"
                    },
                    {
                        "title": "RO Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            }
        ],
        "status": True
    },
    "Zonal Operations LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Analytics"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "HQO Operation SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Location In-Charge SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Device Manager"
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Location In-Charge Ticketing": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    }
                    
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Maintenance Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Device Manager"
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Plant In-Charge SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Device Manager"
                    }
                ]
            },
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "Pro Dash"
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Plant In-Charge Ticketing": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    }
                ]
            },
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "Pro Dash"
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Planning Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Device Manager"
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Safety Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "Device Manager"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Device Manager"
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Chief Manager SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Executive Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Manager SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Device Manager"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Operations Head SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "M&I Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Safety Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal M&I Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }                    
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal HSE SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal SOD Ticketing": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }


                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Transport Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Head LEVEL SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "SOD Planning Officer": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "HQO SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "HQO HSE SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "Help Desk Module"
                            },
                            {
                                "title": "TAS Dashboard"
                            },
                            {
                                "title": "Tank Farm"
                            },
                            {
                                "title": "TAS Insights",
                                "allowed_sub_menus": [
                                    {
                                        "title": "BCU Dosing Alerts"
                                    },
                                    {
                                        "title": "BAY Analytics"
                                    },
                                    {
                                        "title": "BCU Critical Parameter"
                                    }
                                ]
                            },
                            {
                                "title": "Bay Caliberation Module"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Device Manager"
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            },
            {
                "menu_name": "CEMS",
                "allowed_sub_menus": [
                    {
                        "title": "CEMS Dashboard"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "TAS Vendor": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "HQO Supply Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "COLA HQO Officer SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            },
                            {
                                "title": "TAS Insights",
                                "allowed_sub_menus": [
                                    {
                                        "title": "BCU Dosing Alerts"
                                    },
                                    {
                                        "title": "BAY Analytics"
                                    },
                                    {
                                        "title": "BCU Critical Parameter"
                                    }
                                ]
                            },
                            {
                                "title": "Bay Caliberation Module"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Distribution Manager SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "HQO General Manager SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "HQO Manager SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "HQO Head SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "HQO Operations SOD": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "Risk Score"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Safety Officer LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Sales Officer LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Analytics"
                    },
                    {
                        "title": "LPG Inventory"
                    }
                ]
            },
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                        {
                        "title": "LPG Insights"
                        }
          ]
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Location In-Charge LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "Pro Dash"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Maintenance Officer LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "Pro Dash"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Planning Officer LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "Pro Dash"
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Regional Manager LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Analytics"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
{
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                        {
                        "title": "LPG Insights"
                        }
          ]
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "ERP Assistant Manager LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Inventory"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Zonal HSE LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "DS HQO Officer": {
        "allowed_pages": [
            {
                "menu_name": "Direct Sales",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Insights"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "I&C Insights"
                    },
                    {
                        "title": "I&C Campaign"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "Sales",
        "status": True
    },
    "DS Regional Manager": {
        "allowed_pages": [
            {
                "menu_name": "Direct Sales",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Insights"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "I&C Insights"
                    },
                    {
                        "title": "I&C Campaign"
                    }
                ]
            }
        ],
        "name": "Sales",
        "status": True
    },
    "DS Sales Officer": {
        "allowed_pages": [
            {
                "menu_name": "Direct Sales",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Insights"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "I&C Insights"
                    },
                    {
                        "title": "I&C Campaign"
                    }
                ]
            }
        ],
        "name": "Sales",
        "status": True
    },
    "Zonal Officer LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Analytics"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Zonal Operations Chief Manager LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Zonal Distributions Head LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Zonal Operations Head LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "HQO LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    },
                    {
                        "title": "Pro Dash"
                    },
                    {
                        "title": "LPG Settings"
                    },
                    {
                        "title": "Consolidated Report"
                    },
                    {
                        "title": "Supply Chain",
                        "allowed_sub_menus": [
                            {
                            "title": "Operations"
                            },
                            {
                            "title": "Sales"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                        {
                        "title": "LPG Insights"
                        }
                        ]
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "HQO Head LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    },
                    {
                        "title": "Supply Chain",
                        "allowed_sub_menus": [
                            {
                            "title": "Operations"
                            },
                            {
                            "title": "Sales"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Zonal Head LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    }
                ]
            },
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                        {
                        "title": "LPG Insights"
                        }
                        ]
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "HQO Sale General Manager": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "HQO HSE LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    },
                    {
                        "title": "Supply Chain",
                        "allowed_sub_menus": [
                            {
                            "title": "Operations"
                            },
                            {
                            "title": "Sales"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "HQO Operations": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    }
                ]
            },
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "HQO Operations LPG": {
        "allowed_pages": [
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "LPG Operations"
                    },
                    {
                        "title": "LPG Plant"
                    },
                    {
                        "title": "LPG Inventory"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "LPG Analytics"
                    },
                    {
                        "title": "Supply Chain",
                        "allowed_sub_menus": [
                            {
                            "title": "Operations"
                            },
                            {
                            "title": "Sales"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "Sales Performance": {
        "allowed_pages": [
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance"
                    },
                    {
                        "title": "Industry Performance"
                    },
                    {
                        "title": "Performance Insights"
                    }
                ]
            }
        ],
        "name": "Sales",
        "status": True
    },
    "Sales Officer I&C": {
        "allowed_pages": [
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                            {
                            "title": "I&C Insights"
                            },
                            {
                            "title": "I&C Campaign"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "Direct Sales",
                "allowed_sub_menus": [
                    {
                        "title": "VTS Insights"
                    },
                    {
                        "title": "Supply Chain"
                    }
                ]
            }
        ],
        "name": "Sales",
        "status": True
    },
    "temp_role": {
        
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            }
                        ]
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            }
            
        ],
        "name": "SOD",
        "status": True
    },
    "Admin": {
        "allowed_pages": [],
        "status": True
    },
    "Super Admin": {
        "allowed_pages": [],
        "status": True
    },
    "Sales Officer RO": {
        "allowed_pages": [
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
           {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                        {
                        "title": "Retail Insights"
                        }
          ]
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "Ro_role": {
        "allowed_pages": [
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "Regional Manager RO": {
        "allowed_pages": [
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                        {
                        "title": "Retail Insights"
                        }
          ]
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "HQO Officer RO": {
        "allowed_pages": [
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "HQO RO": {
        "allowed_pages": [
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "Zonal Head RO": {
        "allowed_pages": [
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                        {
                            "title": "Retail Insights"
                        }
          ]
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "VTS SOD": {
        "allowed_pages": [
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Violation Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "VTS LPG": {
        "allowed_pages": [
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Violation Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            }
        ],
        "name": "LPG",
        "status": True
    },
    "HQO TICKETING": {
        "allowed_pages": [
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Terminal Home"
                    },
                    {
                        "title": "Video Analytics"
                    },
                    {
                        "title": "TAS",
                        "allowed_sub_menus": [
                            {
                                "title": "TAS Home"
                            },
                            {
                                "title": "TAS Overview"
                            },
                            {
                                "title": "TAS Dashboard"
                            },
                            {
                                "title": "TAS Insights",
                                "allowed_sub_menus": [
                                    {
                                        "title": "BCU Dosing Alerts"
                                    },
                                    {
                                        "title": "BAY Analytics"
                                    },
                                    {
                                        "title": "BCU Critical Parameter"
                                    }
                                ]
                            },
                            {
                                "title": "Bay Caliberation Module"
                            },
                            {
                                "title": "Help Desk Module"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "VTS",
                "allowed_sub_menus": [
                    {
                        "title": "VTS ITDG Alert Home"
                    },
                    {
                        "title": "VTS Governance",
                        "allowed_sub_menus": [
                            {
                            "title": "VTS Dashboard"
                            },
                            {
                            "title": "VTS Insights"
                            },
                            {
                            "title": "Compliance"
                            },
                            {
                            "title": "VTS Unblocking"
                            },
                            {
                            "title": "VTS Live"
                            },
                            {
                            "title": "Admin Module"
                            },
                            {
                            "title": "Risk Score"
                            }
                        ]
                    },
                    {
                        "title": "Alert Manager"
                    }
                ]
            },
            {
                "menu_name": "CEMS",
                "allowed_sub_menus": [
                    {
                        "title": "CEMS Dashboard"
                    }
                ]
            },
            {
                "menu_name": "Ticketing",
                "allowed_sub_menus": [
                    {
                        "title": "Ticketing Dashboard"
                    },
                    {
                        "title": "PM Orders"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "SOD",
        "status": True
    },
    "Zonal Officer RO": {
        "allowed_pages": [
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    },
                    {
                        "title": "Video Analytics"
                    }
                ]
            },
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                        {
                        "title": "Retail Insights"
                        }
          ]
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "RO Dealer": {
        "allowed_pages": [
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "RO Home"
                    },
                    {
                        "title": "Supply Chain"
                    }
                ]
            }
        ],
        "name": "RO",
        "status": True
    },
    "Pipeline HQO Officer": {
        "allowed_pages": [
            {
                "menu_name": "Pipeline",
                "allowed_sub_menus": []
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ],
        "name": "Pipeline",
        "status": True
    }, 
    "HQO CMD Office": {
        "allowed_pages": [
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Industry",
                        "allowed_sub_menus": [
                            {
                                "title": "Industry Performance"
                            },
                            {
                                "title": "Retail Industry Performance"
                            },
                            {
                                "title": "Lpg Industry Performance"
                            },
                            {
                                "title": "I&C Industry Performance"
                            }
                        ]
                    },
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                            {
                                "title": "Marketing Summary"
                            },
                            {
                                "title": "Retail Insights"
                            },
                            {
                                "title": "LPG Insights"
                            },
                            {
                                "title": "I&C Insights"
                            },
                            {
                                "title": "I&C Campaign"
                            },
                            {
                                "title": "Lubes Insights"
                            },
                            {
                                "title": "Aviation Insights"
                            },
                            {
                                "title": "PetChem Insights"
                            },
                            {
                                "title": "GAS Insights"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    }
                ]
            },
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    }
                ]
            },
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ]
    },
    # "CEMS New": {
    #     "allowed_pages": [ 
    #         {
    #             "menu_name": "CEMS",
    #             "allowed_sub_menus": [
    #                 {
    #                     "title": "CEMS Dash"
    #                 }
    #             ]
    #         }
    #     ]
    # },
    "HQO Mkt COO": {
        "allowed_pages": [
            {
                "menu_name": "Performance",
                "allowed_sub_menus": [
                    {
                        "title": "Industry",
                        "allowed_sub_menus": [
                            {
                                "title": "Industry Performance"
                            },
                            {
                                "title": "Retail Industry Performance"
                            },
                            {
                                "title": "Lpg Industry Performance"
                            },
                            {
                                "title": "I&C Industry Performance"
                            }
                        ]
                    },
                    {
                        "title": "Sales Performance",
                        "allowed_sub_menus": [
                            {
                                "title": "Marketing Summary"
                            },
                            {
                                "title": "Retail Insights"
                            },
                            {
                                "title": "LPG Insights"
                            },
                            {
                                "title": "I&C Insights"
                            },
                            {
                                "title": "I&C Campaign"
                            },
                            {
                                "title": "Lubes Insights"
                            },
                            {
                                "title": "Aviation Insights"
                            },
                            {
                                "title": "PetChem Insights"
                            },
                            {
                                "title": "GAS Insights"
                            }
                        ]
                    }
                ]
            },
            {
                "menu_name": "SOD Terminal",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    }
                ]
            },
            {
                "menu_name": "LPG",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    }
                ]
            },
            {
                "menu_name": "Retail Outlet",
                "allowed_sub_menus": [
                    {
                        "title": "Supply Chain"
                    }
                ]
            },
            {
                "menu_name": "Settings",
                "allowed_sub_menus": [
                    {
                        "title": "Users"
                    }
                ]
            }
        ]
    },
    "CEMS Role": {
        "allowed_pages": [
            {
                "menu_name": "CEMS",
                "allowed_sub_menus": [
                    {
                        "title": "CEMS Dashboard"
                    }
                ]
            }
        ]
    }
}
    await hpcl_ceg_model.Roles.bulk_update([{"name": key, "status": True, "allowed_pages": value["allowed_pages"], "bu": [value.get("name")] if value and value.get("name") else []}
                                            for key, value in role_mapping.items()], upsert=True,
                                           upsert_skip_keys=['name'])


if __name__ == "__main__":
    asyncio.run(sync_user_roles())
