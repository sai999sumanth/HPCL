import urdhva_base
import requests
import json
import polars as pl
from datetime import datetime, timezone, timedelta
import pytz

def fetch_va_cleanliness_data():
    ist = pytz.timezone("Asia/Kolkata")
    current_ist_timestamp = datetime.now(ist).strftime("%Y%m%d%H%M%S")
    print(current_ist_timestamp)

    today_utc = datetime.now(timezone.utc).date()
    end_date_utc = today_utc - timedelta(days=1)
    start_date_utc = today_utc - timedelta(days=2)
    
    print("StartDAte (UTC):", start_date_utc)
    print("EndDate (UTC):", end_date_utc)

    API_URL = f'https://va.hpcl.co.in/api/Dashboard/v2/HPCL/CleanlinessCount?StartDate={start_date_utc}%2018%3A30%3A00&EndDate={end_date_utc}%2018%3A29%3A59&Region=HPCL&RegionType=HQ'

    HEADERS = {
        "sec-ch-ua-platform": "Windows",
        "Timestamp": f"{current_ist_timestamp}",
        "sec-ch-ua": 'Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        "sec-ch-ua-mobile": "?0",
        "ZUMO-API-VERSION": "2.0.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "MessageId": f"GET_CLEANLINESS_COUNT{current_ist_timestamp}",
        "OS": "WEB",
        "Cache-Control": "no-store",
        "ApplicationId": "6eec1c22-26f4-4180-ae7f-f054de6d98d1",
        "Referer": "https://va.hpcl.co.in/home/dashboard/3226ab2e-c8ea-40ac-9c18-449155fef756",
        "CustId": "3226ab2e-c8ea-40ac-9c18-449155fef756",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
        "UserId": "ceaf0813-0100-4adf-903b-9a7f43d132c2",
        "SessionToken": "eabd02b6-490e-4a9c-8705-0d985552c2c5"
    }
    print('*'*200)
    print("VA API ---->", API_URL)
    print("HEADERS ---->", HEADERS)
    print('*'*200)
    response = requests.get(API_URL, headers=HEADERS, timeout=60)
    response.raise_for_status()  # raises error if API fails
    return response.json()


# --------------------------------------------------
# 3. PARSE RESPONSE (DOUBLE JSON DECODE)
# --------------------------------------------------
def parse_payload(api_response: dict) -> list:
    """
    Payload is returned as STRING → needs json.loads again
    """
    payload_str = api_response["RespBody"]["Payload"]
    payload_data = json.loads(payload_str)
    return payload_data


# --------------------------------------------------
# 4. CONVERT TO POLARS DATAFRAME
# --------------------------------------------------
def create_dataframe(payload_data: list) -> pl.DataFrame:
    df = pl.DataFrame(payload_data)
    return df


# --------------------------------------------------
# 5. EXPORT TO EXCEL (OPTIONAL)
# --------------------------------------------------
def export_to_excel(df: pl.DataFrame, filename: str):
    output_path = "/tmp/" + filename
    df.write_excel(output_path)
    print(f"Excel exported to: {output_path.absolute()}")


# --------------------------------------------------
# 6. MAIN EXECUTION
# --------------------------------------------------
def main():
    try:
        print("Fetching API data...")
        api_response = fetch_va_cleanliness_data()

        print('*' * 50)
        print(api_response)
        print('*' * 50)

        

        print("Parsing payload...")
        payload_data = parse_payload(api_response)

        print('*' * 50)
        print(payload_data)
        print('*' * 50)

        print("Creating DataFrame...")
        df = create_dataframe(payload_data)

        df = df.drop(["RankByOverallScore", "RegionId", "UncleanSitesCount","PendingSitesCount","WrongImagesCount","OverallScore","OverallScore","SiteStatus"])

        df = df.rename({
            "Region": "Zone",
            "TotalOutlets": "Total Outlets",
            "UplaodedSitesCount": "Image Uploaded",
            "CleanSitesCount": "Clean Images"
        })

        final_cols = [
            "Zone",
            "Total Outlets",
            "Image Uploaded",
            "% Uploaded",
            "Clean Images",
            "% ROs with Clean image"
        ]


        df = df.with_columns([
            ((pl.col("Image Uploaded") / pl.col("Total Outlets")) * 100)
                .round(0).cast(pl.Int64).alias("% Uploaded"),

            ((pl.col("Clean Images") / pl.col("Total Outlets")) * 100)
                .round(0).cast(pl.Int64).alias("% ROs with Clean image")
        ]).select(final_cols)


        total_row = pl.DataFrame({
            "Zone": ["TOTAL"],
            "Total Outlets": [df["Total Outlets"].sum()],
            "Image Uploaded": [df["Image Uploaded"].sum()],
            "% Uploaded": [
                round(
                    (df["Image Uploaded"].sum() / df["Total Outlets"].sum()) * 100
                )
            ],
            "Clean Images": [df["Clean Images"].sum()],
            "% ROs with Clean image": [
                round(
                    (df["Clean Images"].sum() / df["Total Outlets"].sum()) * 100
                )
            ]
        }).select(final_cols)

        df = pl.concat([df, total_row])

        df = df.with_columns([
            (pl.col("% Uploaded").cast(pl.Utf8) + "%").alias("% Uploaded"),
            (pl.col("% ROs with Clean image").cast(pl.Utf8) + "%")
                .alias("% ROs with Clean image")
        ])

        df = df.select([
            "Zone",
            "Total Outlets",
            "Image Uploaded",
            "% Uploaded",
            "Clean Images",
            "% ROs with Clean image"
        ])

        df = df.rename({
            "Total Outlets": "Total Outlets (Active)"
        })

        return {
            "ro_va_cleanliness_df": df,
            "ro_va_cleanliness_rows": df.to_dicts()
        }
    
    except Exception as e:
        print("Error occurred:")
        print(e)

# --------------------------------------------------
# RUN
# --------------------------------------------------
if __name__ == "__main__":
    main()
