queries = {

# QUERY TO TANK DETAILS 
"tank_details" : """
    SELECT 
        live_data.sap_id,
        live_data.location_name,
        live_data.tank_name as "name",
        live_data.tank_code as "tank_id",
        tank_details.type as "type",
        ((tank_details.kl_per_mm::numeric * live_data.curr_level::numeric) * 100) / tank_details.gross_capacity_kl as "percent",
        tank_details.tank_no,
        live_data.tank_mode,
        live_data.curr_level,
        tank_details.kl_per_mm::numeric,
        tank_details.kl_per_mm::numeric * live_data.curr_level::numeric as "curr_stock_kl",
        tank_details.dead_stock_kl,
        ROUND((tank_details.kl_per_mm::numeric * live_data.curr_level::numeric - tank_details.dead_stock_kl)::numeric, 2) as "available_stock_kl",
        live_data.water_level,
        tank_details.product as "product",
        tank_details.gross_capacity_kl as "gross_capacity_kl",
        tank_details.peso_capacity_kl,
        tank_details.pumpable_volume_kl,
        tank_details.diameter,
        tank_details.height,
        tank_details.gross_capacity_kl - (tank_details.kl_per_mm::numeric * live_data.curr_level::numeric) as "ullage"
    FROM (
            SELECT hltd.*,
				   lm.zone
			FROM host_live_tank_details hltd LEFT JOIN location_master lm 
			     ON hltd.sap_id = lm.sap_id
			WHERE {condition}
        ) live_data
    LEFT JOIN public.tank_dia_details tank_details 
    ON live_data.sap_id = tank_details.location_sap_code  
        AND (
            substring(live_data.tank_name FROM '^[A-Z]+') = substring(tank_details.tank_no FROM '^[A-Z]+')
            OR
            substring(live_data.tank_name FROM '\d+')::int = substring(tank_details.tank_no FROM '\d+')::int
        )
""",

# QUERY TO GET PRODUCT DISPATCH
"dispatch" : """
    WITH todays_readings AS (
        SELECT
            hltd.sap_id,
            hltd.tank_name,
            hltd.curr_level,
            hltd.date_time,
            lm.zone,
            LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
            ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
        FROM host_live_tank_details hltd LEFT JOIN location_master lm 
        ON hltd.sap_id = lm.sap_id
        WHERE {condition}
    ),
    combined AS (
        SELECT
            tr.sap_id,
            tr.zone,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'  -- ← dynamic prev day
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time,
            tdd.product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
            ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
    ),
    t_dispatch AS (
        SELECT
            sap_id,
            tank_name,
            product,
            zone,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) > curr_level
                    THEN COALESCE(prev_level, 0) - curr_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric  AS total_dispatch                
        FROM combined
        GROUP BY sap_id, zone, tank_name, kl_per_mm, product
    )
    SELECT
        zone,
        sap_id,
        product,
        ROUND(SUM(total_dispatch)::numeric, 2) as sum
    FROM t_dispatch
    GROUP BY sap_id, zone, product  
""",

#QUERY TO GET PRODUCT RECEIPT
"receipt" : """
    WITH todays_readings AS (
        SELECT
            hltd.sap_id,
            lm.zone,
            hltd.tank_name,
            hltd.curr_level,
            hltd.date_time,
            LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
            ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
        FROM host_live_tank_details hltd LEFT JOIN location_master lm
        ON hltd.sap_id = lm.sap_id
        WHERE {condition}
        ),
    combined AS (
        SELECT
            tr.sap_id,
            tr.zone,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'  -- ← dynamic prev day
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time,
            tdd.product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
            ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
        ),
    t_receipt AS (
        SELECT
            sap_id,
            zone,
            tank_name,
            product,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) < curr_level
                    THEN COALESCE(curr_level, 0) - prev_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric AS total_receipt               
        FROM combined
        GROUP BY sap_id, zone, tank_name, kl_per_mm, product
    )
    SELECT
        sap_id,
        zone,
        product,
        ROUND(SUM(total_receipt)::numeric, 2) as sum
    FROM t_receipt
    GROUP BY sap_id, zone, product  
""",

#QUERY TO GET TOTAL BCU DISPATCH
"bcu_total_dispatch" : """
    SELECT hltd.sap_id, lm.zone, hltd.stock as product, ROUND(SUM(hltd.bcu_net_totalizer)::numeric, 2) as sum
    FROM public.host_day_end_details hltd LEFT JOIN location_master lm
	ON hltd.sap_id = lm.sap_id
    WHERE {condition}
    GROUP BY hltd.sap_id, lm.zone, hltd.stock;
""",

#QUERY TO GET PRODUCT WISE DISPATCH AVERAGE
"dispatch_average_prodwise" : """
    WITH todays_readings AS (
    SELECT
        hltd.sap_id,
		lm.zone,
        hltd.tank_name,
        hltd.curr_level,
        hltd.date_time,
        LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
        ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
    FROM host_live_tank_details hltd LEFT JOIN location_master lm
	ON hltd.sap_id = lm.sap_id
    WHERE date_time::DATE BETWEEN CURRENT_DATE - INTERVAL '8 days' AND CURRENT_DATE - INTERVAL '1 day'
    --WHERE hltd.date_time::DATE BETWEEN DATE '2026-02-05' - INTERVAL '8 days' AND DATE '2026-02-05' - INTERVAL '1 day'
          {}
    ),
    combined AS (
        SELECT
            tr.sap_id,
            -- tr.zone,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time,
            CASE tdd.product
                WHEN 'ETHANOL'   THEN 'ETHANOL'
                WHEN 'Ethanol'   THEN 'ETHANOL'
                WHEN 'ETH'       THEN 'ETHANOL'
                WHEN 'BIODIESEL' THEN 'BIODIESEL'
                WHEN 'Biodiesel' THEN 'BIODIESEL'
                WHEN 'BIO-HSD'   THEN 'BIODIESEL'
                ELSE tdd.product  -- fallback: keep as-is for unmapped products
            END AS product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
        ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
    ),
    t_dispatch AS (
        SELECT
            date_time::DATE AS dispatch_date,
            sap_id,
            tank_name,
            product,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) > curr_level
                    THEN COALESCE(prev_level, 0) - curr_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric AS total_dispatch
        FROM combined
        GROUP BY date_time::DATE, sap_id, tank_name, kl_per_mm, product
    ),
    daily_totals AS (
        SELECT
            product,
            dispatch_date,
            SUM(total_dispatch) AS day_total
        FROM t_dispatch
        GROUP BY dispatch_date, product
    )
    SELECT
        product,
        ROUND(AVG(day_total)::numeric, 2) AS seven_day_avg
    FROM daily_totals
    WHERE NOT (daily_totals IS NULL)
    GROUP BY product 
""",

# QUERY TO GET AVERAGE DISPATCH
"dispatch_average" : """
    WITH todays_readings AS (
            SELECT
                hltd.sap_id,
                hltd.tank_name,
                hltd.curr_level,
                hltd.date_time,
                LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
                ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
            FROM host_live_tank_details hltd JOIN location_master lm 
			ON hltd.sap_id = lm.sap_id
            WHERE hltd.date_time::DATE BETWEEN CURRENT_DATE - INTERVAL '8 days' AND CURRENT_DATE - INTERVAL '1 day'
            --WHERE hltd.date_time::DATE BETWEEN DATE '2026-02-05' - INTERVAL '8 days' AND DATE '2026-02-05' - INTERVAL '1 day'
                  {}
        ),
        combined AS (
            SELECT
                tr.sap_id,
                tr.tank_name,
                tr.curr_level,
                CASE
                    WHEN rn = 1 THEN (
                        SELECT curr_level FROM host_live_tank_details h2
                        WHERE h2.tank_name = tr.tank_name
                        AND h2.sap_id = tr.sap_id
                        AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'
                        ORDER BY h2.date_time DESC
                        LIMIT 1
                    )
                ELSE tr.prev_level
                END AS prev_level,
                tr.date_time,
                tdd.product,
                tdd.kl_per_mm
            FROM todays_readings tr
            LEFT JOIN (
                SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
                ) tdd
                ON tr.sap_id = tdd.location_sap_code
                AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
                )
            ),
        t_dispatch AS (
            SELECT
                date_time::DATE AS dispatch_date,  -- ← added to group per day
                sap_id,
                tank_name,
                product,
                SUM(
                    CASE
                        WHEN COALESCE(prev_level, 0) > curr_level
                        THEN COALESCE(prev_level, 0) - curr_level
                    ELSE 0
                END
                )::numeric * kl_per_mm::numeric  AS total_dispatch
            FROM combined
            GROUP BY date_time::DATE, sap_id, tank_name, kl_per_mm, product
        ),
        daily_totals AS (
            SELECT
                dispatch_date,
                SUM(total_dispatch) AS day_total  -- ← total per day across all tanks/products
            FROM t_dispatch
            GROUP BY dispatch_date
        )
        SELECT
            ROUND(AVG(day_total)::numeric, 2) AS seven_day_avg  -- ← average of 7 daily totals
        FROM daily_totals 
""",

#QUERY TO GET TANK ULLAGE
"tank_ullage" : """
    with ullage_data as (
        select
            tank_details.gross_capacity_kl as capacity,
            tank_details.dead_stock_kl as dead_stock,
            tank_details.product as "product",
	        ROUND((tank_details.gross_capacity_kl - (tank_details.kl_per_mm::numeric * live_data.curr_level::numeric))::numeric, 2) as "ullage"
        FROM (
            SELECT hltd.* FROM host_live_tank_details hltd LEFT JOIN location_master lm 
			ON hltd.sap_id = lm.sap_id 
            WHERE date_time::DATE = CURRENT_DATE 
            --WHERE hltd.date_time::DATE BETWEEN DATE '2026-02-05' AND DATE ' 2026-02-05' 
                 {} 
            ) live_data
        LEFT JOIN public.tank_dia_details tank_details  
        ON live_data.sap_id = tank_details.location_sap_code 
            AND (
                substring(live_data.tank_name FROM '^[A-Z]+') = substring(tank_details.tank_no FROM '^[A-Z]+')
            OR
                substring(live_data.tank_name FROM '\d+')::int = substring(tank_details.tank_no FROM '\d+')::int
                )
    ) 
    select "product", SUM(capacity) as capacity, SUM("ullage") as ullage, SUM("dead_stock") as dead_stock
    FROM ullage_data GROUP BY "product"
""",

#QUERY TO GET DAYWISE TRENDS'
"daywise_trends" : """
    WITH todays_readings AS (
        SELECT
            hltd.sap_id,
            hltd.tank_name,
            hltd.curr_level,
            hltd.date_time::DATE,
            LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
            ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
        FROM host_live_tank_details hltd LEFT JOIN location_master lm ON
        hltd.sap_id = lm.sap_id
        WHERE {}
    ),
    combined AS (
        SELECT
            tr.sap_id,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'  -- ← dynamic prev day
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time,
            tdd.product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
            ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
    ),
    t_dispatch AS (
        SELECT
            sap_id,
            tank_name,
            product,
            date_time,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) > curr_level
                    THEN COALESCE(prev_level, 0) - curr_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric  AS total_dispatch                
        FROM combined
        GROUP BY sap_id, tank_name, date_time, kl_per_mm, product
    ),
	t_reciept AS (
        SELECT 
            sap_id,
            tank_name,
            product,
            date_time,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) < curr_level
                    THEN COALESCE(curr_level, 0) - prev_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric  AS total_reciept               
        FROM combined
        GROUP BY sap_id, tank_name, date_time, kl_per_mm, product
	)
    SELECT
        dis.product,
        dis.date_time,
        ROUND(SUM(dis.total_dispatch)::numeric, 2) as dispatch,
        ROUND(SUM(rec.total_reciept)::numeric, 2) as reciept
    FROM t_dispatch as dis LEFT JOIN t_reciept as rec ON 
        dis.sap_id = rec.sap_id AND dis.tank_name = rec.tank_name AND dis.product = rec.product AND dis.date_time = rec.date_time
    GROUP BY dis.date_time, dis.product
""",

#QUERY TO GET DAYWISE ULLAGE 
"ullage_daywise_trends" : """
    with ullage_data as (
        select 
	        live_data.date_time::DATE,
	        tank_details.dead_stock_kl,
	        tank_details.gross_capacity_kl as capacity,
        ROUND((tank_details.kl_per_mm::numeric * live_data.curr_level::numeric - tank_details.dead_stock_kl)::numeric, 2) as "available_stock",
        tank_details.product as "product",
        ROUND((tank_details.gross_capacity_kl - (tank_details.kl_per_mm::numeric * live_data.curr_level::numeric))::numeric, 2) as "ullage"
    FROM (
        SELECT hltd.* FROM host_live_tank_details hltd LEFT JOIN location_master lm 
	    ON hltd.sap_id = lm.sap_id
	    WHERE {}
    ) live_data
    LEFT JOIN public.tank_dia_details tank_details  
        ON live_data.sap_id = tank_details.location_sap_code 
        AND (
            substring(live_data.tank_name FROM '^[A-Z]+') = substring(tank_details.tank_no FROM '^[A-Z]+')
            OR
            substring(live_data.tank_name FROM '\d+')::int = substring(tank_details.tank_no FROM '\d+')::int
        )
    ) 
    SELECT 
        "product", date_time, SUM(available_stock) AS available_stock, SUM(dead_stock_kl) as dead_stock, SUM(capacity) AS capacity, SUM("ullage") as ullage
    FROM ullage_data GROUP BY date_time, "product"
""",

#QUERY TO GET STOCK SUSTAINABILITY TANK WISE
"tankwise_stock_sustainability" : """

    with dispatch as (

WITH todays_readings AS (
        SELECT
            hltd.sap_id,
            hltd.tank_name,
            hltd.curr_level,
            hltd.date_time,
            lm.zone,
            LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
            ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
        FROM host_live_tank_details hltd LEFT JOIN location_master lm 
        ON hltd.sap_id = lm.sap_id
        WHERE {} 
    ),
    combined AS (
        SELECT
            tr.sap_id,
            tr.zone,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'  -- ← dynamic prev day
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time,
            tdd.product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
            ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
    ),
    t_dispatch AS (
        SELECT
            sap_id,
            tank_name,
            product,
            zone,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) > curr_level
                    THEN COALESCE(prev_level, 0) - curr_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric  AS total_dispatch                
        FROM combined
        GROUP BY sap_id, zone, tank_name, kl_per_mm, product
    )
    SELECT
        zone,
        sap_id,
		tank_name,
        product,
        ROUND(SUM(total_dispatch)::numeric, 2) as total_dispatch
    FROM t_dispatch
    GROUP BY sap_id, zone, tank_name, product  
),
receipt as (

WITH todays_readings AS (
        SELECT
            hltd.sap_id,
            lm.zone,
            hltd.tank_name,
            hltd.curr_level,
            hltd.date_time,
            LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
            ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
        FROM host_live_tank_details hltd LEFT JOIN location_master lm
        ON hltd.sap_id = lm.sap_id
        WHERE {}
        ),
    combined AS (
        SELECT
            tr.sap_id,
            tr.zone,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'  -- ← dynamic prev day
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time,
            tdd.product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
            ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
        ),
    t_receipt AS (
        SELECT
            sap_id,
            zone,
            tank_name,
            product,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) < curr_level
                    THEN COALESCE(curr_level, 0) - prev_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric AS total_receipt               
        FROM combined
        GROUP BY sap_id, zone, tank_name, kl_per_mm, product
    )
    SELECT
		zone,
        sap_id,
		tank_name,
        product,
        ROUND(SUM(total_receipt)::numeric, 2) as total_receipt
    FROM t_receipt
    GROUP BY sap_id, tank_name, zone, product  
),
dispatch_average  as (
WITH todays_readings AS (
    SELECT
        hltd.sap_id,
		lm.zone,
        hltd.tank_name,
        hltd.curr_level,
        hltd.date_time,
        LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
        ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
    FROM host_live_tank_details hltd LEFT JOIN location_master lm
	ON hltd.sap_id = lm.sap_id
    --WHERE date_time::DATE BETWEEN CURRENT_DATE - INTERVAL '8 days' AND CURRENT_DATE - INTERVAL '1 day'
    --WHERE hltd.date_time::DATE BETWEEN DATE '2026-02-05' - INTERVAL '8 days' AND DATE '2026-02-05' - INTERVAL '1 day'
        WHERE {}
    ),
    combined AS (
        SELECT
            tr.sap_id,
            tr.zone,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time,
            tdd.product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
        ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
    ),
    t_dispatch AS (
        SELECT
            date_time::DATE AS dispatch_date,
			zone,
            sap_id,
            tank_name,
            product,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) > curr_level
                    THEN COALESCE(prev_level, 0) - curr_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric AS total_dispatch
        FROM combined
        GROUP BY date_time::DATE, sap_id, zone, tank_name, kl_per_mm, product
    ),
    daily_totals AS (
        SELECT
			zone,
			sap_id,
			tank_name,
            product,
            dispatch_date,
            SUM(total_dispatch) AS day_total
        FROM t_dispatch
        GROUP BY zone, sap_id, tank_name, dispatch_date, product
    )
    SELECT
	    zone,
		sap_id,
		tank_name,
        product,
        ROUND(AVG(day_total)::numeric, 2) AS seven_day_avg
    FROM daily_totals
    WHERE NOT (daily_totals IS NULL)
    GROUP BY zone, sap_id, tank_name, product 
),
available_stock  as (

SELECT 
		live_data.zone,
        live_data.sap_id,
        live_data.location_name,
        live_data.tank_name,
		tank_details.product,
        SUM(
            GREATEST(
                ROUND((tank_details.kl_per_mm::numeric * live_data.curr_level::numeric - tank_details.dead_stock_kl)::numeric, 2),
                0
            )
        ) AS "available_stock_kl"
    FROM (
            SELECT hltd.*
			FROM host_live_tank_details hltd LEFT JOIN location_master lm 
			     ON hltd.sap_id = lm.sap_id
        WHERE {}
        ) live_data
    LEFT JOIN public.tank_dia_details tank_details 
    ON live_data.sap_id = tank_details.location_sap_code  
        AND (
            substring(live_data.tank_name FROM '^[A-Z]+') = substring(tank_details.tank_no FROM '^[A-Z]+')
            OR
            substring(live_data.tank_name FROM '\d+')::int = substring(tank_details.tank_no FROM '\d+')::int
        )
	GROUP BY live_data.zone,
        live_data.sap_id,
        live_data.location_name,
        live_data.tank_name,
		tank_details.product
)
SELECT 
		avs.zone,
        avs.sap_id,
        avs.location_name,
        avs.tank_name,
		avs.product,
		avs.available_stock_kl,
		ds.total_dispatch,
		rc.total_receipt,
		ad.seven_day_avg
FROM 
	available_stock avs 
    LEFT JOIN dispatch ds 
        ON avs.sap_id = ds.sap_id 
        AND avs.product = ds.product
        AND avs.tank_name = ds.tank_name
    LEFT JOIN receipt rc
        ON avs.sap_id = rc.sap_id 
        AND avs.product = rc.product
        AND avs.tank_name = rc.tank_name
	LEFT JOIN dispatch_average ad
		ON avs.sap_id = ad.sap_id 
        AND avs.product = ad.product
        AND avs.tank_name = ad.tank_name

""",

#QUERY TO GET TANK STATUS
"tank_status" : """
    -- TANK USAGE
with dispatch_data as (
WITH todays_readings AS (
        SELECT
            hltd.sap_id,
            hltd.tank_name,
            hltd.curr_level,
            hltd.date_time,
            lm.zone,
            LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
            ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
        FROM host_live_tank_details hltd LEFT JOIN location_master lm 
        ON hltd.sap_id = lm.sap_id
        WHERE {condition}
    ),
    combined AS (
        SELECT
            tr.sap_id,
            tr.zone,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'  -- ← dynamic prev day
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time::DATE AS date_time,
            tdd.product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
            ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
    )
     SELECT
            sap_id,
            tank_name,
			date_time,
            product,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) > curr_level
                    THEN COALESCE(prev_level, 0) - curr_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric  AS total_dispatch                
        FROM combined
        GROUP BY sap_id, tank_name, date_time, kl_per_mm, product
),
receipt_data as (

WITH todays_readings AS (
   SELECT
            hltd.sap_id,
            lm.zone,
            hltd.tank_name,
            hltd.curr_level,
            hltd.date_time,
            LAG(hltd.curr_level) OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS prev_level,
            ROW_NUMBER() OVER (PARTITION BY hltd.tank_name, hltd.sap_id, hltd.date_time::DATE ORDER BY hltd.date_time) AS rn
        FROM host_live_tank_details hltd LEFT JOIN location_master lm
        ON hltd.sap_id = lm.sap_id
        WHERE {condition}
        ),
    combined AS (
        SELECT
            tr.sap_id,
            tr.zone,
            tr.tank_name,
            tr.curr_level,
            CASE
                WHEN rn = 1 THEN (
                    SELECT curr_level FROM host_live_tank_details h2
                    WHERE h2.tank_name = tr.tank_name
                    AND h2.sap_id = tr.sap_id
                    AND h2.date_time::DATE = tr.date_time::DATE - INTERVAL '1 day'  -- ← dynamic prev day
                    ORDER BY h2.date_time DESC
                    LIMIT 1
                )
                ELSE tr.prev_level
            END AS prev_level,
            tr.date_time::DATE as date_time,
            tdd.product,
            tdd.kl_per_mm
        FROM todays_readings tr
        LEFT JOIN (
            SELECT tank_no, product, location_sap_code, kl_per_mm FROM tank_dia_details
            ) tdd
            ON tr.sap_id = tdd.location_sap_code
            AND (
                substring(tr.tank_name FROM '^[A-Z]+') = substring(tdd.tank_no FROM '^[A-Z]+')
                OR
                substring(tr.tank_name FROM '\d+')::int = substring(tdd.tank_no FROM '\d+')::int
            )
        )
        SELECT
            sap_id,
			date_time,
            tank_name,
            product,
            SUM(
                CASE
                    WHEN COALESCE(prev_level, 0) < curr_level
                    THEN COALESCE(curr_level, 0) - prev_level
                    ELSE 0
                END
            )::numeric * kl_per_mm::numeric AS total_receipt               
        FROM combined
        GROUP BY sap_id, tank_name, date_time, kl_per_mm, product
),
available_stock as (
	SELECT 
		live_data.date_time::DATE as date_time,
		live_data.sap_id,
		live_data.tank_name,
		tank_details.product,
        tank_details.kl_per_mm::numeric * live_data.curr_level::numeric as "curr_stock_kl",
        tank_details.dead_stock_kl,
        ROUND((tank_details.kl_per_mm::numeric * live_data.curr_level::numeric - tank_details.dead_stock_kl)::numeric, 2) as "available_stock_kl"
    FROM (
            SELECT hltd.*,
				   lm.zone
			FROM host_live_tank_details hltd LEFT JOIN location_master lm 
			     ON hltd.sap_id = lm.sap_id
			WHERE {condition}
        ) live_data
    LEFT JOIN public.tank_dia_details tank_details 
    ON live_data.sap_id = tank_details.location_sap_code  
        AND (
            substring(live_data.tank_name FROM '^[A-Z]+') = substring(tank_details.tank_no FROM '^[A-Z]+')
            OR
            substring(live_data.tank_name FROM '\d+')::int = substring(tank_details.tank_no FROM '\d+')::int
        )

),
tank_status_data AS (
    SELECT 
        avs.*,
        dd.total_dispatch,
        rd.total_receipt
    FROM available_stock avs 
    LEFT JOIN dispatch_data dd 
        ON avs.sap_id = dd.sap_id 
        AND avs.date_time = dd.date_time 
        AND avs.product = dd.product
        AND avs.tank_name = dd.tank_name
    LEFT JOIN receipt_data rd 
        ON avs.sap_id = rd.sap_id 
        AND avs.date_time = rd.date_time 
        AND avs.product = rd.product
        AND avs.tank_name = rd.tank_name
),
tank_status AS (
    SELECT
        sap_id,
        tank_name,
        product,
        COUNT(DISTINCT tank_name) as "total_tank",
        CASE
            WHEN MAX(available_stock_kl) > 0 THEN 'in_use'
            WHEN MAX(COALESCE(total_dispatch, 0)) > 0 
              OR MAX(COALESCE(total_receipt, 0)) > 0 THEN 'in_use'
            ELSE 'not_in_use'
        END AS status
    FROM tank_status_data
    WHERE product IS NOT NULL   -- exclude TK-10, TK-11 style empty rows
    GROUP BY sap_id, tank_name, product
)
SELECT
    sap_id,
    product,
    SUM(total_tank) as total_tank,
    COUNT(CASE WHEN status = 'in_use'     THEN 1 END) AS tanks_in_use,
    COUNT(CASE WHEN status = 'not_in_use' THEN 1 END) AS tanks_not_in_use
FROM tank_status
GROUP BY sap_id, product
ORDER BY sap_id, product;

"""

}


