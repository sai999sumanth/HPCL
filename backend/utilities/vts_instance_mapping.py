''' 
Here
0 = Instance 1
1 = Instance 2
2 = Instance 3

Ex: 
For instance one 
>> Speed violation 
instance_1 count = 3 which is used to add logic like > 3
instance_2 count = 2 which is used to add logic like > 2
Here for instance_2 
check the count like >3 which is on 4th count and adding >2 which is 3 then total will be 7
'''

instance_mapping = {
    "TAS":{
        "bulk": {
            "0":{
                "device_tamper_count":{
                    "violation_count": 1
                },
                "main_supply_removal_count":{
                    "violation_count": 1
                },
                "route_deviation_count":{
                    "violation_count": 5
                },
                "stoppage_violations_count":{
                    "violation_count": 5
                },
                "speed_violation_count":{
                    "violation_count": 3
                },
                "night_driving_count":{
                    "violation_count": 3
                },
                "continuous_driving_count":{
                    "violation_count": 3
                }
            },
            "1":{
                "device_tamper_count":{
                    "violation_count": 0
                },
                "main_supply_removal_count":{
                    "violation_count": 0
                },
                "route_deviation_count":{
                    "violation_count": 4
                },
                "stoppage_violations_count":{
                    "violation_count": 4
                },
                "speed_violation_count":{
                    "violation_count": 2
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            },
            "2":{
                "device_tamper_count":{
                    "violation_count": 0
                },
                "main_supply_removal_count":{
                    "violation_count": 0
                },
                "route_deviation_count":{
                    "violation_count": 4
                },
                "stoppage_violations_count":{
                    "violation_count": 4
                },
                "speed_violation_count":{
                    "violation_count": 2
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            }
        }
    },
    "LPG":{
        "bulk": {
            "0":{
                "device_tamper_count":{
                    "violation_count": 2
                },
                "main_supply_removal_count":{
                    "violation_count": 3
                },
                "route_deviation_count":{
                    "violation_count": 3
                },
                "stoppage_violations_count":{
                    "violation_count": 3
                },
                "speed_violation_count":{
                    "violation_count": 2
                },
                "night_driving_count":{
                    "violation_count": 3
                },
                "continuous_driving_count":{
                    "violation_count": 3
                }
            },
            "1":{
                "device_tamper_count":{
                    "violation_count": 2
                },
                "main_supply_removal_count":{
                    "violation_count": 2
                },
                "route_deviation_count":{
                    "violation_count": 2
                },
                "stoppage_violations_count":{
                    "violation_count": 3
                },
                "speed_violation_count":{
                    "violation_count": 2
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            },
            "2":{
                "device_tamper_count":{
                    "violation_count": 2
                },
                "main_supply_removal_count":{
                    "violation_count": 2
                },
                "route_deviation_count":{
                    "violation_count": 2
                },
                "stoppage_violations_count":{
                    "violation_count": 3
                },
                "speed_violation_count":{
                    "violation_count": 2
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            }
        },
        "packed": {
            "0":{
                "device_tamper_count":{
                    "violation_count": 0
                },
                "main_supply_removal_count":{
                    "violation_count": 4
                },
                "route_deviation_count":{
                    "violation_count": 4
                },
                "stoppage_violations_count":{
                    "violation_count": 5
                },
                "speed_violation_count":{
                    "violation_count": 1
                },
                "night_driving_count":{
                    "violation_count": 3
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            },
            "1":{
                "device_tamper_count":{
                    "violation_count": 1
                },
                "main_supply_removal_count":{
                    "violation_count": 2
                },
                "route_deviation_count":{
                    "violation_count": 3
                },
                "stoppage_violations_count":{
                    "violation_count": 4
                },
                "speed_violation_count":{
                    "violation_count": 1
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            },
            "2":{
                "device_tamper_count":{
                    "violation_count": 1
                },
                "main_supply_removal_count":{
                    "violation_count": 2
                },
                "route_deviation_count":{
                    "violation_count": 3
                },
                "stoppage_violations_count":{
                    "violation_count": 4
                },
                "speed_violation_count":{
                    "violation_count": 1
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            },
            "3":{
                "device_tamper_count":{
                    "violation_count": 1
                },
                "main_supply_removal_count":{
                    "violation_count": 2
                },
                "route_deviation_count":{
                    "violation_count": 3
                },
                "stoppage_violations_count":{
                    "violation_count": 4
                },
                "speed_violation_count":{
                    "violation_count": 1
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            },
            "4":{
                "device_tamper_count":{
                    "violation_count": 1
                },
                "main_supply_removal_count":{
                    "violation_count": 2
                },
                "route_deviation_count":{
                    "violation_count": 3
                },
                "stoppage_violations_count":{
                    "violation_count": 4
                },
                "speed_violation_count":{
                    "violation_count": 1
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            },
            "5":{
                "device_tamper_count":{
                    "violation_count": 1
                },
                "main_supply_removal_count":{
                    "violation_count": 2
                },
                "route_deviation_count":{
                    "violation_count": 3
                },
                "stoppage_violations_count":{
                    "violation_count": 4
                },
                "speed_violation_count":{
                    "violation_count": 1
                },
                "night_driving_count":{
                    "violation_count": 2
                },
                "continuous_driving_count":{
                    "violation_count": 2
                }
            }
        }
    }
}


violation_mapping = {
    "VTS":{
        "TAS":{
            "device_tamper_count":{
                "violation_name": "VTS Device Tampering",
                "sop_id": "SOP001V",
                "severity": "Medium",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD",
                        "2": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD",
                        "2": "Zonal Transport Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD",
                        "2": "Zonal Transport Officer SOD,Zonal Head SOD"
                    },
                    "mqof": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "main_supply_removal_count":{
                "violation_name": "VTS PowerDisconnect",
                "sop_id": "SOP001V",
                "severity": "High",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD",
                        "2": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD",
                        "2": "Zonal Transport Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD",
                        "2": "Zonal Transport Officer SOD,Zonal Head SOD"
                    },
                    "mqof": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "route_deviation_count":{
                "violation_name": "VTS RouteDeviation",
                "sop_id": "SOP001V",
                "severity": "Critical",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD",
                        "2": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD",
                        "2": "Zonal Transport Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD",
                        "2": "Zonal Transport Officer SOD,Zonal Head SOD"
                    },
                    "mqof": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "stoppage_violations_count":{
                "violation_name": "Unauthorized Stoppage",
                "sop_id": "SOP001V",
                "severity": "Critical",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD",
                        "2": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD",
                        "2": "Zonal Transport Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD",
                        "2": "Zonal Transport Officer SOD,Zonal Head SOD"
                    },
                    "mqof": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "speed_violation_count":{
                "violation_name": "Speed Violation",
                "sop_id": "SOP001V",
                "severity": "Critical",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD",
                        "2": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD",
                        "2": "Zonal Transport Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD",
                        "2": "Zonal Transport Officer SOD,Zonal Head SOD"
                    },
                    "mqof": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "night_driving_count":{
                "violation_name": "Night Driving",
                "sop_id": "SOP001V",
                "severity": "Critical",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD",
                        "2": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD",
                        "2": "Zonal Transport Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD",
                        "2": "Zonal Transport Officer SOD,Zonal Head SOD"
                    },
                    "mqof": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "continuous_driving_count":{
                "violation_name": "Continuous Driving",
                "sop_id": "SOP001V",
                "severity": "High",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD",
                        "2": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Safety Officer SOD,Maintenance Officer SOD,Planning Officer SOD",
                        "1": "Location In-Charge SOD"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD",
                        "2": "Zonal Transport Officer SOD,Location In-Charge SOD"
                    },
                    "mqof": {
                        "0": "Location In-Charge SOD",
                        "1": "Zonal Transport Officer SOD"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD",
                        "2": "Zonal Transport Officer SOD,Zonal Head SOD"
                    },
                    "mqof": {
                        "0": "Zonal Transport Officer SOD",
                        "1": "Zonal Head SOD"
                    },
                    "condition": ">",
                    "value": 10
                }
            }
        },
        "LPG":{
            "device_tamper_count":{
                "violation_name": "VTS Device Tampering",
                "sop_id": "SOP001V",
                "severity": "Medium",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG",
                        "2": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG,Location In-Charge LPG"
                    },
                    "mqof": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Location In-Charge LPG,Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "main_supply_removal_count":{
                "violation_name": "VTS PowerDisconnect",
                "sop_id": "SOP001V",
                "severity": "High",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG",
                        "2": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG,Location In-Charge LPG"
                    },
                    "mqof": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Location In-Charge LPG,Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "route_deviation_count":{
                "violation_name": "VTS RouteDeviation",
                "sop_id": "SOP001V",
                "severity": "Critical",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG",
                        "2": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG,Location In-Charge LPG"
                    },
                    "mqof": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Location In-Charge LPG,Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "stoppage_violations_count":{
                "violation_name": "Unauthorized Stoppage",
                "sop_id": "SOP001V",
                "severity": "Critical",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG",
                        "2": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG,Location In-Charge LPG"
                    },
                    "mqof": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Location In-Charge LPG,Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "speed_violation_count":{
                "violation_name": "Speed Violation",
                "sop_id": "SOP001V",
                "severity": "Critical",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG",
                        "2": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG,Location In-Charge LPG"
                    },
                    "mqof": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Location In-Charge LPG,Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "night_driving_count":{
                "violation_name": "Night Driving",
                "sop_id": "SOP001V",
                "severity": "Critical",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG",
                        "2": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG,Location In-Charge LPG"
                    },
                    "mqof": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Location In-Charge LPG,Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": ">",
                    "value": 10
                }
            },
            "continuous_driving_count":{
                "violation_name": "Continuous Driving",
                "sop_id": "SOP001V",
                "severity": "High",
                "level - 1": {
                    "rolemailto": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG",
                        "2": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG,Location In-Charge LPG"
                    },
                    "mqof": {
                        "0": "Safety Officer LPG,Maintenance Officer LPG,Planning Officer LPG",
                        "1": "Location In-Charge LPG"
                    },
                    "condition": "<",
                    "value": 5
                },
                "level - 2": {
                    "rolemailto": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Location In-Charge LPG,Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Location In-Charge LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": "<>",
                    "value": 10
                },
                "level - 3": {
                    "rolemailto": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "2": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "mqof": {
                        "0": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG",
                        "1": "Zonal HSE LPG,Zonal Operations Chief Manager LPG,Zonal Head LPG,Zonal Officer LPG,Zonal Operations LPG"
                    },
                    "condition": ">",
                    "value": 10
                }
            }
        }
    }
}