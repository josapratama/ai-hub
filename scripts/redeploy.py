import requests
import uuid
from app.core.security import create_access_token

token = create_access_token({"sub": "035f2226-4cbf-4a66-956c-5e6e75e93619"})
print("Token created:", token[:20], "...")

url = "http://127.0.0.1:8000/api/apps/dc06ca0f-50ab-45b3-a4dc-d0e964f4917d/redeploy"
headers = {"Authorization": f"Bearer {token}"}

response = requests.post(url, headers=headers)
print("STATUS:", response.status_code)
print("BODY:", response.text)
