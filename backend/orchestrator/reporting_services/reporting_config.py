zone_map = {
    "WZL": "WZ",
    "NWL": "NWZ",
    "EZL": "EZ",
    "NZL": "NZ",
    "NCL": "NCZ",
    "SZL": "SZ",
    "SCL": "SCZ",
    "SZ": "SZ",
    "EZ": "EZ",
    "SCZ": "SCZ",
    "NWZ": "NWZ",
    "NZ": "NZ",
    "NCZ": "NCZ",
    "WZ": "WZ",
    "NFZ": "NFZ",
    "NWF": "NWF",
    "NCR": "NCR",
    "SCR": "SCR",
    "NWR": "NWR",
    "SC": "SCZ",
    "NW": "NWZ",
    "COR": "COR",
    "ECZ": "ECZ",
    "SWZ": "SWZ",
    "CEN": "CEN",
    "GZR": "GZR",
    "PZR": "PZR",
    "NUZ": "NUZ",
    "CZR": "CZR",
    "NORTH CENTRAL RETAIL": "NCZ",
    "SOUTH CENTRAL RETAIL": "SCZ",
    "WEST ZONE": "WZ",
    "BHUBANESWAR ZONE": "Bhubaneswar Zone",
    "NOIDA (UP-WEST) ZONE": "Noida Zone",
    "EAST ZONE": "EZ",
    "COCHIN ZONE": "Cochin Zone",
    "PATNA ZONE": "Patna Zone",
    "NORTH WEST RETAIL ZO": "NWZ",
    "GUWAHATI ZONE": "Guwahati Zone",
    "JAIPUR ZONE": "Jaipur Zone",
    "CHANDIGARH ZONE": "Chandigarh Zone",
    "SOUTH ZONE": "SZ",
    "BENGALURU ZONE": "Bengaluru Zone",
    "BHOPAL ZONE": "Bhopal Zone",
    "NORTH ZONE": "NZ"
}

novex_model_col = ["username", "email", "first_name", "last_name", "password", "employee_id",
                       "employee_number", "bu", "sap_id", "system_role", "novex_role", "region",
                       "state", "zone", "sales_area", "is_ad_user", "status", "manual_user", "contact_number", "mfa"]

# Add required roles in novex_role_master.csv
lpg_query = """ SELECT distinct(ZE.EMPLOYEE_NUMBER) as EMPLOYEE_NUMBER, ZE.EMPLOYEE_NAME as EMPLOYEE_NAME,  ZE.EMP_EMAIL as EMP_EMAIL, EPL.ZLOC_TYPE,
                    ZE.EMP_BU_CODE,ZE.PLANT_DESC,ZE.SALES_GRP, ZSA.SALES_GROUP_DESC,ZR.ROLE_NAME as ROLE_NAME, EPL.ZZONE as Zone, ZE.PLANT_CODE AS PLANT_CODE,
                    ZE.EMP_CONTACT_NUMBER AS contact_number
                FROM ZGRCCV_ROLE_STG ZR left JOIN ZHRCV_EMP_NONHCM_STG ZE on ZR.USER_NAME = ZE.EMPLOYEE_NUMBER 
                    LEFT JOIN ZMMCV_PLANT_STG EPL on ZE.PLANT_CODE = EPL.PLANT
                    LEFT JOIN ZSDCV_SO_PARAM_STG ZSA on ZSA.SALES_GROUP = ZE.SALES_GRP
                WHERE ZE.PLANT_CODE like '2%' """


