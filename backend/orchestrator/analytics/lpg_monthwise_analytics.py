"""
LPG Month-wise Analytics Module

Provides functions for month-wise analysis of:
1. Production (MT)
2. Productivity (Cyl/hr)
3. Rejections (%)

Supports data segregation by:
- Zone
- Location (sap_id)
- Overall (National/All locations)
"""

import urdhva_base
import hpcl_ceg_model
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Literal
from collections import defaultdict
from dateutil.relativedelta import relativedelta
from zoneinfo import ZoneInfo


def _parse_date_range(start_date: Optional[str], end_date: Optional[str]) -> tuple:
    """
    Parse date range strings to datetime objects
    
    Args:
        start_date: Start date string (YYYY-MM-DD) or None
        end_date: End date string (YYYY-MM-DD) or None
        
    Returns:
        Tuple of (start_datetime, end_datetime)
    """
    ist = ZoneInfo("Asia/Kolkata")
    today = datetime.now(ist).replace(hour=0, minute=0, second=0, microsecond=0)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=ist)
        except ValueError:
            # Default to 6 months ago
            start_dt = today - relativedelta(months=6)
    else:
        # Default to 6 months ago
        start_dt = today - relativedelta(months=6)
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=ist)
        except ValueError:
            end_dt = today
    else:
        end_dt = today
    
    # Ensure end_date is not in future
    if end_dt > today:
        end_dt = today
    
    return start_dt, end_dt


def _get_month_key(dt: datetime) -> str:
    """
    Get month key in YYYY-MM format
    
    Args:
        dt: Datetime object
        
    Returns:
        Month key string (e.g., "2024-01")
    """
    return dt.strftime("%Y-%m")


def _get_month_name(dt: datetime) -> str:
    """
    Get month name abbreviation
    
    Args:
        dt: Datetime object
        
    Returns:
        Month name (e.g., "Jan", "Feb")
    """
    return dt.strftime("%b")


def _aggregate_by_level(
    df: pd.DataFrame,
    level: Literal["zone", "location", "overall"],
    group_cols: List[str],
    agg_dict: Dict[str, str]
) -> pd.DataFrame:
    """
    Aggregate DataFrame by specified level
    
    Args:
        df: Input DataFrame
        level: Aggregation level (zone, location, overall)
        group_cols: Columns to group by
        agg_dict: Aggregation dictionary {column: function}
        
    Returns:
        Aggregated DataFrame
    """
    if df.empty:
        return df
    
    # Group by specified columns
    grouped = df.groupby(group_cols, as_index=False).agg(agg_dict)
    
    # Round numeric columns
    numeric_cols = grouped.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        grouped[col] = grouped[col].round(2)
    
    return grouped


