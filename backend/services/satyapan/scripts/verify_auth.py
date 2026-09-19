import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_auth_flow():
    print("1. Testing Login...")
    login_data = {
        "username": "admin",
        "password": "secret"
    }
    response = requests.post(f"{BASE_URL}/api/v1/auth/token", data=login_data)
    
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return
        
    token_data = response.json()
    access_token = token_data["access_token"]
    print(f"Login successful! Got token: {access_token[:20]}...")
    
    print("\n2. Testing Verification with Token...")
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    verify_data = {
        "enrollment_number": "UP19849/25",
        "state": "Uttar Pradesh"
    }
    
    # We expect this to take some time as it runs Playwright
    try:
        response = requests.post(f"{BASE_URL}/api/v1/verify", json=verify_data, headers=headers, timeout=60)
        
        if response.status_code == 200:
            print("Verification successful!")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Verification failed: {response.status_code} - {response.text}")
            
    except requests.exceptions.Timeout:
        print("Verification timed out (Playwright might be slow first run).")
    except Exception as e:
        print(f"Error during verification: {str(e)}")

if __name__ == "__main__":
    test_auth_flow()
