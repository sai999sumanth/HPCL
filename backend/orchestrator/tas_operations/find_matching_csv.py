import csv
import aiofiles
import pandas as pd


async def find_matching_row(csv_file_path, match_criteria, analog=False):
    """
    Finds the first row in a csv file that matches the given criteria.

    Args:
        csv_file_path (str): The path to the CSV file.
        match_criteria (dict): A dictionary containing the criteria to match against the CSV rows.
    `
    Returns:
         dict: The first matching row as a dictionary, or None if no match is found.    
    """ 

    try:
        # Read the CSV file asynchronously
        reader = pd.read_csv(csv_file_path)
        reader = reader[reader["sap_id"].astype(str) == str(match_criteria["sap_id"])]
        reader = reader.to_dict(orient="records")
        for row in reader:
            # Check if the row matches the criteria
            if all(str(row.get(key,'')).strip().lower() == str(value).strip().lower() for key, value in match_criteria.items()):
                print(f"found matching row : {row}")
                return row
            elif match_criteria.get("equipment_name").strip().lower() in row.get("equipment_name", "").strip().lower():
                print(f"found matching substring row : {row}")
                return row
        return None
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return None