async def get_monthwise_production(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    zones: Optional[List[str]] = None,
    locations: Optional[List[str]] = None,
    aggregation_level: Literal["zone", "location", "overall"] = "overall"
) -> Dict[str, Any]:
    """
    Get month-wise production data aggregated by zone, location, or overall
    
    Args:
        start_date: Start date string (YYYY-MM-DD), defaults to 6 months
        end_date: End date string (YYYY-MM-DD), defaults to today
        zones: Optional list of zones to filter
        locations: Optional list of SAP IDs to filter
        aggregation_level: Level of aggregation - "zone", "location", or "overall"
        
    Returns:
        Dictionary containing:
        - monthly_data: List of monthly production records
        - summary: Summary statistics
        - total_production: Total production across all months
    """
    start_dt, end_dt = _parse_date_range(start_date, end_date)
    
    # Build query conditions
    conditions = []
    
    # Date condition
    conditions.append(f"process_date >= '{start_dt.date()}'")
    conditions.append(f"process_date <= '{end_dt.date()}'")
    
    # Zone filter
    if zones:
        if len(zones) == 1:
            conditions.append(f"zone = '{zones[0]}'")
        else:
            zone_str = "', '".join(zones)
            conditions.append(f"zone IN ('{zone_str}')")
    
    # Location filter
    if locations:
        if len(locations) == 1:
            conditions.append(f"sap_id = '{locations[0]}'")
        else:
            loc_str = "', '".join(locations)
            conditions.append(f"sap_id IN ('{loc_str}')")
    
    where_clause = " AND ".join(conditions)
    
    # Build query - using lpg_operations_summary table
    query = f"""
        SELECT 
            DATE_TRUNC('month', process_date)::DATE as month_date,
            EXTRACT(YEAR FROM process_date) as year,
            EXTRACT(MONTH FROM process_date) as month,
            zone,
            sap_id,
            name as location_name,
            SUM(bottling_14_2kg) as total_14_2kg,
            SUM(bottling_19kg) as total_19kg,
            SUM(bottling_total) as total_production
        FROM lpg_operations_summary
        WHERE {where_clause}
        GROUP BY 
            DATE_TRUNC('month', process_date),
            zone,
            sap_id,
            name
        ORDER BY month_date ASC
    """
    
    # Execute query
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    data = resp.get("data", [])
    
    if not data:
        return {
            "status": True,
            "message": "No data found",
            "monthly_data": [],
            "summary": {},
            "total_production": 0.0
        }
    
    df = pd.DataFrame(data)
    
    # Convert production to MT (divide by 1000)
    df["production_14_2kg_mt"] = (df["total_14_2kg"] / 1000).round(2)
    df["production_19kg_mt"] = (df["total_19kg"] / 1000).round(2)
    df["total_production_mt"] = (df["total_production"] / 1000).round(2)
    
    # Add month name
    df["month_name"] = pd.to_datetime(df["month_date"]).dt.strftime("%b")
    df["month_year"] = pd.to_datetime(df["month_date"]).dt.strftime("%Y-%m")
    
    # Aggregate based on level
    if aggregation_level == "zone":
        agg_dict = {
            "production_14_2kg_mt": "sum",
            "production_19kg_mt": "sum",
            "total_production_mt": "sum"
        }
        grouped = _aggregate_by_level(df, "zone", ["month_date", "month_year", "month_name", "zone"], agg_dict)
        grouped = grouped.rename(columns={"zone": "group_name"})
        
    elif aggregation_level == "location":
        agg_dict = {
            "production_14_2kg_mt": "sum",
            "production_19kg_mt": "sum",
            "total_production_mt": "sum"
        }
        grouped = _aggregate_by_level(
            df, "location", 
            ["month_date", "month_year", "month_name", "sap_id", "location_name", "zone"], 
            agg_dict
        )
        grouped = grouped.rename(columns={"location_name": "group_name"})
        grouped["group_id"] = grouped["sap_id"]
        
    else:  # overall
        agg_dict = {
            "production_14_2kg_mt": "sum",
            "production_19kg_mt": "sum",
            "total_production_mt": "sum"
        }
        grouped = _aggregate_by_level(df, "overall", ["month_date", "month_year", "month_name"], agg_dict)
        grouped["group_name"] = "Overall"
    
    # Calculate summary statistics
    total_production = float(grouped["total_production_mt"].sum())
    avg_monthly_production = float(grouped["total_production_mt"].mean()) if len(grouped) > 0 else 0.0
    max_month_production = float(grouped["total_production_mt"].max()) if len(grouped) > 0 else 0.0
    min_month_production = float(grouped["total_production_mt"].min()) if len(grouped) > 0 else 0.0
    
    # Find months with max and min production
    max_month_row = grouped.loc[grouped["total_production_mt"].idxmax()] if len(grouped) > 0 else None
    min_month_row = grouped.loc[grouped["total_production_mt"].idxmin()] if len(grouped) > 0 else None
    
    summary = {
        "total_production_mt": round(total_production, 2),
        "average_monthly_production_mt": round(avg_monthly_production, 2),
        "max_monthly_production_mt": round(max_month_production, 2),
        "min_monthly_production_mt": round(min_month_production, 2),
        "max_production_month": max_month_row["month_year"] if max_month_row is not None else None,
        "min_production_month": min_month_row["month_year"] if min_month_row is not None else None,
        "total_months": len(grouped)
    }
    
    return {
        "status": True,
        "message": "Success",
        "aggregation_level": aggregation_level,
        "monthly_data": grouped.to_dict(orient="records"),
        "summary": summary,
        "total_production_mt": round(total_production, 2),
        "date_range": {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d")
        }
    }