additional_lpg_query = [
    """ SELECT distinct(ZE.EMPLOYEE_NUMBER) as EMPLOYEE_NUMBER, ZE.EMPLOYEE_NAME as EMPLOYEE_NAME,  ZE.EMP_EMAIL as EMP_EMAIL,
            ZE.EMP_BU_CODE,ZE.PLANT_CODE as PLANT_CODE, ZE.PLANT_DESC,ZE.SALES_GRP, ZSA.SALES_GROUP_DESC,ZR.ROLE_NAME as ROLE_NAME,
            EPL.ZZONE as Zone, EPL.ZLOC_TYPE, ZE.EMP_CONTACT_NUMBER AS contact_number
        FROM ZGRCCV_ROLE_STG ZR left JOIN ZHRCV_EMP_NONHCM_STG ZE on ZR.USER_NAME = ZE.EMPLOYEE_NUMBER 
            LEFT JOIN ZMMCV_PLANT_STG EPL on ZE.PLANT_CODE = EPL.PLANT
            LEFT JOIN ZSDCV_SO_PARAM_STG ZSA on ZSA.SALES_GROUP = ZE.SALES_GRP
        WHERE 
            ZE.PLANT_CODE like '2%' and ZR.ROLE_NAME IN ('IL_DGM_LPGOPNNFP', 'IL_CHMNGR_LPGHSEZONE', 'IL_MANAGER_LPG')""",
        # Contract Employess
    """ SELECT distinct(ZR.USER_NAME) as EMPLOYEE_NUMBER, ZR.USER_NAME as EMPLOYEE_NAME,
            EPL.PLANT as PLANT_CODE, EPL.PLANT_DESC,ZR.ROLE_NAME as ROLE_NAME, ZR.LOCATION as LOCATION, EPL.ZZONE as Zone,EPL.ZLOC_TYPE
        FROM ZGRCCV_ROLE_STG ZR
            LEFT JOIN ZMMCV_PLANT_STG EPL on ZR.LOCATION = EPL.PLANT
        WHERE ZR.LOCATION like '2%' AND ZR.ROLE_NAME IN ('IL_LPGCONT_OFFCER')"""
        ]

# Add required roles in novex_role_master.csv
tas_query = """ SELECT ZE.EMPLOYEE_NUMBER as EMPLOYEE_NUMBER, ZE.EMPLOYEE_NAME as EMPLOYEE_NAME,  ZE.EMP_EMAIL as EMP_EMAIL,
                    ZE.EMP_BU_CODE, ZE.PLANT_CODE AS PLANT_CODE, ZE.PLANT_DESC, ZR.ROLE_NAME as ROLE_NAME, EPL.ZZONE as zone,
                    ZE.EMP_CONTACT_NUMBER AS contact_number
                FROM ZGRCCV_ROLE_STG ZR LEFT JOIN ZHRCV_EMP_NONHCM_STG ZE on ZR.USER_NAME = ZE.EMPLOYEE_NUMBER 
                    LEFT JOIN ZMMCV_PLANT_STG EPL on ZE.PLANT_CODE = EPL.PLANT
                WHERE (ZE.PLANT_CODE like '1%') AND EPL.ZZONE NOT IN ('COR','MHQ') """

# Add required roles in novex_role_master.csv
ro_query = """ SELECT distinct(ZE.EMPLOYEE_NUMBER) as EMPLOYEE_NUMBER, ZE.EMPLOYEE_NAME as EMPLOYEE_NAME,  ZE.EMP_EMAIL as EMP_EMAIL, 
                    ZE.EMP_BU_CODE,ZE.PLANT_CODE AS PLANT_CODE, ZE.PLANT_DESC,ZE.SALES_GRP, ZSA.SALES_GROUP_DESC,ZR.ROLE_NAME as ROLE_NAME, EPL.ZZONE as Zone,
                    ZE.EMP_CONTACT_NUMBER AS contact_number
                FROM ZGRCCV_ROLE_STG ZR left JOIN ZHRCV_EMP_NONHCM_STG ZE on ZR.USER_NAME = ZE.EMPLOYEE_NUMBER 
                    LEFT JOIN ZMMCV_PLANT_STG EPL on ZE.PLANT_CODE = EPL.PLANT
                    LEFT JOIN ZSDCV_SO_PARAM_STG ZSA on ZSA.SALES_GROUP = ZE.SALES_GRP
                WHERE ZE.PLANT_CODE like '7%' """

