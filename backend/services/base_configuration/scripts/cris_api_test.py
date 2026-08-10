import requests


def test_va_api():
    url = 'https://10.90.38.161:443/api/cris/ingest_data'
    headers = {
        "vendor": "hpcl_cris",
        "ceg-auth-token": "FOA5iiG81MK0kWSOJh5jtlAbYvkJ4viIZh2yRqzam9DWlGzzFPpYkhvtMSmcsjwq",
        "content-type": "application/json"
    }
    data = {"vendor_id": "ORPAK", "location_id": "41026683", "ro_code": "15558410", "location_type": "RO", "data": [
        {"interlock_type": "Tank", "interlock_description": "TANK: 1 Product Level Low", "device_id": "1",
         "device_value": "1", "tank_id": "1", "nozzle_id": "1", "pump_no": "1", "alarm_id": "18261",
         "occurrence_date": "20240405155707", "closure_date": "20240405155739", "alert_status": "Open"}]}

    response = requests.post(url, headers=headers, json=data, verify=False)
    print(response.status_code, "  ", response.text)


if __name__ == "__main__":
    test_va_api()
