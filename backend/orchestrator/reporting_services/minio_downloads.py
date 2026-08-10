import urdhva_base
import asyncio
import os
import fnmatch
import shutil
import datetime
from datetime import datetime, timedelta
from pathlib import Path
import utilities.minio_connector as minio_connector


async def download_to_local():
    minio_client = minio_connector.get_minio_client()
    today = datetime.now()
    last_10_dates = [(today - timedelta(days=i)).strftime("%y%m%d") for i in range(10)]

    objects = list(minio_client.list_objects(
        minio_connector.urdhva_base.settings.minio_bucket,
        recursive=True
    ))

    base_path = Path("/tmp/minio_downloads")
    base_path.mkdir(exist_ok=True)

    for date_str in last_10_dates:
        pattern = f"*{date_str}*"
        file_list = [obj.object_name for obj in objects if fnmatch.fnmatch(os.path.basename(obj.object_name), pattern)]
        if not file_list:
            print(f"No files found for {date_str}")
            continue

        date_folder = base_path / date_str
        date_folder.mkdir(exist_ok=True)
        print(f"Downloading {len(file_list)} files for date {date_str}")

        for fp in file_list:
            saved, temp_path = minio_connector.download_from_minio(fp)
            if saved:
                final_path = date_folder / Path(temp_path).name
                shutil.move(temp_path, final_path)
            else:
                print(f"Failed to download {fp}: {temp_path}")
        
        zip_path = "/tmp/minio_downloads.zip"
        shutil.make_archive("/tmp/minio_downloads", 'zip', root_dir=base_path)
        print(f"All last 10 days zipped into: {zip_path}")
        print(f"All files for {date_str} saved in {date_folder}")
    print("All last 10 days processed.")


if __name__ == "__main__":
    asyncio.run(download_to_local())