# Add required roles in novex_role_master.csv
# Direct Sales (I&C)
ds_query = """SELECT distinct(ZE.EMPLOYEE_NUMBER) as EMPLOYEE_NUMBER, ZE.EMPLOYEE_NAME as EMPLOYEE_NAME,  
    ZE.EMP_EMAIL as EMP_EMAIL, 
    ZE.EMP_BU_CODE,ZE.PLANT_CODE AS PLANT_CODE, ZE.PLANT_DESC,ZE.SALES_GRP, 
    ZSA.SALES_GROUP_DESC,ZR.ROLE_NAME as ROLE_NAME, EPL.ZZONE as Zone,
    ZE.EMP_CONTACT_NUMBER AS contact_number
FROM ZGRCCV_ROLE_STG ZR left JOIN ZHRCV_EMP_NONHCM_STG ZE on ZR.USER_NAME = ZE.EMPLOYEE_NUMBER 
    LEFT JOIN ZMMCV_PLANT_STG EPL on ZE.PLANT_CODE = EPL.PLANT
    LEFT JOIN ZSDCV_SO_PARAM_STG ZSA on ZSA.SALES_GROUP = ZE.SALES_GRP
WHERE ZE.PLANT_CODE like '3%' """
# AND ZR.ROLE_NAME IN ('SD_RREGNL_MNGR','SD_RHQO_OFFICER','SD_RSALES_OFFICER','SD_RHQO_GMSALES')

# Zonal
# query = """ SELECT distinct(ZE.EMPLOYEE_NUMBER) as EMPLOYEE_NUMBER, ZE.EMPLOYEE_NAME as EMPLOYEE_NAME,  ZE.EMP_EMAIL as EMP_EMAIL,
#                 ZE.EMP_BU_CODE,ZE.PLANT_CODE,ZE.PLANT_DESC,ZE.SALES_GRP, ZSA.SALES_GROUP_DESC,ZR.ROLE_NAME as ROLE_NAME, ZR.LOCATION as LOCATION, EPL.ZZONE as Zone
#             FROM ZHRCV_EMP_NONHCM_STG ZE left JOIN ZGRCCV_ROLE_STG ZR on ZR.USER_NAME = ZE.EMPLOYEE_NUMBER 
#                 LEFT JOIN ZMMCV_PLANT_STG EPL on ZE.PLANT_CODE = EPL.PLANT
#                 LEFT JOIN ZSDCV_SO_PARAM_STG ZSA on ZSA.SALES_GROUP = ZE.SALES_GRP
#             WHERE ZR.ROLE_NAME IN ('SD_LZONAL_HEAD') """

required_field = ["bu", "sap_id", "name", "city", "district", "region", "sales_area", "state", "zone", "adress", "pincode", "terminal_plant_id", "dealer_phone","dealer_email"]

location_master_schema = {
    "bu": "VARCHAR", "sap_id": "VARCHAR", "bu_id": "VARCHAR", "name": "VARCHAR", "is_active": "BOOLEAN", "activation_date": "TIMESTAMP",
    "activation_notes": "VARCHAR","activated_by": "VARCHAR","deactivated_by": "VARCHAR","deactivation_notes": "VARCHAR","health_status": "VARCHAR",
    "health_notes": "VARCHAR", "scada_vendor": "VARCHAR", "scada_version": "VARCHAR", "scada_conn_status": "BOOLEAN", "scada_conn_notes": "VARCHAR",
    "city": "VARCHAR", "district": "VARCHAR", "region": "VARCHAR", "state": "VARCHAR", "zone": "VARCHAR", "address": "VARCHAR", "pincode": "VARCHAR",
    "local_automation_vendor": "VARCHAR", "latitude": "VARCHAR", "longitude": "VARCHAR", "entity_id": "VARCHAR", "ro_id": "VARCHAR", "dealer_name": "VARCHAR",
    "dealer_phone": "VARCHAR", "dealer_email": "VARCHAR", "sales_area": "VARCHAR", "terminal_plant_id": "VARCHAR","terminal_plant_name": "VARCHAR",
    "category": "VARCHAR", "distributor_code": "VARCHAR", "distributor_name": "VARCHAR","round_trip_distance": "INTEGER","location_onboard": "BOOLEAN",
    "sales_area_code": "VARCHAR", "region_code": "VARCHAR"
    }

