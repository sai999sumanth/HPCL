vts_interlock_mapping = {
    "TAS":{
        "bulk":{
            "speed_violation_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Speed Violation FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Speed Violation SecondTime",
                        "block_duration": 15,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Speed Violation ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Speed Violation FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Speed Violation FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Speed Violation SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Speed Violation",
                "alert_threshold": 3
            },
            "night_driving_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Night Driving FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Night Driving SecondTime",
                        "block_duration": 15,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Night Driving ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Night Driving FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Night Driving FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Night Driving SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Night Driving",
                "alert_threshold": 3
            },
            "route_deviation_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS RouteDeviation FirstTime",
                        "block_duration": 30,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS RouteDeviation SecondTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS RouteDeviation ThirdTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS RouteDeviation FourthTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS RouteDeviation FifthTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS RouteDeviation SixthTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Route Deviation",
                "alert_threshold": 5
            },
            "stoppage_violations_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Unauthorized Stoppage FirstTime",
                        "block_duration": 30,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Unauthorized Stoppage SecondTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Unauthorized Stoppage ThirdTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Unauthorized Stoppage FourthTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Unauthorized Stoppage FifthTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Unauthorized Stoppage SixthTime",
                        "block_duration": 90,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Stoppage  Violations",
                "alert_threshold": 5
            },
            "no_halt_zone_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "NoHalt Zone FirstTime",
                        "block_duration": 90,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "NoHalt Zone SecondTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "NoHalt Zone ThirdTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "NoHalt Zone FourthTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "NoHalt Zone FifthTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "NoHalt Zone SixthTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "",
                "description": "NoHalt Zone",
                "alert_threshold": 0
            },
            "device_offline_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS Offline FirstTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS Offline SecondTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS Offline ThirdTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS Offline FourthTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS Offline FifthTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS Offline SixthTime",
                        "block_duration": 365,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "",
                "description": "Device Offline",
                "alert_threshold": 0
            },
            "device_tamper_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS Device Tampering FirstTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS Device Tampering SecondTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS Device Tampering ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS Device Tampering FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS Device Tampering FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS Device Tampering SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "",
                "description": "Device Tampered",
                "alert_threshold": 0
            },
            "main_supply_removal_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS PowerDisconnect FirstTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS PowerDisconnect SecondTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS PowerDisconnect ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS PowerDisconnect FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS PowerDisconnect FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS PowerDisconnect SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "High",
                "description": "Main Supply Removal",
                "alert_threshold": 0
            },
            "driver_panic": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Driver Panic FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    }
                },
                "severity": "Critical",
                "description": "Driver Panic",
                "alert_threshold": 0
            },
            "continuous_driving_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Continuous Driving FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Continuous Driving SecondTime",
                        "block_duration": 15,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Continuous Driving ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Continuous Driving FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Continuous Driving FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Continuous Driving SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "High",
                "description": "Continuous Driving",
                "alert_threshold": 3
            },
            "harsh_breaking": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Harsh Breaking FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True
                    }
                },
                "severity": "Medium",
                "description": "Harsh Breaking",
                "alert_threshold": 5
            },
            "harsh_turn": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Harsh Turn FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True
                    }
                },
                "severity": "Medium",
                "description": "Harsh Turn",
                "alert_threshold": 5
            }
        }
    },
    "LPG":{
        "bulk":{
            "speed_violation_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Speed Violation FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Speed Violation SecondTime",
                        "block_duration": 15,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Speed Violation ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Speed Violation FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Speed Violation FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Speed Violation SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Speed Violation",
                "alert_threshold": 3
            },
            "night_driving_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Night Driving FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Night Driving SecondTime",
                        "block_duration": 15,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Night Driving ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Night Driving FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Night Driving FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Night Driving SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "High",
                "description": "Night Driving",
                "alert_threshold": 3
            },
            "route_deviation_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS RouteDeviation FirstTime",
                        "block_duration": 7,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS RouteDeviation SecondTime",
                        "block_duration": 15,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS RouteDeviation ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS RouteDeviation FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS RouteDeviation FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS RouteDeviation SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Route Deviation",
                "alert_threshold": 5
            },
            "stoppage_violations_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Unauthorized Stoppage FirstTime",
                        "block_duration": 7,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Unauthorized Stoppage SecondTime",
                        "block_duration": 15,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Unauthorized Stoppage ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Unauthorized Stoppage FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Unauthorized Stoppage FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Unauthorized Stoppage SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Stoppage  Violations",
                "alert_threshold": 5
            },
            "no_halt_zone_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "NoHalt Zone FirstTime",
                        "block_duration": 7,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "NoHalt Zone SecondTime",
                        "block_duration": 15,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "NoHalt Zone ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "NoHalt Zone FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "NoHalt Zone FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "NoHalt Zone SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "",
                "description": "NoHalt Zone",
                "alert_threshold": 0
            },
            "device_offline_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS Offline FirstTime",
                        "block_duration": 7,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS Offline SecondTime",
                        "block_duration": 15,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS Offline ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS Offline FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS Offline FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS Offline SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "",
                "description": "Device Offline",
                "alert_threshold": 0
            },
            "device_tamper_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS Device Tampering FirstTime",
                        "block_duration": 7,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS Device Tampering SecondTime",
                        "block_duration": 15,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS Device Tampering ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS Device Tampering FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS Device Tampering FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS Device Tampering SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Device Tampered",
                "alert_threshold": 0
            },
            "main_supply_removal_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS PowerDisconnect FirstTime",
                        "block_duration": 7,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS PowerDisconnect SecondTime",
                        "block_duration": 15,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS PowerDisconnect ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS PowerDisconnect FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS PowerDisconnect FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS PowerDisconnect SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Main Supply Removal",
                "alert_threshold": 0
            },
            "driver_panic": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Driver Panic FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    }
                },
                "severity": "Critical",
                "description": "Driver Panic",
                "alert_threshold": 0
            },
            "continuous_driving_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Continuous Driving FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Continuous Driving SecondTime",
                        "block_duration": 15,
                        "block_msg": "90 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Continuous Driving ThirdTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Continuous Driving FourthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Continuous Driving FifthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Continuous Driving SixthTime",
                        "block_duration": 30,
                        "block_msg": "1 year",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "High",
                "description": "Continuous Driving",
                "alert_threshold": 3
            },
            "harsh_breaking": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Harsh Breaking FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True
                    }
                },
                "severity": "Medium",
                "description": "Harsh Breaking",
                "alert_threshold": 5
            },
            "harsh_turn": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Harsh Turn FirstTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True
                    }
                },
                "severity": "Medium",
                "description": "Harsh Turn",
                "alert_threshold": 5
            }
        },
        "packed":{
            "speed_violation_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Speed Violation FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Speed Violation SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Speed Violation ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Speed Violation FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Speed Violation FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Speed Violation SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Speed Violation",
                "alert_threshold": 3
            },
            "night_driving_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Night Driving FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Night Driving SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Night Driving ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Night Driving FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Night Driving FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Night Driving SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "High",
                "description": "Night Driving",
                "alert_threshold": 3
            },
            "route_deviation_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS RouteDeviation FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS RouteDeviation SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS RouteDeviation ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS RouteDeviation FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS RouteDeviation FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS RouteDeviation SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Route Deviation",
                "alert_threshold": 5
            },
            "stoppage_violations_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Unauthorized Stoppage FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Unauthorized Stoppage SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Unauthorized Stoppage ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Unauthorized Stoppage FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Unauthorized Stoppage FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Unauthorized Stoppage SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Stoppage  Violations",
                "alert_threshold": 5
            },
            "no_halt_zone_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "NoHalt Zone FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "NoHalt Zone SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "NoHalt Zone ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "NoHalt Zone FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "NoHalt Zone FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "NoHalt Zone SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "",
                "description": "NoHalt Zone",
                "alert_threshold": 0
            },
            "device_offline_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS Offline FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS Offline SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS Offline ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS Offline FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS Offline FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS Offline SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "",
                "description": "Device Offline",
                "alert_threshold": 0
            },
            "device_tamper_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS Device Tampering FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS Device Tampering SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS Device Tampering ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS Device Tampering FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS Device Tampering FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS Device Tampering SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Device Tampered",
                "alert_threshold": 0
            },
            "main_supply_removal_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "VTS PowerDisconnect FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "VTS PowerDisconnect SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "VTS PowerDisconnect ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "VTS PowerDisconnect FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "VTS PowerDisconnect FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "VTS PowerDisconnect SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "Critical",
                "description": "Main Supply Removal",
                "alert_threshold": 0
            },
            "driver_panic": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Driver Panic FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    }
                },
                "severity": "Critical",
                "description": "Driver Panic",
                "alert_threshold": 0
            },
            "continuous_driving_count": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Continuous Driving FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True,
                        "instance": "Instance - 1"
                    },
                    "1": {
                        "interlock_name": "Continuous Driving SecondTime",
                        "block_duration": 7,
                        "block_msg": "7 days",
                        "clear_count": True,
                        "instance": "Instance - 2"
                    },
                    "2": {
                        "interlock_name": "Continuous Driving ThirdTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 3"
                    },
                    "3": {
                        "interlock_name": "Continuous Driving FourthTime",
                        "block_duration": 15,
                        "block_msg": "15 days",
                        "clear_count": True,
                        "instance": "Instance - 4"
                    },
                    "4": {
                        "interlock_name": "Continuous Driving FifthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 5"
                    },
                    "5": {
                        "interlock_name": "Continuous Driving SixthTime",
                        "block_duration": 30,
                        "block_msg": "30 days",
                        "clear_count": True,
                        "instance": "Instance - 6"
                    }
                },
                "severity": "High",
                "description": "Continuous Driving",
                "alert_threshold": 3
            },
            "harsh_breaking": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Harsh Breaking FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True
                    }
                },
                "severity": "Medium",
                "description": "Harsh Breaking",
                "alert_threshold": 5
            },
            "harsh_turn": {
                "alerting_rules": {
                    "0": {
                        "interlock_name": "Harsh Turn FirstTime",
                        "block_duration": 1,
                        "block_msg": "1 day",
                        "clear_count": True
                    }
                },
                "severity": "Medium",
                "description": "Harsh Turn",
                "alert_threshold": 5
            }
        }
    }
}

