import requests


def test_va_api():
    url = 'https://localhost:443/api/va/ingest_data'
    headers = {
        "vendor": "hpcl_va",
        "ceg-auth-token": "Mauad4ysWfCzb1eAOSLKYM9yp8DyxLtio0H7QbXl7kkkzaTePw7dYJui3KWCccSp",
        "content-type": "application/json"
    }
    data = {
        "vendor_id": "vendor001122337",
        "location_id": "867152",
        "location_type": "TAS",
        "data": [
            {
                "alert_type": "IntrusionDetection",
                "alert_description": "Intrusion Detection",
                "device_id": "abdsj2_djjjd",
                "video_url": "https://media.gettyimages.com/id/1363719467/vector/indian-flag-abstract.jpg?s=1024x1024&w=gi&k=20&c=oJQtvFrVuWP35pzLZGJ2F6TuXGzSWJJehPXVV0hlFzw="
            },
            {
                "alert_type": "FireLeakDetection",
                "alert_description": "Fire Leak Detection",
                "device_id": "abdsj2_djjdddjd",
                "video_url": "https://media.gettyimages.com/id/1363719467/vector/indian-flag-abstract.jpg?s=1024x1024&w=gi&k=20&c=oJQtvFrVuWP35pzLZGJ2F6TuXGzSWJJehPXVV0hlFzw="
            },

        ]
    }

    response = requests.post(url, headers=headers, json=data, verify=False)
    print(response.status_code, "  ", response.text)


if __name__ == "__main__":
    test_va_api()
