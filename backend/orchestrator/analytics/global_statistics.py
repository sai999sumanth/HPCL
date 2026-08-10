import urdhva_base
from api_manager import hpcl_ceg_model


async def get_global_bu_statistics(bus: list):
    """
    Retrieves global statistics for specified business units.

    Parameters:
    bus (list): A list of business unit identifiers (IDs or names) to retrieve statistics for.

    Returns:
    dict: A dictionary containing aggregated statistics for each business unit in `bus`.

    Functionality:
    - Iterates through each business unit in the provided list.
    - For each business unit, fetches relevant statistics from the data source (database, API, etc.).
    - Aggregates and processes data to generate summary statistics for each business unit.
    - Formats the data into a dictionary structure to be returned to the caller.
    """
    # Define the order and initial structure for response
    resp_order = ['RO', 'TAS', 'LPG', 'CP', 'RDI']
    resp = {key: {"bu": key, "count": 0, "alerts_count": 0, "critical": 0, "high": 0, "medium": 0, "low": 0} for key in resp_order}

    # Main query to get count of each 'bu' from location_master table
    query = "SELECT bu, COUNT(*) FROM location_master GROUP BY bu"
    if bus:
        query += " AND".join(bus)

    # Execute the query
    query_resp = await hpcl_ceg_model.LocationMasterCreate.get_aggr_data(query, limit=1000)
    print("query_resp --> ", query_resp)
    # Update the 'count' for each 'bu' in the response dictionary
    for record in query_resp['data']:  # Loop through `query_resp['data']` instead of `query_resp`
        print(record)
        bu = record['bu']
        count = record['count']
        if bu not in resp:
            resp[bu] = {"count": 0, "alerts_count": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
        resp[bu]["count"] = count

    # Query to get count of each severity level for each 'bu' from alerts table
    alert_query = "SELECT bu, severity, COUNT(*) FROM alerts GROUP BY bu, severity"
    if bus:
        alert_query += " AND".join(bus)

    # Execute the alert query
    alert_resp = await hpcl_ceg_model.LocationMasterCreate.get_aggr_data(alert_query, limit=1000)

    # Update alerts count and severity levels for each 'bu' in the response dictionary
    for record in alert_resp['data']:
        bu = record['bu']
        severity = record['severity'].lower()  # Assuming severity levels are 'critical', 'high', 'medium', 'low'
        count = record['count']
        
        if bu in resp:
            resp[bu]["alerts_count"] += count
            if severity in resp[bu]:  # Check if severity level exists in the dictionary keys
                resp[bu][severity] += count
    return resp
