import utilities.helpers as helpers
from datetime import datetime

today = datetime.now()

financial_year = 'financial_year'
current_month = 'current_month'

timezone_format = 'YYYY-MM-DD HH24:MI:SS.US'
lpg_plant_query = {
    "production_query": f'''SELECT SUM("productivity.normal.production")/1000 AS total_production,
        AVG("productivity.normal.production") AS average_production
FROM public.lpg_consolidated_data
WHERE process_date BETWEEN TO_TIMESTAMP('{helpers.get_time_stamp_by_delta(months=1)} 00:00:00.000000', '{timezone_format}')
  AND TO_TIMESTAMP('{helpers.get_time_stamp_by_delta(months=0)} 00:00:00.000000', '{timezone_format}')
LIMIT 50000;''',

    "rejection_query": f'''SELECT AVG(sortoutpercentage)/100 AS cs_rejections
FROM
  (WITH aggregated_data AS
     (SELECT el.system_id,
             el.process_id,
             el.process_status,
             COUNT(el.event_log_id) AS count,
             REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1') AS plant_name,
             el.process_date::DATE AS process_date
      FROM lpg_event_log_data el
      WHERE el.system_id IN (1,
                             2)
        AND el.process_id IN (4,
                              24)
      GROUP BY el.system_id,
               el.process_id,
               el.process_status,
               REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1'),
               el.process_date::DATE),
        mapped_data AS
     (SELECT ad.system_id,
             ad.process_id,
             ad.process_status,
             ad.count,
             ad.plant_name,
             ad.process_date,
             p.zone
      FROM aggregated_data ad
      LEFT JOIN plants p ON ad.plant_name = p.short_name) SELECT system_id,
                                                                 SUM(count) AS handled,
                                                                 SUM(count) FILTER (
                                                                                    WHERE process_status != 0) AS sortout,
                                                                 CASE
                                                                     WHEN SUM(count) > 0 THEN (SUM(count) FILTER (
                                                                                                                  WHERE process_status != 0) * 1.0) / SUM(count)
                                                                     ELSE 0
                                                                 END AS sortOutPercentage,
                                                                 plant_name,
                                                                 zone,
                                                                 process_date
   FROM mapped_data
   GROUP BY system_id,
            plant_name,
            zone,
            process_date) AS virtual_table
WHERE process_date >= TO_DATE('{helpers.get_time_stamp_by_delta(months=1)}', 'YYYY-MM-DD')
  AND process_date < TO_DATE('{helpers.get_time_stamp_by_delta(months=0)}', 'YYYY-MM-DD')
LIMIT 50000;''',

    "total_gd_rejection": f'''SELECT AVG(sortoutpercentage)/100 AS "Percentage"
FROM
  (WITH aggregated_data AS
     (SELECT el.system_id,
             el.process_id,
             el.process_status,
             COUNT(el.event_log_id) AS count,
             REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1') AS plant_name,
             el.process_date::DATE AS process_date
      FROM lpg_event_log_data el
      WHERE el.system_id IN (1,
                             2)
        AND el.process_id IN (3,
                              23)
      GROUP BY el.system_id,
               el.process_id,
               el.process_status,
               REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1'),
               el.process_date::DATE),
        mapped_data AS
     (SELECT ad.system_id,
             ad.process_id,
             ad.process_status,
             ad.count,
             ad.plant_name,
             ad.process_date,
             p.zone
      FROM aggregated_data ad
      LEFT JOIN plants p ON ad.plant_name = p.short_name) SELECT system_id,
                                                                 SUM(count) AS handled,
                                                                 SUM(count) FILTER (
                                                                                    WHERE process_status != 0) AS sortout,
                                                                 CASE
                                                                     WHEN SUM(count) > 0 THEN (SUM(count) FILTER (
                                                                                                                  WHERE process_status != 0) * 1.0) / SUM(count)
                                                                     ELSE 0
                                                                 END AS sortOutPercentage,
                                                                 plant_name,
                                                                 zone,
                                                                 process_date
   FROM mapped_data
   GROUP BY system_id,
            plant_name,
            zone,
            process_date) AS virtual_table
WHERE process_date >= TO_DATE('{helpers.get_time_stamp_by_delta(months=1)}', 'YYYY-MM-DD')
  AND process_date < TO_DATE('{helpers.get_time_stamp_by_delta(months=0)}', 'YYYY-MM-DD')
LIMIT 50000;''',

    "total_pt_rejection": f'''SELECT AVG(sortoutpercentage)/100 AS "AVG(sortoutpercentage)/100"
FROM
  (WITH aggregated_data AS
     (SELECT el.system_id,
             el.process_id,
             el.process_status,
             COUNT(el.event_log_id) AS count,
             REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1') AS plant_name,
             el.process_date::DATE AS process_date
      FROM lpg_event_log_data el
      WHERE el.system_id IN (1,
                             2)
        AND el.process_id IN (4,
                              24)
      GROUP BY el.system_id,
               el.process_id,
               el.process_status,
               REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1'),
               el.process_date::DATE),
        mapped_data AS
     (SELECT ad.system_id,
             ad.process_id,
             ad.process_status,
             ad.count,
             ad.plant_name,
             ad.process_date,
             p.zone
      FROM aggregated_data ad
      LEFT JOIN plants p ON ad.plant_name = p.short_name) SELECT system_id,
                                                                 SUM(count) AS handled,
                                                                 SUM(count) FILTER (
                                                                                    WHERE process_status != 0) AS sortout,
                                                                 CASE
                                                                     WHEN SUM(count) > 0 THEN (SUM(count) FILTER (
                                                                                                                  WHERE process_status != 0) * 1.0) / SUM(count)
                                                                     ELSE 0
                                                                 END AS sortOutPercentage,
                                                                 plant_name,
                                                                 zone,
                                                                 process_date
   FROM mapped_data
   GROUP BY system_id,
            plant_name,
            zone,
            process_date) AS virtual_table
WHERE process_date >= TO_DATE('{helpers.get_time_stamp_by_delta(months=1)}', 'YYYY-MM-DD')
  AND process_date < TO_DATE('{helpers.get_time_stamp_by_delta(months=0)}', 'YYYY-MM-DD')
LIMIT 50000;''',
    
    "productivity_cyl_per_hour": f'''SELECT zone AS zone,
               AVG("productivity.normal.productivity") AS "Total Productivity"
FROM public.lpg_consolidated_data
GROUP BY zone
ORDER BY COUNT(*) DESC
LIMIT 10000;''',

    "rejections_by_zones" : f'''SELECT zone AS zone,
               rejection_type AS rejection_type,
               AVG(sort_out_percentage) AS "AVG(sort_out_percentage)",
               COUNT(*) AS count
FROM public."Rejections"
GROUP BY zone,
         rejection_type
ORDER BY count DESC
LIMIT 10000;''',

    "daily_productivity_cyl_per_hour": f'''SELECT DATE_TRUNC('day', process_date) AS process_date,
       sum("productivity.normal.productivity") AS "Productivity"
FROM public.lpg_consolidated_data
GROUP BY DATE_TRUNC('day', process_date)
ORDER BY "Productivity" DESC
LIMIT 10000;''',
    
    "cyl_rejection_in_check_scale": f'''SELECT zone AS zone,
               AVG("sort_out_percentage") AS "AVG(""sort_out_percentage"")"
FROM
  (WITH aggregated_data AS
     (SELECT system_id,
             topic_name,
             DATE(process_date) AS process_date,
             COUNT(production_log_id) AS total_count,
             SUM(CASE
                     WHEN process_status IN (1040, 2064, 1296, 17424, 1048, 4120, 5392, 1041, 1042, 2192, 4112, 4113, 5136, 6160) THEN 1
                     ELSE 0
                 END) AS sort_outs,
             SUM(CASE
                     WHEN process_status < 0
                          OR process_status = 4096 THEN 1
                     ELSE 0
                 END) AS comm_errors
      FROM lpg_dncceg_data
      WHERE system_id IN (1,
                          2)
        AND process_id IN (2,
                           22)
      GROUP BY system_id,
               topic_name,
               DATE(process_date)),
        final_data AS
     (SELECT system_id,
             topic_name,
             process_date,
             total_count,
             total_count - sort_outs AS cyl_filled,
             sort_outs,
             comm_errors,
             CASE
                 WHEN total_count > 0 THEN sort_outs::FLOAT / total_count
                 ELSE 0
             END AS sort_out_percentage,
             REGEXP_REPLACE(topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1') AS plant_name
      FROM aggregated_data) SELECT fd.*,
                                   p.zone
   FROM final_data fd
   JOIN plants p ON p.short_name = fd.plant_name) AS virtual_table
GROUP BY zone
ORDER BY "AVG(""sort_out_percentage"")" DESC
LIMIT 1000;''',





    "cyl_rejection_in_gd": f'''SELECT zone AS zone,
               sum(sortoutpercentage) AS "Rejection Percentage"
FROM
  (WITH aggregated_data AS
     (SELECT el.system_id,
             el.process_id,
             el.process_status,
             COUNT(el.event_log_id) AS count,
             SUBSTRING(el.topic_name FROM '^.*_dncceg_([^-\s]+).*') AS plant_name,
             el.process_date::DATE AS process_date
      FROM lpg_event_log_data el
      WHERE el.system_id IN (1,
                             2)
        AND el.process_id IN (3,
                              23)
      GROUP BY el.system_id,
               el.process_id,
               el.process_status,
               SUBSTRING(el.topic_name FROM '^.*_dncceg_([^-\s]+).*'),
               el.process_date::DATE),
        mapped_data AS
     (SELECT ad.system_id,
             ad.process_id,
             ad.process_status,
             ad.count,
             ad.plant_name,
             ad.process_date,
             p.zone
      FROM aggregated_data ad
      LEFT JOIN plants p ON ad.plant_name = p.short_name) SELECT system_id,
                                                                 SUM(count) AS handled,
                                                                 SUM(count) FILTER (
                                                                                    WHERE process_status != 0) AS sortout,
                                                                 CASE
                                                                     WHEN SUM(count) > 0 THEN (SUM(count) FILTER (
                                                                                                                  WHERE process_status != 0) * 1.0) / SUM(count)
                                                                     ELSE 0
                                                                 END AS sortOutPercentage,
                                                                 plant_name,
                                                                 zone,
                                                                 process_date
   FROM mapped_data
   GROUP BY system_id,
            plant_name,
            zone,
            process_date) AS virtual_table
GROUP BY zone
ORDER BY "Rejection Percentage" DESC
LIMIT 1000;''',

    "cyl_rejection_in_pt": f'''SELECT zone AS zone,
               AVG("sortoutpercentage") AS "Percentage Rejection"
FROM
  (WITH aggregated_data AS
     (SELECT el.system_id,
             el.process_id,
             el.process_status,
             COUNT(el.event_log_id) AS count,
             REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1') AS plant_name,
             el.process_date::DATE AS process_date
      FROM lpg_event_log_data el
      WHERE el.system_id IN (1,
                             2)
        AND el.process_id IN (4,
                              24)
      GROUP BY el.system_id,
               el.process_id,
               el.process_status,
               REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1'),
               el.process_date::DATE),
        mapped_data AS
     (SELECT ad.system_id,
             ad.process_id,
             ad.process_status,
             ad.count,
             ad.plant_name,
             ad.process_date,
             p.zone
      FROM aggregated_data ad
      LEFT JOIN plants p ON ad.plant_name = p.short_name) SELECT system_id,
                                                                 SUM(count) AS handled,
                                                                 SUM(count) FILTER (
                                                                                    WHERE process_status != 0) AS sortout,
                                                                 CASE
                                                                     WHEN SUM(count) > 0 THEN (SUM(count) FILTER (
                                                                                                                  WHERE process_status != 0) * 1.0) / SUM(count)
                                                                     ELSE 0
                                                                 END AS sortOutPercentage,
                                                                 plant_name,
                                                                 zone,
                                                                 process_date
   FROM mapped_data
   GROUP BY system_id,
            plant_name,
            zone,
            process_date) AS virtual_table
GROUP BY zone
ORDER BY "Percentage Rejection" DESC
LIMIT 1000;''',

    "cyl_count_by_carousel": f'''SELECT carousel AS carousel,
       sum("bottling.14_2kg") AS "14.2 KG",
       sum("bottling.19kg") AS "19 KG"
FROM public.lpg_consolidated_data
GROUP BY carousel
ORDER BY "14.2 KG" DESC
LIMIT 1000;''',

    "cyl_count_by_zone": f'''SELECT zone AS zone,
               sum("bottling.14_2kg") AS "SUM(bottling.14_2kg)",
               sum("bottling.19kg") AS "SUM(bottling.19kg)",
               COUNT(*) AS count
FROM public.lpg_consolidated_data
WHERE process_date >= TO_TIMESTAMP('{helpers.get_time_stamp_by_delta(months=1)} 00:00:00.000000', '{timezone_format}')
  AND process_date < TO_TIMESTAMP('{helpers.get_time_stamp_by_delta(months=0)} 00:00:00.000000', '{timezone_format}')
GROUP BY zone
ORDER BY count DESC
LIMIT 10000;''',

    "bottom_cs_plants": f'''SELECT plant_name AS plant_name,
       system_id AS system_id,
       AVG("sort_out_percentage") AS "AVG(""sort_out_percentage"")"
FROM
  (WITH aggregated_data AS
     (SELECT system_id,
             topic_name,
             DATE(process_date) AS process_date,
             COUNT(production_log_id) AS total_count,
             SUM(CASE
                     WHEN process_status IN (1040, 2064, 1296, 17424, 1048, 4120, 5392, 1041, 1042, 2192, 4112, 4113, 5136, 6160) THEN 1
                     ELSE 0
                 END) AS sort_outs,
             SUM(CASE
                     WHEN process_status < 0
                          OR process_status = 4096 THEN 1
                     ELSE 0
                 END) AS comm_errors
      FROM lpg_dncceg_data
      WHERE system_id IN (1,
                          2)
        AND process_id IN (2,
                           22)
      GROUP BY system_id,
               topic_name,
               DATE(process_date)),
        final_data AS
     (SELECT system_id,
             topic_name,
             process_date,
             total_count,
             total_count - sort_outs AS cyl_filled,
             sort_outs,
             comm_errors,
             CASE
                 WHEN total_count > 0 THEN sort_outs::FLOAT / total_count
                 ELSE 0
             END AS sort_out_percentage,
             REGEXP_REPLACE(topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1') AS plant_name
      FROM aggregated_data) SELECT fd.*,
                                   p.zone
   FROM final_data fd
   JOIN plants p ON p.short_name = fd.plant_name) AS virtual_table
GROUP BY plant_name,
         system_id
ORDER BY COUNT(*) DESC
LIMIT 10000;''',

    "bottom_gd_plants": '''SELECT plant_name AS plant_name,
       system_id AS system_id,
       sum(sortoutpercentage) AS "Percentage Rejection"
FROM
  (WITH aggregated_data AS
     (SELECT el.system_id,
             el.process_id,
             el.process_status,
             COUNT(el.event_log_id) AS count,
             REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1') AS plant_name,
             el.process_date::DATE AS process_date
      FROM lpg_event_log_data el
      WHERE el.system_id IN (1,
                             2)
        AND el.process_id IN (3,
                              23)
      GROUP BY el.system_id,
               el.process_id,
               el.process_status,
               REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1'),
               el.process_date::DATE),
        mapped_data AS
     (SELECT ad.system_id,
             ad.process_id,
             ad.process_status,
             ad.count,
             ad.plant_name,
             ad.process_date,
             p.zone
      FROM aggregated_data ad
      LEFT JOIN plants p ON ad.plant_name = p.short_name) SELECT system_id,
                                                                 SUM(count) AS handled,
                                                                 SUM(count) FILTER (
                                                                                    WHERE process_status != 0) AS sortout,
                                                                 CASE
                                                                     WHEN SUM(count) > 0 THEN (SUM(count) FILTER (
                                                                                                                  WHERE process_status != 0) * 1.0) / SUM(count)
                                                                     ELSE 0
                                                                 END AS sortOutPercentage,
                                                                 plant_name,
                                                                 zone,
                                                                 process_date
   FROM mapped_data
   GROUP BY system_id,
            plant_name,
            zone,
            process_date) AS virtual_table
GROUP BY plant_name,
         system_id
ORDER BY "Percentage Rejection" DESC
LIMIT 10000;''',

    "bottom_pt_plants": '''SELECT plant_name AS plant_name,
       system_id AS system_id,
       sum(sortoutpercentage) AS "Percentage Rejection"
FROM
  (WITH aggregated_data AS
     (SELECT el.system_id,
             el.process_id,
             el.process_status,
             COUNT(el.event_log_id) AS count,
             REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1') AS plant_name,
             el.process_date::DATE AS process_date
      FROM lpg_event_log_data el
      WHERE el.system_id IN (1,
                             2)
        AND el.process_id IN (4,
                              24)
      GROUP BY el.system_id,
               el.process_id,
               el.process_status,
               REGEXP_REPLACE(el.topic_name, '^.*_dncceg_([^-\s]+).*$', '\\1'),
               el.process_date::DATE),
        mapped_data AS
     (SELECT ad.system_id,
             ad.process_id,
             ad.process_status,
             ad.count,
             ad.plant_name,
             ad.process_date,
             p.zone
      FROM aggregated_data ad
      LEFT JOIN plants p ON ad.plant_name = p.short_name) SELECT system_id,
                                                                 SUM(count) AS handled,
                                                                 SUM(count) FILTER (
                                                                                    WHERE process_status != 0) AS sortout,
                                                                 CASE
                                                                     WHEN SUM(count) > 0 THEN (SUM(count) FILTER (
                                                                                                                  WHERE process_status != 0) * 1.0) / SUM(count)
                                                                     ELSE 0
                                                                 END AS sortOutPercentage,
                                                                 plant_name,
                                                                 zone,
                                                                 process_date
   FROM mapped_data
   GROUP BY system_id,
            plant_name,
            zone,
            process_date) AS virtual_table
GROUP BY plant_name,
         system_id
ORDER BY "Percentage Rejection" DESC
LIMIT 10000;''',

    "bottom_productivity_plants": '''SELECT short_name AS short_name,
       AVG("productivity.normal.productivity") AS "Total Productivity"
FROM public.lpg_consolidated_data
WHERE (short_name NOT IN ('sitarganj',
                          'madurai'))
GROUP BY short_name
ORDER BY COUNT(*) DESC
LIMIT 10000;''',

    "productivity_by_zone": '''SELECT DATE_TRUNC('day', process_date) AS process_date,
       zone AS zone,
               sum("productivity.normal.productivity") AS "SUM(productivity.normal.productivity)"
FROM public.lpg_consolidated_data
GROUP BY DATE_TRUNC('day', process_date),
         zone
ORDER BY "SUM(productivity.normal.productivity)" DESC
LIMIT 50000;''',

    "productivity_by_location": '''SELECT DATE_TRUNC('day', process_date) AS process_date,
       short_name AS short_name,
       sum("productivity.normal.productivity") AS "SUM(productivity.normal.productivity)"
FROM public.lpg_consolidated_data
GROUP BY DATE_TRUNC('day', process_date),
         short_name
ORDER BY "SUM(productivity.normal.productivity)" DESC
LIMIT 10000;''',

    "consolidated_table": '''SELECT DATE_TRUNC('day', process_date) AS process_date,
       short_name AS short_name,
       carousel AS carousel,
       sum("bottling.14_2kg") AS "Bottling Summary(14.2KG)",
       sum("bottling.19kg") AS "Bottling Summary(19KG)",
       sum("bottling.total") AS "Bottling Summary(Total)",
       sum("productivity.normal.production") AS "Productivity Normal Hours(Production)",
       sum("productivity.normal.stoppages") AS "Productivity Normal Hours(Stoppage)",
       sum("productivity.normal.productivity") AS "Productivity Normal Hours(Productivity)",
       sum("productivity.break.production") AS "Productivity Break Hours(Production)",
       sum("productivity.break.net_hours") AS "Productivity Break Hours(Net Hours)",
       sum("productivity.break.productivity") AS "Productivity Break Hours(Productivity)",
       sum("productivity.overtime.production") AS "Productivity Overtime(Production)",
       sum("productivity.overtime.productivity") AS "Productivity Overtime(Net Hours)"
FROM public.lpg_consolidated_data
GROUP BY DATE_TRUNC('day', process_date),
         short_name,
         carousel
ORDER BY "Bottling Summary(14.2KG)" DESC
LIMIT 10000;''',

     "top_productivity_plants": '''SELECT short_name AS short_name,
       AVG("productivity.normal.productivity") AS "Productivity"
FROM public.lpg_consolidated_data
WHERE short_name IN ('sitarganj',
                     'madurai',
                     'barhi',
                     'mysore',
                     'gummidipoondi')
GROUP BY short_name
ORDER BY COUNT(*) DESC
LIMIT 10000;''',

    "high_alert_locations": '''SELECT location_name, COUNT(*) AS alert_count
                                FROM public.alerts 
                                WHERE severity = 'High'
                                GROUP BY location_name 
                                ORDER BY alert_count DESC''',

    "critical_alert_locations": '''SELECT location_name, COUNT(*) AS alert_count
                                FROM public.alerts 
                                WHERE severity = 'Critical'
                                GROUP BY location_name 
                                ORDER BY alert_count DESC''',

    "sod_terminal": '''SELECT severity, COUNT(*) AS alert_count 
                        FROM public.alerts 
                        GROUP BY severity 
                        ORDER BY alert_count DESC''',

    "alert_categories": '''SELECT severity, alert_status, COUNT(*) AS alert_count 
                            FROM public.alerts 
                            WHERE alert_status IN ('Open', 'Close')
                            GROUP BY severity, alert_status 
                            ORDER BY alert_count DESC''',

    "tas_alerts": '''SELECT bu, alert_section, COUNT(*) AS alert_count 
                      FROM public.alerts 
                      WHERE alert_section NOT IN ('VA', 'VTS')
                      GROUP BY bu, alert_section 
                      ORDER BY alert_count DESC''',

    "non_tas_alerts": '''SELECT alert_section, COUNT(*) AS alert_count 
                          FROM public.alerts 
                          WHERE alert_section NOT IN ('TAS')
                          GROUP BY alert_section 
                          ORDER BY alert_count DESC''',

    "no_of_terminals": '''SELECT bu, COUNT(*) AS no_of_terminals 
                           FROM public.alerts 
                           GROUP BY bu 
                           ORDER BY no_of_terminals DESC''',

    "alert_ageing": '''SELECT DISTINCT bu, alert_section,
                        CASE 
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) <= 1 THEN '1 Day'
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 1 AND 2 THEN '1 to 2 Days'
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 2 AND 5 THEN '2 to 5 Days'
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 5 AND 7 THEN '5 to 7 Days'
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 7 AND 10 THEN '7 to 10 Days'
                            ELSE 'Older than 10 Days'
                        END AS alert_ageing,
                        COUNT(*) OVER (
                            PARTITION BY 
                            bu, alert_section,
                            CASE 
                                WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) <= 1 THEN '1 Day'
                                WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 1 AND 2 THEN '1 to 2 Days'
                                WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 2 AND 5 THEN '2 to 5 Days'
                                WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 5 AND 7 THEN '5 to 7 Days'
                                WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 7 AND 10 THEN '7 to 10 Days'
                                ELSE 'Older than 10 Days'
                            END
                        ) AS alert_count,
                        CASE 
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) <= 1 THEN 1
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 1 AND 2 THEN 2
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 2 AND 5 THEN 3
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 5 AND 7 THEN 4
                            WHEN DATE_PART('day', CURRENT_DATE - (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) BETWEEN 7 AND 10 THEN 5
                            ELSE 6
                        END AS alert_ageing_order
                    FROM 
                        alerts
                    ORDER BY bu, alert_section,
                        alert_ageing_order''',

    "alert_distributions": '''SELECT severity, COUNT(*) AS alert_count 
                               FROM public.alerts 
                               GROUP BY severity 
                               ORDER BY alert_count DESC ;''',
        
    "analytics": '''SELECT 
                        a.sap_id, a.interlock_name,
                        COUNT(a.severity) as severity_count, 
                        a.alert_status, 
                        a.severity
                    FROM alerts a 
                    GROUP BY a.sap_id, a.interlock_name, a.severity, a.alert_status
                    ORDER BY severity_count DESC;
                    ''',
    
    "vts_violation_analytics": '''SELECT 
                        a.sap_id, a.violation_name,
                        COUNT(a.severity) as severity_count, 
                        a.alert_status, 
                        a.severity
                    FROM violation_history_vts a 
                    GROUP BY a.sap_id, a.violation_name, a.severity, a.alert_status
                    ORDER BY severity_count DESC;
                    ''',

    "no_of_locations": f'''SELECT COUNT(sap_id) FROM location_master''',

    "day_wise_alerts": '''SELECT 
                             DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS alert_date,
                            interlock_name,
                            severity,
                            COUNT(*) AS total_alerts
                        FROM alerts
                        GROUP BY DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') , interlock_name, severity
                        ORDER BY alert_date, severity;
                        ''',
    
    "location_severity_count": '''SELECT 
                                        b.name AS location_name,
                                        a.severity,
                                        COUNT(a.severity) AS alert_count
                                    FROM 
                                        alerts a
                                    LEFT JOIN 
                                        location_master b 
                                    ON 
                                        a.sap_id = b.sap_id
                                    GROUP BY 
                                        b.name, a.severity
                                    ORDER BY 
                                        b.name, a.severity;''',
    
    "severity_count": '''SELECT 
                            lm.sap_id,
                            lm.bu,
                            lm.state,
                            lm.region,
                            lm.zone,
                            lm.name,
                            lm.latitude,
                            lm.longitude,
                            jsonb_build_object(
                                'Critical', SUM(CASE WHEN a.severity = 'Critical' THEN 1 ELSE 0 END),
                                'High', SUM(CASE WHEN a.severity = 'High' THEN 1 ELSE 0 END),
                                'Medium', SUM(CASE WHEN a.severity = 'Medium' THEN 1 ELSE 0 END),
                                'Low', SUM(CASE WHEN a.severity = 'Low' THEN 1 ELSE 0 END)
                            ) AS alerts
                        FROM 
                            location_master lm
                        LEFT JOIN 
                            alerts a
                        ON 
                            lm.sap_id = a.sap_id AND lm.bu = a.bu
                        GROUP BY 
                            lm.sap_id, lm.bu, lm.state, lm.region, lm.zone, lm.name, lm.latitude, lm.longitude;''',
    
    "hourly_alerts": '''SELECT 
                                DATE_TRUNC('hour', created_at) AS alert_hour, interlock_name,
                                COUNT(*) AS alert_count
                            FROM 
                                alerts
                            WHERE 
                                created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                            GROUP BY 
                                DATE_TRUNC('hour', created_at), interlock_name
                            ORDER BY 
                                alert_hour;''',
    
    "sales_performance": '''SELECT "SBU", "SBU_Name", "ZONE", "Zone_Name", "REGION", "Region_Name", "SA", 
                                    "SalesArea_Name", "PRODUCT", "ProductName", "UOM", "INVOICE_DT", 
                                    "TARGET_QTY_TMT", "FISCAL_YEAR", "NETWEIGHT_TMT", "FinalSum", 
                                    "FinalActualSum", "Rate_Per_Day_Required_MMT", "Rate_per_day_current_MMT", 
                                    "month_year", "month_name", "Prediction_Value", "Zone_Region_Achievement",  
                                    "Product_Achievement"
                            FROM public."M60_LEVEL_METADATA"''',

    "sales_growth": '''SELECT * FROM public."MOM_LEVEL_FINAL_DATA" where "MOM_LEVEL_FINAL_DATA"."fiscal_year" in ('2023-2024','2024-2025') ''',
        
    "carry_forward_analysis": '''select 
                                        SUM(total_indents) as "total_indents", 
                                        SUM(indents_executed) as "indents_executed", 
                                        SUM(cf_indents) as "cf_indents", SUM(dry_out_locations) as "dry_out_locations",
                                        SUM(dry_out_cat_a) as "dry_out_cat_a", DATE(execution_date)
                                  from 
                                        "carry_forward_indents"''',

    "carry_fwd_indent": '''SELECT 
                                    reported_date::DATE AS execution_date,
                                    COUNT(*) AS cf_indents,
                                    COUNT(dry_out_in_days) AS dry_out_locations,
                                    COUNT(category) AS dry_out_cat_a
                                FROM 
                                    public.carry_fwd_indent''',
    
    "location_wise_distribution": '''SELECT 
                                            bu,
                                            alert_section,
                                            interlock_name,
                                            location_name,
                                            severity,
                                            COUNT(*) AS alert_count
                                        FROM 
                                            alerts
                                        GROUP BY 
                                            bu, alert_section, interlock_name, location_name, severity
                                        ORDER BY 
                                        bu, alert_section, interlock_name, location_name, severity;''',
    
    "lpg_cdcms_booking_vs_sales_vs_pending": '''select sum("bookings_volume") as "Bookings",
                            sum("sales_volume") as "Sales",
                            sum("pendings_volume") as "Pending",
                            "ZOName",
                            "ROName",
                            "SAName",
                            "DistributorName",
                            "ConsumerType",
                            "CylType"
                    from
                        "lpg_todays_cdcms_sales_summary"''',
    
    "lpg_cdcms_sakhi_registrations": ''' SELECT 
                                            "Month",
                                            "Month_Number",
                                            SUM("SakhiRegisteredCount") AS "SakhiRegistered",
                                            "ZOName", "ROName", "SAName", "DistributorName"
                                        FROM
                                            "lpg_cdcms_sakhi_registrations"
                                    ''',
    
    "lpg_cdcms_monthly_sales": '''select
                                sum("sales_volume") as "Total Sales",
                                "Month",
                                "Month_Number",
                                "ZOName",
                                "ROName",
                                "SAName",
                                "ConsumerType", 
                                "CylType",
                                "DistributorName"
                            from
                                "lpg_monthly_cdcms_sales_summary"''',
    
    "lpg_cdcms_bookings_order_source_wise": '''select
                                    "OrderSourceName",
                                    "DistributorName",
	                                "ZOName",
	                                "ROName",
	                                "SAName",
                                    "ConsumerType", 
                                    "CylType",
	                                sum("bookings_volume") as "Total_Bookings"
                                from
	                                "lpg_todays_cdcms_sales_summary"''',
                                 
    "lpg_cdcms_pending_cosumer_type_wise": '''
                                select 
                                    "ZOName",
                                    "ROName",
                                    "SAName",
                                    "ConsumerType",
                                    "DistributorName",
                                    "CylType",
                                    sum("Total_Pending") as "Total_pending"
                                from
                                    "lpg_todays_cdcms_sales_summary" ''',
    "lpg_cdcms_ageing" : '''
                        select 
                            "ZOName",
                            "ROName",
                            "SAName",
                            "DistributorName",
                            "ConsumerType",
                            "CylType",
                            sum("pending_1_3_days") as "pending_1_3_days",
                            sum("pending_4_7_days") as "pending_4_7_days",
                            sum("pending_8_15_days") as "pending_8_15_days",
                            sum("Pending_Beyond15D") as "pending_beyond_15_days"
                        from
                            "lpg_todays_cdcms_sales_summary" ''',
    
    "lpg_cdcms_current_financial_year_sales": '''select
                                            "DistributorName",
                                            "ConsumerType",
                                            "ZOName",
                                            "ROName",
                                            "SAName",
                                            sum("sales_volume") as "Sales"
                                        from
                                            "lpg_monthly_cdcms_sales_summary"''',
    
    "lpg_cdcms_overall_ctc_statistics": '''select
                                        "Category",
                                        "JDEDistributorCode",
                                        "ZOName",
                                        "ROName",
                                        "SAName",
                                        sum("ACTCCount") as "ACTC",
                                        sum("BCTCCount") as "BCTC",
                                        sum("NCTCCount") as "NCTC"
                                    from
                                        "LPG_CONSUMERS_SUMMARY"''',
    
    'lpg_cdcms_daywise_overall_ctc_statistics': ''' 
                                        select 
                                            "ZoneNames" AS "ZOName",
                                            "ROName",
                                            "SAName",
                                            "SubCategory" AS "ConsumerType",
                                            TO_CHAR("Execution_Datetime", 'Month') AS "Month",
                                            sum("ACTCCount") as "ACTC",
                                            sum("BCTCCount") as "BCTC",
                                            sum("NCTCCount") as "NCTC"
                                        from
                                            "lpg_consumers_statistics_month_end_data"
                                                ''',

    "lpg_cdcms_safety_check_pending": '''select
                                            "SubCategory",
                                            "JDEDistributorCode",
                                            "ZOName",
                                            "ROName",
                                            "SAName",
                                            sum("SafetyCheckPending") as "SafetyCheckPending"
                                        from
                                            "LPG_CONSUMERS_SUMMARY"''',

    'lpg_cdcms_actual_vs_historic_sales': ''' select 
                                            "Month",
                                            "Month_Number",
                                            "Financial_Year",
                                            "Quarter",
                                            sum("sales_volume") as "sales_volume",
                                            "ZOName", "ROName", "SAName", "ConsumerType", "CylType", "DistributorName"
                                        from
                                            "lpg_monthly_cdcms_sales_summary" ''',
    
    "lpg_cdcms_total_consumers": ''' select
                                "ZOName",
                                "ROName",
                                "SAName",
                                "JDEDistributorCode",
                                "Category" as "Category",
                                "SubCategory" as "SubCategory",
                                sum("ConsumerCount") as "Total_Consumers"
                            from
                                "LPG_CONSUMERS_SUMMARY" ''',
                                
    "lpg_cdcms_backlogs": ''' SELECT 
                                    "DistributorName",
                                    "ZOName", "ROName", "SAName", "ConsumerType",
                                    SUM("TotalSalesYesterday") AS "TotalSalesYesterday" ,
                                    SUM("Total_Pending") AS "Total_Pending"
                                FROM
                                    "lpg_cdcms_last_three_months_summary" ''',
    
    "lpg_cdcms_april_consumer_stats": ''' SELECT
                                                "DistributorName", "SubCategory", "ZOName",
                                                "SAName", "ROName",
                                                SUM("ConsumerCount") AS "ConsumerCount"
                                            FROM
                                                "lpg_consumers_summary_april" ''',
    
    "lpg_cdcms_current_consumer_stats": ''' SELECT "JDEDistributorCode", "SubCategory", "ZOName",
                                                    "SAName", "ROName",
                                                    SUM("ConsumerCount") AS "ConsumerCount"
                                                FROM 
                                                    "LPG_CONSUMERS_SUMMARY"
                                                ''',
                                                
                 "lpg_cdcms_pcc_sales": ''' SELECT 
                                                "DistributorName", "ConsumerType", "CylType", "ZOName",
                                                "SAName", "ROName", 
                                                SUM("TotalSalesYesterday") AS "TotalSalesYesterday"
                                            FROM
                                                "lpg_monthly_cdcms_sales_summary" ''',

    "lpg_cdcms_dbc_enrollments": ''' SELECT 
                                        "ZOName" ,
                                        "ROName",
                                        "SAName",
                                        "DistributorName",
                                        "Month",
                                        "month_number",
                                        "ConsumerType",
                                        sum("DBCIssuedCount") as "DBCIssued"
                                    from
                                        "lpg_cdcms_dbc_enrollment_data" ''',
    
    "lpg_cdcms_nc_query": '''SELECT 
                                "ZOName" ,
                                "ROName",
                                "SAName",
                                "DistributorName",
                                "Month",
                                "month_number",
                                "ConsumerType",
                                sum("new_connection") as "new_connection"
                            FROM
                                "lpg_cdcms_nc_data" ''',
    
    "lpg_cdcms_backlogs_today": ''' SELECT
                                        "DistributorName",
                                        "ZOName", "ROName", "SAName", "ConsumerType",
                                        SUM("TotalSalesYesterday") AS "TotalSalesYesterday",
                                        SUM("Total_Pending") AS "Total_Pending"
                                    FROM
                                        "lpg_todays_cdcms_sales_summary" ''',
    
    "sales_growth_ytd": '''select * from "MOM_DAY_LEVEL_DATA" where "MOM_DAY_LEVEL_DATA"."fiscal_year" in ('2023-2024','2024-2025')''',
    
    "lpg_cdcms_total_suvidha": '''select 
                            "ZOName",
                            "ROName",
                            "SAName",
                            "JDEDistributorCode",
                            "SubCategory" as "SubCategory",
                            "Category" As "Category",
                            sum("SuvidhaClub") as "SuvidhaClub" 
                        from
                            "LPG_CONSUMERS_SUMMARY" ''',
    "lpg_cdcms_ekyc_statistics": '''
                        SELECT
                            "ROName",
                            "SAName",
                            "JDEDistributorCode",
                            "ZOName",
                            sum("eKYCCompleted") as "Completed",
                            sum("eKYCPending") as "Pending"     
                        FROM
                            "LPG_CONSUMERS_SUMMARY"
                        ''',
    'lpg_operations_connected_plants': f''' SELECT
                                                COUNT(DISTINCT "location_name") AS short_name_count
                                            FROM
                                                "lpg_plant_operations"
                                            HAVING
                                                COUNT(DISTINCT "location_name") > 0 ''',
                                    
    'lpg_operations_total_plants': f''' SELECT
                                            COUNT(DISTINCT "location_name") AS short_name_count
                                        FROM
                                            "lpg_plant_operations"
                                        HAVING
                                            COUNT(DISTINCT "location_name") > 0 ''',
    
    'lpg_plant_status': """ SELECT
                                p.erp_id as sap_id,
                                p.plant_name,
                                CASE
                                    WHEN EXISTS (
                                        SELECT 1
                                        FROM lpg_plant_operations lpo
                                        WHERE CAST(lpo.sap_id AS TEXT) = CAST(p.erp_id AS TEXT)
                                        AND lpo.process_date = CURRENT_DATE
                                    )
                                    THEN 'Available'
                                    ELSE 'Not Available'
                                END AS data_status
                            FROM plants p
                            ORDER BY data_status DESC """,

    'lpg_operations_current_month_production': '''
                                                    SELECT 
                                                        ROUND(
                                                            (SUM(production_14_2kg) * 14.2 + SUM(production_19kg) * 19)::NUMERIC / 1000, 
                                                            0
                                                        ) AS current_month_production
                                                    FROM 
                                                        lpg_plant_operations
                                                    WHERE 
                                                        DATE_TRUNC('month', process_date) = DATE_TRUNC('month', CURRENT_DATE)
                                                ''',
                                                
    'lpg_operations_current_month_productivity': '''
                                                    SELECT
                                                        ROUND(SUM(total_production) / SUM(total_net_hours), 0) AS "Total Productivity"
                                                    FROM
                                                        "lpg_plant_operations"
                                                    WHERE
                                                        DATE_TRUNC('month', "process_date") = DATE_TRUNC('month', CURRENT_DATE)
                                                ''',

    'lpg_operations_current_month_cylinder_filled': ''' SELECT
                                                            ROUND(((SUM(production_14_2kg) + SUM(production_19kg)) / 100000), 1) AS "Cylinders_Filled"
                                                        FROM
                                                            "lpg_plant_operations"
                                                        WHERE
                                                            DATE_TRUNC('month', "process_date") = DATE_TRUNC('month', CURRENT_DATE) ''',

    'lpg_operations_current_month_cs_rejection': ''' SELECT
                                                        ROUND(
                                                            CASE 
                                                            WHEN SUM(cs_handled) = 0 THEN 0
                                                            ELSE ((SUM(cs_sortout)::float / SUM(cs_handled)) * 100)::numeric
                                                        END, 1) AS cs_rejection
                                                    FROM
                                                        "lpg_plant_operations"
                                                    WHERE
                                                        DATE_TRUNC('month', "process_date") = DATE_TRUNC('month', CURRENT_DATE) ''',

    'lpg_operations_current_month_gd_rejection': ''' SELECT                                                        
                                                        ROUND(
                                                            CASE 
                                                            WHEN SUM(gd_handled) = 0 THEN 0
                                                            ELSE ((SUM(gd_sortout)::float / SUM(gd_handled)) * 100)::numeric
                                                        END, 1) AS gd_rejection
                                                    FROM
                                                        "lpg_plant_operations"
                                                    WHERE
                                                        DATE_TRUNC('month', "process_date") = DATE_TRUNC('month', CURRENT_DATE) ''',

    'lpg_operations_current_month_pt_rejection': ''' SELECT
                                                        ROUND(
                                                            CASE 
                                                            WHEN SUM(pt_handled) = 0 THEN 0
                                                            ELSE ((SUM(pt_sortout)::float / SUM(pt_handled)) * 100)::numeric
                                                        END, 1) AS pt_rejection
                                                    FROM
                                                        "lpg_plant_operations"
                                                    WHERE
                                                        DATE_TRUNC('month', "process_date") = DATE_TRUNC('month', CURRENT_DATE) ''',
    
    'lpg_operations_notconnected_plants': ''' SELECT DISTINCT m."short_name"
                                            FROM 
                                                "lpg_operations_masters" m
                                            LEFT JOIN "lpg_operations_summary" s ON m."short_name" = s."short_name"
                                            WHERE s."short_name" IS NULL
                                            ORDER BY m."short_name"; ''',
    
    "lpg_operations_productivity_zone": '''   
                        select
                            zone,
                            sap_id,
                            location_name AS plant,
                            filling_head as carousel_type,
                            SUM(total_production) as total_production,
                            SUM(total_net_hours) as total_net_hours
                        from
                            "lpg_plant_operations"
                        ''',
    
    "lpg_operations_production_zone": ''' 
                        select
                            zone,
                            sap_id,
                            location_name AS plant,
                            filling_head as carousel_type,
                            SUM(production_14_2kg) AS "14_kg",
                            SUM(production_19kg) AS "19_kg"
                        from
                            "lpg_plant_operations" ''',

    "lpg_operations_pq_rejection": '''
                    SELECT
                        zone,
                        sap_id,
                        location_name as plant,
                        'CS' AS rejection_type,
                        filling_head as carousel_type,
                        SUM(cs_handled) as cs_handled,
                        SUM(cs_sortout) as cs_sortout,
                        SUM(pt_handled) as pt_handled,
                        SUM(pt_sortout) as pt_sortout,
                        SUM(gd_handled) as gd_handled,
                        SUM(gd_sortout) as gd_sortout
                    FROM
                        "lpg_plant_operations"
                ''',
    
    'productivity_overtime_vs_break_production': '''  
                            SELECT 
                                zone,
                                sap_id,
                                location_name as plant,
                                filling_head as carousel_type,
                                SUM(break_net_hours) as break_production,
                                SUM(overtime_net_hours) as overtime_production
                            FROM 
                                "lpg_plant_operations" ''',
    
    'lpg_operations_daywise_productivity': '''  
                                SELECT 
                                    zone,
                                    sap_id,
                                    location_name AS plant,
                                    filling_head as carousel_type,
                                    ROUND(SUM(total_production), 2) as total_production,
                                    ROUND(SUM(total_net_hours), 2) as total_net_hours,
                                    DATE(process_date) AS process_date
                                FROM 
                                    lpg_plant_operations ''',
    
    'lpg_operations_daywise_production': '''  
                            SELECT 
                                zone,
                                sap_id,
                                location_name AS plant,
                                filling_head as carousel_type,
                                SUM(production_14_2kg) AS "14_kg",
                                SUM(production_19kg) AS "19_kg",
                                DATE("process_date") AS process_date
                            FROM
                                lpg_plant_operations ''',
    
    'lpg_cdcms_daywise_subsidy_failure_statistics': '''
                                SELECT
                                    "ZOName",
                                    "ROName",
                                    "SAName",
                                    "DistributorName",
                                    "PaymentErrorName",
                                    "Financial_Year",
                                    DATE("Delivery_Date") AS "Delivery_Date",
                                    SUM("Refills") as "Refills"
                                FROM
                                    "lpg_cdcms_subsidy_failure_statistics"
                                    ''',
    
    'lpg_cdcms_daywise_subsidy_failure_statistics_m': '''
                                SELECT
                                    "ZOName",
                                    "ROName",
                                    "SAName",
                                    "DistributorName",
                                    "PaymentErrorName",
                                    "Financial_Year",
                                    "Month",
                                    SUM("Refills") as "Refills"
                                FROM
                                    "lpg_cdcms_subsidy_failure_statistics"
                                    ''',
    
    
    'lpg_cdcms_daywise_subsidy_exception_statistics': '''
                                SELECT
                                    "ZOName",
                                    "ROName",
                                    "SAName",
                                    "DistributorName",
                                    "Month",
                                    "ExceptionName",
                                    "Financial_Year",
                                    DATE("Delivery_Date") AS "Delivery_Date",
                                    SUM("Refills") as "Refills"
                                FROM
                                    "lpg_cdcms_subsidy_exception_statistics"
                                    ''',
    
    'lpg_cdcms_daywise_subsidy_exception_statistics_m': ''' SELECT
                                    "ZOName",
                                    "ROName",
                                    "SAName",
                                    "DistributorName",
                                    "Month",
                                    "ExceptionName",
                                    "Financial_Year",
                                    SUM("Refills") as "Refills"
                                FROM
                                    "lpg_cdcms_subsidy_exception_statistics" ''',
            
    "cp_total_locations": 'select count(distinct("sap_id")) as "total_plants" from "consumer_pump_transactions" ',

    "cp_total_dus": '''SELECT SUM("du") AS "total_du"
FROM (
    SELECT COUNT(DISTINCT "dispensing_unit") AS "du"
    FROM "consumer_pump_transactions"
    GROUP BY "sap_id"
) AS subquery ''',

    "cp_total_tanks": '''SELECT SUM("tanks") AS "total_tanks"
FROM (
    SELECT COUNT(DISTINCT "tank_no") AS "tanks"
    FROM "consumer_pump_transactions"
    GROUP BY "sap_id"
) AS subquery ''',

    "cp_avg_monthly_consumption": '''SELECT 
    AVG("sale_volume")/1000 AS "avg_sale_volume",
    TO_CHAR(CAST("start_date" AS TIMESTAMP), 'Mon YYYY') AS "start_month_year",
    "product" AS "product"
FROM
    "cp_tank_delivery_updated"
GROUP BY
    TO_CHAR(CAST("start_date" AS TIMESTAMP), 'Mon YYYY'),
    "product",
    TO_CHAR(CAST("start_date" AS TIMESTAMP), 'MM-YYYY')
ORDER BY
    TO_CHAR(CAST("start_date" AS TIMESTAMP), 'MM-YYYY') ASC''',

    "cp_avg_monthly_consumption_by_location": '''SELECT 
        AVG("sale_volume")/1000 AS "avg_sale_volume",
        "depot" AS "plant",
        TO_CHAR(CAST("start_date" AS TIMESTAMP), 'Mon YYYY') AS "start_month_year",
        "product" AS "product"
    FROM
        "cp_tank_delivery_updated"
    GROUP BY
        TO_CHAR(CAST("start_date" AS TIMESTAMP), 'Mon YYYY'),
        "product",
        "depot",
        TO_CHAR(CAST("start_date" AS TIMESTAMP), 'MM-YYYY')
    ORDER BY
        "depot",TO_CHAR(CAST("start_date" AS TIMESTAMP), 'MM-YYYY') ASC''',

    "cp_total_volume_consumption": '''select sum("sale_volume")/1000 as "total_consumption" 
    from "cp_tank_delivery_updated" ''',

    "cp_total_volume_sales": '''select sum("quantity")/1000 as "total_sales" 
    from "consumer_pump_transactions"''',

    "lpg_cdcms_exception_stats": f''' select 
                                        "ZOName",
                                        "ROName",
                                        "SAName",
                                        "DistributorName",
                                        "ExceptionName",
                                        SUM("Consumers") AS "Consumers",
                                        SUM("Refills") AS "Refills"
                                    from
                                        "subsidy_exception_statistics" 
                                     ''',

    "lpg_cdcms_subsidy_failure_stats": f'''
                        SELECT 
                            "ZOName" ,
                            "ROName",
                            "SAName",
                            "DistributorName",
                            "PaymentErrorName",
                            sum("Consumers") as "Consumers",
                            sum("Refills") as "Refills"
                        FROM
                            "subsidy_failure_statistics"''',
    
    'lpg_cdcms_subsidy_central_consumers': f''' 
                            SELECT 
                                "ConsumerType",
                                "Month",
                                "month_number",
                                "ZOName",
                                "ROName",
                                "SAName",
                                "DistributorName",
                                "StateCode",
                                "Financial_Year",
                                SUM("Consumer_Count") as "consumer_count"
                            FROM
                                "lpg_cdcms_subsidy_central" ''',
    
    'lpg_cdcms_subsidy_central_transaction': f''' 
                            SELECT 
                                "ConsumerType",
                                "Month",
                                "month_number",
                                "ZOName",
                                "ROName",
                                "SAName",
                                "DistributorName",
                                "StateCode",
                                "Financial_Year",
                                SUM("Transaction_Count") as "transaction_count"
                            FROM
                                "lpg_cdcms_subsidy_central" ''',
    
    'lpg_cdcms_subsidy_central_amount':f''' 
                            SELECT 
                                "ConsumerType",
                                "Month",
                                "month_number",
                                "ZOName",
                                "ROName",
                                "SAName",
                                "DistributorName",
                                "StateCode",
                                "Financial_Year",
                                SUM("SubsidyAmount") as "SubsidyAmount"
                            FROM
                                "lpg_cdcms_subsidy_central" ''',
    
    'lpg_cdcms_subsidy_state_consumers': f''' 
                            SELECT 
                                "ConsumerType",
                                "Month",
                                "month_number",
                                "ZOName",
                                "ROName",
                                "SAName",
                                "DistributorName",
                                "StateCode",
                                "Financial_Year",
                                SUM("Consumer_Count") as "consumer_count"
                            FROM
                                "lpg_cdcms_subsidy_state" ''',
    
    'lpg_cdcms_subsidy_state_transaction': f''' 
                            SELECT 
                                "ConsumerType",
                                "Month",
                                "month_number",
                                "ZOName",
                                "ROName",
                                "SAName",
                                "DistributorName",
                                "StateCode",
                                "Financial_Year",
                                SUM("Transaction_Count") as "transaction_count"
                            FROM
                                "lpg_cdcms_subsidy_state" ''',
    
    'lpg_cdcms_subsidy_state_amount':f''' 
                            SELECT 
                                "ConsumerType",
                                "Month",
                                "month_number",
                                "ZOName",
                                "ROName",
                                "SAName",
                                "DistributorName",
                                "StateCode",
                                "Financial_Year",
                                SUM("SubsidyAmount") as "SubsidyAmount"
                            FROM
                                "lpg_cdcms_subsidy_state" ''',        
                    
    'cdcms_current_year_sales':''' SELECT 
                                        ROUND(CAST(SUM("sales_volume") / 1000000 AS NUMERIC), 2) AS "total_sales"
                                    FROM 
                                        "lpg_monthly_cdcms_sales_summary"
                                    WHERE 
                                        "Financial_Year"='{financial_year}' AND "ZOName" IS NOT NULL ''',
    
    'cdcms_current_month_sales':'''select
                                        ROUND(CAST(SUM("sales_volume") / 1000000 AS NUMERIC), 2) AS "total_sales"
                                    from
                                        "lpg_monthly_cdcms_sales_summary"
                                    where
                                        "Financial_Year"='{financial_year}' AND "Month"='{current_month}' AND "ZOName" IS NOT NULL ''',
                                                
    'cdcms_current_week_sales': ''' SELECT 
                                        ROUND(CAST(SUM("sales_volume") / 1000000 AS NUMERIC), 2) AS "total_sales"
                                    FROM
                                        "lpg_cdcms_sales_summary"
                                    WHERE 
                                        "Execution_Date" >= CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT + 1
                                        AND "Execution_Date" <= CURRENT_DATE AND "ZOName" IS NOT NULL ''',
    
    'cdcms_current_date_sales': '''select
                                        ROUND(CAST(SUM("sales_volume") / 1000000 AS NUMERIC), 2) AS "total_sales",
                                        ROUND(CAST(SUM("TotalSalesYesterday") / 100000 AS NUMERIC), 2) AS "no_of_cylinders"
                                    from
                                        "lpg_todays_cdcms_sales_summary"
                                    where
                                        "ZOName" IS NOT NULL ''',                                

    'cdcms_current_date_bookings': '''select
                                        ROUND(CAST(SUM("bookings_volume") / 1000000 AS NUMERIC), 2) AS "Bookings",
                                        ROUND(CAST(SUM("BookingReceivedYesterday") / 100000 AS NUMERIC), 2) AS "no_of_cylinders"
                                    from
                                        "lpg_todays_cdcms_sales_summary"
                                    where
                                        "ZOName" IS NOT NULL ''',

    'cdcms_current_date_pending': '''select
                                        ROUND(CAST(SUM("pendings_volume") / 1000000 AS NUMERIC), 2) AS "Pending",
                                        ROUND(CAST(SUM("Total_Pending") / 100000 AS NUMERIC), 2) AS "no_of_cylinders"
                                    from
                                        "lpg_todays_cdcms_sales_summary"
                                    where
                                        "ZOName" IS NOT NULL ''',

    "lpg_cdcms_domestic_sales_table": f''' select 
                                        "ZOName" as "ZOName",
                                        "CylType" as "CylType",
                                        "ConsumerType" as "ConsumerType",
                                        sum("bookings_volume") as "Total_Booking",
                                        sum("sales_volume") as "Total_Sales",
                                        sum("pendings_volume") as "Total_Pending"
                                    from
                                        "lpg_todays_cdcms_sales_summary" 
                                     ''',

    "lpg_cdcms_consumer_statistics_table": f''' select 
                                    "ZoneNames" as "ZoneNames",
                                    "SubCategory" as "SubCategory",
                                    sum("ConsumerCount") as "Total_Consumers",
                                    sum("eKYCCompleted") as "eKYCCompleted",
                                    sum("eKYCPending") as "eKYCPending",
                                    sum("SafetyCheckPending") as "SafetyCheckPending",
                                    sum("SuvidhaClub") as "SuvidhaClub",
                                    "CylinderType" as "CylinderType" 
                                from
                                    "LPG_CONSUMERS_SUMMARY" ''',

    "present_previous_month_sales": '''WITH SalesData AS (
    SELECT 
        rosapcode, 
        CASE
            WHEN item_name = 'HSD' THEN '2812000'
            WHEN item_name = 'MS' THEN '2811000'
            WHEN item_name = 'TURBO' THEN '3912000'
            WHEN item_name = 'E20' THEN '2822000'
            WHEN item_name = 'POWER 95' THEN '3672000'
            WHEN item_name = 'POWER 99' THEN '2816000'
            WHEN item_name = 'POWER 100' THEN '3373000'
            ELSE NULL
        END AS item_name_code,
        run_id,
        avgsales_7days
    FROM sch_inventory_forecast_dashboard
    WHERE run_id LIKE '%2300'
)

SELECT 
    a.location_name,
    SUM(CASE WHEN TO_CHAR(TO_DATE(SUBSTRING(sd.run_id FROM 1 FOR 6), 'DDMMYY'), 'YYYY-MM') = TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') THEN sd.avgsales_7days ELSE 0 END) AS present_month,
    SUM(CASE WHEN TO_CHAR(TO_DATE(SUBSTRING(sd.run_id FROM 1 FOR 6), 'DDMMYY'), 'YYYY-MM') = TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') - INTERVAL '1 month', 'YYYY-MM') THEN sd.avgsales_7days ELSE 0 END) AS previous_month
FROM 
    public.alerts a
LEFT JOIN 
    SalesData sd
ON 
    COALESCE(a.sap_id::TEXT, '') = COALESCE(sd.rosapcode::TEXT, '')
    AND COALESCE(a.product_code::TEXT, '') = COALESCE(sd.item_name_code::TEXT, '')
WHERE 
    a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
    AND a.indent_status NOT IN ('Cancelled', 'Completed')
GROUP BY 
    a.location_name
ORDER BY 
    present_month DESC 
''',
    "present_previous_week_sales": '''WITH SalesData AS (
    SELECT 
        rosapcode, 
        CASE
            WHEN item_name = 'HSD' THEN '2812000'
            WHEN item_name = 'MS' THEN '2811000'
            WHEN item_name = 'TURBO' THEN '3912000'
            WHEN item_name = 'E20' THEN '2822000'
            WHEN item_name = 'POWER 95' THEN '3672000'
            WHEN item_name = 'POWER 99' THEN '2816000'
            WHEN item_name = 'POWER 100' THEN '3373000'
            ELSE NULL
        END AS item_name_code,
        run_id,
        avgsales_7days,
        TO_DATE(SUBSTRING(run_id FROM 1 FOR 6), 'DDMMYY') AS run_date
    FROM sch_inventory_forecast_dashboard
    WHERE run_id LIKE '%2300'
)

SELECT 
    a.location_name,
    SUM(CASE WHEN EXTRACT(week FROM sd.run_date) = EXTRACT(week FROM CURRENT_DATE) 
             AND EXTRACT(year FROM sd.run_date) = EXTRACT(year FROM CURRENT_DATE) 
             THEN sd.avgsales_7days ELSE 0 END) AS present_week,
    SUM(CASE WHEN EXTRACT(week FROM sd.run_date) = EXTRACT(week FROM CURRENT_DATE - INTERVAL '1 week') 
             AND EXTRACT(year FROM sd.run_date) = EXTRACT(year FROM CURRENT_DATE - INTERVAL '1 week') 
             THEN sd.avgsales_7days ELSE 0 END) AS previous_week
FROM 
    public.alerts a
LEFT JOIN 
    SalesData sd
ON 
    COALESCE(a.sap_id::TEXT, '') = COALESCE(sd.rosapcode::TEXT, '')
    AND COALESCE(a.product_code::TEXT, '') = COALESCE(sd.item_name_code::TEXT, '')
WHERE 
    a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
    AND a.indent_status NOT IN ('Cancelled', 'Completed')
GROUP BY 
    a.location_name
ORDER BY 
    present_week DESC
''',
    'present_previous_day_sales': '''WITH SalesData AS (
    SELECT 
        rosapcode, 
        CASE
            WHEN item_name = 'HSD' THEN '2812000'
            WHEN item_name = 'MS' THEN '2811000'
            WHEN item_name = 'TURBO' THEN '3912000'
            WHEN item_name = 'E20' THEN '2822000'
            WHEN item_name = 'POWER 95' THEN '3672000'
            WHEN item_name = 'POWER 99' THEN '2816000'
            WHEN item_name = 'POWER 100' THEN '3373000'
            ELSE NULL
        END AS item_name_code,
        run_id,
        avgsales_7days,
        TO_DATE(SUBSTRING(run_id FROM 1 FOR 6), 'DDMMYY') AS run_date
    FROM sch_inventory_forecast_dashboard
    WHERE run_id LIKE '%2300'
)

SELECT 
    a.location_name,
    SUM(CASE WHEN sd.run_date = CURRENT_DATE THEN sd.avgsales_7days ELSE 0 END) AS present_day,
    SUM(CASE WHEN sd.run_date = CURRENT_DATE - INTERVAL '1 day' THEN sd.avgsales_7days ELSE 0 END) AS previous_day
FROM 
    public.alerts a
LEFT JOIN 
    SalesData sd
ON 
    COALESCE(a.sap_id::TEXT, '') = COALESCE(sd.rosapcode::TEXT, '')
    AND COALESCE(a.product_code::TEXT, '') = COALESCE(sd.item_name_code::TEXT, '')
WHERE 
    a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
    AND a.indent_status NOT IN ('Cancelled', 'Completed')
GROUP BY 
    a.location_name
ORDER BY 
    present_day DESC
''',
    'previous_current_month_sales': '''WITH SalesData AS (
    SELECT 
        ro_sap_code, 
        CASE
            WHEN product_no = '1322000' THEN '2811000'
            WHEN product_no = '1683000' THEN '2812000'
            WHEN product_no = '1683100' THEN '3912000'
            WHEN product_no = '1322000' THEN '2822000'
            WHEN product_no = '3672000' THEN '3672000'
            WHEN product_no = '2682000' THEN '2816000'
            WHEN product_no = '3373000' THEN '3373000'
            ELSE NULL
        END AS product_code,
        transaction_date,
        total_sales
    FROM "HPCL_HOS".ro_daily_sales
)

SELECT 
    a.location_name, 
    -- Handle time grain and aggregate based on the period
    CASE 
        WHEN '{time_grain}' = 'monthly' THEN TO_CHAR(DATE_TRUNC('month', sd.transaction_date::TIMESTAMP), 'Mon YYYY')
        WHEN '{time_grain}' = 'weekly' THEN TO_CHAR(DATE_TRUNC('week', sd.transaction_date::TIMESTAMP), 'DD-MM-YYYY')
        WHEN '{time_grain}' = 'daily' THEN TO_CHAR(sd.transaction_date::TIMESTAMP, 'DD-MM-YYYY')
    END AS period,
    AVG(sd.total_sales) AS avg_total_sales
FROM 
    public.alerts a
LEFT JOIN 
    SalesData sd
ON 
    COALESCE(a.sap_id::TEXT, '') = COALESCE(sd.ro_sap_code::TEXT, '')
    AND COALESCE(a.product_code::TEXT, '') = COALESCE(sd.product_code::TEXT, '')
WHERE 
    a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
    AND a.indent_status NOT IN ('Cancelled', 'Completed')
    AND (
        -- Handling aggregation for Monthly, Weekly, Daily

        -- For Monthly: Check if the transaction date is in the current or previous month
        CASE 
            WHEN '{time_grain}' = 'monthly' THEN 
                (DATE_TRUNC('month', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('month', CURRENT_DATE) 
                 OR DATE_TRUNC('month', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'))

        -- For Weekly: Check if the transaction date is in the current or previous week
        WHEN '{time_grain}' = 'weekly' THEN 
            (DATE_TRUNC('week', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('week', CURRENT_DATE)
             OR DATE_TRUNC('week', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week'))

        -- For Daily: Check if the transaction date is in the current or previous day
        WHEN '{time_grain}' = 'daily' THEN 
            (sd.transaction_date::DATE = CURRENT_DATE 
             OR sd.transaction_date::DATE = CURRENT_DATE - INTERVAL '1 day')
        END
    )
GROUP BY 
    a.location_name, period
ORDER BY 
    avg_total_sales 
''',
    'i_dryout_ro_count': '''select sum("alerts_view"."total_unique_count") as "total_count" from
            (WITH max_progress_rate AS (
            SELECT 
                sap_id, 
                MAX(progress_rate) AS present_stage,
                dry_out_in_days
            FROM alerts
            WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
              AND indent_status NOT IN ('Cancelled', 'Completed')
            GROUP BY sap_id, dry_out_in_days
        )
                    SELECT 
                        dry_out_in_days,
                        SUM(unique_count) AS total_unique_count
                    FROM (
                        SELECT 
                            dry_out_in_days, 
                            present_stage, 
                            COUNT(DISTINCT sap_id) AS unique_count
                        FROM max_progress_rate
                        WHERE present_stage != '11'
                        GROUP BY dry_out_in_days, present_stage
                    ) subquery
                    GROUP BY dry_out_in_days
                    ORDER BY dry_out_in_days)  "alerts_view" 
        where
            ( "alerts_view"."dry_out_in_days"  IN ('1') )''',

    'i_intraday_dryout_ro_count': '''select sum("alerts_view"."total_unique_count") as "total_count" from
            (WITH max_progress_rate AS (
            SELECT 
                sap_id, 
                MAX(progress_rate) AS present_stage,
                dry_out_in_days
            FROM alerts
            WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
              AND indent_status NOT IN ('Cancelled', 'Completed')
            GROUP BY sap_id, dry_out_in_days
        )
                    SELECT 
                        dry_out_in_days,
                        SUM(unique_count) AS total_unique_count
                    FROM (
                        SELECT 
                            dry_out_in_days, 
                            present_stage, 
                            COUNT(DISTINCT sap_id) AS unique_count
                        FROM max_progress_rate
                        WHERE present_stage != '11'
                        GROUP BY dry_out_in_days, present_stage
                    ) subquery
                    GROUP BY dry_out_in_days
                    ORDER BY dry_out_in_days)  "alerts_view" 
        where
            ( "alerts_view"."dry_out_in_days"  IN ('2'))''',

    'i_potential_dryout_ro_count': '''select 
             CASE
                WHEN SUM("alerts_view"."total_unique_count") IS NULL THEN 'Coming Soon'
                ELSE CAST(SUM("alerts_view"."total_unique_count") AS VARCHAR)
            END as "total_count" 
        from
            (WITH max_progress_rate AS (
                                SELECT 
                                    sap_id, 
                                    MAX(progress_rate) AS present_stage,
                                    dry_out_in_days
                                FROM alerts
                                WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
                                  AND indent_status NOT IN ('Cancelled', 'Completed')
                                GROUP BY sap_id, dry_out_in_days
                            )
                            SELECT 
                                dry_out_in_days,
                                SUM(unique_count) AS total_unique_count
                            FROM (
                                SELECT 
                                    dry_out_in_days, 
                                    present_stage, 
                                    COUNT(DISTINCT sap_id) AS unique_count
                                FROM max_progress_rate
                                WHERE present_stage != '11'
                                GROUP BY dry_out_in_days, present_stage
                            ) subquery
                            GROUP BY dry_out_in_days
                            ORDER BY dry_out_in_days)  "alerts_view" 
        where
            ( "alerts_view"."dry_out_in_days"  IN ('3'))''',

    'i_indent_status_summary': '''select 
            "View 1"."progress_name" as "indent_status",
            count(distinct("View 1"."sap_id")) as "total_ro",
            "View 1"."dry_out_name" as "dryout_status" 
        from
            (SELECT 
            *,
            CASE 
                WHEN "alerts"."progress_rate" = '1' THEN 'Indent Not Raised'
                WHEN "alerts"."progress_rate" = '2' THEN 'Indent On Hold'
                WHEN "alerts"."progress_rate" = '3' THEN 'Pending Indents'
                WHEN "alerts"."progress_rate" = '4' THEN 'Truck Allocated'
                WHEN "alerts"."progress_rate" = '5' THEN 'Sent to SAP'
                WHEN "alerts"."progress_rate" = '6' THEN 'Sales Order Placed'
                WHEN "alerts"."progress_rate" = '7' THEN 'R2 Swiped'
                WHEN "alerts"."progress_rate" = '8' THEN 'Invoice Created'
                WHEN "alerts"."progress_rate" = '9' THEN 'R3 Swiped'
                WHEN "alerts"."progress_rate" = '10' THEN 'VTS'
                WHEN "alerts"."progress_rate" = '11' THEN 'Indent Delivered'
            END AS "progress_name",
            CASE 
                WHEN "product_code" = '2811000' THEN 'MS'
                WHEN "product_code" = '2812000' THEN 'HSD'
                WHEN "product_code" = '3912000' THEN 'TURBO'
                WHEN "product_code" = '2822000' THEN 'E20'
                WHEN "product_code" = '3672000' THEN 'POWER 95'
                WHEN "product_code" = '2816000' THEN 'POWER 99'
                WHEN "product_code" = '3373000' THEN 'POWER 100'
                ELSE 'Unknown'
            END AS "product_name",
            CASE 
                WHEN "dry_out_in_days" = '1' THEN 'Fully Dry Out'
                WHEN "dry_out_in_days" = '2' THEN 'Intra-Day Dry Out'
                WHEN "dry_out_in_days" = '3' THEN 'Potential Dry Out'
                ELSE 'Dry Out'
            END AS "dry_out_name"
        FROM 
            "alerts"
        WHERE 
            "alerts"."interlock_name" IN ('Dry Out Each Indent Wise MainFlow')
            AND (
                (
                    "alerts"."indent_status" = 'Completed' 
                    AND CAST("alerts"."updated_at" AS DATE) = CURRENT_DATE
                )
                OR 
                (
                    "alerts"."indent_status" != 'Completed' 
                    AND "alerts"."indent_status" NOT IN ('Cancelled')
                )
            )
            AND "zone" IS NOT NULL AND "zone" != '' 
            AND "sales_area" IS NOT NULL AND "sales_area" != '' 
            AND "region" IS NOT NULL AND "region" != '')  "View 1" 
        where
            ( "View 1"."progress_rate"  NOT IN ('11')) and 
            ("View 1"."progress_name" IS NOT NULL AND "View 1"."progress_name" != '')
        group by
            "View 1"."progress_name", "View 1"."dry_out_name" 
        order by
            count(("View 1"."sap_id")) desc, "View 1"."dry_out_name" asc ''',

    'i_dryout_summary_by_product': '''select 
            "View 1"."product_name" as "product",
            count(distinct("View 1"."sap_id")) as "total_ro",
            "View 1"."dry_out_name" as "dryout_status" 
        from
            (SELECT 
            *,
            CASE 
                WHEN "alerts"."progress_rate" = '1' THEN 'Indent Not Raised'
                WHEN "alerts"."progress_rate" = '2' THEN 'Indent On Hold'
                WHEN "alerts"."progress_rate" = '3' THEN 'Pending Indents'
                WHEN "alerts"."progress_rate" = '4' THEN 'Truck Allocated'
                WHEN "alerts"."progress_rate" = '5' THEN 'Sent to SAP'
                WHEN "alerts"."progress_rate" = '6' THEN 'Sales Order Placed'
                WHEN "alerts"."progress_rate" = '7' THEN 'R2 Swiped'
                WHEN "alerts"."progress_rate" = '8' THEN 'Invoice Created'
                WHEN "alerts"."progress_rate" = '9' THEN 'R3 Swiped'
                WHEN "alerts"."progress_rate" = '10' THEN 'VTS'
                WHEN "alerts"."progress_rate" = '11' THEN 'Indent Delivered'
            END AS "progress_name",
            CASE 
                WHEN "product_code" = '2811000' THEN 'MS'
                WHEN "product_code" = '2812000' THEN 'HSD'
                WHEN "product_code" = '3912000' THEN 'TURBO'
                WHEN "product_code" = '2822000' THEN 'E20'
                WHEN "product_code" = '3672000' THEN 'POWER 95'
                WHEN "product_code" = '2816000' THEN 'POWER 99'
                WHEN "product_code" = '3373000' THEN 'POWER 100'
                ELSE 'Unknown'
            END AS "product_name",
            CASE 
                WHEN "dry_out_in_days" = '1' THEN 'Fully Dry Out'
                WHEN "dry_out_in_days" = '2' THEN 'Intra-Day Dry Out'
                WHEN "dry_out_in_days" = '3' THEN 'Potential Dry Out'
                ELSE 'Dry Out'
            END AS "dry_out_name"
        FROM 
            "alerts"
        WHERE 
            "alerts"."interlock_name" IN ('Dry Out Each Indent Wise MainFlow')
            AND (
                (
                    "alerts"."indent_status" = 'Completed' 
                    AND CAST("alerts"."updated_at" AS DATE) = CURRENT_DATE
                )
                OR 
                (
                    "alerts"."indent_status" != 'Completed' 
                    AND "alerts"."indent_status" NOT IN ('Cancelled')
                )
            )
            AND "zone" IS NOT NULL AND "zone" != '' 
            AND "sales_area" IS NOT NULL AND "sales_area" != '' 
            AND "region" IS NOT NULL AND "region" != '')  "View 1" 
        where
            ( "View 1"."progress_rate"  NOT IN ( '11') AND "View 1"."indent_status"  NOT IN ( 'Completed') ) 
        group by
            "View 1"."product_name", "View 1"."dry_out_name" 
        order by
            count(("View 1"."sap_id")) desc, "View 1"."dry_out_name" asc ''',

    'i_detailed_dryout_summary': '''select 
            {display_col},
            "View 1"."dry_out_name" as "dryout_status",
            count(distinct("View 1"."sap_id")) as "total_ro" 
        from
            (SELECT 
            *,
            CASE 
                WHEN "alerts"."progress_rate" = '1' THEN 'Indent Not Raised'
                WHEN "alerts"."progress_rate" = '2' THEN 'Indent On Hold'
                WHEN "alerts"."progress_rate" = '3' THEN 'Pending Indents'
                WHEN "alerts"."progress_rate" = '4' THEN 'Truck Allocated'
                WHEN "alerts"."progress_rate" = '5' THEN 'Sent to SAP'
                WHEN "alerts"."progress_rate" = '6' THEN 'Sales Order Placed'
                WHEN "alerts"."progress_rate" = '7' THEN 'R2 Swiped'
                WHEN "alerts"."progress_rate" = '8' THEN 'Invoice Created'
                WHEN "alerts"."progress_rate" = '9' THEN 'R3 Swiped'
                WHEN "alerts"."progress_rate" = '10' THEN 'VTS'
                WHEN "alerts"."progress_rate" = '11' THEN 'Indent Delivered'
            END AS "progress_name",
            CASE 
                WHEN "product_code" = '2811000' THEN 'MS'
                WHEN "product_code" = '2812000' THEN 'HSD'
                WHEN "product_code" = '3912000' THEN 'TURBO'
                WHEN "product_code" = '2822000' THEN 'E20'
                WHEN "product_code" = '3672000' THEN 'POWER 95'
                WHEN "product_code" = '2816000' THEN 'POWER 99'
                WHEN "product_code" = '3373000' THEN 'POWER 100'
                ELSE 'Unknown'
            END AS "product_name",
            CASE 
                WHEN "dry_out_in_days" = '1' THEN 'Fully Dry Out'
                WHEN "dry_out_in_days" = '2' THEN 'Intra-Day Dry Out'
                WHEN "dry_out_in_days" = '3' THEN 'Potential Dry Out'
                ELSE 'Dry Out'
            END AS "dry_out_name"
        FROM 
            "alerts"
        WHERE 
            "alerts"."interlock_name" IN ('Dry Out Each Indent Wise MainFlow')
            AND (
                (
                    "alerts"."indent_status" = 'Completed' 
                    AND CAST("alerts"."updated_at" AS DATE) = CURRENT_DATE
                )
                OR 
                (
                    "alerts"."indent_status" != 'Completed' 
                    AND "alerts"."indent_status" NOT IN ('Cancelled')
                )
            )
            AND "zone" IS NOT NULL AND "zone" != '' 
            AND "sales_area" IS NOT NULL AND "sales_area" != '' 
            AND "region" IS NOT NULL AND "region" != '')  "View 1" 
        where
            ( "View 1"."progress_rate"  NOT IN ('11') ) 
        group by
           {grp_col}, "View 1"."dry_out_name" ''',

    'i_detailed_indent_status_summary': '''select 
            "View 1"."zone" as "zone",
            "View 1"."region" as "region",
            "View 1"."sales_area" as "sales_area",
            "View 1"."product_name" as "product_name",
            "View 1"."progress_name" as "indent_status",
            count(distinct("View 1"."sap_id")) as "total_ro" 
        from
            (SELECT 
            *,
            CASE 
                WHEN "alerts"."progress_rate" = '1' THEN 'Indent Not Raised'
                WHEN "alerts"."progress_rate" = '2' THEN 'Indent On Hold'
                WHEN "alerts"."progress_rate" = '3' THEN 'Pending Indents'
                WHEN "alerts"."progress_rate" = '4' THEN 'Truck Allocated'
                WHEN "alerts"."progress_rate" = '5' THEN 'Sent to SAP'
                WHEN "alerts"."progress_rate" = '6' THEN 'Sales Order Placed'
                WHEN "alerts"."progress_rate" = '7' THEN 'R2 Swiped'
                WHEN "alerts"."progress_rate" = '8' THEN 'Invoice Created'
                WHEN "alerts"."progress_rate" = '9' THEN 'R3 Swiped'
                WHEN "alerts"."progress_rate" = '10' THEN 'VTS'
                WHEN "alerts"."progress_rate" = '11' THEN 'Indent Delivered'
            END AS "progress_name",
            CASE 
                WHEN "product_code" = '2811000' THEN 'MS'
                WHEN "product_code" = '2812000' THEN 'HSD'
                WHEN "product_code" = '3912000' THEN 'TURBO'
                WHEN "product_code" = '2822000' THEN 'E20'
                WHEN "product_code" = '3672000' THEN 'POWER 95'
                WHEN "product_code" = '2816000' THEN 'POWER 99'
                WHEN "product_code" = '3373000' THEN 'POWER 100'
                ELSE 'Unknown'
            END AS "product_name",
            CASE 
                WHEN "dry_out_in_days" = '1' THEN 'Fully Dry Out'
                WHEN "dry_out_in_days" = '2' THEN 'Intra-Day Dry Out'
                WHEN "dry_out_in_days" = '3' THEN 'Potential Dry Out'
                ELSE 'Dry Out'
            END AS "dry_out_name"
        FROM 
            "alerts"
        WHERE 
            "alerts"."interlock_name" IN ('Dry Out Each Indent Wise MainFlow')
            AND (
                (
                    "alerts"."indent_status" = 'Completed' 
                    AND CAST("alerts"."updated_at" AS DATE) = CURRENT_DATE
                )
                OR 
                (
                    "alerts"."indent_status" != 'Completed' 
                    AND "alerts"."indent_status" NOT IN ('Cancelled')
                )
            )
            AND "zone" IS NOT NULL AND "zone" != '' 
            AND "sales_area" IS NOT NULL AND "sales_area" != '' 
            AND "region" IS NOT NULL AND "region" != '')  "View 1" 
        where 
            "View 1"."progress_name" IS NOT NULL AND "View 1"."progress_name" != ''
        group by
            "View 1"."zone", "View 1"."region", "View 1"."sales_area", "View 1"."product_name", "View 1"."progress_name" 
        order by
            count(("View 1"."sap_id")) desc ''',

    'i_product_report': '''SELECT 
    "dryoutreport_view"."locn_code" AS "location_code",
    "dryoutreport_view"."location_name" AS "location_name",
    "dryoutreport_view"."dealer_code" AS "dealer_code",
    "dryoutreport_view"."indent_no" AS "indent_number",
    "dryoutreport_view"."indent_status" AS "indent_status",
    "dryoutreport_view"."product_name" AS "product_name",
    CASE 
        WHEN SUM("dryoutreport_view"."qty") < 1000 THEN SUM("dryoutreport_view"."qty") * 1000
        ELSE SUM("dryoutreport_view"."qty")
    END AS "Quantity",
    "dryoutreport_view"."dry_out_status" AS "Dry Out Status" 
FROM
    (WITH CombinedData AS (
        SELECT 
            ir."locn_code",
            ir."indent_no",
            ir."indent_date",
            ir."prod_reqd_dt",
            ir."dealer_code",
            ir."batch_flag",
            ir."truck_regno",
            ir."valid_indent",
            ir."send_to_jde_time",
            ir."delivery_date",
            ir."indent_hold_release_time",
            ir."indent_executable_time",
            ip."prod" AS "product_code",
            CASE 
                WHEN ip."prod" = '2811000' THEN 'MS'
                WHEN ip."prod" = '2812000' THEN 'HSD'
                WHEN ip."prod" = '3912000' THEN 'TURBO'
                WHEN ip."prod" = '2822000' THEN 'E20'
                WHEN ip."prod" = '3672000' THEN 'POWER 95'
                WHEN ip."prod" = '2816000' THEN 'POWER 99'
                WHEN ip."prod" = '3373000' THEN 'POWER 100'
                ELSE 'Unknown'
            END AS "product_name",
            ip."qty",
            ip."prod_allot_time",
            ip."sales_orderno",
            ip."invoice_no",
            ip."jde_truck_no",
            tse."LOADED_ON",
            tse."CARD_STATUS",
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(ir."locn_code"::TEXT, ''), 
                             COALESCE(ir."indent_no"::TEXT, ''), 
                             COALESCE(ir."dealer_code"::TEXT, ''), 
                             COALESCE(ip."prod"::TEXT, '') 
                ORDER BY tse."LOADED_ON" ASC
            ) AS rn
        FROM 
            "IMS_SAP"."INDENT_REQUEST" ir
        LEFT JOIN 
            "IMS_SAP"."INDENT_PRODUCTS" ip
        ON 
            COALESCE(ir."locn_code"::TEXT, '') = COALESCE(ip."locn_code"::TEXT, '')
            AND COALESCE(ir."dealer_code"::TEXT, '') = COALESCE(ip."dealer_code"::TEXT, '')
            AND COALESCE(ir."indent_no"::TEXT, '') = COALESCE(ip."indent_no"::TEXT, '')
        LEFT JOIN 
            "public"."TRUCK_SWIPE_ENTRY_SAP" tse
        ON 
            COALESCE(ir."locn_code"::TEXT, '') = COALESCE(tse."LOCN_CODE"::TEXT, '')
            AND COALESCE(ir."truck_regno"::TEXT, '') = COALESCE(tse."TRUCK_REGNO"::TEXT, '')
            AND tse."CARD_STATUS" = 'O'
            AND tse."LOADED_ON"::timestamp >= ir."prod_reqd_dt"::timestamp
            AND tse."LOADED_ON"::timestamp <= ir."prod_reqd_dt"::timestamp + INTERVAL '1 day'
    )
    SELECT 
        a.sap_id AS sap_id,
        a.location_name AS location_name,
        a.terminal_plant_id AS terminal_plant_id,
        a.indent_no AS INDENT_NO,
        a.product_code AS product_code,
        a.indent_status AS indent_status,
        CASE 
            WHEN a.dry_out_in_days = '1' THEN 'Fully Dry Out'
            WHEN a.dry_out_in_days = '2' THEN 'IntraDay Dry Out'
            WHEN a.dry_out_in_days = '3' THEN 'Potential Dry Out'
            ELSE 'Dry Out'
        END AS dry_out_status,
        cd."locn_code",
        cd."indent_no" AS "indent_number",
        cd."indent_date",
        cd."prod_reqd_dt",
        cd."dealer_code",
        cd."batch_flag",
        cd."truck_regno",
        cd."valid_indent",
        cd."send_to_jde_time",
        cd."delivery_date",
        cd."indent_hold_release_time",
        cd."indent_executable_time",
        cd."product_code",
        cd."product_name",
        cd."qty",
        cd."prod_allot_time",
        cd."sales_orderno",
        cd."invoice_no",
        cd."jde_truck_no",
        cd."LOADED_ON",
        cd."CARD_STATUS"
    FROM 
        (SELECT * 
         FROM alerts 
         WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
         AND indent_status NOT IN ('Cancelled', 'Completed')
         AND dry_out_in_days IN ('1', '2')) a
    LEFT JOIN 
        CombinedData cd
    ON 
        COALESCE(substr(cd."dealer_code", 3, 8)::TEXT, '') = COALESCE(a.sap_id::TEXT, '')
        AND COALESCE(cd."indent_no"::TEXT, '') = COALESCE(a.indent_no::TEXT, '')
        AND COALESCE(cd."product_code"::TEXT, '') = COALESCE(a.product_code::TEXT, '')
    WHERE 
        cd.rn = 1 OR cd.rn IS NULL
    ORDER BY 
        a.sap_id, a.indent_no) "dryoutreport_view" 
WHERE
    "dryoutreport_view"."indent_no" IS NOT NULL
GROUP BY
    "dryoutreport_view"."locn_code", "dryoutreport_view"."location_name", "dryoutreport_view"."dealer_code", 
    "dryoutreport_view"."indent_no", "dryoutreport_view"."indent_status", "dryoutreport_view"."product_name", 
    "dryoutreport_view"."dry_out_status" 
ORDER BY
    "dryoutreport_view"."indent_no" ASC, 
    CASE 
        WHEN SUM("dryoutreport_view"."qty") < 1000 THEN SUM("dryoutreport_view"."qty") * 1000
        ELSE SUM("dryoutreport_view"."qty")
    END DESC;
''',

    'i_indent_report': '''select 
                "dryoutreport_view"."LOCN_CODE" as "Loc Code",
                "dryoutreport_view"."location_name" as "Loc Name",
                "dryoutreport_view"."DEALER_CODE" as "Dealer Code",
                "dryoutreport_view"."INDENT_NO" as "Indent No",
                "dryoutreport_view"."INDENT_DATE" as "Indent Date",
                "dryoutreport_view"."indent_status" as "Indent Status",
                "dryoutreport_view"."DELIVERY_DATE" as "Delivery Date",
                "dryoutreport_view"."INVOICE_NO" as "Invoice No",
                "dryoutreport_view"."JDE_TRUCK_NO" as "JDE Truck No",
                "dryoutreport_view"."LOADED_ON" as "Loaded On",
                "dryoutreport_view"."PRODUCT_NAME" as "Product Name",
                "dryoutreport_view"."PROD_ALLOT_TIME" as "Prod Alot Time",
                "dryoutreport_view"."SALES_ORDERNO" as "Sales Order No",
                "dryoutreport_view"."SEND_TO_JDE_TIME" as "Send to JDE Time",
                "dryoutreport_view"."BATCH_FLAG" as "Batch Flag",
                "dryoutreport_view"."VALID_INDENT" as "Valid Indent",
                CASE 
                    WHEN SUM("dryoutreport_view"."QTY")  < 1000 THEN SUM("dryoutreport_view"."QTY") * 1000
                    ELSE SUM("dryoutreport_view"."QTY")
                END as "Quantity",
                "dryoutreport_view"."CARD_STATUS" as "Card Status",
                "dryoutreport_view"."INDENT_EXECUTABLE_TIME" as "Indent Executable Time",
                "dryoutreport_view"."INDENT_HOLD_RELEASE_TIME" as "Indent Hold Release Time" 
            from
                (WITH CombinedData AS (
                SELECT 
                    ir."LOCN_CODE",
                    ir."INDENT_NO",
                    ir."INDENT_DATE",
                    ir."PROD_REQD_DT",
                    ir."DEALER_CODE",
                    ir."BATCH_FLAG",
                    ir."TRUCK_REGNO",
                    ir."VALID_INDENT",
                    ir."SEND_TO_JDE_TIME",
                    ir."DELIVERY_DATE",
                    ir."INDENT_HOLD_RELEASE_TIME",
                    ir."INDENT_EXECUTABLE_TIME",
                    ip."PROD" AS "PRODUCT_CODE",
                    CASE 
                    WHEN ip."PROD" = '2811000' THEN 'MS'
                    WHEN ip."PROD" = '2812000' THEN 'HSD'
                    WHEN ip."PROD" = '3912000' THEN 'TURBO'
                    WHEN ip."PROD" = '2822000' THEN 'E20'
                    WHEN ip."PROD" = '3672000' THEN 'POWER 95'
                    WHEN ip."PROD" = '2816000' THEN 'POWER 99'
                    WHEN ip."PROD" = '3373000' THEN 'POWER 100'
                    ELSE 'Unknown'
                END AS "PRODUCT_NAME",
                    ip."QTY",
                    ip."PROD_ALLOT_TIME",
                    ip."SALES_ORDERNO",
                    ip."INVOICE_NO",
                    ip."JDE_TRUCK_NO",
                    tse."LOADED_ON",
                    tse."CARD_STATUS",
                    ROW_NUMBER() OVER (
                        PARTITION BY COALESCE(ir."LOCN_CODE"::TEXT, ''), 
                                     COALESCE(ir."INDENT_NO"::TEXT, ''), 
                                     COALESCE(ir."DEALER_CODE"::TEXT, ''), 
                                     COALESCE(ip."PROD"::TEXT, '') 
                        ORDER BY tse."LOADED_ON" ASC
                    ) AS rn
                FROM 
                    "IMS_SAP"."INDENT_REQUEST" ir
                LEFT JOIN 
                    "IMS_SAP"."INDENT_PRODUCTS" ip
                ON 
                    COALESCE(ir."LOCN_CODE"::TEXT, '') = COALESCE(ip."LOCN_CODE"::TEXT, '')
                    AND COALESCE(ir."DEALER_CODE"::TEXT, '') = COALESCE(ip."DEALER_CODE"::TEXT, '')
                    AND COALESCE(ir."INDENT_NO"::TEXT, '') = COALESCE(ip."INDENT_NO"::TEXT, '')
                LEFT JOIN 
                    "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" tse
                ON 
                    COALESCE(ir."LOCN_CODE"::TEXT, '') = COALESCE(tse."LOCN_CODE"::TEXT, '')
                    AND COALESCE(ir."TRUCK_REGNO"::TEXT, '') = COALESCE(tse."TRUCK_REGNO"::TEXT, '')
                    AND tse."CARD_STATUS" = 'O'
                    AND tse."LOADED_ON"::TIMESTAMP >= ir."PROD_REQD_DT"
                    AND tse."LOADED_ON"::TIMESTAMP <= ir."PROD_REQD_DT" + INTERVAL '1 day'
            )
            SELECT 
                a.sap_id AS sap_id,
                a.location_name AS location_name,
                a.terminal_plant_id AS terminal_plant_id,
                a.indent_no AS indent_no,
                a.product_code AS product_code,
                a.indent_status AS indent_status,
                -- Add the CASE statement for dry_out_in_days
                CASE 
                    WHEN a.dry_out_in_days = '1' THEN 'Fully Dry Out'
                    WHEN a.dry_out_in_days = '2' THEN 'IntraDay Dry Out'
                    WHEN a.dry_out_in_days = '3' THEN 'Potential Dry Out'
                    ELSE 'Dry Out'
                END AS dry_out_status,
                cd."LOCN_CODE",
                cd."INDENT_NO",
                cd."INDENT_DATE",
                cd."PROD_REQD_DT",
                cd."DEALER_CODE",
                cd."BATCH_FLAG",
                cd."TRUCK_REGNO",
                cd."VALID_INDENT",
                cd."SEND_TO_JDE_TIME",
                cd."DELIVERY_DATE",
                cd."INDENT_HOLD_RELEASE_TIME",
                cd."INDENT_EXECUTABLE_TIME",
                cd."PRODUCT_CODE",
                cd."PRODUCT_NAME",
                cd."QTY",
                cd."PROD_ALLOT_TIME",
                cd."SALES_ORDERNO",
                cd."INVOICE_NO",
                cd."JDE_TRUCK_NO",
                cd."LOADED_ON",
                cd."CARD_STATUS"
            FROM 
                (SELECT * 
                 FROM alerts 
                 WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
                 AND indent_status NOT IN ('Cancelled', 'Completed')
                 AND dry_out_in_days IN ('1', '2')) a
            LEFT JOIN 
                CombinedData cd
            ON 
                COALESCE(substr(cd."DEALER_CODE", 3, 8)::TEXT, '') = COALESCE(a.sap_id::TEXT, '')
                AND COALESCE(cd."INDENT_NO"::TEXT, '') = COALESCE(a.indent_no::TEXT, '')
                AND COALESCE(cd."PRODUCT_CODE"::TEXT, '') = COALESCE(a.product_code::TEXT, '')
            WHERE 
                cd.rn = 1 OR cd.rn IS NULL
            ORDER BY 
                a.sap_id, a.indent_no)  "dryoutreport_view" 
            where
                ( "dryoutreport_view"."PROD_REQD_DT" = CURRENT_DATE AND 
                "dryoutreport_view"."INDENT_NO" IS NOT NULL ) 
            group by
                "dryoutreport_view"."LOCN_CODE", 
                "dryoutreport_view"."location_name", 
                "dryoutreport_view"."DEALER_CODE", 
                "dryoutreport_view"."INDENT_NO", 
                "dryoutreport_view"."INDENT_DATE", 
                "dryoutreport_view"."indent_status", 
                "dryoutreport_view"."DELIVERY_DATE", 
                "dryoutreport_view"."INVOICE_NO", 
                "dryoutreport_view"."JDE_TRUCK_NO", 
                "dryoutreport_view"."LOADED_ON",
                "dryoutreport_view"."PRODUCT_NAME", 
                "dryoutreport_view"."PROD_ALLOT_TIME",
                "dryoutreport_view"."SALES_ORDERNO", 
                "dryoutreport_view"."SEND_TO_JDE_TIME", 
                "dryoutreport_view"."BATCH_FLAG", 
                "dryoutreport_view"."VALID_INDENT", 
                "dryoutreport_view"."CARD_STATUS", 
                "dryoutreport_view"."INDENT_EXECUTABLE_TIME", 
                "dryoutreport_view"."INDENT_HOLD_RELEASE_TIME" 
    ''',

    'i_product_wise_quantity_by_location': '''select 
        "dryoutreport_view"."location_name" as "Location Name",
        CASE 
            WHEN SUM("dryoutreport_view"."QTY")  < 1000 THEN SUM("dryoutreport_view"."QTY") * 1000
            ELSE SUM("dryoutreport_view"."QTY")
        END as "Quantity",
        "dryoutreport_view"."PRODUCT_NAME" as "Product Name" 
    from
        (WITH CombinedData AS (
        SELECT 
            ir."LOCN_CODE",
            ir."INDENT_NO",
            ir."INDENT_DATE",
            ir."PROD_REQD_DT",
            ir."DEALER_CODE",
            ir."BATCH_FLAG",
            ir."TRUCK_REGNO",
            ir."VALID_INDENT",
            ir."SEND_TO_JDE_TIME",
            ir."DELIVERY_DATE",
            ir."INDENT_HOLD_RELEASE_TIME",
            ir."INDENT_EXECUTABLE_TIME",
            ip."PROD" AS "PRODUCT_CODE",
            CASE 
            WHEN ip."PROD" = '2811000' THEN 'MS'
            WHEN ip."PROD" = '2812000' THEN 'HSD'
            WHEN ip."PROD" = '3912000' THEN 'TURBO'
            WHEN ip."PROD" = '2822000' THEN 'E20'
            WHEN ip."PROD" = '3672000' THEN 'POWER 95'
            WHEN ip."PROD" = '2816000' THEN 'POWER 99'
            WHEN ip."PROD" = '3373000' THEN 'POWER 100'
            ELSE 'Unknown'
        END AS "PRODUCT_NAME",
            ip."QTY",
            ip."PROD_ALLOT_TIME",
            ip."SALES_ORDERNO",
            ip."INVOICE_NO",
            ip."JDE_TRUCK_NO",
            tse."LOADED_ON",
            tse."CARD_STATUS",
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(ir."LOCN_CODE"::TEXT, ''), 
                             COALESCE(ir."INDENT_NO"::TEXT, ''), 
                             COALESCE(ir."DEALER_CODE"::TEXT, ''), 
                             COALESCE(ip."PROD"::TEXT, '') 
                ORDER BY tse."LOADED_ON" ASC
            ) AS rn
        FROM 
            "IMS_SAP"."INDENT_REQUEST" ir
        LEFT JOIN 
            "IMS_SAP"."INDENT_PRODUCTS" ip
        ON 
            COALESCE(ir."LOCN_CODE"::TEXT, '') = COALESCE(ip."LOCN_CODE"::TEXT, '')
            AND COALESCE(ir."DEALER_CODE"::TEXT, '') = COALESCE(ip."DEALER_CODE"::TEXT, '')
            AND COALESCE(ir."INDENT_NO"::TEXT, '') = COALESCE(ip."INDENT_NO"::TEXT, '')
        LEFT JOIN 
            "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" tse
        ON 
            COALESCE(ir."LOCN_CODE"::TEXT, '') = COALESCE(tse."LOCN_CODE"::TEXT, '')
            AND COALESCE(ir."TRUCK_REGNO"::TEXT, '') = COALESCE(tse."TRUCK_REGNO"::TEXT, '')
            AND tse."CARD_STATUS" = 'O'
            AND tse."LOADED_ON"::TIMESTAMP >= ir."PROD_REQD_DT"
            AND tse."LOADED_ON"::TIMESTAMP <= ir."PROD_REQD_DT" + INTERVAL '1 day'
    )
    SELECT 
        a.sap_id AS sap_id,
        a.location_name AS location_name,
        a.terminal_plant_id AS terminal_plant_id,
        a.indent_no AS indent_no,
        a.product_code AS product_code,
        a.indent_status AS indent_status,
        -- Add the CASE statement for dry_out_in_days
        CASE 
            WHEN a.dry_out_in_days = '1' THEN 'Fully Dry Out'
            WHEN a.dry_out_in_days = '2' THEN 'IntraDay Dry Out'
            WHEN a.dry_out_in_days = '3' THEN 'Potential Dry Out'
            ELSE 'Dry Out'
        END AS dry_out_status,
        cd."LOCN_CODE",
        cd."INDENT_NO",
        cd."INDENT_DATE",
        cd."PROD_REQD_DT",
        cd."DEALER_CODE",
        cd."BATCH_FLAG",
        cd."TRUCK_REGNO",
        cd."VALID_INDENT",
        cd."SEND_TO_JDE_TIME",
        cd."DELIVERY_DATE",
        cd."INDENT_HOLD_RELEASE_TIME",
        cd."INDENT_EXECUTABLE_TIME",
        cd."PRODUCT_CODE",
        cd."PRODUCT_NAME",
        cd."QTY",
        cd."PROD_ALLOT_TIME",
        cd."SALES_ORDERNO",
        cd."INVOICE_NO",
        cd."JDE_TRUCK_NO",
        cd."LOADED_ON",
        cd."CARD_STATUS"
    FROM 
        (SELECT * 
         FROM alerts 
         WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
         AND indent_status NOT IN ('Cancelled', 'Completed')
         AND dry_out_in_days IN ('1', '2')) a
    LEFT JOIN 
        CombinedData cd
    ON 
        COALESCE(substr(cd."DEALER_CODE", 3, 8)::TEXT, '') = COALESCE(a.sap_id::TEXT, '')
        AND COALESCE(cd."INDENT_NO"::TEXT, '') = COALESCE(a.indent_no::TEXT, '')
        AND COALESCE(cd."PRODUCT_CODE"::TEXT, '') = COALESCE(a.product_code::TEXT, '')
    WHERE 
        cd.rn = 1 OR cd.rn IS NULL
    ORDER BY 
        a.sap_id, a.indent_no)  "dryoutreport_view" 
    where
        ( "dryoutreport_view"."QTY" IS NOT NULL AND "dryoutreport_view"."location_name"  NOT IN ( '') ) 
    group by
        "dryoutreport_view"."location_name", "dryoutreport_view"."PRODUCT_NAME" 
''',

    'i_ims_report': '''WITH cte_indents AS (
        SELECT 
            ir."LOCN_CODE",
            ir."INDENT_NO",
            ir."INDENT_DATE",
            ir."PROD_REQD_DT",
            ir."DEALER_CODE",
            ir."BATCH_FLAG",
            ir."TRUCK_REGNO",
            ir."VALID_INDENT",
            ir."SEND_TO_JDE_TIME",
            ir."DELIVERY_DATE",
            ir."INDENT_HOLD_RELEASE_TIME",
            ir."INDENT_EXECUTABLE_TIME",
            ip."PROD",
            CASE 
                WHEN ip."PROD" = '2811000' THEN 'MS'
                WHEN ip."PROD" = '2812000' THEN 'HSD'
                WHEN ip."PROD" = '3912000' THEN 'TURBO'
                WHEN ip."PROD" = '2822000' THEN 'E20'
                WHEN ip."PROD" = '3672000' THEN 'POWER 95'
                WHEN ip."PROD" = '2816000' THEN 'POWER 99'
                WHEN ip."PROD" = '3373000' THEN 'POWER 100'
                ELSE 'Unknown'
            END AS product_name,
            ip."QTY",
            ip."PROD_ALLOT_TIME",
            ip."SALES_ORDERNO",
            ip."INVOICE_NO",
            ip."JDE_TRUCK_NO",
            tse."LOADED_ON",
            tse."CARD_STATUS",
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(ir."LOCN_CODE"::TEXT, ''), 
                             COALESCE(ir."INDENT_NO"::TEXT, ''), 
                             COALESCE(ir."DEALER_CODE"::TEXT, ''), 
                             COALESCE(ip."PROD"::TEXT, '') 
                ORDER BY tse."LOADED_ON" ASC
            ) AS rn
        FROM 
            "IMS_SAP"."INDENT_REQUEST" ir
        LEFT JOIN 
            "IMS_SAP"."INDENT_PRODUCTS" ip
        ON 
            ir."LOCN_CODE" = ip."LOCN_CODE"
            AND ir."DEALER_CODE" = ip."DEALER_CODE"
            AND ir."INDENT_NO" = ip."INDENT_NO"
        LEFT JOIN 
            "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" tse
        ON 
            ir."LOCN_CODE" = tse."LOCN_CODE"
            AND ir."TRUCK_REGNO" = tse."TRUCK_REGNO"
            AND tse."CARD_STATUS" = 'O'
            AND tse."LOADED_ON"::TIMESTAMP >= ir."PROD_REQD_DT"
            AND tse."LOADED_ON"::TIMESTAMP <= ir."PROD_REQD_DT" + INTERVAL '1 day'
        WHERE 
            ir."PROD_REQD_DT" = CURRENT_DATE
    ),
    alerts_cte AS (
        SELECT * 
        FROM alerts 
        WHERE 
            interlock_name = 'Dry Out Each Indent Wise MainFlow'
            AND indent_status NOT IN ('Cancelled', 'Completed')
            AND dry_out_in_days IN ('1', '2')
    ),
    ind_req_view AS (
        SELECT *
        FROM cte_indents
        WHERE rn = 1
        ORDER BY "INDENT_NO"
    )
    
    SELECT 
        ind_req_view."LOCN_CODE" AS "Location Code",
        ind_req_view."DEALER_CODE" AS "Dealer Code",
        ind_req_view."INDENT_NO" AS "Indent No",
        ind_req_view."product_name" AS "Product",
        SUM(ind_req_view."QTY") AS "Quantity"
    FROM ind_req_view
    LEFT JOIN alerts_cte a
    ON 
        COALESCE(a.sap_id::TEXT, '') = COALESCE(substr(ind_req_view."DEALER_CODE", 3, 8)::TEXT, '')
        AND COALESCE(a.indent_no::TEXT, '') = COALESCE(ind_req_view."INDENT_NO"::TEXT, '')
        AND COALESCE(a.product_code::TEXT, '') = COALESCE(ind_req_view."PROD"::TEXT, '')
    WHERE
        ind_req_view."product_name" NOT IN ('Unknown')
    GROUP BY
        ind_req_view."LOCN_CODE", ind_req_view."DEALER_CODE", 
        ind_req_view."INDENT_NO", ind_req_view."product_name"
    ORDER BY
        SUM(ind_req_view."QTY") DESC
''',
    'cp_monthly_avg_sales': '''select 
        TO_CHAR(DATE_TRUNC('month', transaction_date), 'Mon YYYY') as transaction_month, 
        product,
        avg(amount) as avg_sale_volume
    from consumer_pump_transactions
    group by DATE_TRUNC('month', transaction_date), product
    order by transaction_month desc''',

    'cp_top_3_sales': '''select sap_id, sum(quantity)/1000 as "Total Sales (TMT)" from consumer_pump_transactions
            group by sap_id
            order by "Total Sales (TMT)"
            limit 3''',

    'lpg_cdcms_totalconsumer_count': f'''SELECT 
                                            ROUND(CAST(SUM("ConsumerCount") AS NUMERIC) / 100000, 2) AS "Total Consumers"
                                        FROM 
                                            "LPG_CONSUMERS_SUMMARY"
                                        WHERE 
                                            "ZOName" IS NOT NULL 
                                            AND "Category" NOT IN ('Others') ''',

    'lpg_cdcms_SafetyCheckPending': f''' SELECT 
                                        ROUND(CAST(SUM("SafetyCheckPending") / 100000 AS NUMERIC), 2) AS "Total SafetyCheckPending"
                                    FROM 
                                        "LPG_CONSUMERS_SUMMARY" WHERE "Category" = 'Domestic' ''',

    'lpg_cdcms_total_Suvidha_count': f''' SELECT 
                                            ROUND(CAST(SUM("SuvidhaClub") / 1000 AS NUMERIC), 2) AS "Total Suvidha"
                                        FROM 
                                            "LPG_CONSUMERS_SUMMARY" ''',
    'i_previous_current_month_sales_by_product': '''WITH SalesData AS (
    SELECT 
        ro_sap_code, 
        CASE
            WHEN product_no = '1322000' THEN '2811000'
            WHEN product_no = '1683000' THEN '2812000'
            WHEN product_no = '1683100' THEN '3912000'
            WHEN product_no = '1322000' THEN '2822000'
            WHEN product_no = '3672000' THEN '3672000'
            WHEN product_no = '2682000' THEN '2816000'
            WHEN product_no = '3373000' THEN '3373000'
            ELSE NULL
        END AS product_code,
        transaction_date,
        total_sales
    FROM "HPCL_HOS".ro_daily_sales
)

SELECT 
    -- Handle time grain and aggregate based on the period
    CASE 
        WHEN '{time_grain}' = 'monthly' THEN TO_CHAR(DATE_TRUNC('month', sd.transaction_date::TIMESTAMP), 'Mon YYYY')
        WHEN '{time_grain}' = 'weekly' THEN TO_CHAR(DATE_TRUNC('week', sd.transaction_date::TIMESTAMP), 'DD-MM-YYYY')
        WHEN '{time_grain}' = 'daily' THEN TO_CHAR(sd.transaction_date::TIMESTAMP, 'DD-MM-YYYY')
    END AS period,
    CASE 
        WHEN a.product_code = '2811000' THEN 'MS'
        WHEN a.product_code = '2812000' THEN 'HSD'
        WHEN a.product_code = '3912000' THEN 'TURBO'
        WHEN a.product_code = '2822000' THEN 'E20'
        WHEN a.product_code = '3672000' THEN 'POWER 95'
        WHEN a.product_code = '2816000' THEN 'POWER 99'
        WHEN a.product_code = '3373000' THEN 'POWER 100'
    END AS product_name,
    AVG(sd.total_sales) AS avg_total_sales
FROM 
    public.alerts a
LEFT JOIN 
    SalesData sd
ON 
    COALESCE(a.sap_id::TEXT, '') = COALESCE(sd.ro_sap_code::TEXT, '')
    AND COALESCE(a.product_code::TEXT, '') = COALESCE(sd.product_code::TEXT, '')
WHERE 
    a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
    AND a.indent_status NOT IN ('Cancelled', 'Completed')
    AND (
        -- Handling aggregation for Monthly, Weekly, Daily

        -- For Monthly: Check if the transaction date is in the current or previous month
        CASE 
            WHEN '{time_grain}' = 'monthly' THEN 
                (DATE_TRUNC('month', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('month', CURRENT_DATE) 
                 OR DATE_TRUNC('month', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'))

        -- For Weekly: Check if the transaction date is in the current or previous week
        WHEN '{time_grain}' = 'weekly' THEN 
            (DATE_TRUNC('week', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('week', CURRENT_DATE)
             OR DATE_TRUNC('week', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week'))

        -- For Daily: Check if the transaction date is in the current or previous day
        WHEN '{time_grain}' = 'daily' THEN 
            (sd.transaction_date::DATE = CURRENT_DATE 
             OR sd.transaction_date::DATE = CURRENT_DATE - INTERVAL '1 day')
        END
    )
GROUP BY 
    product_name, period
ORDER BY 
    avg_total_sales ''',

    'cdcms_current_date_pending_count': f''' select
                                                CAST(SUM("Total_Pending")AS NUMERIC) AS "Total Pending"
                                            from
                                                "lpg_todays_cdcms_sales_summary"
                                            where
                                                "ZOName" IS NOT NULL ''',
                                        
    'cdcms_current_date_bookings_count': f''' select
                                                CAST(SUM("BookingReceivedYesterday")AS NUMERIC) AS "Total Bookings"
                                            from
                                                "lpg_todays_cdcms_sales_summary"
                                            where
                                                "ZOName" IS NOT NULL ''',
                                    
    'cdcms_current_date_sales_count': f''' select
                                            CAST(SUM("TotalSalesYesterday")AS NUMERIC) AS "Total Sales"
                                        from
                                            "lpg_todays_cdcms_sales_summary"
                                        where
                                            "ZOName" IS NOT NULL ''',
    'i_previous_current_month_amount_litres': '''WITH SalesData AS (
    SELECT 
        ro_sap_code, 
        CASE
            WHEN product_no = '1322000' THEN '2811000'
            WHEN product_no = '1683000' THEN '2812000'
            WHEN product_no = '1683100' THEN '3912000'
            WHEN product_no = '1322000' THEN '2822000'
            WHEN product_no = '3672000' THEN '3672000'
            WHEN product_no = '2682000' THEN '2816000'
            WHEN product_no = '3373000' THEN '3373000'
            ELSE NULL
        END AS product_code,
        transaction_date,
        txn_amount,
        total_sales
    FROM "HPCL_HOS".ro_daily_sales
)

SELECT 
    a.location_name,
    CASE 
        WHEN '{time_grain}' = 'monthly' THEN TO_CHAR(DATE_TRUNC('month', sd.transaction_date::TIMESTAMP), 'Mon YYYY')
        WHEN '{time_grain}' = 'weekly' THEN TO_CHAR(DATE_TRUNC('week', sd.transaction_date::TIMESTAMP), 'DD-MM-YYYY')
        WHEN '{time_grain}' = 'daily' THEN TO_CHAR(sd.transaction_date::TIMESTAMP, 'DD-MM-YYYY')
    END AS period,
    AVG(sd.txn_amount) AS avg_txn_amount,
    AVG(sd.total_sales) AS avg_total_sales
FROM 
    public.alerts a
LEFT JOIN 
    SalesData sd
ON 
    COALESCE(a.sap_id::TEXT, '') = COALESCE(sd.ro_sap_code::TEXT, '')
    AND COALESCE(a.product_code::TEXT, '') = COALESCE(sd.product_code::TEXT, '')
WHERE 
    a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
    AND a.indent_status NOT IN ('Cancelled', 'Completed')
    AND (
        -- Handling aggregation for Monthly, Weekly, Daily

        -- For Monthly: Check if the transaction date is in the current or previous month
        CASE 
            WHEN '{time_grain}' = 'monthly' THEN 
                (DATE_TRUNC('month', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('month', CURRENT_DATE) 
                 OR DATE_TRUNC('month', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'))

        -- For Weekly: Check if the transaction date is in the current or previous week
        WHEN '{time_grain}' = 'weekly' THEN 
            (DATE_TRUNC('week', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('week', CURRENT_DATE)
             OR DATE_TRUNC('week', sd.transaction_date::TIMESTAMP) = DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week'))

        -- For Daily: Check if the transaction date is in the current or previous day
        WHEN '{time_grain}' = 'daily' THEN 
            (sd.transaction_date::DATE = CURRENT_DATE 
             OR sd.transaction_date::DATE = CURRENT_DATE - INTERVAL '1 day')
        END
    )
GROUP BY 
    a.location_name,period
ORDER BY 
    avg_txn_amount, avg_total_sales'''
}
