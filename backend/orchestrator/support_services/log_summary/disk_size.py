import urdhva_base
import pandas as pd
import asyncio
import pytz
import subprocess
import paramiko
import psycopg2
from psycopg2 import Error
from datetime import datetime
import orchestrator.notification_manager.notification_factory
import io
import base64
import tempfile
import os
import orchestrator.dbconnector.credential_loader as credential_loader

# Database configuration for dev 162 (PostgreSQL) - NEW ADDITION

creds = credential_loader.get_credentials("HPCL_DEV")

DB_CONFIG = {
    'host': creds['host'],
    'database': creds['database'],
    'user': creds['user'],
    'password': creds['password'],
    'port': creds['port']
}

# List of servers to check, adjust IP range as needed
servers = [f"10.90.38.{i}" for i in range(211, 223)]
ssh_username = urdhva_base.settings.novex_user
ssh_password = urdhva_base.settings.novex_password  # confirm if this password is correct otherwise update


# NEW FUNCTION - Clean old data to keep only 7 days
async def cleanup_old_disk_usage_data():
    """Remove disk usage data older than 7 days to maintain only 7 days of records"""
    connection = None
    cursor = None
    try:
        print("Connecting to PostgreSQL database for cleanup...")
        connection = psycopg2.connect(**DB_CONFIG)
        cursor = connection.cursor()

        # Delete records older than 7 days
        cleanup_query = """
        DELETE FROM disk_usage
        WHERE created_at < NOW() - INTERVAL '7 days'
        """

        cursor.execute(cleanup_query)
        deleted_count = cursor.rowcount
        connection.commit()

        if deleted_count > 0:
            print(f"Successfully deleted {deleted_count} old records (older than 7 days)")
        else:
            print("No old records found to delete")

    except Exception as e:
        print(f"Error cleaning up old disk usage data: {e}")
        if connection:
            connection.rollback()
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# NEW FUNCTION - Insert only filtered CSV data to database
async def insert_disk_usage_to_database(all_reports):
    """Insert only filtered disk usage data (>60%) to PostgreSQL database - same as CSV data"""
    connection = None
    cursor = None
    try:
        print("Connecting to PostgreSQL database for filtered disk usage data...")
        connection = psycopg2.connect(**DB_CONFIG)
        cursor = connection.cursor()

        # Create table if it doesn't exist
        create_table_query = """
        CREATE TABLE IF NOT EXISTS disk_usage (
            id SERIAL PRIMARY KEY,
            server VARCHAR(20) NOT NULL,
            filesystem TEXT NOT NULL,
            size VARCHAR(20),
            used VARCHAR(20),
            avail VARCHAR(20),
            use_percent VARCHAR(10),
            mounted_on VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        cursor.execute(create_table_query)

        # Insert data for each server - ONLY FILTERED DATA (>60%)
        insert_query = """
        INSERT INTO disk_usage (server, filesystem, size, used, avail, use_percent, mounted_on)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """

        total_records = 0
        for server, df in all_reports.items():
            # Filter data same as CSV - only >60% usage
            filtered_df = filter_high_usage(df, threshold=60)

            # Skip if no high usage partitions
            if filtered_df.empty:
                print(f"No high usage partitions (>60%) found for {server}")
                continue

            # Insert only filtered records (same as CSV data)
            for _, row in filtered_df.iterrows():
                try:
                    cursor.execute(insert_query, (
                        server,
                        row.get('Filesystem', ''),
                        row.get('Size', ''),
                        row.get('Used', ''),
                        row.get('Avail', ''),
                        row.get('Use%', ''),
                        row.get('Mounted on', '')
                    ))
                    total_records += 1
                except Exception as row_error:
                    print(f"Error inserting row for {server}: {row_error}")
                    continue

        connection.commit()
        print(f"Successfully inserted {total_records} filtered disk usage records (>60%) into database")

    except Exception as e:
        print(f"Error inserting filtered disk usage data to database: {e}")
        if connection:
            connection.rollback()
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


def fetch_disk_usage(host):
    try:
        if host == "10.90.38.211":
            # Local execution for this host
            result = subprocess.run(['df', '-h'], capture_output=True, text=True, check=True)
            output = result.stdout
        else:
            # Remote execution via SSH
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(host, username=ssh_username, password=ssh_password, timeout=10)
            stdin, stdout, stderr = ssh.exec_command("df -h")
            output = stdout.read().decode()
            ssh.close()

        lines = output.strip().split('\n')
        columns = ['Filesystem', 'Size', 'Used', 'Avail', 'Use%', 'Mounted on']
        data = []

        # Parse lines while handling multiple words in Filesystem column
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 6:
                fs = ' '.join(parts[0:len(parts) - 5])
                size, used, avail, use_percent, mount = parts[-5:]
                data.append([fs, size, used, avail, use_percent, mount])

        df = pd.DataFrame(data, columns=columns)
        return host, df

    except Exception as e:
        # Return error info in a DataFrame if exception occurs
        return host, pd.DataFrame({"Error": [str(e)]})


def parse_usage(usage_str):
    """Convert Use% string value like '77%' to integer 77 safely."""
    try:
        # Handle both string and numeric inputs
        if usage_str is None or usage_str == '':
            return 0
        
        # Convert to string and clean it
        usage_clean = str(usage_str).strip().replace('%', '')
        
        # Handle empty string after cleaning
        if not usage_clean:
            return 0
            
        # Convert to integer
        return int(usage_clean)
    except (ValueError, TypeError) as e:
        print(f"Warning: Could not parse usage '{usage_str}': {e}")
        return 0


def filter_high_usage(df, threshold=60):
    """
    Return rows with 'Use%' greater than threshold (includes 100% case).
    If no 'Use%' column or empty df, returns empty DataFrame.
    """
    if "Use%" not in df.columns:
        return pd.DataFrame()  # no Use% column means no data to filter
    usage_series = df['Use%'].apply(parse_usage)
    filtered_df = df[usage_series > threshold].reset_index(drop=True)
    return filtered_df


def create_csv_attachment(all_reports, file_timestamp):
    """Create CSV file for attachment with all filtered data"""
    csv_data = []

    for server, df in all_reports.items():
        filtered_df = filter_high_usage(df, threshold=60)

        # Add server column to each row
        if not filtered_df.empty:
            filtered_df_copy = filtered_df.copy()
            filtered_df_copy.insert(0, 'Server', server)
            csv_data.append(filtered_df_copy)

    if csv_data:
        # Combine all server data into one DataFrame
        combined_df = pd.concat(csv_data, ignore_index=True)

        # Create temporary file
        temp_dir = tempfile.gettempdir()
        csv_filename = f"disk_usage_report_{file_timestamp}.csv"
        csv_filepath = os.path.join(temp_dir, csv_filename)

        # Save to file
        combined_df.to_csv(csv_filepath, index=False)
        return csv_filepath

    return None


async def send_disk_report(all_reports):
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist).strftime('%d-%m-%Y %I:%M %p IST')
    file_timestamp = datetime.now(ist).strftime('%d-%m-%Y_%H-%M')

    html_tables = ""
    for server, df in all_reports.items():
        filtered_df = filter_high_usage(df, threshold=60)

        # Skip servers with no partitions above threshold
        if filtered_df.empty:
            continue

        try:
            # No special styling applied now, just plain table
            html_table = filtered_df.to_html(index=False, border=0, justify='center', classes='disk-table',
                                             escape=False)
        except Exception:
            # Fallback to something very basic
            html_table = filtered_df.to_html(index=False)

        html_tables += f"<h3>Server: {server}</h3>{html_table}<br><br>"

    if not html_tables:
        html_tables = "<p>No disk partitions with usage above 60% found on monitored servers.</p>"

    html_body = f"""
    <html>
    <head>
        <style>
            .disk-table {{
                font-family: Arial, sans-serif;
                border-collapse: collapse;
                width: 100%;
            }}
            .disk-table th, .disk-table td {{
                border: 1px solid #dddddd;
                text-align: left;
                padding: 8px;
            }}
            .disk-table th {{
                background-color: #d32f2f;  /* red header for high alert */
                color: white;
            }}
            h3 {{
                color: black;
                margin-top: 30px;
                margin-bottom: 10px;
            }}
        </style>
    </head>
    <body>
        <p>Hello,</p>
        <p>Below is the <b>disk usage report (only partitions &gt; 60%)</b> from all monitored servers.</p>
        <p>Generated at: <b>{now_ist}</b></p>
        <p><i>Please find the detailed CSV report attached for your reference.</i></p>
        <br>
        {html_tables}
        <br><br>
        Regards,<br>
        Disk Usage Monitor
    </body>
    </html>
    """

    # Create CSV attachment
    csv_filepath = create_csv_attachment(all_reports, file_timestamp)

    for attempt in range(1, 4):
        try:
            ins = await orchestrator.notification_manager.notification_factory.get_notification_module("email")

            # Prepare email parameters
            email_params = {
                "subject": f"Disk Usage Report - {now_ist}",
                "recipients": [
                    "sreedhar.maddipati@algofusiontech.com",
                    "bala@algofusiontech.com",
                    "venu@algofusiontech.com",
                    "moufikali@algofusiontech.com",
                    "yesu.p@algofusiontech.com",
                    "manohar.v@algofusiontech.com",
                    "mohith.p@algofusiontech.com",
                    "pawann.k@algofusiontech.com",
                    "poojitha.gumma@algofusiontech.com"
                ],
                "html_content": True,
                "body": html_body,
                "force_send": True
            }

            # Add attachment if CSV file exists
            if csv_filepath and os.path.exists(csv_filepath):
                email_params["attachments"] = [csv_filepath]

            await ins.publish_message(**email_params)
            print("Email sent successfully with CSV attachment.")

            # Clean up temporary file
            if csv_filepath and os.path.exists(csv_filepath):
                try:
                    os.remove(csv_filepath)
                    print("Temporary CSV file cleaned up.")
                except Exception as cleanup_error:
                    print(f"Warning: Could not clean up temporary file {csv_filepath}: {cleanup_error}")

            break
        except Exception as e:
            print(f"Attempt {attempt} - Failed to send email: {e}")
            if attempt == 3:
                print("All retries failed. Giving up.")
                # Clean up temporary file even on failure
                if csv_filepath and os.path.exists(csv_filepath):
                    try:
                        os.remove(csv_filepath)
                    except Exception:
                        pass


async def main():
    all_reports = {}
    for server in servers:
        print(f"Checking {server}...")
        host, df = fetch_disk_usage(server)
        all_reports[host] = df

    # NEW ADDITION: Clean old data first (keep only 7 days)
    await cleanup_old_disk_usage_data()

    # NEW ADDITION: Insert disk usage data to database
    await insert_disk_usage_to_database(all_reports)

    await send_disk_report(all_reports)


if __name__ == "__main__":
    asyncio.run(main())
