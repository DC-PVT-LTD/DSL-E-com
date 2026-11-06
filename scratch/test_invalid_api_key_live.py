import os
import requests
import json
import base64

# Send a real request to the official Google Gemini endpoint with an invalid key
# to verify how the official Google endpoint responds and how the error is handled.

fake_key = "AIzaSyFakeKeyInvalidTesting123456789"
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={fake_key}"

payload = {
    "contents": [
        {
            "parts": [
                {"text": "Extract stationery items"},
                {
                    "inlineData": {
                        "mimeType": "image/jpeg",
                        "data": base64.b64encode(b"dummy image data").decode("ascii")
                    }
                }
            ]
        }
    ]
}

print(f"Calling official Google endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=[REDACTED]")
res = requests.post(url, json=payload)
print(f"Google API HTTP Response Code: {res.status_code}")
err_json = res.json()
print(f"Error Code: {err_json.get('error', {}).get('code')}")
print(f"Error Status: {err_json.get('error', {}).get('status')}")
print(f"Error Message: {err_json.get('error', {}).get('message')}")

# Verify secret scrubbing
error_msg = f"HTTP {res.status_code}: {err_json.get('error', {}).get('message')}"
sanitized = error_msg.replace(fake_key, "[REDACTED_API_KEY]")
assert fake_key not in sanitized
print("Sanitization Verified: No API key appears in sanitized error message!")

