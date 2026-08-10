# For RO
RO = {
    "ROCode": "ro_id",
    "LocationID": "sap_id",
    "LocationName": "name",
    "LocationType": "bu",
    "LocationState": "state",
    "Address": "address",
    "LocationDistrict": "district",
    "LocationRegion": "region",
    "LocationCity": "city",
    "LocationZone": "zone",
    "LocationPinCode": "pincode",
    "Latitude": "latitude",
    "Longitude": "longitude",
    "LocalAutomationVendor": "local_automation_vendor",
    "DealerName": "dealer_name",
    "DealerMobile": "dealer_phone",
    "DealerEmail": "dealer_email",
    "SalesArea": "sales_area",
    "DeliveryPlantID": "terminal_plant_id",
    "DeliveryPlantName": "terminal_plant_name",
    "Category": "category",
    "DistributorCode": "distributor_code",
    "DistributorName": "distributor_name",
    "RTKM": "round_trip_distance",
}

# For Terminal Locations
TAS = {
    "LocationID": "sap_id",
    "LocationName": "name",
    "LocationType": "bu",
    "LocationState": "state",
    "Address": "address",
    "LocationDistrict": "district",
    "LocationRegion": "region",
    "LocationCity": "city",
    "LocationZone": "zone",
    "LocationPinCode": "pincode",
    "Latitude": "latitude",
    "Longitude": "longitude"
}

# For LPG Locations
LPG = {
    "LocationID": "sap_id",
    "LocationName": "name",
    "LocationType": "bu",
    "LocationState": "state",
    "Address": "address",
    "LocationDistrict": "district",
    "LocationRegion": "region",
    "LocationCity": "city",
    "LocationZone": "zone",
    "LocationPinCode": "pincode",
    "Latitude": "latitude",
    "Longitude": "longitude"
}

RO_Device = {
    "LocationID": "sap_id",
    "LocationName": "location_name",
    "LocationType": "bu",
    "LocationState": "state",
    "LocationCity": "city",
    "LocationRegion": "region",
    "BayID": "bay_id",
    "MPDID": "mpd_id",
    "TankID": "tank_id",
    "NozzleID": "nozzle_id"
}

Role = {
    "LocationID": "sap_id",
    "LocationName": "location_name",
    "LocationType": "bu",
    "LocationState": "state",
    "LocationCity": "city",
    "LocationDistrict": "district",
    "LocationRegion": "region",
    "InchargeName": "user_name",
    "InchargeEmail": "email",
    "InchargePhone": "phone_no",
    "InchargeRole": "role",
    "NotificationLevel": "escalation_level",
    "LocationZone": "zone"
}

processcodemap = {
    'RO': '1',
    'TAS': '2',
    'VTS': '3',
    'TAS_vehicle': '3',
    'LPG_vehicle': '4'
}

tasSopcommands = {
    "SOP012": "/ASSETS/OPC/TLF_PULSE_STP_LPID.OP",
    "SOP013": "/ASSETS/OPC/TLF_KFACT_STP_LPID.OP",
    "SOP014": "/ASSETS/OPC/TLF_NFLOW_STP_LPID.OP",
    "SOP015": "/ASSETS/OPC/TLF_LFLOW_STP_LPID.OP",
    "SOP016": "/ASSETS/OPC/TLF_HFLOW_STP_LPID.OP",
    "SOP017": "/ASSETS/OPC/TLF_UFLOW_STP_LPID.OP",
    "SOP018": "/ASSETS/OPC/TLF_ORUN_STP_LPID.OP",
    "SOP019": "/ASSETS/OPC/TLF_BOVER_STP_LPID.OP",
    "SOP020": "/ASSETS/OPC/TLF_BUNDER_STP_LPID.OP",
    "SOP004": "/ASSETS/OPC/TLF_AOVER_STP_LPID.OP",
    "SOP022": "/ASSETS/OPC/TLF_AUNDER_STP_LPID.OP",
}

cems_location_master = {
    "BUID": "bu_id",
    "BU": "bu",
    "DeviceName": "device_name",
    "LocationName": "location_name",
    "LocationID": "location_id",
    "SourceID": "source_id",
    "ZonalID": "zonal_id",
    "District": "district",
    "Zone": "zone",
    "Region": "region",
    "State": "state",
    "City": "city"
}

alertmap = {'Pulse Security': 'LOADING TERMINATE COMMAND FROM CCC FOR PULSE ERROR',
            'K-Factors': 'LOADING TERMINATE COMMAND FROM CCC FOR KFACTOR ERROR',
            'No Flow': 'LOADING TERMINATE COMMAND FROM CCC FOR NO FLOW ERROR',
            'Low Flow': 'LOADING TERMINATE COMMAND FROM CCC FOR LOW FLOW ERROR',
            'High Flow': 'LOADING TERMINATE COMMAND FROM CCC FOR HIGH FLOW ERROR',
            'Unauthorized Flow': 'LOADING TERMINATE COMMAND FROM CCC FOR UNAUTHORISE FLOW ERROR',
            'Meteroverrun': 'LOADING TERMINATE COMMAND FROM CCC FOR METER OVERRUN ERROR',
            'Blendoverdose': 'LOADING TERMINATE COMMAND FROM CCC FOR BLEND OVERDOSE ERROR',
            'Blendunderdose': 'LOADING TERMINATE COMMAND FROM CCC FOR BLEND UNDERDOSE ERROR',
            'Additive overdose': 'LOADING TERMINATE COMMAND FROM CCC FOR ADD OVERDOSE ERROR',
            'Additive underdose': 'LOADING TERMINATE COMMAND FROM CCC FOR ADD UNDERDOSE ERROR'}
