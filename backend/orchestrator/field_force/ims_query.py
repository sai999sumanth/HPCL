ims_queries = {
"location_wise_query" : f"""
                    WITH swipe_diff AS (
                    SELECT
                        "LOCN_CODE",
                        "CARD_DATE",
                        DATE_TRUNC('month', "CARD_DATE") AS month,
                        "TRUCK_REGNO",
                        "SWIPE_SEQ",
                        EXTRACT(EPOCH FROM (
                            MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END)
                        - MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END)
                        )) / 60 AS R3_DIFF_R1
                    FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP"
                    GROUP BY
                        "LOCN_CODE",
                        "CARD_DATE",
                        DATE_TRUNC('month', "CARD_DATE"),
                        "TRUCK_REGNO",
                        "SWIPE_SEQ"
                    HAVING
                        MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END) IS NOT NULL
                    AND MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END) IS NOT NULL
                )
                SELECT
                    sd."LOCN_CODE",
                    TO_CHAR(sd.month, 'Mon-YYYY') AS month,
                    lm.bu,
                    lm.name,
                    lm.zone,
                    AVG(sd.R3_DIFF_R1) AS monthly_avg_r3_r1
                FROM swipe_diff sd LEFT JOIN public.location_master lm ON lm.sap_id = sd."LOCN_CODE"
                GROUP BY
                    sd."LOCN_CODE",
                    sd.month,
                    lm.bu,
                    lm.name,
                    lm.zone
                ORDER BY
                    "LOCN_CODE",
                    month;  
            """,
"location_wise_summary_query" : f"""
            WITH monthly_data AS (
            WITH swipe_diff AS (
                SELECT
                    "LOCN_CODE",
                    DATE_TRUNC('month', "CARD_DATE") AS month,
                    "TRUCK_REGNO",
                    "SWIPE_SEQ",
                    EXTRACT(EPOCH FROM (
                        MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END)
                    - MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END)
                    )) / 60 AS r3_diff_r1
                FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP"
                GROUP BY
                    "LOCN_CODE",
                    DATE_TRUNC('month', "CARD_DATE"),
                    "TRUCK_REGNO",
                    "SWIPE_SEQ"
                HAVING
                    MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END) IS NOT NULL
                AND MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END) IS NOT NULL
            )

            SELECT
                sd."LOCN_CODE",
                sd.month,
                lm.bu,
                lm.name,
                lm.zone,
                AVG(sd.r3_diff_r1) AS monthly_avg
            FROM swipe_diff sd
            LEFT JOIN public.location_master lm 
                ON lm.sap_id = sd."LOCN_CODE"
            GROUP BY
                sd."LOCN_CODE",
                sd.month,
                lm.bu,
                lm.name,
                lm.zone
        ),

        ranked AS (
            SELECT
                *,
                ROW_NUMBER() OVER (PARTITION BY "LOCN_CODE" ORDER BY monthly_avg DESC) AS rn_max,
                ROW_NUMBER() OVER (PARTITION BY "LOCN_CODE" ORDER BY monthly_avg ASC) AS rn_min
            FROM monthly_data
        )

        SELECT
            "LOCN_CODE",
            bu,
            name,
            zone,

            -- overall avg across months
            AVG(monthly_avg) AS overall_avg,

            -- highest & lowest values
            MAX(monthly_avg) AS highest_avg,
            MIN(monthly_avg) AS lowest_avg,

            -- corresponding months
            MAX(CASE WHEN rn_max = 1 THEN TO_CHAR(month, 'Mon-YYYY') END) AS highest_avg_month,
            MAX(CASE WHEN rn_min = 1 THEN TO_CHAR(month, 'Mon-YYYY') END) AS lowest_avg_month

        FROM ranked
        GROUP BY
            "LOCN_CODE",
            bu,
            name,
            zone
        ORDER BY
            "LOCN_CODE";
            """,
"monthly_query" : f"""
                        WITH swipe_diff AS (
                    SELECT
                        "CARD_DATE",
                        DATE_TRUNC('month', "CARD_DATE") AS month,
                        "TRUCK_REGNO",
                        "SWIPE_SEQ",
                        EXTRACT(EPOCH FROM (
                            MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END)
                        - MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END)
                        )) / 60 AS R3_DIFF_R1
                    FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP"
                    GROUP BY
                        "CARD_DATE",
                        DATE_TRUNC('month', "CARD_DATE"),
                        "TRUCK_REGNO",
                        "SWIPE_SEQ"
                    HAVING
                        MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END) IS NOT NULL
                    AND MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END) IS NOT NULL
                )
                SELECT
                    TO_CHAR(month, 'Mon-YYYY') AS month_label,
                    AVG(R3_DIFF_R1) AS monthly_avg_r3_r1
                FROM swipe_diff
                GROUP BY
                    month
                ORDER BY
                    month;
            """,
"monthly_summary_query" : f"""
                WITH monthly_data AS (
                WITH swipe_diff AS (
                SELECT
                    DATE_TRUNC('month', "CARD_DATE") AS month,
                    "TRUCK_REGNO",
                    "SWIPE_SEQ",
                    EXTRACT(EPOCH FROM (
                        MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END)
                    - MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END)
                    )) / 60 AS r3_diff_r1
                FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP"
                GROUP BY
                    DATE_TRUNC('month', "CARD_DATE"),
                    "TRUCK_REGNO",
                    "SWIPE_SEQ"
                HAVING
                    MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END) IS NOT NULL
                AND MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END) IS NOT NULL
            )
            SELECT
                month,
                AVG(r3_diff_r1) AS monthly_avg
            FROM swipe_diff
            GROUP BY month
            ),

            ranked AS (
            SELECT
                *,
                ROW_NUMBER() OVER (ORDER BY monthly_avg DESC) AS rn_max,
                ROW_NUMBER() OVER (ORDER BY monthly_avg ASC) AS rn_min
            FROM monthly_data
            )

            SELECT
            -- overall average across months
            AVG(monthly_avg) AS overall_avg,

            -- highest & lowest values
            MAX(monthly_avg) AS highest_avg,
            MIN(monthly_avg) AS lowest_avg,

            -- corresponding months
            MAX(CASE WHEN rn_max = 1 THEN TO_CHAR(month, 'Mon-YYYY') END) AS highest_avg_month,
            MAX(CASE WHEN rn_min = 1 THEN TO_CHAR(month, 'Mon-YYYY') END) AS lowest_avg_month

            FROM ranked;
            """,
"zone_wise_query" : f"""

                WITH swipe_diff AS (
                SELECT
                    lm."zone",
                    tses."CARD_DATE",
                    DATE_TRUNC('month', tses."CARD_DATE") AS month,
                    tses."TRUCK_REGNO",
                    tses."SWIPE_SEQ",
                    
                    EXTRACT(EPOCH FROM (
                        MAX(CASE WHEN tses."CARD_STATUS" = 'O' THEN tses."LOADED_ON" END)
                    - MAX(CASE WHEN tses."CARD_STATUS" = 'R' THEN tses."LOADED_ON" END)
                    )) / 60 AS R3_DIFF_R1

                FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" tses LEFT JOIN public.location_master lm 
                ON tses."LOCN_CODE" = lm."sap_id" 
                GROUP BY
                    lm."zone",
                    tses."CARD_DATE",
                    DATE_TRUNC('month', tses."CARD_DATE"),
                    tses."TRUCK_REGNO",
                    tses."SWIPE_SEQ"
                    
                HAVING
                    MAX(CASE WHEN "CARD_STATUS" = 'O' THEN "LOADED_ON" END) IS NOT NULL
                AND MAX(CASE WHEN "CARD_STATUS" = 'R' THEN "LOADED_ON" END) IS NOT NULL
            )
            SELECT
                zone,
                TO_CHAR(month, 'Mon-YYYY') AS month,
                AVG(R3_DIFF_R1) AS monthly_avg_r3_r1
            FROM swipe_diff 
            GROUP BY
                zone,
                month
            ORDER BY
                zone,
                month;
            """,
"zone_wise_summary_query" : f"""

                WITH monthly_data AS (
            WITH swipe_diff AS (
                SELECT
                    lm."zone",
                    DATE_TRUNC('month', tses."CARD_DATE") AS month,
                    tses."TRUCK_REGNO",
                    tses."SWIPE_SEQ",
                    EXTRACT(EPOCH FROM (
                        MAX(CASE WHEN tses."CARD_STATUS" = 'O' THEN tses."LOADED_ON" END)
                    - MAX(CASE WHEN tses."CARD_STATUS" = 'R' THEN tses."LOADED_ON" END)
                    )) / 60 AS r3_diff_r1
                FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" tses
                LEFT JOIN public.location_master lm 
                    ON tses."LOCN_CODE" = lm."sap_id"
                GROUP BY
                    lm."zone",
                    DATE_TRUNC('month', tses."CARD_DATE"),
                    tses."TRUCK_REGNO",
                    tses."SWIPE_SEQ"
                HAVING
                    MAX(CASE WHEN tses."CARD_STATUS" = 'O' THEN tses."LOADED_ON" END) IS NOT NULL
                AND MAX(CASE WHEN tses."CARD_STATUS" = 'R' THEN tses."LOADED_ON" END) IS NOT NULL
            )
            SELECT
                zone,
                month,
                AVG(r3_diff_r1) AS monthly_avg
            FROM swipe_diff
            GROUP BY zone, month
        ),

        ranked AS (
            SELECT
                *,
                ROW_NUMBER() OVER (PARTITION BY zone ORDER BY monthly_avg DESC) AS rn_max,
                ROW_NUMBER() OVER (PARTITION BY zone ORDER BY monthly_avg ASC) AS rn_min
            FROM monthly_data
        )

        SELECT
            zone,

            -- overall average across months
            AVG(monthly_avg) AS overall_avg,

            -- highest & lowest values
            MAX(monthly_avg) AS highest_avg,
            MIN(monthly_avg) AS lowest_avg,

            -- corresponding months
            MAX(CASE WHEN rn_max = 1 THEN TO_CHAR(month, 'Mon-YYYY') END) AS highest_avg_month,
            MAX(CASE WHEN rn_min = 1 THEN TO_CHAR(month, 'Mon-YYYY') END) AS lowest_avg_month

        FROM ranked
        GROUP BY zone
        ORDER BY zone;
            """,
"daywise_query" : """
        WITH R3_DIFF_R1 AS (
            WITH base AS (
                SELECT 
                    tses."CARD_DATE", 
                    tses."CARD_NO", 
                    tses."LOCN_CODE",
                    tses."CARD_STATUS",
                    tses."LOADED_ON",
                    MAX(CASE WHEN tses."CARD_STATUS" = 'O' THEN tses."LOADED_ON" END) 
                        OVER (PARTITION BY tses."CARD_DATE", tses."CARD_NO") AS o_time
                FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" tses
                    LEFT JOIN public.location_master lm 
                        ON tses."LOCN_CODE" = lm."sap_id"
                WHERE {}
            ),
            r_filtered AS (
                SELECT
                    "CARD_DATE",
                    "CARD_NO",
                    "LOCN_CODE",
                    o_time,
                    -- Pick the LARGEST R that is still less than O
                    MAX(CASE 
                            WHEN "CARD_STATUS" = 'R' AND "LOADED_ON" < o_time 
                            THEN "LOADED_ON" 
                        END) AS r_time
                FROM base
                GROUP BY "CARD_DATE", "CARD_NO", "LOCN_CODE", o_time
            )
            SELECT
                "CARD_DATE",
                -- EXTRACT(EPOCH FROM (o_time - r_time)) / 60 AS diff_minutes
                ROUND(EXTRACT(EPOCH FROM (o_time - r_time)) / 60, 2) AS diff_minutes
            FROM r_filtered
            WHERE o_time IS NOT NULL
            AND r_time IS NOT NULL
            ) 
        SELECT "CARD_DATE",
        ROUND(AVG(diff_minutes), 2) as average_minutes
        FROM R3_DIFF_R1
        GROUP BY "CARD_DATE"
        ORDER BY "CARD_DATE"
    """
}