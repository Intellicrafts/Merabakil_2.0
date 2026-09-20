# Satyapan — Testing Guide

## Running locally

```bash
cd backend/services/satyapan
pip install -r requirements.txt
playwright install chromium

# Run headed (visible browser) for debugging
HEADLESS=false uvicorn app.main:app --reload --port 8007

# Run headless (default, same as production)
uvicorn app.main:app --reload --port 8007
```

Service is up when `GET http://localhost:8007/` returns `{"status":"ok","service":"Satyapan"}`.

---

## API

```
POST /api/v1/verify
Content-Type: application/json

{ "enrollment_number": "<number>", "state": "<state name>" }
```

**Response shape**

```json
{
  "status": "success" | "failed" | "error",
  "message": "...",
  "data": { ... }
}
```

---

## Uttar Pradesh

**Source:** http://upbarcouncil.com/AdvocateOnRoll.aspx

**Format:** `UP<number>/<year>` — number and year without separating slash prefix.

```
UP19849/25
UP1234/2020
```

**curl**

```bash
curl -X POST http://localhost:8007/api/v1/verify \
  -H 'Content-Type: application/json' \
  -d '{"enrollment_number": "UP19849/25", "state": "Uttar Pradesh"}'
```

**Expected success response fields**

| Field | Description |
|---|---|
| `name` | Advocate's name |
| `father_name` | Father's name |
| `address` | Registered address |
| `district` | District |
| `enrollment_date` | Date of enrollment |
| `transfer_date` | Date of transfer (if any) |
| `dob` | Date of birth |
| `tr_date` | TR date |
| `state` | `"Uttar Pradesh"` |

**Not-found:** Returns `status: "failed"` with `"Record not found or timeout waiting for results."`.

---

## Delhi

**Source:** https://delhibarcouncil.com/bcd/enrolment_index.php

**Format:** `D/<enroll_id>/<year>` — the scraper splits on `/` and uses parts[1] and parts[2].

```
D/105/2005
D/1532/2018
```

**curl**

```bash
curl -X POST http://localhost:8007/api/v1/verify \
  -H 'Content-Type: application/json' \
  -d '{"enrollment_number": "D/105/2005", "state": "Delhi"}'
```

**Expected success response fields**

| Field | Description |
|---|---|
| `name` | Advocate's name |
| `father_name` | Father / relative name |
| `address` | Current address |
| `mobile_no` | Mobile number |
| `email` | Email address |
| `dob` | Date of birth |
| `enrollment_date` | Date of enrollment |
| `degree_year` | LLB degree year |
| `aibe_applicable` | AIBE applicable flag |
| `fake` | Flagged as fake (`"Yes"` / `"No"`) |
| `licence_removed` | Licence removed flag |
| `licence_cancelled` | Licence cancelled flag |
| `state` | `"Delhi"` |

**Retries:** The Delhi scraper automatically retries up to 3 times on transient failures.

**Not-found:** Returns `status: "failed"` with `"Record not found or timeout."`.

**Invalid format:** Must be exactly `D/<number>/<year>`. Anything else returns `status: "failed"` with format error message before hitting the site.

---

## Andhra Pradesh

**Source:** https://barcouncilap.org/search-by-enrollment-number/

**Format:** `AP/<number>/<year>` — the scraper passes the full string to the `#enumber` input.

```
AP/123/2020
AP/456/2015
```

**curl**

```bash
curl -X POST http://localhost:8007/api/v1/verify \
  -H 'Content-Type: application/json' \
  -d '{"enrollment_number": "AP/123/2020", "state": "Andhra Pradesh"}'
```

**Expected success response fields**

| Field | Description |
|---|---|
| `name` | Advocate's name |
| `father_name` | Father's name |
| `address` | Registered address |
| `enrollment_date` | Date of enrollment |
| `status` | Enrolment status from the council |
| `state` | `"Andhra Pradesh"` |

**Not-found:** Returns `status: "failed"` with `"Record not found or timeout."`.

**Invalid format:** Must start with `AP/`. Otherwise fails immediately with a format error before hitting the site.

---

## Rajasthan

**Source:** https://barcouncilofrajasthan.org/Advocate/

**Format:** `R/<number>/<year>` — number may include a suffix letter (e.g. `176A`).

```
R/176A/1978
R/250/2005
```

**curl**

```bash
curl -X POST http://localhost:8007/api/v1/verify \
  -H 'Content-Type: application/json' \
  -d '{"enrollment_number": "R/176A/1978", "state": "Rajasthan"}'
```

**Expected success response fields**

| Field | Description |
|---|---|
| `name` | Advocate's name |
| `mobile_no` | Mobile number (masked on the council site) |
| `place_of_practice` | Bar association / council name |
| `state` | `"Rajasthan"` |

**Not-found:** Returns `status: "failed"` with `"Record not found (Name empty)."` after polling for 10 seconds.

**Format:** Also accepts `<number>/<year>` without the `R/` prefix — the scraper handles both.

---

## Testing via the advocate profile (end-to-end)

Once deployed, advocates can verify from their profile page without using curl:

1. Log in as an advocate at merabakil.in.
2. Go to **Profile → My Profile**.
3. Enter a valid enrollment number in the **Bar Council ID** field.
4. Click **Verify**.
   - If the prefix matches a supported state, verification starts immediately.
   - If the prefix is unknown, a state picker appears — select the state and click **Verify** again.
5. On success: button turns green and shows **✓ Verified**. Name appears below the field.
6. On failure: amber text shows **Not found on bar council records**.

The result is persisted to the lawyer record (`is_verified`, `verified_at`, `verification_data`).

---

## Checking Satyapan on the production VM

```bash
ssh merabakil-gce

# Health check
docker exec merabakil-satyapan-1 curl -sf http://localhost:8000/

# Test UP directly inside the container
docker exec merabakil-satyapan-1 curl -X POST http://localhost:8000/api/v1/verify \
  -H 'Content-Type: application/json' \
  -d '{"enrollment_number": "UP19849/25", "state": "Uttar Pradesh"}'
```

Satyapan runs headless on production (`HEADLESS=true`). To debug a scraper issue, run locally with `HEADLESS=false`.