_rename = {"PLANT": "sap_id", "PLANT_DESC": "name", "ZZONE": "zone", "STATE_NAME": "state", 
           "SALES_OFFICE_DESC": "region", "SALES_GROUP_DESC": "sales_area", "CITY1": "city",
           "sales_grp": "sales_area_code", "sales_off": "region_code", "DISTRICT_NAME": "district",
           "POST_CODE1": "pincode", "STREET": "land_mark", "STR_SUPPL1": "location", "dealer_email": "email"}

location_configs = [
    {
        "bu": "lpg",
        "query": """
                SELECT
                    DISTINCT ZPS.PLANT, ZPS.ZLOC_TYPE, ZPS.PLANT_DESC,
                    ZPS.ZZONE, ZPS.CITY1, ZPS.POST_CODE1, ZPS.STREET, ZPS.STR_SUPPL1,
                    ZPS.REPORTING_OFFICE FROM 
                    ZMMCV_PLANT_STG ZPS INNER JOIN ZSDCV_AY_INV3_STG ZCA ON ZCA.SUPPLY_LOC = ZPS.PLANT
                    WHERE ZPS.ZLOC_TYPE IN ('12','17','32','33','11','18','19','35') AND ZPS.SBU='LPG' AND
                    ZCA.INVOICE_DATE >= DATE_SUB(NOW(), INTERVAL 1 YEAR) AND ZCA.INVOICE_DATE <= NOW();
                """,
        # '12', '17', '25', '32', '33','68'
        "reporting_office_query":"""
                    SELECT
                        PLT.PLANT AS RO_CODE, ZN.SALES_OFFICE_DESC, ZN.SALES_GROUP_DESC
                    FROM
                        EDW_DC_PLANT PLT
                        LEFT JOIN ZSDCV_SO_PARAM_STG ZN ON PLT.PLANT = ZN.PLANT
                    WHERE
                        ZLOC_TYPE IN ('68');
                """
    },
    {
        "bu": "lpg_customers",
        "query": """                               
                SELECT
                    zca.customer AS PLANT, zcs.name1 AS PLANT_DESC, zca.sales_district, zso.sales_district_desc, 
                    zca.deliv_plant AS terminal_plant_id, deliv.PLANT_DESC as terminal_plant_name, zso.SALES_OFFICE_DESC, 
                    zso.SALES_GROUP_DESC, plt.ZZONE, zcs.CITY AS CITY1, zcs.POSTAL_CODE AS POST_CODE1, zcs.ADDRESS1, zcs.ADDRESS2,
                    zcs.ADDRESS3, zcs.ADDRESS4, zcs.ADDRESS5, plt.STATE_NAME, zcs.first_telephone_number AS dealer_phone,
                    zcs.email_id AS dealer_email, zca.inactive, zcs.OUTLET_TYPE, zcs.gstin, zcs.OUTLET_TYPE,
                    zcs.permanent_Account_number, zca.sales_grp, zca.sales_off
                FROM ZSDCV_CUST_SA_STG zca 
                    INNER join ZSDCV_CUSTOMER_STG zcs on zcs.customer_number = zca.customer 
                    INNER join ZSDCV_SO_PARAM_STG zso on zso.sales_district = zca.sales_district AND
                    zso.sales_org=zca.sales_org AND zso.sales_office=zca.sales_off AND zso.sales_group=zca.sales_grp
                    INNER join EDW_DC_PLANT plt on zso.PLANT=plt.PLANT
                    INNER join EDW_DC_PLANT deliv on deliv.PLANT=zca.deliv_plant
                WHERE 
                    zca.deliv_plant <> '' AND zca.sales_org='2000'
                    AND zca.INACTIVE=''
                    AND zca.customer BETWEEN 4000000 AND 49999999 
                    AND zca.DIST_CHANNEL=11 
                 """
    },
    {
        "bu": "tas",
        "query": """
                    SELECT 
                    DISTINCT ZPS.PLANT, ZPS.ZLOC_TYPE, ZPS.PLANT_DESC,
                    ZPS.ZZONE, ZPS.CITY1, ZPS.POST_CODE1, ZPS.STREET, ZPS.STR_SUPPL1,
                    ZPS.REPORTING_OFFICE FROM 
                    ZMMCV_PLANT_STG ZPS INNER JOIN ZSDCV_AY_INV3_STG ZCA ON ZCA.SUPPLY_LOC = ZPS.PLANT
                    WHERE ZPS.ZLOC_TYPE IN ('11','15','16','18','19','44','51','52','53','98') 
                    AND ZPS.SBU IN ('RET','DIR') AND
                    ZCA.INVOICE_DATE >= DATE_SUB(NOW(), INTERVAL 1 YEAR) AND ZCA.INVOICE_DATE <= NOW();
                """,
        "reporting_office_query": """ 
                SELECT
                    PLT.PLANT AS RO_CODE, ZN.SALES_OFFICE_DESC, ZN.SALES_GROUP_DESC
                FROM
                    EDW_DC_PLANT PLT
                    LEFT JOIN ZSDCV_SO_PARAM_STG ZN ON PLT.PLANT = ZN.PLANT
                WHERE
                    ZLOC_TYPE IN ('38');
                """
    },
    {
        "bu": "ro",
        "query": """                               
                SELECT
                    DISTINCT zca.customer AS PLANT, zcs.name1 AS PLANT_DESC, zca.sales_district, zso.sales_district_desc AS ZZONE,
                    zca.deliv_plant AS terminal_plant_id,
                    deliv.PLANT_DESC as terminal_plant_name,
                    zso.SALES_OFFICE_DESC,
                    zso.SALES_GROUP_DESC, zcs.CITY AS CITY1, zcs.POSTAL_CODE AS POST_CODE1, zcs.ADDRESS1, zcs.ADDRESS2,
                    zcs.ADDRESS3, zcs.ADDRESS4, zcs.ADDRESS5,
                    edd.STATE_NM as STATE_NAME,
                    edd.DISTRICT_NM as DISTRICT_NAME,
                    -- plt.STATE_NAME,
                    zcs.first_telephone_number AS dealer_phone,
                    zcs.email_id AS dealer_email, zca.inactive, zcs.OUTLET_TYPE, 
                    -- zcs.gstin,  zcs.permanent_Account_number, 
                    zca.sales_grp, zca.sales_off
                FROM ZSDCV_CUST_SA_STG zca
                    LEFT  join ZSDCV_CUSTOMER_STG zcs on zcs.customer_number = zca.customer
                    left join ZSDCV_SO_PARAM_STG zso on zso.SALES_GROUP  = zca.SALES_GRP 
                    -- left join EDW_DC_PLANT plt on zso.PLANT=plt.PLANT
                    LEFT join EDW_DC_PLANT deliv on deliv.PLANT=zca.deliv_plant
                    LEFT Join PS.EDW_DISTRICT_DIM edd on zcs.district = edd.DISTRICT_CD                                                        
                WHERE
                    zca.deliv_plant <> '' AND zca.sales_org='7000' AND zca.DIST_CHANNEL=11
                    AND zca.division in (11,12) AND zca.customer BETWEEN 4000000 AND 49999999
                 """
    },
    {
        "bu": "ds",
        "query": """                               
                SELECT
                    zca.customer AS PLANT, zcs.name1 AS PLANT_DESC, zca.sales_district, zso.sales_district_desc, 
                    zca.deliv_plant AS terminal_plant_id, deliv.PLANT_DESC as terminal_plant_name, zso.SALES_OFFICE_DESC, 
                    zso.SALES_GROUP_DESC, plt.ZZONE, zcs.CITY AS CITY1, zcs.POSTAL_CODE AS POST_CODE1, zcs.ADDRESS1, zcs.ADDRESS2,
                    zcs.ADDRESS3, zcs.ADDRESS4, zcs.ADDRESS5, plt.STATE_NAME, zcs.first_telephone_number AS dealer_phone,
                    zcs.email_id AS dealer_email, zca.inactive, zcs.OUTLET_TYPE, zcs.gstin, zcs.OUTLET_TYPE,
                    zcs.permanent_Account_number, zca.sales_grp
                FROM ZSDCV_CUST_SA_STG zca 
                    INNER join ZSDCV_CUSTOMER_STG zcs on zcs.customer_number = zca.customer 
                    INNER join ZSDCV_SO_PARAM_STG zso on zso.sales_district = zca.sales_district AND
                    zso.sales_org=zca.sales_org AND zso.sales_office=zca.sales_off AND zso.sales_group=zca.sales_grp
                    INNER join EDW_DC_PLANT plt on zso.PLANT=plt.PLANT
                    INNER join EDW_DC_PLANT deliv on deliv.PLANT=zca.deliv_plant
                WHERE 
                    zca.deliv_plant <> '' AND zca.sales_org='3000' AND zca.DIST_CHANNEL=12
                    AND zca.customer BETWEEN 4000000 AND 49999999 AND zca.INACTIVE=''
                 """
    }
]