async def lpg_operations_monthwise_productivity(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    zones: Optional[List[str]] = None,
    locations: Optional[List[str]] = None,
    aggregation_level: Literal["zone", "location", "overall"] = "overall",
    zone_level_req: bool = True,
    location_level_req: bool = True
) -> Dict[str, Any]:
    """
    Get month-wise productivity data aggregated by zone, location, or overall.
    This function follows the same logic as lpg_operations_daywise_productivity but aggregates by month.
    
    Args:
        start_date: Start date string (YYYY-MM-DD), defaults to 6 months ago
        end_date: End date string (YYYY-MM-DD), defaults to today
        zones: Optional list of zones to filter
        locations: Optional list of SAP IDs to filter
        aggregation_level: Level of aggregation - "zone", "location", or "overall" (for backward compatibility)
        zone_level_req: If True, include zone-level data in response
        location_level_req: If True, include location-level data in response
        
    Returns:
        Dictionary containing monthly productivity data with:
        - overall_data: List of monthly records aggregated at overall level
        - zone_data: List of monthly records aggregated by zone (if zone_level_req=True)
        - location_data: List of monthly records aggregated by location (if location_level_req=True)
        - overall_summary: Summary statistics for overall level
        - zone_summary: Summary statistics for zone level (if zone_level_req=True)
        - location_summary: Summary statistics for location level (if location_level_req=True)
    """
    start_dt, end_dt = _parse_date_range(start_date, end_date)
    
    # Build base query similar to lpg_operations_daywise_productivity
    # Using lpg_plant_operations table
    query = """
        SELECT 
            zone,
            sap_id,
            location_name AS plant,
            filling_head as carousel_type,
            ROUND(SUM(total_production), 2) as total_production,
            ROUND(SUM(total_net_hours), 2) as total_net_hours,
            DATE_TRUNC('month', process_date)::DATE as month_date
        FROM 
            lpg_plant_operations
    """
    
    # Build WHERE conditions
    conditions = []
    conditions.append(f"process_date >= '{start_dt.date()}'")
    conditions.append(f"process_date <= '{end_dt.date()}'")
    
    if zones:
        if len(zones) == 1:
            conditions.append(f"zone = '{zones[0]}'")
        else:
            zone_str = "', '".join(zones)
            conditions.append(f"zone IN ('{zone_str}')")
    
    if locations:
        if len(locations) == 1:
            conditions.append(f"sap_id = '{locations[0]}'")
        else:
            loc_str = "', '".join(locations)
            conditions.append(f"sap_id IN ('{loc_str}')")
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    # Group by month, zone, sap_id, location_name, filling_head (similar to daywise but by month)
    query += """
        GROUP BY 
            DATE_TRUNC('month', process_date),
            zone,
            sap_id,
            location_name,
            filling_head
        ORDER BY month_date ASC
    """
    
    # Execute query
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    data = resp.get("data", [])
    
    if not data:
        return {
            "status": True,
            "message": "No data found",
            "monthly_data": [],
            "summary": {}
        }
    
    df = pd.DataFrame(data)
    
    # Ensure numeric columns are float
    df["total_production"] = df["total_production"].fillna(0).astype(float)
    df["total_net_hours"] = df["total_net_hours"].fillna(0).astype(float)
    
    # Helper function to calculate productivity and summary
    def calculate_productivity_and_summary(grouped_df):
        """Calculate productivity and summary statistics for a grouped dataframe"""
        # Calculate productivity: total_production / total_net_hours
        grouped_df["productivity"] = np.where(
            grouped_df["total_net_hours"] > 0,
            (grouped_df["total_production"] / grouped_df["total_net_hours"]).round(2),
            0.0
        )
        
        # Round numeric columns
        grouped_df["total_production"] = grouped_df["total_production"].round(2)
        grouped_df["total_net_hours"] = grouped_df["total_net_hours"].round(2)
        
        # Calculate summary statistics
        avg_productivity = float(grouped_df["productivity"].mean()) if len(grouped_df) > 0 else 0.0
        max_productivity = float(grouped_df["productivity"].max()) if len(grouped_df) > 0 else 0.0
        min_productivity = float(grouped_df["productivity"].min()) if len(grouped_df) > 0 else 0.0
        total_production = float(grouped_df["total_production"].sum())
        total_net_hours = float(grouped_df["total_net_hours"].sum())
        
        max_month_row = grouped_df.loc[grouped_df["productivity"].idxmax()] if len(grouped_df) > 0 else None
        min_month_row = grouped_df.loc[grouped_df["productivity"].idxmin()] if len(grouped_df) > 0 else None
        
        # Get month_year from month_date for summary
        if len(grouped_df) > 0 and max_month_row is not None:
            max_month_date = max_month_row["month_date"]
            max_month_year = pd.to_datetime(max_month_date).strftime("%Y-%m") if pd.notna(max_month_date) else None
        else:
            max_month_year = None
            
        if len(grouped_df) > 0 and min_month_row is not None:
            min_month_date = min_month_row["month_date"]
            min_month_year = pd.to_datetime(min_month_date).strftime("%Y-%m") if pd.notna(min_month_date) else None
        else:
            min_month_year = None
        
        summary = {
            "average_productivity": round(avg_productivity, 2),
            "max_productivity": round(max_productivity, 2),
            "min_productivity": round(min_productivity, 2),
            "max_productivity_month": max_month_year,
            "min_productivity_month": min_month_year,
            "total_production": round(total_production, 2),
            "total_net_hours": round(total_net_hours, 2),
            "overall_productivity": round(total_production / total_net_hours, 2) if total_net_hours > 0 else 0.0
        }
        
        return grouped_df, summary
    
    # Always calculate overall level data
    overall_grouped = df.groupby(["month_date"], as_index=False).agg({
        "total_production": "sum",
        "total_net_hours": "sum"
    })
    overall_grouped, overall_summary = calculate_productivity_and_summary(overall_grouped)
    # Keep only month_date, total_production, total_net_hours, productivity
    overall_grouped = overall_grouped[["month_date", "total_production", "total_net_hours", "productivity"]]
    
    # Initialize response
    response = {
        "status": True,
        "message": "Success",
        "overall_data": overall_grouped.to_dict(orient="records"),
        "overall_summary": overall_summary,
        "date_range": {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d")
        }
    }
    
    # Calculate zone level data if requested
    if zone_level_req:
        zone_grouped = df.groupby(["month_date", "zone"], as_index=False).agg({
            "total_production": "sum",
            "total_net_hours": "sum"
        })
        zone_grouped, zone_summary = calculate_productivity_and_summary(zone_grouped)
        # Keep only month_date, zone, total_production, total_net_hours, productivity
        zone_grouped = zone_grouped[["month_date", "zone", "total_production", "total_net_hours", "productivity"]]
        response["zone_data"] = zone_grouped.to_dict(orient="records")
        response["zone_summary"] = zone_summary
    
    # Calculate location level data if requested
    if location_level_req:
        location_grouped = df.groupby(
            ["month_date", "sap_id", "plant", "zone"], 
            as_index=False
        ).agg({
            "total_production": "sum",
            "total_net_hours": "sum"
        })
        location_grouped, location_summary = calculate_productivity_and_summary(location_grouped)
        # Rename plant to location and keep only required fields
        location_grouped = location_grouped.rename(columns={"plant": "location"})
        # Keep only month_date, location, group_id, zone, total_production, total_net_hours, productivity
        location_grouped = location_grouped[["month_date", "location", "sap_id", "zone", "total_production", "total_net_hours", "productivity"]]
        response["location_data"] = location_grouped.to_dict(orient="records")
        response["location_summary"] = location_summary
    
    # For backward compatibility, include the old structure if aggregation_level is specified
    if aggregation_level != "overall":
        if aggregation_level == "zone" and zone_level_req:
            response["monthly_data"] = response.get("zone_data", [])
            response["summary"] = response.get("zone_summary", {})
        elif aggregation_level == "location" and location_level_req:
            response["monthly_data"] = response.get("location_data", [])
            response["summary"] = response.get("location_summary", {})
        else:
            response["monthly_data"] = response["overall_data"]
            response["summary"] = response["overall_summary"]
    else:
        response["monthly_data"] = response["overall_data"]
        response["summary"] = response["overall_summary"]
    
    response["aggregation_level"] = aggregation_level
    
    return response


