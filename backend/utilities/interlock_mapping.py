import urdhva_base.utilities


# Interlock name and sop mapping for TAS Alerts
tas_interlock_mapping = [
                        {"sop_id": "SOP001V", "interlock_name": "VTS Device Tampering","model": "VTS", "workflow_name": "TAS VTS Violation"},
                        {"sop_id": "SOP001V", "interlock_name": "VTS PowerDisconnect", "model": "VTS", "workflow_name": "TAS VTS Violation"},
                        {"sop_id": "SOP001V", "interlock_name": "VTS RouteDeviation", "model": "VTS", "workflow_name": "TAS VTS Violation"},
                        {"sop_id": "SOP001V", "interlock_name": "Unauthorized Stoppage", "model": "VTS", "workflow_name": "TAS VTS Violation"},
                        {"sop_id": "SOP001V", "interlock_name": "Speed Violation", "model": "VTS", "workflow_name": "TAS VTS Violation"},
                        {"sop_id": "SOP001V", "interlock_name": "Night Driving", "model": "VTS", "workflow_name": "TAS VTS Violation"},
                        {"sop_id": "SOP001V", "interlock_name": "Continuous Driving", "model": "VTS", "workflow_name": "TAS VTS Violation"},
                        {"sop_id": "SOP001N", "interlock_name": "No VTS No Load", "model": "VTS", "workflow_name": "TAS No VTS No Load"},
                        {"sop_id": "SOP009B", "interlock_name": "Itdg Admin Blocked", "model": "VTS", "workflow_name": "Itdg Manual Block"},
                        {"sop_id": "SOP001E", "interlock_name": "Truck Contract Validity Status", "model": "VTS", "workflow_name": "Vts Device Expiry"},

                        {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation FirstTime","model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},


                        {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage FirstTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},

                        {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect FirstTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        
                        {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering FirstTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},

                        {"sop_id": "SOP001", "interlock_name": "VTS Offline FirstTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Offline SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Offline ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Offline FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Offline FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Offline SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},

                        {"sop_id": "SOP001", "interlock_name": "Night Driving FirstTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Night Driving SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Night Driving ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Night Driving FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Night Driving FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Night Driving SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},

                        {"sop_id": "SOP001", "interlock_name": "Speed Violation FirstTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Speed Violation SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Speed Violation ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Speed Violation FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Speed Violation FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Speed Violation SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},

                        {"sop_id": "SOP001", "interlock_name": "NoHalt Zone FirstTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "NoHalt Zone SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "NoHalt Zone ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "NoHalt Zone FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "NoHalt Zone FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "NoHalt Zone SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},

                        {"sop_id": "SOP001", "interlock_name": "Continuous Driving FirstTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Continuous Driving SecondTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Continuous Driving ThirdTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Continuous Driving FourthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Continuous Driving FifthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},
                        {"sop_id": "SOP001", "interlock_name": "Continuous Driving SixthTime", "model": "VTS", "workflow_name": "TAS SOP001 7 DAYS 1st Instance"},

                        {"sop_id": "SOP001E", "interlock_name": "Route Deviation Exception FirstTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "Route Deviation Exception SecondTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "Unauthorized Stoppage Exception FirstTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "Unauthorized Stoppage Exception SecondTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "VTS PowerDisconnect Exception", "model": "VTS", "workflow_name": "Tas_Vts_Exception_ThirdTime_2years"},
                        {"sop_id": "SOP001E", "interlock_name": "VTS device Tampering Exception", "model": "VTS", "workflow_name": "Tas_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "VTS offline Exception FirstTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "VTS Offline Exception SecondTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_ThirdTime_2years"},
                        
                        {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception FirstTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception SecondTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_SecondTime_90days"},
                        {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception ThirdTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_ThirdTime_2years"},


                        {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception FirstTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception SecondTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_SecondTime_90days"},
                        {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception ThirdTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "NoHalt zone Exception FirstTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "NoHalt Zone Exception SecondTime", "model": "VTS", "workflow_name": "Tas_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001", "interlock_name": "EM Locks : VTS Offline - Lorry", "model": "VTS"},

                        {"sop_id": "SOP001", "interlock_name": "HHH alarm from VFT", "workflow_name": "TAS TANK OVERFILL PREVENTION SOP001"},
                        {"sop_id": "SOP001", "interlock_name": "HHH alarm from Secondary Radar guage", "workflow_name": "TAS TANK OVERFILL PREVENTION SOP001"},
                        {"sop_id": "SOP01A", "interlock_name": "ROSOV_Close Status", "workflow_name": "TAS TANK OVERFILL PREVENTION SOP001"},
                        {"sop_id": "SOP01A", "interlock_name": "MOV_Close Status", "workflow_name": "TAS TANK OVERFILL PREVENTION SOP001"},
                        {"sop_id": "SOP01A", "interlock_name": "ROSOV_Close Status_Fail", "workflow_name": "TAS TANK OVERFILL PREVENTION SOP001"},
                        {"sop_id": "SOP01A", "interlock_name": "MOV_Close Status_Fail", "workflow_name": "TAS TANK OVERFILL PREVENTION SOP001"},
                        
                        {"sop_id": "SOP002", "interlock_name": "ESD Pushbutton Activated", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP002", "interlock_name": "Plant ESD activated", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP002", "interlock_name": "EM Locks : VTS Offline - Customer", "model": "VTS", "workflow_name": ""},
                        {"sop_id": "SOP02A", "interlock_name": "All ROSOVs Closed", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All ROSOVs Closed(Except PL Receipt)", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Tanks in TTL Dispatch in Dormant Mode", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "As Power ESD Activation in Main PMCC Panel after 120 Sec", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Hooter cum strobe for ESD activated in control room", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Siren Activated", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "ESD Command To Process PLC", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All DBBVs Closed", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All DBBVs Closed(Except PL Receipt)", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All Tanks in Dormant Mode", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All TLF Product Pumps Stopped", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Gantry Permissive Off", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Barrier Gate opened", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "TLF Gantry Permissive Power Off", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},

                        {"sop_id": "SOP02A", "interlock_name": "All ROSOVs Closed_Fail", "workflow_name": "TAS ESD CAUSE AND NON EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All ROSOVs Closed(Except PL Receipt)_Fail", "workflow_name": "TAS ESD CAUSE AND NON EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Tanks in TTL Dispatch in Dormant Mode_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "As Power ESD Activation in Main PMCC Panel after 120 Sec_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Hooter cum strobe for ESD activated in control room_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Siren Activated_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "ESD Command To Process PLC_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All DBBVs Closed_Fail", "workflow_name": "TAS ESD CAUSE AND NON EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All DBBVs Closed(Except PL Receipt)_Fail", "workflow_name": "TAS ESD CAUSE AND NON EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All Tanks in Dormant Mode_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "All TLF Product Pumps Stopped_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Gantry Permissive Off_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "Barrier Gate opened_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "TLF Gantry Permissive Power Off_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "ESD ROSOV_Close Status_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "ESD MOV_Close Status_Fail", "workflow_name": "TAS ESD CAUSE AND EFFECT SOP002 SOP02A"},
                        {"sop_id": "SOP02A", "interlock_name": "ROSOV in PL Receipt Mode", "workflow_name": "PIPELINE MODE"}, # Immediate Close Purpose
                        {"sop_id": "SOP02A", "interlock_name": "ESD ROSOV_Close Status", "workflow_name": "PIPELINE MODE"}, # Immediate Close Purpose
                        {"sop_id": "SOP02A", "interlock_name": "MOV in PL Receipt Mode", "workflow_name": "PIPELINE MODE"}, # Immediate Close Purpose
                        {"sop_id": "SOP02A", "interlock_name": "ESD MOV_Close Status", "workflow_name": "PIPELINE MODE"}, # Immediate Close Purpose
                        
                        {"sop_id": "SOP003", "interlock_name": "Proof Test_VFT_Failed", "workflow_name": "HHH PROOF TEST"},
                        {"sop_id": "SOP003", "interlock_name": "Proof Test_Secondary Radar Guage_Failed", "workflow_name": "HHH PROOF TEST"},
                        {"sop_id": "SOP003", "interlock_name": "Proof Test_VFT_Success", "workflow_name": "HHH PROOF TEST"},
                        {"sop_id": "SOP003", "interlock_name": "Proof Test_Secondary Radar Guage_Success", "workflow_name": "HHH PROOF TEST"},
                        {"sop_id": "SOP004", "interlock_name": "Rim Seal system_Fault activated", "workflow_name": "RIM SEAL"},
                        {"sop_id": "SOP005", "interlock_name": "HCD_20% LEL activated", "workflow_name": "TAS HCD ALARM SOP005"},
                        {"sop_id": "SOP005", "interlock_name": "HCD_40% LEL activated", "workflow_name": "TAS HCD ALARM SOP005"},
                        {"sop_id": "SOP05A", "interlock_name": "HCD_20% LEL activated Hooter_Fail", "workflow_name": "TAS HCD ALARM SOP005"},
                        {"sop_id": "SOP05A", "interlock_name": "HCD_40% LEL activated Hooter_Fail", "workflow_name": "TAS HCD ALARM SOP005"},
                        {"sop_id": "SOP006", "interlock_name": "Earthing Failure Alarm", "workflow_name": "EARTHING FAILURE"},
                        {"sop_id": "SOP007", "interlock_name": "ESD Push button_Under Maintenance", "workflow_name": "TAS ESD MAINTENANCE"},
                        {"sop_id": "SOP008", "interlock_name": "Rim Seal system_Under Maintenance", "workflow_name": "TAS ESD MAINTENANCE"},
                        {"sop_id": "SOP009", "interlock_name": "Tank_Under Maintenance", "workflow_name": "TAS ROSOV UNDER MAINTENANCE"},
                        {"sop_id": "SOP010", "interlock_name": "ROSOV_Under Maintenance", "workflow_name": "TAS ROSOV UNDER MAINTENANCE"},
                        {"sop_id": "SOP010A", "interlock_name": "MOV_Under Maintenance", "workflow_name": "TAS ROSOV UNDER MAINTENANCE"},
                        {"sop_id": "SOP011", "interlock_name": "VFT_Under Maintenance", "workflow_name": "TAS ROSOV UNDER MAINTENANCE"},
                        {"sop_id": "SOP012", "interlock_name": "Secondary Radar_Under Maintenance", "workflow_name": "TAS ROSOV UNDER MAINTENANCE"},
                        {"sop_id": "SOP013", "interlock_name": "Fire engine_Under Maintenance", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP013", "interlock_name": "JockeyPump_Under Maintenance", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP013", "interlock_name": "HydrantPT_Under Maintenance", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP014", "interlock_name": "HCD_Under Maintenance", "workflow_name": "TAS ESD MAINTENANCE"},
                        {"sop_id": "SOP015", "interlock_name": "Dykevalve_Activated", "workflow_name": "TAS HCD AND DYKE ACTIVATION"},
                        {"sop_id": "SOP015A", "interlock_name": "Dykevalve_Activated Hooter_Fail", "workflow_name": "TAS HCD ALARM SOP005"},
                        {"sop_id": "SOP016", "interlock_name": "HCD_Fault activated", "workflow_name": "TAS HCD FAULT ALARM"},
                        {"sop_id": "SOP017", "interlock_name": "AirCompressor_Fault activated", "workflow_name": "TAS HCD FAULT ALARM"},
                        {"sop_id": "SOP018", "interlock_name": "ROSOV_FailtoClose", "workflow_name": "TAS HCD FAULT ALARM"},
                        {"sop_id": "SOP019", "interlock_name": "Fire engine_ FailtoStart", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP019", "interlock_name": "Fireengine_LLOP", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP019", "interlock_name": "FireEngine_HWOT", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP019", "interlock_name": "FireEngine_Tripped", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP020", "interlock_name": "Jockeypump_ FailtoStart", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP020", "interlock_name": "JockeyPump_Tripped", "workflow_name": "Fire Pump Alarm"},
                        {"sop_id": "SOP021", "interlock_name": "SafetyPLC_Communication fail", "workflow_name": "CONTROL ROOM"},
                        {"sop_id": "SOP021", "interlock_name": "UPS_Fail", "workflow_name": "CONTROL ROOM"},
                        {"sop_id": "SOP021", "interlock_name": "UPS_Lowbattery", "workflow_name": "CONTROL ROOM"},
                        {"sop_id": "SOP021", "interlock_name": "ProcessPLC_Communication fail", "workflow_name": "CONTROL ROOM"},
                        {"sop_id": "SOP022", "interlock_name": "LRC server out of sync", "workflow_name": "CONTROL ROOM"},
                        {"sop_id": "SOP023", "interlock_name": "Firefighting system parameter", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023", "interlock_name": "Main Fire Engines not in REMOTE", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023", "interlock_name": "WATER Level below Reference Volume", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023", "interlock_name": "Two Fire Engine Running status", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "Hooter Activated at control room", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "All TLF Product Pumps Stopped", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "TLF Header Line MOV Close", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "Gantry Permissive Off", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "Hooter Activated at control room_Fail", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "All TLF Product Pumps Stopped_Fail", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "TLF Header Line MOV Close_Fail", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "Gantry Permissive Off_Fail", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP023A", "interlock_name": "All BCU Permissive Fail Status", "workflow_name": "FIRE CRITICAL DATA"},
                        {"sop_id": "SOP024", "interlock_name": "Day End totaliser Mismatch", "workflow_name": "TOTALISER MISMATCH"},
                        {"sop_id": "SOP024", "interlock_name": "Day End totaliser Mismatch Blend", "workflow_name": "TOTALISER MISMATCH"},
                        {"sop_id": "SOP025", "interlock_name": "BCU Local Loading", "workflow_name": ""},
                        {"sop_id": "SOP026", "interlock_name": "BCU vs MFM totalizer mismatch alarm", "workflow_name": "K Factor Change"},
                        {"sop_id": "SOP027", "interlock_name": "K Factor Change_BCU", "workflow_name": "K Factor Change"},
                        {"sop_id": "SOP027", "interlock_name": "K Factor Change_MFM", "workflow_name": "K Factor Change"},
                        {"sop_id": "SOP027", "interlock_name": "K Factor Change Blend_BCU", "workflow_name": "K Factor Change"},
                        {"sop_id": "SOP028", "interlock_name": "Pulse Security", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "K-Factors", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "No Flow alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "No Flow alarm Blend_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Low Flow alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Low Flow alarm Blend_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "High Flow Alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "High Flow Alarm Blend_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Unauthorized Flow Alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Unauthorized Flow Alarm Blend_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Meter overrun Alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Meter overrun Alarm Blend_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Blend overdose Alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Blend Underdose Alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Additive Overdose Alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028", "interlock_name": "Additive Underdose Alarm_BCU", "workflow_name": "BCU ALARM PARAMETERS"},
                        {"sop_id": "SOP028A", "interlock_name": "BCU Permissive Off_Fail", "workflow_name": "BCU PERMISSIVE OFF"},
                        {"sop_id": "SOP028A", "interlock_name": "BCU Permissive Off_DNC", "workflow_name": "BCU PERMISSIVE OFF"},
                        {"sop_id": "SOP028A", "interlock_name": "Gantry Permissive Off_DNC", "workflow_name": "BCU PERMISSIVE OFF"},
                        {"sop_id": "SOP028A", "interlock_name": "Gantry Permissive Off_ACK from TAS", "workflow_name": "BCU ALARM PARAMETERS ACK"},
                        {"sop_id": "SOP028A", "interlock_name": "ESD ACK from TAS", "workflow_name": "BCU ALARM PARAMETERS ACK"},
                        {"sop_id": "SOP028A", "interlock_name": "BCU Permissive Off", "workflow_name": "BCU PERMISSIVE OFF"},
                        {"sop_id": "SOP028A", "interlock_name": "DayStartTotalizer_Gantry Permissive_Fail", "workflow_name": "BCU PERMISSIVE OFF"},
                        {"sop_id": "SOP028A",  "interlock_name": "K Factor BCU Permissive Off_Fail", "workflow_name": "ANALOG ALERTS BCU PERMISSIVE OFF"},
                        {"sop_id": "SOP028A",  "interlock_name": "Local Loading BCU Permissive Off_Fail", "workflow_name": "ANALOG ALERTS BCU PERMISSIVE OFF"},
                        {"sop_id": "SOP028A",  "interlock_name": "MFM Factor BCU Permissive Off_Fail", "workflow_name": "ANALOG ALERTS BCU PERMISSIVE OFF"},
                        {"sop_id": "SOP029", "interlock_name": "Tank level change during dormant mode", "workflow_name": "TANK LEAKAGE"},
                        {"sop_id": "SOP032", "interlock_name": "Primary Radar Guage_H alarm", "workflow_name": "TANK PRIMARY RADAR GAUGE HAND HH"},
                        {"sop_id": "SOP032", "interlock_name": "Primary Radar Guage_HH alarm", "workflow_name": "TANK PRIMARY RADAR GAUGE HAND HH"},
                        {"sop_id": "SOP035", "interlock_name": "Gantry Permissive_Override", "workflow_name": "Gantry Permessive Ovveride SOP035"},
                        {"sop_id": "SOP291", "interlock_name": "Indent Dry Out", "workflow_name": ""},
                        {"sop_id": "SOP061", "interlock_name": "Unauthorized flow_BCU", "workflow_name": ""},
                        {"sop_id": "SOP062", "interlock_name": "Cancel TT Reported", "workflow_name": ""},
                        {"sop_id": "SOP063", "interlock_name": "Manual FAN printed less than 5% of total TT loaded", "workflow_name": ""},
                        {"sop_id": "SOP063", "interlock_name": "Manual FAN printed more than 5% of total TT loaded", "workflow_name": ""},
                        {"sop_id": "SOP064", "interlock_name": "TT Overloaded", "workflow_name": ""},
                        {"sop_id": "SOP065", "interlock_name": "BCU K- Factor Change", "workflow_name": ""},
                        {"sop_id": "SOP066", "interlock_name": "Bay reassignment", "workflow_name": ""},
                        {"sop_id": "SOP067", "interlock_name": "Manual Bay assignment of more than 5% of total TT loaded", "workflow_name": ""},
                        {"sop_id": "SOP068", "interlock_name": "SickTT Reported", "workflow_name": ""},
                        {"sop_id": "SOP069", "interlock_name": "MFM K Factor Change", "workflow_name": ""},
                        {"sop_id": "SOP073", "interlock_name": "Day End Report", "workflow_name": ""},
                        {"sop_id": "SOP074", "interlock_name": "TAS User access report", "workflow_name": ""},
                        {"sop_id": "SOP075", "interlock_name": "Local order/Standalone Order Entryt", "workflow_name": ""},
                        {"sop_id": "SOP099", "interlock_name": "Loss Of Communication", "workflow_name": "Loss Of Communication"},
                         
                         {"sop_id": "SOP033", "interlock_name": "Non compliance of Fire Extinguisher (TT Unloading)", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP034", "interlock_name": "Fire", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP035", "interlock_name": "Spillage", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP036", "interlock_name": "Perimeter Intrusion", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP037", "interlock_name": "TT Dome Covers", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP038", "interlock_name": "valve Box in open status", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP039", "interlock_name": "Safety Harness non compliance (TT Unloading)", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP040", "interlock_name": "Wheel choke non compliance (TT Unloading)", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP041", "interlock_name": "Intrusion in nonworking hours (Storage Area/Wagon Gantry)", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP042", "interlock_name": "Obstruction on approach road (Emergency gate)", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP043", "interlock_name": "PPE non compliance", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP044", "interlock_name": "Product filling in unauthorized container (TT Gantry)", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP045", "interlock_name": "TT Crew non availability (TT unloading)", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP046", "interlock_name": "TT Crew entering below TT", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP047", "interlock_name": "Unauthorized activity in parking area", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP048", "interlock_name": "Non availability of Crash Guard in TT", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP049", "interlock_name": "Emergency gate Key Removal", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP050", "interlock_name": "Parking Discipline deviation", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP051", "interlock_name": "Unauthorized Activity (Emergency Gate opening )", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP052", "interlock_name": "Clustering of people", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP053", "interlock_name": "TT Branding non compliance", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         {"sop_id": "SOP054", "interlock_name": "Unauthorized activity (Stacking of unwanted material in shed)", "model": "VA", "workflow_name": "UC_TAS_SOP27_33"},
                         
                         {"sop_id": "SOP055", "interlock_name": "Fan Number Not Generated", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                         {"sop_id": "SOP056", "interlock_name": "Swipe In Count Exceeded", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                         {"sop_id": "SOP057", "interlock_name": "TT outside Terminal Radius", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                         {"sop_id": "SOP058", "interlock_name": "Swipe Out Count Limit Exceed", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                         {"sop_id": "SOP059", "interlock_name": "Invoice Not Generated", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                         {"sop_id": "SOP060", "interlock_name": "Shipment Number Not Generated", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                         {"sop_id": "SOP070", "interlock_name": "TT outside RO radius", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                         {"sop_id": "SOP071", "interlock_name": "Pre Decantation Request Exceed", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                         {"sop_id": "SOP072", "interlock_name": "Post Decantation Request Exceed", "model": "EMLock", "workflow_name": "TAS EMLOCK"}]

# Interlock name and sop mapping for RO Alerts
ro_interlock_mapping = [{"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_FirstTime_90days"},
                        {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_SecondTime_2years"},

                        {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_FirstTime_90days"},
                        {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_SecondTime_2years"},

                        {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect", "model": "VTS", "workflow_name": "Ro_Vts_PermanantBlock"},                         
                        {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering", "model": "VTS", "workflow_name": "Ro_Vts_PermanantBlock"},

                        {"sop_id": "SOP001", "interlock_name": "VTS Offline FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_FirstTime_90days"},
                        {"sop_id": "SOP001", "interlock_name": "VTS Offline SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_SecondTime_2years"},

                        {"sop_id": "SOP001", "interlock_name": "Night Driving FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_FirstTime_7days"},
                        {"sop_id": "SOP001", "interlock_name": "Night Driving SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_FirstTime_90days"},
                        {"sop_id": "SOP001", "interlock_name": "Night Driving ThirdTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_SecondTime_2years"},

                        {"sop_id": "SOP001", "interlock_name": "Speed Violation FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_FirstTime_7days"},
                        {"sop_id": "SOP001", "interlock_name": "Speed Violation SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_FirstTime_90days"},
                        {"sop_id": "SOP001", "interlock_name": "Speed Violation ThirdTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_SecondTime_2years"},

                        {"sop_id": "SOP001", "interlock_name": "NoHalt Zone FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_FirstTime_90days"},
                        {"sop_id": "SOP001", "interlock_name": "NoHalt Zone SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Deviation_SecondTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "Route Deviation Exception FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "Route Deviation Exception SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "Unauthorized Stoppage Exception FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "Unauthorized Stoppage Exception SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "VTS PowerDisconnect Exception", "model": "VTS", "workflow_name": "Ro_Vts_Exception_ThirdTime_2years"},
                        {"sop_id": "SOP001E", "interlock_name": "VTS device Tampering Exception", "model": "VTS", "workflow_name": "Ro_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "VTS offline Exception FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "VTS Offline Exception SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_ThirdTime_2years"},
                         
                        {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_SecondTime_90days"},
                        {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception ThirdTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_ThirdTime_2years"},


                        {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_SecondTime_90days"},
                        {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception ThirdTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001E", "interlock_name": "NoHalt zone Exception FirstTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_FirstTime_7days"},
                        {"sop_id": "SOP001E", "interlock_name": "NoHalt Zone Exception SecondTime", "model": "VTS", "workflow_name": "Ro_Vts_Exception_ThirdTime_2years"},

                        {"sop_id": "SOP001", "interlock_name": "Auto RSP Interlock"},
                        {"sop_id": "SOP002", "interlock_name": "Auto RSP Mismatch Interlock"},
                        {"sop_id": "SOP003", "interlock_name": "Testing Interlock"},
                        {"sop_id": "SOP005", "interlock_name": "k-Factor Interlock"},
                        {"sop_id": "SOP006", "interlock_name": "Tank Low Level  Interlock"},
                        {"sop_id": "SOP007", "interlock_name": "Water Level High Interlock"},
                        {"sop_id": "SOP008", "interlock_name": "Decantation Violation","model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP008", "interlock_name": "Absence Of Earthing","model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP008", "interlock_name": "Absence Of Wheelchock","model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP009", "interlock_name": "Alight From Two Wheeler", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP009", "interlock_name": "Unauthorised Filling Of Container", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP009", "interlock_name": "Vehicle Mixing", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP009", "interlock_name": "Vehicle Cluttering", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP009", "interlock_name": "Wrong Entry of Vehicle", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP010", "interlock_name": "ATG Communication Failure Interlock"},
                        {"sop_id": "SOP011", "interlock_name": "TT Decantation Interlock"},
                        {"sop_id": "SOP012", "interlock_name": "FCC Offline"},
                        {"sop_id": "SOP013", "interlock_name": "High level ( ATG) interlock"},
                        {"sop_id": "SOP014", "interlock_name": "Person not wearing Safety Helmet", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP016", "interlock_name": "Absence Of Fire Extinguisher Decantation", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP017", "interlock_name": "Fire Hose is not available during UC", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP017", "interlock_name": "Smoke Detection", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP017", "interlock_name": "Fire Detection", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP017", "interlock_name": "Fire/Smoke Detection", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP018", "interlock_name": "Person not wearing Protective Clothing", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP018", "interlock_name": "Nozzle"},
                        {"sop_id": "SOP019", "interlock_name": "Camera is offline", "model": "VA", "workflow_name": "UC_RO_SOP14_20"},
                        {"sop_id": "SOP999", "interlock_name": "Nozzle Interlock"},
                        {"sop_id": "SOP999", "interlock_name": "Bay Interlock"},
                        {"sop_id": "SOP291", "interlock_name": "Indent Dry Out", "workflow_name": "Indent Dry Out"},
                        {"sop_id": "SOP292", "interlock_name": "Dry Out Each Indent Wise MainFlow", "workflow_name": "Dry Out Each Indent Wise MainFlow"},
                        {"sop_id": "SOP293", "interlock_name": "Dry Out Triggering Flow"},

                        {"sop_id": "SOP294", "interlock_name": "Product Low Level", "workflow_name": "RETAIL AUTOMATION"},
                        {"sop_id": "SOP295", "interlock_name": "High Water Level", "workflow_name": "RETAIL AUTOMATION"},
                        {"sop_id": "SOP296", "interlock_name": "TT Receipt", "workflow_name": "RETAIL AUTOMATION"},
                        {"sop_id": "SOP297", "interlock_name": "Decantation", "workflow_name": "RETAIL AUTOMATION"},
                        {"sop_id": "SOP298", "interlock_name": "NANF", "workflow_name": "RETAIL AUTOMATION"},
                        {"sop_id": "SOP299", "interlock_name": "No Pump Test", "workflow_name": "RETAIL AUTOMATION"},
                        
                        {"sop_id": "SOP020", "interlock_name": "TT outside RO radius", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                        {"sop_id": "SOP021", "interlock_name": "Pre Decantation Request Exceed", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                        {"sop_id": "SOP022", "interlock_name": "Post Decantation Request Exceed", "model": "EMLock", "workflow_name": "TAS EMLOCK"},
                        
                        {"sop_id": "SOP023", "interlock_name": "Restroom Cleaning Evidence Missing", "model": "VA", "workflow_name": "Restroom Cleaning Evidence Missing"}]

# Interlock name and sop mapping for LPG Alerts
lpg_interlock_mapping = [

    {"sop_id": "SOP001V", "interlock_name": "VTS Device Tampering","model": "VTS", "workflow_name": "LPG VTS Violation"},
    {"sop_id": "SOP001V", "interlock_name": "VTS PowerDisconnect", "model": "VTS", "workflow_name": "LPG VTS Violation"},
    {"sop_id": "SOP001V", "interlock_name": "VTS RouteDeviation", "model": "VTS", "workflow_name": "LPG VTS Violation"},
    {"sop_id": "SOP001V", "interlock_name": "Unauthorized Stoppage", "model": "VTS", "workflow_name": "LPG VTS Violation"},
    {"sop_id": "SOP001V", "interlock_name": "Speed Violation", "model": "VTS", "workflow_name": "LPG VTS Violation"},
    {"sop_id": "SOP001V", "interlock_name": "Night Driving", "model": "VTS", "workflow_name": "LPG VTS Violation"},
    {"sop_id": "SOP001V", "interlock_name": "Continuous Driving", "model": "VTS", "workflow_name": "LPG VTS Violation"},
    {"sop_id": "SOP001N", "interlock_name": "No VTS No Load", "model": "VTS", "workflow_name": "LPG No VTS No Load"},
    {"sop_id": "SOP009B", "interlock_name": "Itdg Admin Blocked", "model": "VTS", "workflow_name": "Itdg Manual Block"},
    {"sop_id": "SOP001E", "interlock_name": "Truck Contract Validity Status", "model": "VTS", "workflow_name": "Vts Device Expiry"},

    {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation FirstTime","model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS RouteDeviation SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},


    {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage FirstTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Unauthorized Stoppage SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},

    {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect FirstTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS PowerDisconnect SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    
    {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering FirstTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Device Tampering SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},

    {"sop_id": "SOP001", "interlock_name": "VTS Offline FirstTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Offline SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Offline ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Offline FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Offline FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "VTS Offline SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},

    {"sop_id": "SOP001", "interlock_name": "Night Driving FirstTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Night Driving SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Night Driving ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Night Driving FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Night Driving FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Night Driving SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},

    {"sop_id": "SOP001", "interlock_name": "Speed Violation FirstTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Speed Violation SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Speed Violation ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Speed Violation FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Speed Violation FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Speed Violation SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},

    {"sop_id": "SOP001", "interlock_name": "NoHalt Zone FirstTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "NoHalt Zone SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "NoHalt Zone ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "NoHalt Zone FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "NoHalt Zone FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "NoHalt Zone SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},

    {"sop_id": "SOP001", "interlock_name": "Continuous Driving FirstTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Continuous Driving SecondTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Continuous Driving ThirdTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Continuous Driving FourthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Continuous Driving FifthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},
    {"sop_id": "SOP001", "interlock_name": "Continuous Driving SixthTime", "model": "VTS", "workflow_name": "LPG SOP001 7 DAYS 1st Instance"},

    {"sop_id": "SOP001E", "interlock_name": "Unauthorized Stoppage Exception FirstTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_FirstTime_7days"},
    {"sop_id": "SOP001E", "interlock_name": "Unauthorized Stoppage Exception SecondTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_ThirdTime_2years"},

    {"sop_id": "SOP001E", "interlock_name": "VTS PowerDisconnect Exception", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_ThirdTime_2years"},
    {"sop_id": "SOP001E", "interlock_name": "VTS device Tampering Exception", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_ThirdTime_2years"},

    {"sop_id": "SOP001E", "interlock_name": "VTS offline Exception FirstTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_FirstTime_7days"},
    {"sop_id": "SOP001E", "interlock_name": "VTS Offline Exception SecondTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_ThirdTime_2years"},
    
    {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception FirstTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_FirstTime_7days"},
    {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception SecondTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_SecondTime_90days"},
    {"sop_id": "SOP001E", "interlock_name": "Night Driving Exception ThirdTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_ThirdTime_2years"},


    {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception FirstTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_FirstTime_7days"},
    {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception SecondTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_SecondTime_90days"},
    {"sop_id": "SOP001E", "interlock_name": "Speed Violation Exception ThirdTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_ThirdTime_2years"},

    {"sop_id": "SOP001E", "interlock_name": "NoHalt zone Exception FirstTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_FirstTime_7days"},
    {"sop_id": "SOP001E", "interlock_name": "NoHalt Zone Exception SecondTime", "model": "VTS", "workflow_name": "Lpg_Vts_Exception_ThirdTime_2years"},

    {"sop_id": "SOP001", "interlock_name": "Healthy Status of High level alarm interlock loops for vessels"},
    {"sop_id": "SOP002", "interlock_name": "Health status of Plant ESD level Interlock loops"},
    {"sop_id": "SOP003", "interlock_name": "Health status of Plant MCP level Interlock loops"},
    {"sop_id": "SOP004", "interlock_name": "Health status of Fire Water Level in Tanks"},
    {"sop_id": "SOP005", "interlock_name": "Fire Fighting Water line is under Pressure"},
    {"sop_id": "SOP006", "interlock_name": "Filling Operation  Interlock"},
    {"sop_id": "SOP007", "interlock_name": "OLD Bypass"},
    {"sop_id": "SOP007A", "interlock_name": "Loss of Communication"},
    {"sop_id": "SOP008", "interlock_name": "Checking of OLD"},
    {"sop_id": "SOP009", "interlock_name": "Quality of Cylinders in OLD Machine"},
    {"sop_id": "SOP010", "interlock_name": "VLD Bypass"},
    {"sop_id": "SOP011", "interlock_name": "Checking of VLD"},
    {"sop_id": "SOP012", "interlock_name": "Quality of Cylinders in VLD Machine"},
    {"sop_id": "SOP013", "interlock_name": "Quality of Cylinders in Water bath"},
    {"sop_id": "SOP013A", "interlock_name": "TestBath communication loss"},

    {"sop_id": "SOP014", "interlock_name": "Fire Extinguisher Non Compliance (TT)", "model": "VA",
     "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP014", "interlock_name": "Fire", "model": "VA", "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP014", "interlock_name": "Smoke", "model": "VA", "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP015", "interlock_name": "LPG Leakages thru Filling Gun", "model": "VA",
     "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP016", "interlock_name": "LPG Leakages", "model": "VA", "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP017", "interlock_name": "Perimeter Intrusion", "model": "VA", "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP017", "interlock_name": "Wheel choke non compliance (TT)", "model": "VA",
     "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP017", "interlock_name": "Obstruction on Road (Emergency gate)", "model": "VA",
     "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP017", "interlock_name": "PPE non compliance", "model": "VA", "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP017", "interlock_name": "TT Crew non avaibaility near TT", "model": "VA",
     "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP017", "interlock_name": "Position of Truck on weigh bridge", "model": "VA",
     "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP021", "interlock_name": "Detection of rolling of cylinders", "model": "VA",
     "workflow_name": "UC_LPG_SOP21_27"},

    {"sop_id": "SOP027", "interlock_name": "Work Beyond time", "model": "VA", "workflow_name": "UC_LPG_SOP21_27"},
    {"sop_id": "SOP029", "interlock_name": "Healthiness of Pump Operations"},
    {"sop_id": "SOP033", "interlock_name": "Healthiness of Fire Engine"},
    {"sop_id": "SOP034", "interlock_name": "Healthiness of Deluge Valve"},
    {"sop_id": "SOP077", "interlock_name": "Check Scale Rejection", "workflow_name": "UC_LPG_SOP07_77"},
    {"sop_id": "SOP078", "interlock_name": "Valve Leak Rejection", "workflow_name": "UC_LPG_SOP08_78"},
    {"sop_id": "SOP079", "interlock_name": "O-Ring Leak Rejection", "workflow_name": "UC_LPG_SOP09_79"}]

rdi_interlock_mapping = [{"sop_id": "SOP001", "interlock_name": "Product Quality Density"},
                         {"sop_id": "SOP002", "interlock_name": "Product Quality Water"},
                         {"sop_id": "SOP003", "interlock_name": "Unauthorized Decantation RDI"}]


def get_interlock_name(bu, interlock_name=None, sop_id=None):
    if not bu or (not interlock_name and not sop_id):
        return {}
    mapping = eval(f'{urdhva_base.utilities.snake_case(bu)}_interlock_mapping')
    filtered_data = []
    if sop_id:
        filtered_data = list(filter(lambda x: x['sop_id'].lower() == sop_id.lower(), mapping))
        if len(filtered_data) > 1 and interlock_name:
            filtered_data = list(filter(lambda x: x['interlock_name'].lower() == interlock_name.lower(), filtered_data))
    elif interlock_name:
        filtered_data = list(filter(lambda x: x['interlock_name'].lower() == interlock_name.lower(), mapping))
    print("filtered_data--->", filtered_data)
    return filtered_data[0] if filtered_data else {}


def fmt_il_name(interlock_name=None):
    # Fetch interlock details from configuration
    """
    Format interlock name and return interlock details for a given BU.

    If sop_id is provided, fetches the interlock details based on the sop_id.
    If interlock_name is provided, fetches the interlock details based on the interlock_name.
    If neither sop_id nor interlock_name is provided, returns an empty dictionary.

    :param interlock_name: The name of the interlock
    :param sop_id: The SOP ID of the interlock
    :return: A dictionary containing the interlock details. The dictionary will contain the keys 'sop_id', 'interlock_name', 'location_name', 'device_name', 'device_type', 'device_id', 'state', 'city', 'zone' and 'interlock_status'. If the interlock is not found, an empty dictionary is returned.
    """
    if interlock_name:
        interlock_name = ''.join(char for char in interlock_name if char not in ' :()-/_')

    return interlock_name
