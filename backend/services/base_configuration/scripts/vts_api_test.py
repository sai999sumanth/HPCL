import requests


def test_vts_api():
    url = 'https://localhost/api/vts/ingest_data'
    headers = {
        "vendor": "hpcl_vts",
        "ceg-auth-token": "ZALpdEQTyfc6hZ1Oc98msUc3srqQGIfLYDEu7wxqhWy3FbPECaHejcEMUiSsZiB0",
        "content-type": "application/json"
    }
    data = {
        "vendor_id": "vendor001122337",
        "location_id": "867152",
        "location_type": "TAS",
        "data": [{
            "tl_number": "tl_123_890",
            "report_duration": "01-11-2022 00:00:00 To 15-11-2022 00:00:00",
            "total_trips": 10,
            "stoppage_violations_count": 23,
            "route_deviation_count": 0,
            "speed_violation_count": 1,
            "main_supply_removal_count": 1,
            "night_driving_count": 1,
            "no_halt_zone_count": 1,
            "device_offline_count": 1,
            "device_tamper_count": 1
        }]
    }

    response = requests.post(url, headers=headers, json=data, verify=False)
    print(response.status_code, "  ", response.text)


if __name__ == "__main__":
    test_vts_api()