# BKPS RETAIL OUTLET
# SELECT
#     zca.customer AS PLANT, zcs.name1 AS PLANT_DESC, zca.sales_district, zso.sales_district_desc, zca.deliv_plant AS terminal_plant_id,
#     zso.SALES_OFFICE_DESC, zso.SALES_GROUP_DESC, plt.ZZONE, zcs.CITY AS CITY1, zcs.POSTAL_CODE AS POST_CODE1, zcs.ADDRESS1, zcs.ADDRESS2,
#     zcs.ADDRESS3, zcs.ADDRESS4, zcs.ADDRESS5, plt.PLANT_DESC AS terminal_plant_name, plt.STATE_NAME, zcs.first_telephone_number AS dealer_phone,
#     zcs.second_tel_no, zcs.email_id AS dealer_email, zca.inactive, zcs.OUTLET_TYPE, zcs.gstin, zcs.mrn, zcs.OUTLET_TYPE, zcs.gstin,
#     zcs.mrn, zcs.permanent_Account_number, zca.sales_grp
# FROM ZSDCV_CUST_SA_STG zca 
#     INNER join ZSDCV_CUSTOMER_STG zcs on zcs.customer_number = zca.customer 
#     INNER join ZSDCV_SO_PARAM_STG zso on zso.sales_district = zca.sales_district AND
#     zso.sales_org=zca.sales_org AND zso.sales_office=zca.sales_off AND zso.sales_group=zca.sales_grp
#     INNER join EDW_DC_PLANT plt on zso.PLANT=plt.PLANT
# WHERE 
#     zca.deliv_plant <> '' AND zca.sales_org='7000' AND zca.DIST_CHANNEL=11 AND zca.division in (11,12) AND
#     zca.customer BETWEEN 4000000 AND 49999999 AND zca.INACTIVE=''
# ORDER BY zca.deliv_plant,zso.plant_desc,zca.sales_off,zso.sales_office_desc,zca.sales_grp,zso.sales_group_desc
