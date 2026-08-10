import requests


def test_emlock_api():
    url = 'https://localhost/api/emlock/ingest_data'
    headers = {
        "vendor": "hpcl_emlock",
        "ceg-auth-token": "ghArMdF7wcjSLUpo9fvDoRXfoExJlSqBaT9rd1gxotblW7VmFtROy9qFQMjqJkEo",
        "content-type": "application/json"
    }
    data = {
        "vendor_id": "50041589",
        "data":
            [
                {
                    "location_id": "1856",
                    "location_type": "RO",
                    "vehicle_number": "TN40C6151",
                    "violation_type": "VTSOFFLINE",
                    "initiated_date": "10/11/2024 10:20:00 PM",
                    "approved_date": "10/11/2024 10:25:00 PM",
                    "approved_by": "sedhu"
                }
            ]
        }

    response = requests.post(url, headers=headers, json=data, verify=False)
    print(response.status_code, "  ", response.text)


if __name__ == "__main__":
    test_emlock_api()
