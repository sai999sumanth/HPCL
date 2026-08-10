import urdhva_base
import os
import pandas as pd
import utilities.fiscal_year as fiscal_year


base_path = f"{os.path.dirname(fiscal_year.__file__)}/../orchestrator/masters"
Industry_performance_23_24 = f"{base_path}/industry_data_23-24.csv"
Industry_performance_24_25 = f"{base_path}/industry_data_24-25.csv"
Industry_performance_25_26 = f"{base_path}/industry_data_25-26.csv"
Industry_performance_26_27 = f"{base_path}/industry_data_26-27.csv"
#Industry_performance_25_26 = f"/tmp/industry_data_25-26.csv"


Months = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']
Company_Mapping = {"OIL INDIA LIMITED": "OIL", "RBML": "RIL", "RSIL": "RIL", "SIMPL": "SHELL", "SEIPL": "SHELL",
                   "SMAFSL": "SMA"}


def filter_data_by_month(df, start_month=None, end_month=None):
    # Todo:- write filter
    if not start_month and not end_month:
        return df
    filtered_df = []
    for fis_year in df['FIN_YEAR'].unique().tolist():
        df_filtered = df[df['FIN_YEAR'] == fis_year]
        filtered_months = [month for month in Months]
        if start_month:
            filtered_months = filtered_months[filtered_months.index(start_month.upper()):]
        if end_month:
            filtered_months = filtered_months[:filtered_months.index(end_month.upper())+1]
        df_filtered = df_filtered[df_filtered['MONTH'].isin(filtered_months)]
        filtered_df.append(df_filtered)
    return pd.concat(filtered_df)


def fetch_industry_raw_data(actual=True, history=True, start_month=None, end_month=None):
    """
    To Get dataframe from actual and history
    :param actual: Present Financial year data required or not
    :param history: Last Financial year data required or not
    :param start_month: Start month to consider
    :param end_month: Month to calculate upto
    :return:
    """
    df_a = pd.DataFrame()
    df_h = pd.DataFrame()
    if actual:
        # df_a = pd.read_csv(Industry_performance_25_26)
        df_a = pd.read_csv(Industry_performance_26_27)
        #df_a = df_a[df_a['CATEGORY'] != 'O']
        df_a['FIN_YEAR'] = "2026-2027"
    if history:
        # df_h = pd.read_csv(Industry_performance_24_25)
        df_a = pd.read_csv(Industry_performance_25_26)
        #df_h = df_h[df_h['CATEGORY'] != 'O']
        df_h['FIN_YEAR'] = "2025-2026"
    df = pd.concat([df_a, df_h], ignore_index=True, sort=False)
    df['COMNAME'] = df['COMNAME'].apply(lambda x: Company_Mapping.get(x, x))
    columns = list(set(list(df.columns)) - set(Months))
    df = df.melt(id_vars=columns, value_vars=Months, var_name='MONTH', value_name='VALUE')
    df.fillna('', inplace=True)
    df['COMP_TYPE'] = df['PSU/PVT']
    df = filter_data_by_month(df, start_month, end_month)
    return df


def get_group_by_keys(by_month=False, by_product=False, by_year=True, by_company=True, comp_type=False):
    group_keys = []
    if by_year:
        group_keys.append('FIN_YEAR')
    if by_product:
        group_keys.append('PRODNAME')
    if by_month:
        group_keys.append('MONTH')
    if by_company:
        group_keys.append('COMNAME')
    if comp_type:
        group_keys.append('COMP_TYPE')
    return group_keys


def get_filtered_data(df, filters):
    """
    Function to filter dataframe based on the filters provided
    :param df: Pandas DataFrame
    :param filters: list of dictionaries
    :return: Filtered Pandas DataFrame
    """
    for filter in filters:
        if filter['cond'] in ["=", "equal", "equals"]:
            df = df[df[filter['key']] == filter['value']]
        elif filter['cond'] == "contains":
            df = df[df[filter['key']].isin([k.strip() for k in filter['value'].split(",")])]
    return df


def get_industry_share(actual=True, history=True, start_month=None, end_month=None, by_month=False, by_product=False,
                       comp_type=False, segregate=False, filters=None):
    """
    Function to get industry share based on multiple parameters
    :param actual: Whether present financial year data required or not
    :param history: Whether previous financial year data required or not
    :param start_month: Month from when to consider for calculation
    :param end_month: Month upto where to consider
    :param by_month: (bool) Aggregation by month or year
    :param by_product: Aggregate data by product
    :param comp_type: Aggregate data by company type
    :param segregate: Model required, Segregated data or regular data
    :param filters: List of filters to use, It should be list of dict's
    :return:
    """
    df = fetch_industry_raw_data(actual, history, start_month, end_month)
    if filters:
        df = get_filtered_data(df, filters)
    unique_companies = df['COMNAME'].unique().tolist()
    pres_fiscal_year = fiscal_year.FiscalYear.fiscal_year_start_date
    unique_years = df['FIN_YEAR'].unique().tolist()
    market_size = {rec['FIN_YEAR']: round(rec['VALUE']/1000, 2) for rec in
                   df.groupby(['FIN_YEAR'])['VALUE'].sum().reset_index().to_dict(orient='records')}

    year_mapping = {}
    analysed_data = {}
    com_df = df.groupby(['COMNAME', 'FIN_YEAR'])['VALUE'].sum().reset_index()
    # Calculating Market level performance by Value/Size
    for company in unique_companies:
        com_df_filtered = com_df[com_df['COMNAME'] == company].to_dict(orient='records')
        analysed_data[company] = {}
    # Calculating Market level performance by Percentage


