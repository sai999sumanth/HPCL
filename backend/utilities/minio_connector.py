import os
import urdhva_base
from minio import Minio
from minio.error import S3Error, InvalidResponseError


def get_minio_client():
    """
    Initialize and return a MinIO client using configuration from urdhva_base.settings.

    Returns:
        Minio: Configured MinIO client object.

    Raises:
        ConnectionError: If client initialization fails (e.g., invalid endpoint or credentials).
    """
    try:
        return Minio(
            urdhva_base.settings.minio_endpoint.replace("https://", "").replace("http://", ""),
            access_key=urdhva_base.settings.minio_access_key,
            secret_key=urdhva_base.settings.minio_secret_key,
            region="us-east-1",
            secure=urdhva_base.settings.minio_secure,
        )
    except Exception as e:
        raise ConnectionError(f"MinIO client initialization failed: {e}")


def upload_to_minio(bu, section, unique_id, filepath):
    """
    Upload a local file to a MinIO bucket under the path: novex/<bu>/<section>/<unique_id>/filename.

    Args:
        bu (str): Business unit or logical grouping.
        section (str): Subsection or category of the file.
        unique_id (str): Unique identifier (e.g., transaction ID, record ID).
        filepath (str): Full path of the file to upload.

    Returns:
        tuple:
            (bool, str):
                - True, <object_name> if upload succeeds.
                - False, <error_message> if any error occurs.
    """
    # --- Validate inputs ---
    if not os.path.exists(filepath):
        return False, "File not found"

    if not urdhva_base.settings.minio_endpoint:
        return False, "Missing MinIO endpoint"

    # Construct full object path within the bucket
    object_path = "/".join(["novex", bu, section, unique_id, os.path.basename(filepath)])

    # --- Connect to MinIO ---
    try:
        minio_client = get_minio_client()
    except ConnectionError as e:
        print(f"[MinIO] Connection error: {e}")
        return False, "Could not connect to MinIO"

    # --- Upload file to bucket ---
    try:
        # Uploads local file to MinIO
        minio_client.fput_object(urdhva_base.settings.minio_bucket, object_path, filepath)

        # Validate that file exists in MinIO (optional verification)
        object_stat = minio_client.stat_object(urdhva_base.settings.minio_bucket, object_path)
        return True, object_stat.object_name

    except FileNotFoundError:
        return False, "Local file not found during upload"

    except S3Error as e:
        # Handles MinIO-specific S3 errors (e.g. AccessDenied, NoSuchBucket)
        print(f"[MinIO] S3Error during upload: {e.code} - {e.message}")
        return False, f"Upload failed: {e.message or e.code}"

    except InvalidResponseError as e:
        # Handles malformed responses from MinIO server
        print(f"[MinIO] Invalid response: {e}")
        return False, "Invalid response from MinIO server"

    except Exception as e:
        # Catch-all for any unexpected runtime issue
        print(f"[MinIO] Unexpected upload error ({object_path}): {e}")
        return False, "Unexpected error during upload"


def download_from_minio(object_path):
    """
    Download a file from MinIO to /tmp directory.

    Args:
        object_path (str): Full object path within the bucket.

    Returns:
        tuple:
            (bool, str):
                - True, <local_file_path> if download succeeds.
                - False, <error_message> if any error occurs.
    """
    # --- Validate configuration ---
    if not urdhva_base.settings.minio_endpoint:
        return False, "Missing MinIO endpoint"

    # --- Connect to MinIO ---
    try:
        minio_client = get_minio_client()
    except ConnectionError as e:
        print(f"[MinIO] Connection error: {e}")
        return False, "Could not connect to MinIO"

    # --- Download file ---
    try:

        # Define output path in temporary directory
        output_file = os.path.join("/tmp", os.path.basename(object_path))

        # Retrieve object to local file path
        minio_client.fget_object(urdhva_base.settings.minio_bucket, object_path, output_file)

        return True, output_file

    except S3Error as e:
        print(f"[MinIO] S3Error during download: {e.code} - {e.message}")
        return False, f"Download failed: {e.message or e.code}"

    except FileNotFoundError:
        return False, "Output path not writable"

    except InvalidResponseError as e:
        print(f"[MinIO] Invalid response: {e}")
        return False, "Invalid response from MinIO server"

    except Exception as e:
        print(f"[MinIO] Unexpected download error ({object_path}): {e}")
        return False, "Unexpected error during download"


# Example usage:
# success, msg = upload_to_minio("finance", "reports", "123", "/path/to/file.csv")
# success, path = download_from_minio("novex/finance/reports/123/file.csv")