async def lpg_operations_monthwise_rejections(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    zones: Optional[List[str]] = None,
    locations: Optional[List[str]] = None,
    aggregation_level: Literal["zone", "location", "overall"] = "overall",
    rejection_type: Literal["cs", "pt", "gd", "all"] = "all",
    zone_level_req: bool = True,
    location_level_req: bool = True
) -> Dict[str, Any]:
    """
    Get month-wise rejection data aggregated by zone, location, or overall.
    This function follows the same logic as lpg_operations_rejections but aggregates by month.
    
    Args:
        start_date: Start date string (YYYY-MM-DD), defaults to 12 months ago
        end_date: End date string (YYYY-MM-DD), defaults to today
        zones: Optional list of zones to filter
        locations: Optional list of SAP IDs to filter
        aggregation_level: Level of aggregation - "zone", "location", or "overall" (for backward compatibility)
        rejection_type: Type of rejection - "cs", "pt", "gd", or "all"
        zone_level_req: If True, include zone-level data in response
        location_level_req: If True, include location-level data in response
        
    Returns:
        Dictionary containing monthly rejection data with:
        - overall_data: List of monthly records aggregated at overall level
        - zone_data: List of monthly records aggregated by zone (if zone_level_req=True)
        - location_data: List of monthly records aggregated by location (if location_level_req=True)
        - overall_summary: Summary statistics for overall level
        - zone_summary: Summary statistics for zone level (if zone_level_req=True)
        - location_summary: Summary statistics for location level (if location_level_req=True)
    """
    start_dt, end_dt = _parse_date_range(start_date, end_date)
    
    # Build base query similar to lpg_operations_rejections
    # Using lpg_plant_operations table
    query = """
        SELECT 
            zone,
            sap_id,
            location_name AS plant,
            filling_head as carousel_type,
            DATE_TRUNC('month', process_date)::DATE as month_date,
            SUM(cs_handled) as cs_handled,
            SUM(cs_sortout) as cs_sortout,
            SUM(pt_handled) as pt_handled,
            SUM(pt_sortout) as pt_sortout,
            SUM(gd_handled) as gd_handled,
            SUM(gd_sortout) as gd_sortout
        FROM 
            lpg_plant_operations
    """
    
    # Build WHERE conditions
    conditions = []
    conditions.append(f"process_date >= '{start_dt.date()}'")
    conditions.append(f"process_date <= '{end_dt.date()}'")
    conditions.append("zone IS NOT NULL")
    
    if zones:
        if len(zones) == 1:
            conditions.append(f"zone = '{zones[0]}'")
        else:
            zone_str = "', '".join(zones)
            conditions.append(f"zone IN ('{zone_str}')")
    
    if locations:
        if len(locations) == 1:
            conditions.append(f"sap_id = '{locations[0]}'")
        else:
            loc_str = "', '".join(locations)
            conditions.append(f"sap_id IN ('{loc_str}')")
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    # Group by month, zone, sap_id, location_name, filling_head
    query += """
        GROUP BY 
            DATE_TRUNC('month', process_date),
            zone,
            sap_id,
            location_name,
            filling_head
        ORDER BY month_date ASC
    """
    
    # Execute query
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    data = resp.get("data", [])
    
    if not data:
        return {
            "status": True,
            "message": "No data found",
            "overall_data": [],
            "overall_summary": {}
        }
    
    df = pd.DataFrame(data)
    
    # Ensure numeric columns are float
    for col in ["cs_handled", "cs_sortout", "pt_handled", "pt_sortout", "gd_handled", "gd_sortout"]:
        df[col] = df[col].fillna(0).astype(float)
    
    # Helper function to calculate rejections and summary
    def calculate_rejections_and_summary(grouped_df, rej_type):
        """Calculate rejection percentages and summary statistics for a grouped dataframe"""
        # Calculate rejection percentages based on type
        if rej_type == "cs":
            grouped_df["rejection_percent"] = np.where(
                grouped_df["cs_handled"] > 0,
                (grouped_df["cs_sortout"] / grouped_df["cs_handled"] * 100).round(2),
                0.0
            )
        elif rej_type == "pt":
            grouped_df["rejection_percent"] = np.where(
                grouped_df["pt_handled"] > 0,
                (grouped_df["pt_sortout"] / grouped_df["pt_handled"] * 100).round(2),
                0.0
            )
        elif rej_type == "gd":
            grouped_df["rejection_percent"] = np.where(
                grouped_df["gd_handled"] > 0,
                (grouped_df["gd_sortout"] / grouped_df["gd_handled"] * 100).round(2),
                0.0
            )
        else:  # all
            # Calculate all three types
            grouped_df["cs_rejection_percent"] = np.where(
                grouped_df["cs_handled"] > 0,
                (grouped_df["cs_sortout"] / grouped_df["cs_handled"] * 100).round(2),
                0.0
            )
            grouped_df["pt_rejection_percent"] = np.where(
                grouped_df["pt_handled"] > 0,
                (grouped_df["pt_sortout"] / grouped_df["pt_handled"] * 100).round(2),
                0.0
            )
            grouped_df["gd_rejection_percent"] = np.where(
                grouped_df["gd_handled"] > 0,
                (grouped_df["gd_sortout"] / grouped_df["gd_handled"] * 100).round(2),
                0.0
            )
            # Calculate overall average rejection
            grouped_df["rejection_percent"] = (
                grouped_df["cs_rejection_percent"].fillna(0) +
                grouped_df["pt_rejection_percent"].fillna(0) +
                grouped_df["gd_rejection_percent"].fillna(0)
            ) / 3
        
        # Round rejection percentages
        if "rejection_percent" in grouped_df.columns:
            grouped_df["rejection_percent"] = grouped_df["rejection_percent"].round(2)
        for col in ["cs_rejection_percent", "pt_rejection_percent", "gd_rejection_percent"]:
            if col in grouped_df.columns:
                grouped_df[col] = grouped_df[col].round(2)
        
        # Calculate summary statistics
        summary_col = "rejection_percent"
        avg_rejection = float(grouped_df[summary_col].mean()) if len(grouped_df) > 0 else 0.0
        max_rejection = float(grouped_df[summary_col].max()) if len(grouped_df) > 0 else 0.0
        min_rejection = float(grouped_df[summary_col].min()) if len(grouped_df) > 0 else 0.0
        
        max_month_row = grouped_df.loc[grouped_df[summary_col].idxmax()] if len(grouped_df) > 0 else None
        min_month_row = grouped_df.loc[grouped_df[summary_col].idxmin()] if len(grouped_df) > 0 else None
        
        # Get month_year from month_date for summary
        if len(grouped_df) > 0 and max_month_row is not None:
            max_month_date = max_month_row["month_date"]
            max_month_year = pd.to_datetime(max_month_date).strftime("%Y-%m") if pd.notna(max_month_date) else None
        else:
            max_month_year = None
            
        if len(grouped_df) > 0 and min_month_row is not None:
            min_month_date = min_month_row["month_date"]
            min_month_year = pd.to_datetime(min_month_date).strftime("%Y-%m") if pd.notna(min_month_date) else None
        else:
            min_month_year = None
        
        summary = {
            "average_rejection_percent": round(avg_rejection, 2),
            "max_rejection_percent": round(max_rejection, 2),
            "min_rejection_percent": round(min_rejection, 2),
            "max_rejection_month": max_month_year,
            "min_rejection_month": min_month_year,
            "rejection_type": rej_type
        }
        
        return grouped_df, summary
    
    # Process rejections based on type
    if rejection_type == "cs":
        # Sum handled and sortout, then calculate rejection
        overall_grouped = df.groupby(["month_date"], as_index=False).agg({
            "cs_handled": "sum",
            "cs_sortout": "sum"
        })
        overall_grouped, overall_summary = calculate_rejections_and_summary(overall_grouped, "cs")
        overall_grouped = overall_grouped[["month_date", "rejection_percent"]]
        overall_grouped = overall_grouped.rename(columns={"rejection_percent": "cs_rejection_percent"})
        
    elif rejection_type == "pt":
        overall_grouped = df.groupby(["month_date"], as_index=False).agg({
            "pt_handled": "sum",
            "pt_sortout": "sum"
        })
        overall_grouped, overall_summary = calculate_rejections_and_summary(overall_grouped, "pt")
        overall_grouped = overall_grouped[["month_date", "rejection_percent"]]
        overall_grouped = overall_grouped.rename(columns={"rejection_percent": "pt_rejection_percent"})
        
    elif rejection_type == "gd":
        overall_grouped = df.groupby(["month_date"], as_index=False).agg({
            "gd_handled": "sum",
            "gd_sortout": "sum"
        })
        overall_grouped, overall_summary = calculate_rejections_and_summary(overall_grouped, "gd")
        overall_grouped = overall_grouped[["month_date", "rejection_percent"]]
        overall_grouped = overall_grouped.rename(columns={"rejection_percent": "gd_rejection_percent"})
        
    else:  # all
        overall_grouped = df.groupby(["month_date"], as_index=False).agg({
            "cs_handled": "sum",
            "cs_sortout": "sum",
            "pt_handled": "sum",
            "pt_sortout": "sum",
            "gd_handled": "sum",
            "gd_sortout": "sum"
        })
        overall_grouped, overall_summary = calculate_rejections_and_summary(overall_grouped, "all")
        overall_grouped = overall_grouped[["month_date", "cs_rejection_percent", "pt_rejection_percent", "gd_rejection_percent", "rejection_percent"]]
    
    # Initialize response
    response = {
        "status": True,
        "message": "Success",
        "overall_data": overall_grouped.to_dict(orient="records"),
        "overall_summary": overall_summary,
        "date_range": {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d")
        }
    }
    
    # Calculate zone level data if requested
    if zone_level_req:
        if rejection_type == "cs":
            zone_grouped = df.groupby(["month_date", "zone"], as_index=False).agg({
                "cs_handled": "sum",
                "cs_sortout": "sum"
            })
            zone_grouped, zone_summary = calculate_rejections_and_summary(zone_grouped, "cs")
            zone_grouped = zone_grouped[["month_date", "zone", "rejection_percent"]]
            zone_grouped = zone_grouped.rename(columns={"rejection_percent": "cs_rejection_percent"})
            
        elif rejection_type == "pt":
            zone_grouped = df.groupby(["month_date", "zone"], as_index=False).agg({
                "pt_handled": "sum",
                "pt_sortout": "sum"
            })
            zone_grouped, zone_summary = calculate_rejections_and_summary(zone_grouped, "pt")
            zone_grouped = zone_grouped[["month_date", "zone", "rejection_percent"]]
            zone_grouped = zone_grouped.rename(columns={"rejection_percent": "pt_rejection_percent"})
            
        elif rejection_type == "gd":
            zone_grouped = df.groupby(["month_date", "zone"], as_index=False).agg({
                "gd_handled": "sum",
                "gd_sortout": "sum"
            })
            zone_grouped, zone_summary = calculate_rejections_and_summary(zone_grouped, "gd")
            zone_grouped = zone_grouped[["month_date", "zone", "rejection_percent"]]
            zone_grouped = zone_grouped.rename(columns={"rejection_percent": "gd_rejection_percent"})
            
        else:  # all
            zone_grouped = df.groupby(["month_date", "zone"], as_index=False).agg({
                "cs_handled": "sum",
                "cs_sortout": "sum",
                "pt_handled": "sum",
                "pt_sortout": "sum",
                "gd_handled": "sum",
                "gd_sortout": "sum"
            })
            zone_grouped, zone_summary = calculate_rejections_and_summary(zone_grouped, "all")
            zone_grouped = zone_grouped[["month_date", "zone", "cs_rejection_percent", "pt_rejection_percent", "gd_rejection_percent", "rejection_percent"]]
        
        response["zone_data"] = zone_grouped.to_dict(orient="records")
        response["zone_summary"] = zone_summary
    
    # Calculate location level data if requested
    if location_level_req:
        if rejection_type == "cs":
            location_grouped = df.groupby(
                ["month_date", "sap_id", "plant", "zone"], 
                as_index=False
            ).agg({
                "cs_handled": "sum",
                "cs_sortout": "sum"
            })
            location_grouped, location_summary = calculate_rejections_and_summary(location_grouped, "cs")
            location_grouped = location_grouped.rename(columns={"plant": "location"})
            location_grouped["group_id"] = location_grouped["sap_id"]
            location_grouped = location_grouped[["month_date", "location", "group_id", "zone", "rejection_percent"]]
            location_grouped = location_grouped.rename(columns={"rejection_percent": "cs_rejection_percent"})
            
        elif rejection_type == "pt":
            location_grouped = df.groupby(
                ["month_date", "sap_id", "plant", "zone"], 
                as_index=False
            ).agg({
                "pt_handled": "sum",
                "pt_sortout": "sum"
            })
            location_grouped, location_summary = calculate_rejections_and_summary(location_grouped, "pt")
            location_grouped = location_grouped.rename(columns={"plant": "location"})
            location_grouped["group_id"] = location_grouped["sap_id"]
            location_grouped = location_grouped[["month_date", "location", "group_id", "zone", "rejection_percent"]]
            location_grouped = location_grouped.rename(columns={"rejection_percent": "pt_rejection_percent"})
            
        elif rejection_type == "gd":
            location_grouped = df.groupby(
                ["month_date", "sap_id", "plant", "zone"], 
                as_index=False
            ).agg({
                "gd_handled": "sum",
                "gd_sortout": "sum"
            })
            location_grouped, location_summary = calculate_rejections_and_summary(location_grouped, "gd")
            location_grouped = location_grouped.rename(columns={"plant": "location"})
            location_grouped["group_id"] = location_grouped["sap_id"]
            location_grouped = location_grouped[["month_date", "location", "group_id", "zone", "rejection_percent"]]
            location_grouped = location_grouped.rename(columns={"rejection_percent": "gd_rejection_percent"})
            
        else:  # all
            location_grouped = df.groupby(
                ["month_date", "sap_id", "plant", "zone"], 
                as_index=False
            ).agg({
                "cs_handled": "sum",
                "cs_sortout": "sum",
                "pt_handled": "sum",
                "pt_sortout": "sum",
                "gd_handled": "sum",
                "gd_sortout": "sum"
            })
            location_grouped, location_summary = calculate_rejections_and_summary(location_grouped, "all")
            location_grouped = location_grouped.rename(columns={"plant": "location"})
            location_grouped = location_grouped[["month_date", "location", "sap_id", "zone", "cs_rejection_percent", "pt_rejection_percent", "gd_rejection_percent", "rejection_percent"]]
        
        response["location_data"] = location_grouped.to_dict(orient="records")
        response["location_summary"] = location_summary
    
    # For backward compatibility, include the old structure if aggregation_level is specified
    if aggregation_level != "overall":
        if aggregation_level == "zone" and zone_level_req:
            response["monthly_data"] = response.get("zone_data", [])
            response["summary"] = response.get("zone_summary", {})
        elif aggregation_level == "location" and location_level_req:
            response["monthly_data"] = response.get("location_data", [])
            response["summary"] = response.get("location_summary", {})
        else:
            response["monthly_data"] = response["overall_data"]
            response["summary"] = response["overall_summary"]
    else:
        response["monthly_data"] = response["overall_data"]
        response["summary"] = response["overall_summary"]
    
    response["aggregation_level"] = aggregation_level
    response["rejection_type"] = rejection_type
    
    return response