vts_exception_interlock_mapping = {
    "speed_violation_count": {
        "alerting_rules": {
            "1": {
                "interlock_name": "Speed Violation Exception FirstTime",
                "block_duration": 7,
                "block_msg": "7 days",
                "clear_count": True
            },
            "2": {
                "interlock_name": "Speed Violation Exception SecondTime",
                "block_duration": 90,
                "block_msg": "90 days",
                "clear_count": True
            },
            "3": {
                "interlock_name": "Speed Violation Exception ThirdTime",
                "block_duration": 365,
                "block_msg": "1 year",
                "clear_count": True
            }
        },
        "severity": "Critical",
        "description": "Speed Violation",
        "alert_threshold": 5
    },
    "night_driving_count": {
        "alerting_rules": {
            "1": {
                "interlock_name": "Night Driving Exception FirstTime",
                "block_duration": 7,
                "block_msg": "7 days",
                "clear_count": True
            },
            "2": {
                "interlock_name": "Night Driving Exception SecondTime",
                "block_duration": 90,
                "block_msg": "90 days",
                "clear_count": True
            },
            "3": {
                "interlock_name": "Night Driving Exception ThirdTime",
                "block_duration": 365,
                "block_msg": "1 year",
                "clear_count": True
            }
        },
        "severity": "Critical",
        "description": "Night Driving",
        "alert_threshold": 5
    },
    "route_deviation_count": {
        "alerting_rules": {
            "1": {
                "interlock_name": "Route Deviation Exception FirstTime",
                "block_duration": 90,
                "block_msg": "90 days",
                "clear_count": True
            },
            "2": {
                "interlock_name": "Route Deviation Exception SecondTime",
                "block_duration": 365,
                "block_msg": "1 year",
                "clear_count": True
            }
        },
        "severity": "Critical",
        "description": "Route Deviation",
        "alert_threshold": 5
    },
    "stoppage_violations_count": {
        "alerting_rules": {
            "1": {
                "interlock_name": "Unauthorized Stoppage Exception FirstTime",
                "block_duration": 90,
                "block_msg": "90 days",
                "clear_count": True
            },
            "2": {
                "interlock_name": "Unauthorized Stoppage Exception SecondTime",
                "block_duration": 365,
                "block_msg": "1 year",
                "clear_count": True
            }
        },
        "severity": "Critical",
        "description": "Stoppage  Violations",
        "alert_threshold": 5
    },
    "no_halt_zone_count": {
        "alerting_rules": {
            "1": {
                "interlock_name": "NoHalt zone Exception FirstTime",
                "block_duration": 90,
                "block_msg": "90 days",
                "clear_count": True
            },
            "2": {
                "interlock_name": "NoHalt Zone Exception SecondTime",
                "block_duration": 365,
                "block_msg": "1 year",
                "clear_count": True
            }
        },
        "severity": "",
        "description": "NoHalt Zone",
        "alert_threshold": 0
    },
    "device_offline_count": {
        "alerting_rules": {
            "1": {
                "interlock_name": "VTS offline Exception FirstTime",
                "block_duration": 90,
                "block_msg": "90 days",
                "clear_count": True
            },
            "2": {
                "interlock_name": "VTS Offline Exception SecondTime",
                "block_duration": 365,
                "block_msg": "1 year",
                "clear_count": True
            }
        },
        "severity": "",
        "description": "Device Offline",
        "alert_threshold": 0
    },
    "device_tamper_count": {
        "alerting_rules": {
            "1": {
                "interlock_name": "VTS device Tampering Exception",
                "block_duration": 365,
                "block_msg": "Permanent",
                "clear_count": True
            }
        },
        "severity": "",
        "description": "Device Tampered",
        "alert_threshold": 0
    },
    "main_supply_removal_count": {
        "alerting_rules": {
            "1": {
                "interlock_name": "VTS PowerDisconnect Exception",
                "block_duration": 365,
                "block_msg": "Permanent",
                "clear_count": True
            }
        },
        "severity": "High",
        "description": "Main Supply Removal",
        "alert_threshold": 0
    },
    "driver_panic": {
        "alerting_rules": {
            "0": {
                "interlock_name": "Driver Panic FirstTime",
                "block_duration": 7,
                "block_msg": "7 days",
                "clear_count": True
            }
        },
        "severity": "Critical",
        "description": "Driver Panic",
        "alert_threshold": 0
    },
    "continuous_driving_count": {
        "alerting_rules": {
            "0": {
                "interlock_name": "Continuous Driving FirstTime",
                "block_duration": 7,
                "block_msg": "7 days",
                "clear_count": True
            }
        },
        "severity": "High",
        "description": "Continuous Driving",
        "alert_threshold": 5
    },
    "harsh_breaking": {
        "alerting_rules": {
            "0": {
                "interlock_name": "Harsh Breaking FirstTime",
                "block_duration": 7,
                "block_msg": "7 days",
                "clear_count": True
            }
        },
        "severity": "Medium",
        "description": "Harsh Breaking",
        "alert_threshold": 5
    },
    "harsh_turn": {
        "alerting_rules": {
            "0": {
                "interlock_name": "Harsh Turn FirstTime",
                "block_duration": 7,
                "block_msg": "7 days",
                "clear_count": True
            }
        },
        "severity": "Medium",
        "description": "Harsh Turn",
        "alert_threshold": 5
    }
}
