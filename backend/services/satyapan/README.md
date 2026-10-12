# Satyapan - Lawyer Verification Engine

**Satyapan** is a robust, production-ready microservice designed to verify lawyer enrollment details by scraping official State Bar Council websites in real-time. It features advanced security, a modular architecture, and easy deployment options.

## 🚀 Features

*   **Multi-State Support**:
    *   **Uttar Pradesh** (UP)
    *   **Delhi** (D)
    *   **Andhra Pradesh** (AP)
    *   **Rajasthan** (R)
    *   **Punjab, Haryana & Chandigarh** (P/…, PH/…) — one Bar Council; see below
*   **Standardized API**: Unified JSON response structure for all states.
*   **Advanced Authentication**:
    *   OAuth2 Password Bearer Flow.
    *   RSA-signed JWT Access Tokens (15-minute expiry).
    *   Long-lived Refresh Tokens (7-day expiry).
    *   JWKS Endpoint (`/.well-known/jwks.json`) for decentralized token validation.
*   **Production Ready**:
    *   FastAPI for high performance.
    *   Playwright for reliable headless browser automation.
    *   Dockerized for easy deployment (AWS App Runner / Azure).
*   **Advanced Bot Evasion**:
    *   Random User-Agent rotation.
    *   Hardened Browser Identity (hides WebDriver).
    *   Human-like Mouse Movements & Typing (`stealth_click`, `stealth_fill`).

---

## 🛠️ Prerequisites

*   **Python 3.12+**
*   **Playwright Browsers** (`chromium`)
*   **Docker** (for containerized deployment)

---

## ⚙️ Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/Intellicrafts/Satyapan.git
    cd satyapan
    ```

2.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    playwright install chromium
    ```

3.  **Generate Security Keys**
    This script generates the RSA Private/Public key pair used for signing JWTs.
    ```bash
    python scripts/gen_keys.py
    ```
    *Keys will be saved in the `certs/` directory.*

4.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```ini
    # Admin Credentials for generating tokens
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=your_secure_password
    ```

---

## 🏃‍♂️ Running the Service

Start the server with hot reload enabled:

```bash
python -m uvicorn app.main:app --reload
```

The API will be available at: **`http://127.0.0.1:8000`**

---

## 📖 API Documentation

### 1. Check Status
**GET** `/api/v1/status`
Returns the service health and supported states.
*   **Auth**: None

### 2. Authentication (Login)
**POST** `/api/v1/auth/token`
Obtain an access token using your admin credentials.
*   **Body** (`x-www-form-urlencoded`):
    *   `username`: (from .env)
    *   `password`: (from .env)
*   **Response**:
    ```json
    {
      "access_token": "eyJhbGciOiJSUz...",
      "token_type": "bearer",
      "refresh_token": "..."
    }
    ```

### 3. Verify Lawyer
**POST** `/api/v1/verify`
Scrape the Bar Council website for lawyer details.
*   **Headers**: `Authorization: Bearer <your_access_token>`
*   **Body** (`JSON`):
    ```json
    {
      "enrollment_number": "UP19849/25",
      "state": "Uttar Pradesh"
    }
    ```
 ### Example: Verify Rajasthan Lawyer
```bash
curl -X POST "https://<your-url>/api/v1/verify" \
     -H "Authorization: Bearer <access_token>" \
     -H "Content-Type: application/json" \
     -d '{
           "enrollment_number": "R/176A/1978",
           "state": "rajasthan"
         }'
```
*   **Supported States**: "Uttar Pradesh", "Delhi", "Andhra Pradesh", "Rajasthan"

*   **Response (Success)**:
    ```json
    {
      "status": "success",
      "message": "Verification successful",
      "data": {
        "enrollment_number": "UP19849/25",
        "name": "Abhishek Kumar Singh",
        "father_name": "Brijesh Kumar Singh",
        "address": "Vill. Canal Road...",
        "state": "Uttar Pradesh",
        "enrollment_date": "21/05/2025",
        "dob": "23/10/1999",
        ...
      }
    }
    ```

---

## ☁️ Deployment (AWS)

Satyapan is optimized for deployment on AWS App Runner using Amazon ECR.

### Automated Deployment
We provide a helper script `deploy_aws.sh` that automates the process:

```bash
# Usage: ./deploy_aws.sh [REPO_NAME] [REGION]
./deploy_aws.sh satyapan ap-south-1
```

This script will:
1.  Create an ECR Repository (`satyapan`).
2.  Login to ECR.
3.  Build and Push the Docker image.
4.  Print instructions for creating the App Runner service.

### Manual Steps
See [deploy_aws.md](deploy_aws.md) for a detailed walkthrough.

---

## 📁 Project Structure

```
├── app/
│   ├── api/            # Routes, Models, Auth Endpoints
│   ├── core/           # Config, Security (JWT/Password)
│   ├── services/       # Business Logic
│   │   └── scrapers/   # Playwright Scrapers (UP, Delhi)
│   └── main.py         # App Entrypoint
├── certs/              # RSA Keys (Generated)
├── scripts/            # Helper scripts (Key Gen, Verification)
├── Dockerfile          # Container definition
├── deploy_aws.sh       # AWS Deployment Automation
└── requirements.txt    # Python Dependencies
```


---

## Punjab, Haryana & Chandigarh (offline index)

The Bar Council of Punjab & Haryana (bcph.co.in) has no working online search, so
Satyapan checks an index built from the lists BCPH publishes:

* the **State Roll** PDF (~134k advocates enrolled up to Oct 2023), and
* the annual **bar-association voter lists**: "Uploaded" lists add recent
  enrolments (2024–26); "Invalid" lists carry BCPH's status (suspended, deceased,
  transferred, not eligible).

Only enrolment number, name, place of practice, district, state and status are
stored — never phone numbers, addresses, father's names or dates of birth.

Results: found and active → `success`; suspended / deceased / removed → `failed`;
not on the lists, or a remark such as "Transfered" → `not_found`, which the
marketplace sends to an admin for review instead of rejecting.

**Build / refresh** (≈6 minutes; the old index stays in place until the new one is complete):

```bash
docker compose -p merabakil -f docker-compose.prod.yml exec satyapan python scripts/build_ph_index.py
```

Refresh monthly, e.g. a host cron entry:

```cron
0 3 1 * * cd /opt/merabakil/repo/infrastructure && docker compose -p merabakil -f docker-compose.prod.yml exec -T satyapan python scripts/build_ph_index.py >> /var/log/satyapan-ph-index.log 2>&1
```

Each election year BCPH publishes new voter lists at a new address — update
`roll_indexes.punjab_haryana.voter_lists_page` in `app/core/urls.yaml`.
`GET /api/v1/status` shows when the index was built and how many advocates it holds.
