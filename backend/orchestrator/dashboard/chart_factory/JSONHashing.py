import json
import hashlib
import traceback

def canonicalize_json(json_obj, level=0):
  """
  Recursively sort the JSON keys and ensure consistent formatting.
  """
  indent = '  ' * level  # For better visualization of nested levels

  try:
    if isinstance(json_obj, dict):
      print(f"{indent}Canonicalizing dict at level {level}:")
      sorted_dict = {key: canonicalize_json(json_obj[key], level + 1) for key in sorted(json_obj)}
      print(f"{indent}Sorted dict at level {level}: {sorted_dict}")
      return sorted_dict
    elif isinstance(json_obj, list):
      print(f"{indent}Canonicalizing list at level {level}:")
      # Sort list elements if they are comparable; otherwise, leave as is
      sorted_list = sorted([canonicalize_json(element, level + 1) for element in json_obj], key=lambda x: json.dumps(x))
      print(f"{indent}Sorted list at level {level}: {sorted_list}")
      return sorted_list
    else:
      print(f"{indent}Processing primitive at level {level}: {json_obj}")
      return json_obj
  except Exception as e:
    print(f"\nError at level {level} while processing key or JSON object: {json_obj}")
    traceback.print_exc()
    raise e

def generate_json_hash(json_obj):
  """
  Generates a SHA-256 hash of the canonicalized JSON object.
  """
  # Step 1: Canonicalize JSON
  print("Starting JSON canonicalization...")
  canonicalized_json = canonicalize_json(json_obj)

  # Step 2: Convert to JSON string with sorted keys and no whitespace for consistency
  json_str = json.dumps(canonicalized_json, separators=(',', ':'), ensure_ascii=False)
  print(f"\nCanonicalized JSON string: {json_str}")

  # Step 3: Encode to UTF-8
  json_bytes = json_str.encode('utf-8')
  print(f"\nUTF-8 encoded JSON bytes: {json_bytes}")

  # Step 4: Generate SHA-256 hash
  sha256_hash = hashlib.sha256(json_bytes).hexdigest()
  print(f"\nGenerated SHA-256 hash: {sha256_hash}")

  # Print final canonicalized JSON for verification
  print(f"\nFinal Canonicalized JSON: {canonicalized_json}")

  return sha256_hash

if __name__ == '__main__':
    # Example JSON input
    json_input = {
      "table": "billing_cost",
      "visualization_name": "bar",
      "name": "bar - Provide top 100 distinct component costs in Asia Pacific (Tokyo) for Q3 2024",
      "description": "",
      "params": {
        "queries": [
          {
            "filters": [
              {
                "col": "start",
                "op": "TEMPORAL_RANGE",
                "val": ["2024-07-01 : 2024-09-30"]
              },
              {
                "col": "region_name",
                "op": "EQUALS",
                "val": ["Asia Pacific (Tokyo)", "EU Frankfurt"]
              }
            ],
            "metrics": [
              {
                "expression_type": "SQL",
                "column": {
                  "column_name": "amount",
                  "type": "string"
                },
                "aggregate": "SUM",
                "label": "AMOUNt"
              }
            ],
            "orderby": [
              {
                "order_by": True,
                "expression_type": "string",
                "column": {
                  "column_name": "amount",
                  "type": "string"
                },
                "aggregate": "SUM",
                "label": "AMOUNT"
              }
            ],
            "row_limit": 100,
            "order_descending": True
          }
        ],
        "form_data": {
          "x_axis": {
            "name": "component",
            "label": "Component",
            "sort_ascending": False
          },
          "groupby": [],
          "query_mode": "",
          "order_descending": False,
          "row_limit": 0,
          "show_legend": False
        }
      }
    }

    # Generate hash for the input JSON
    try:
      hash_value = generate_json_hash(json_input)
      print(f"\nFinal SHA-256 Hash: {hash_value}")
    except Exception as e:
      print("An error occurred during JSON hashing.")