product_mapping = {
    "1856" : {
        "host_day_end_details" : {
            "ATF": "ATF",
            "BIO DIESEL": "BIODIESEL",
            "BS VI HSD": "HSD",
            "BS VI MS": "MS",
            "ETHANOL": "ETHANOL"
        }
    },
    "1845" : {
        "host_day_end_details" : {
            "ETHANOL": "ETHANOL",
            "HEXANE": "HEXANE",
            "BS VI HSD": "HSD",
            "BS VI MS": "MS",
            "MTO": "MTO",
            "SKO": "SKO",
            "SOLVENT": "SOLVENT"
        }
    },
    "1146": {
        "host_day_end_details" : {
            "BS VI HSD": "HSD",
            "BIO DIESEL": "Biodiesel",
            "BS VI MS": "MS",
            "ETHANOL": "Ethanol"
        }
    },
    "1216": {
        "host_day_end_details" : {
            "BS VI HSD": "HSD"
        }
    }
}

product_name_mapping = {
    'ATF': 'ATF',
    'MS' : 'MS',
    "BS VI MS": "MS",
    "BS VI HSD": "HSD",
    'HSD': 'HSD',
    'ETHANOL': 'ETHANOL',
    'Ethanol': 'ETHANOL',
    'ETH': 'ETHANOL',
    'BIODIESEL': 'BIODIESEL',
    'Biodiesel' : 'BIODIESEL',
    'BIO DIESEL': 'BIODIESEL',
    'BIO-HSD' : 'BIODIESEL',
    'SOLVENT': 'SOLVENT',
    'HEXANE': 'HEXANE',
    'SKO': 'SKO',
    'MTO': 'MTO'
}

ACTION_MAP = {
    "tank_details":  "tank_details",
    "tank_dispatch": "dispatch",
    "tank_receipt":  "receipt",
    "bcu_dispacth":  "bcu_total_dispatch",
    "total_dispatch":"dispatch",
    "total_receipt": "receipt",
    "total_product": "tank_details",
    "tank_status": "tank_status"
}

SUM_ACTIONS = {"total_dispatch": "sum", "total_receipt": "sum"}