def get_industry_share_old(actual=True, history=True, start_month=None, end_month=None, by_month=False,
                           by_product=False, comp_type=False, segregate=False):
    """
    Function to get industry share based on multiple parameters
    :param actual: Whether present financial year data required or not
    :param history: Whether previous financial year data required or not
    :param start_month: Month from when to consider for calculation
    :param end_month: Month upto where to consider
    :param by_month: (bool) Aggregation by month or year
    :param by_product: Aggregate data by product
    :param comp_type: Aggregate data by company type
    :param segregate: Model required, Segregated data or regular data
    :return:
    """
    df = filter_data_by_month(fetch_industry_raw_data(actual, history), start_month, end_month)
    # industry_share = df.groupby(get_group_by_keys(by_month, by_product,
    #                                               comp_type=comp_type))['VALUE'].sum().reset_index()
    # Todo:- Need to calculate by input values
    unique_companies = df['COMNAME'].unique().tolist()
    unique_years = df['FIN_YEAR'].unique().tolist()
    overall_share = df.groupby(['FIN_YEAR'])['VALUE'].sum().reset_index()
    overall_share['VALUE'] = overall_share['VALUE'].apply(lambda x: round(x/1000, 2))
    overall_share = {rec['FIN_YEAR']: {"share": rec['VALUE'], "avg_share": rec["VALUE"]/len(unique_years)}
                     for rec in overall_share.to_dict(orient='records')}
    psu_share = df[df['Co'].isin(['IOCL', 'HPCL', 'BPCL'])].groupby(['FIN_YEAR'])['VALUE'].sum().reset_index()
    psu_share['VALUE'] = psu_share['VALUE'].apply(lambda x: round(x / 1000, 2))
    psu_share = {rec['FIN_YEAR']: {"share": rec['VALUE'], "avg_share": rec["VALUE"] / len(unique_years)}
                 for rec in psu_share.to_dict(orient='records')}
    company_share = []
    for year in unique_years:
        for company in unique_companies:
            share = round((df[(df['COMNAME'] == company) & (df['FIN_YEAR'] == year)]['VALUE'].sum())/1000, 2)
            share_per = 100 * (share / overall_share[year]['share'])
            if not segregate:
                company_share.append({"COMNAME": company, "FIN_YEAR": year, "CompanySize": share,
                                      "OverAllMarketSize": overall_share[year]['share'],
                                      "PSUSize": psu_share[year]['share'],
                                      "OverAllMarketSizeAvg": overall_share[year]['avg_share'],
                                      "MarketSharePer": round(share_per, 2),
                                      "PSUSharePer": round(100 * (share / psu_share[year]['share']))})
            else:
                company_share.append({"COMNAME": company, "FIN_YEAR": year, "MODEL": "CompanySize", "Value": share})
                company_share.append({"COMNAME": company, "FIN_YEAR": year, "MODEL": "MarketSharePer",
                                      "Value": round(share_per, 2)})
                company_share.append({"COMNAME": company, "FIN_YEAR": year, "MODEL": "PSUSharePer",
                                      "Value": round(100 * (share / psu_share[year]['share']))})
    return company_share


def get_performance_metrics(actual=True, history=True, start_month=None, end_month=None, sbu=None):
    df = filter_data_by_month(fetch_industry_raw_data(actual, history), start_month, end_month)
    if sbu:
        if not isinstance(sbu, list):
            sbu = [sbu]
        df = df[df['SBU'] in sbu]
    company_wise = df.groupby(['FIN_YEAR', 'MONTH', 'COMNAME', 'COMP_TYPE'])['VALUE'].sum().reset_index()
    pivoted_df = company_wise.pivot(index=["COMNAME", "COMP_TYPE", "MONTH"], columns="FIN_YEAR",
                                    values="VALUE").reset_index()
    pivoted_df = pivoted_df.rename(columns={"2023-2024": "LAST_YEAR", "2024-2025": "PRESENT_YEAR"})
    # Calculate the difference and percentage growth
    pivoted_df["VALUE_DIFF"] = pivoted_df["PRESENT_YEAR"] - pivoted_df["LAST_YEAR"]
    pivoted_df["PERCENT_GROWTH"] = (pivoted_df["VALUE_DIFF"] / pivoted_df["LAST_YEAR"]) * 100
    pivoted_df["data_order"] = pivoted_df["MONTH"].map({cond: i for i, cond in enumerate(Months)})
    merged_df = pivoted_df.sort_values("data_order").drop(columns="data_order")
    merged_df.reset_index(drop=True, inplace=True)
    return merged_df.to_dict(orient='records')
