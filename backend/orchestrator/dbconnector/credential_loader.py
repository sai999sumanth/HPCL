import urdhva_base
import os
import dotenv
import utilities.helpers

# ENV File path to fetch data from
file_path = os.path.join(os.path.dirname(utilities.helpers.__file__), "..",
                         "orchestrator", "dbconnector", ".db_creds_env")
dotenv.load_dotenv(dotenv_path=file_path)


def get_credentials(db_name: str) -> dict:
    """
    Retrieve database credentials dynamically based on the database name.

    Args:
        db_name (str): The name of the database (e.g., 'MYSQL', 'POSTGRES', 'MSSQL').

    Returns:
        dict: A dictionary of credentials for the specified database.
    """
    db_name = db_name.upper()  # Ensure the name matches the environment variable keys

    credentials = {
        "host": os.getenv(f"{db_name}_HOST"),
        "user": os.getenv(f"{db_name}_USER"),
        "port": os.getenv(f"{db_name}_PORT"),
        "password": os.getenv(f"{db_name}_PASSWORD"),
        "database": os.getenv(f"{db_name}_DB"),
    }

    # Check if any credential is missing
    if None in credentials.values():
        raise ValueError(f"Missing credentials for {db_name}")

    return credentials

def get_va_creds(db_name: str) -> dict:
    """

    Args:
        db_name:

    Returns:

    """
    db_name = db_name.upper()
    credentials = {
        "host": os.getenv(f"{db_name}_HOST"),
        "user": os.getenv(f"{db_name}_USER"),
        "cust_id": os.getenv(f"{db_name}_CUST_ID"),
        "application_id": os.getenv(f"{db_name}_APPLICATION_ID"),
        "session_token": os.getenv(f"{db_name}_SESSION_TOKEN"),
        "cookie": os.getenv(f"{db_name}_COOKIE")
    }

    # Check if any credential is missing
    if None in credentials.values():
        raise ValueError(f"Missing credentials for {db_name}")

    return credentials


def load_credentials(credential_base: str) -> dict:
    credentials = {}
    for key, value in os.environ.items():
        if key.upper().startswith(credential_base.upper()):
            credentials[key] = value
    return credentials