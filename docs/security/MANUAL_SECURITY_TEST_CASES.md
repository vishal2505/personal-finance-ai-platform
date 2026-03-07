# Manual Security Test Cases — Personal Finance AI Platform

> **Module**: App Security  
> **Task**: Final Test Cases (Non-Automated Testing)  
> **Date**: 2026-03-07  
> **Tester**: _______________  
> **Environment**: Local dev (`localhost:8000` / `localhost:5173`) or Staging URL  

---

## How to Use This Document

1. Start the backend (`http://localhost:8000`) and frontend (`http://localhost:5173`).
2. Open **Swagger UI** at `http://localhost:8000/docs` for API-level tests.
3. Walk through each test case in order, filling in **Actual Result** and **Pass/Fail**.
4. Capture a screenshot for every test (especially failures) — these are needed for the course submission.
5. Any failed test should be logged as a bug with steps to reproduce.

### Tools Required

| Tool | Purpose |
|------|---------|
| Browser (Chrome/Edge) | Frontend UI tests |
| Swagger UI (`/docs`) | API-level security tests |
| Postman or cURL | Token manipulation, header tests |
| Browser DevTools (F12 → Network tab) | Inspect requests, tokens, CORS headers |

---

## 1. Authentication — Registration

### SEC-01: Successful Registration

| Field | Value |
|-------|-------|
| **Category** | Authentication |
| **Description** | Verify a new user can register successfully |
| **Pre-conditions** | Email not already registered |
| **Steps** | 1. Open frontend → Register page<br>2. Enter email: `sectest@example.com`, password: `SecurePass1!`, name: `Security Tester`<br>3. Click Register |
| **Expected Result** | User is created; frontend auto-calls login and, when `status: 2fa_required` is returned, user is redirected to the 2FA verification page (`/verify-2fa`); default categories and merchant rules are auto-created |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-02: Duplicate Email Registration

| Field | Value |
|-------|-------|
| **Category** | Authentication |
| **Description** | Verify registering with an already-used email is rejected |
| **Pre-conditions** | `sectest@example.com` already registered (from SEC-01) |
| **Steps** | 1. Open Register page<br>2. Enter same email `sectest@example.com` with any password<br>3. Click Register |
| **Expected Result** | HTTP 400 — "Email already registered"; user is NOT created again |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-03: Invalid Email Format

| Field | Value |
|-------|-------|
| **Category** | Input Validation |
| **Description** | Verify registration rejects invalid email formats |
| **Pre-conditions** | None |
| **Steps** | 1. POST to `/api/auth/register` via Swagger UI<br>2. Use body: `{"email": "not-an-email", "password": "test123"}` |
| **Expected Result** | HTTP 422 — Validation error (Pydantic `EmailStr` rejects invalid format) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-04: Oversized Password Rejected

| Field | Value |
|-------|-------|
| **Category** | Input Validation |
| **Description** | Verify passwords exceeding 72 bytes are rejected |
| **Pre-conditions** | None |
| **Steps** | 1. POST to `/api/auth/register` via Swagger<br>2. Use a password that is 80+ characters long (e.g., `"a"` repeated 80 times)<br>3. Submit |
| **Expected Result** | HTTP 400 — "Password must be at most 72 bytes" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 2. Authentication — Login

### SEC-05: Successful Login Returns 2FA Pending Token

| Field | Value |
|-------|-------|
| **Category** | Authentication |
| **Description** | Verify login returns a token with `2fa_required` status |
| **Pre-conditions** | User `test@example.com` / `test123` exists (seeded on startup) |
| **Steps** | 1. POST to `/api/auth/login` via Swagger (use `username=test@example.com`, `password=test123`)<br>2. Inspect the response |
| **Expected Result** | HTTP 200 — Response contains `access_token`, `token_type: "bearer"`, `status: "2fa_required"` |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-06: Login with Wrong Password

| Field | Value |
|-------|-------|
| **Category** | Authentication |
| **Description** | Verify incorrect password is rejected |
| **Pre-conditions** | User exists |
| **Steps** | 1. POST to `/api/auth/login` with `username=test@example.com`, `password=wrongpassword` |
| **Expected Result** | HTTP 401 — "Incorrect email or password" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-07: Login with Non-Existent User

| Field | Value |
|-------|-------|
| **Category** | Authentication |
| **Description** | Verify login for a non-registered email gives a generic error (no user enumeration) |
| **Pre-conditions** | None |
| **Steps** | 1. POST to `/api/auth/login` with `username=nobody@example.com`, `password=anything` |
| **Expected Result** | HTTP 401 — "Incorrect email or password" (same message as SEC-06, preventing user enumeration) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 3. Two-Factor Authentication (2FA)

### SEC-08: 2FA Verification with Correct Code

| Field | Value |
|-------|-------|
| **Category** | 2FA |
| **Description** | Verify correct 2FA code upgrades the token to full access |
| **Pre-conditions** | Obtained `2fa_pending` token from login (SEC-05) |
| **Steps** | 1. Copy the `access_token` from SEC-05<br>2. POST to `/api/auth/verify-2fa` with header `Authorization: Bearer <token>` and body `{"code": "123456"}`<br>3. Inspect response |
| **Expected Result** | HTTP 200 — New token with `status: "success"`; this token has `access` scope |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-09: 2FA Verification with Wrong Code

| Field | Value |
|-------|-------|
| **Category** | 2FA |
| **Description** | Verify incorrect 2FA code is rejected |
| **Pre-conditions** | `2fa_pending` token from login |
| **Steps** | 1. POST to `/api/auth/verify-2fa` with body `{"code": "000000"}` |
| **Expected Result** | HTTP 400 — "Invalid authentication code" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-10: 2FA Endpoint Rejects Full-Access Token

| Field | Value |
|-------|-------|
| **Category** | 2FA / Scope Enforcement |
| **Description** | Verify the verify-2fa endpoint cannot be called with an already-verified access token |
| **Pre-conditions** | Obtained full `access`-scoped token (from SEC-08) |
| **Steps** | 1. POST to `/api/auth/verify-2fa` with the **full access token** and body `{"code": "123456"}` |
| **Expected Result** | HTTP 401 — "Invalid token scope for 2FA verification" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-11: 2FA Pending Token Cannot Access Protected Routes

| Field | Value |
|-------|-------|
| **Category** | 2FA / Scope Enforcement |
| **Description** | Verify `2fa_pending` token is rejected by all regular protected endpoints |
| **Pre-conditions** | `2fa_pending` token from login |
| **Steps** | 1. GET `/api/transactions/` with `Authorization: Bearer <2fa_pending_token>`<br>2. GET `/api/budgets/` with same token<br>3. GET `/api/accounts/` with same token |
| **Expected Result** | All three return HTTP 401 — "2FA verification required" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-12: Frontend 2FA Flow (UI)

| Field | Value |
|-------|-------|
| **Category** | 2FA / UI |
| **Description** | Verify the frontend 2FA page works correctly end-to-end |
| **Pre-conditions** | None |
| **Steps** | 1. Open frontend → Login page<br>2. Enter `test@example.com` / `test123` → Click Login<br>3. Verify you are redirected to the 2FA page with 6 code input boxes<br>4. Enter `123456` → Click Verify<br>5. Verify you are redirected to the Dashboard |
| **Expected Result** | Full login → 2FA → Dashboard flow completes; dashboard loads user data |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 4. Token Security

### SEC-13: No Token — Unauthenticated Access

| Field | Value |
|-------|-------|
| **Category** | Authorization |
| **Description** | Verify all protected endpoints reject requests with no token |
| **Pre-conditions** | None |
| **Steps** | Send requests **without** an `Authorization` header to each endpoint:<br>1. GET `/api/transactions/`<br>2. GET `/api/budgets/`<br>3. GET `/api/accounts/`<br>4. GET `/api/categories/`<br>5. GET `/api/auth/me`<br>6. POST `/api/imports/upload`<br>7. GET `/api/settings/categories`<br>8. GET `/api/insights/`<br>9. GET `/api/anomalies/` |
| **Expected Result** | All return HTTP 401 — "Not authenticated" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-14: Invalid / Tampered Token

| Field | Value |
|-------|-------|
| **Category** | Authorization |
| **Description** | Verify a tampered or garbage token is rejected |
| **Pre-conditions** | None |
| **Steps** | 1. GET `/api/transactions/` with header `Authorization: Bearer this.is.not.a.valid.jwt`<br>2. GET `/api/auth/me` with same invalid token |
| **Expected Result** | HTTP 401 — "Could not validate credentials" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-15: Expired Token

| Field | Value |
|-------|-------|
| **Category** | Authorization |
| **Description** | Verify an expired JWT is rejected |
| **Pre-conditions** | Create a token with very short expiry (or wait 30 min after login) |
| **Steps** | 1. Login and obtain an access token<br>2. Wait for the token to expire (30 min for access, 5 min for 2FA pending) — OR use a tool like [jwt.io](https://jwt.io) to decode the token and verify the `exp` claim is set correctly<br>3. Try GET `/api/auth/me` with the expired token |
| **Expected Result** | HTTP 401 — "Could not validate credentials" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-16: Token Does Not Leak Password

| Field | Value |
|-------|-------|
| **Category** | Data Exposure |
| **Description** | Verify JWT payload and `/me` endpoint never expose passwords |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. Decode the access token at [jwt.io](https://jwt.io)<br>2. Verify the payload contains only `sub` (email), `scopes`, and `exp`<br>3. GET `/api/auth/me` and inspect the response |
| **Expected Result** | Token payload has no password field; `/me` response has `id`, `email`, `full_name`, `created_at` only — no `hashed_password` |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 5. Data Isolation (Multi-User Authorization)

### SEC-17: User A Cannot See User B's Transactions

| Field | Value |
|-------|-------|
| **Category** | Authorization / Data Isolation |
| **Description** | Verify users can only access their own transactions |
| **Pre-conditions** | Two registered users: User A (`test@example.com`) and User B (`sectest@example.com`), each with at least one transaction |
| **Steps** | 1. Login as User A → complete 2FA → get access token<br>2. POST `/api/transactions/` to create a transaction as User A<br>3. Login as User B → complete 2FA → get access token<br>4. GET `/api/transactions/` with User B's token |
| **Expected Result** | User B's transactions list does NOT contain User A's transaction |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-18: User A Cannot See User B's Budgets

| Field | Value |
|-------|-------|
| **Category** | Authorization / Data Isolation |
| **Description** | Verify budget data isolation between users |
| **Pre-conditions** | User A has at least one budget |
| **Steps** | 1. Login as User A → create a budget via POST `/api/budgets/`<br>2. Login as User B → GET `/api/budgets/` |
| **Expected Result** | User B sees only their own budgets (empty list or their own data) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-19: User A Cannot See User B's Accounts

| Field | Value |
|-------|-------|
| **Category** | Authorization / Data Isolation |
| **Description** | Verify account data isolation between users |
| **Pre-conditions** | User A has created an account |
| **Steps** | 1. Login as User A → create account via POST `/api/accounts/`<br>2. Note the account ID (e.g., `1`)<br>3. Login as User B → GET `/api/accounts/1` |
| **Expected Result** | HTTP 404 — "Account not found" (User B cannot access User A's account by ID) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-20: User A Cannot See User B's Categories

| Field | Value |
|-------|-------|
| **Category** | Authorization / Data Isolation |
| **Description** | Verify category data isolation between users |
| **Pre-conditions** | Each user has categories |
| **Steps** | 1. Login as User A → GET `/api/categories/` → note category IDs<br>2. Login as User B → GET `/api/categories/`<br>3. As User B, try PUT `/api/categories/{User_A_category_id}` with body `{"name": "Hacked"}` |
| **Expected Result** | GET returns only User B's categories; PUT on User A's category → HTTP 404 "Category not found" |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-21: User A Cannot Delete User B's Data

| Field | Value |
|-------|-------|
| **Category** | Authorization / Data Isolation |
| **Description** | Verify cross-user deletion is blocked |
| **Pre-conditions** | User A has a category with known ID |
| **Steps** | 1. Login as User B<br>2. DELETE `/api/categories/{User_A_category_id}` with User B's token<br>3. DELETE `/api/accounts/{User_A_account_id}` with User B's token |
| **Expected Result** | Both return HTTP 404 — resource not found (filtered by user ownership) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 6. Input Validation & Injection Prevention

### SEC-22: SQL Injection in Login

| Field | Value |
|-------|-------|
| **Category** | Injection |
| **Description** | Verify SQL injection payloads in login fields are safely handled |
| **Pre-conditions** | None |
| **Steps** | 1. POST `/api/auth/login` with `username=' OR 1=1 --`, `password=anything`<br>2. POST `/api/auth/login` with `username=test@example.com`, `password=' OR '1'='1` |
| **Expected Result** | HTTP 401 or 422 — login fails; no data leak; no server error (500) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-23: SQL Injection in Transaction Filters

| Field | Value |
|-------|-------|
| **Category** | Injection |
| **Description** | Verify SQL injection in query parameters is safely handled |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. GET `/api/transactions/?bank_name=' OR '1'='1` (remember: URL-encode this string when sending it as a query parameter) with valid token |
| **Expected Result** | Returns empty list or HTTP 422 — no data leak; no 500 error; database remains intact |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-24: XSS in Transaction/Category Fields

| Field | Value |
|-------|-------|
| **Category** | XSS |
| **Description** | Verify script payloads in data fields are stored/returned safely |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. POST `/api/categories/` with body `{"name": "<script>alert('xss')</script>", "type": "expense"}`<br>2. GET `/api/categories/` and inspect the response<br>3. Open the Settings page in the frontend and check if the script executes |
| **Expected Result** | The string is stored as literal text, not executed; frontend renders it as escaped text (React auto-escapes by default) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-25: XSS in Transaction Merchant Name

| Field | Value |
|-------|-------|
| **Category** | XSS |
| **Description** | Verify XSS payload in merchant name is safely handled |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. POST `/api/transactions/` with `merchant: "<img src=x onerror=alert('xss')>"`<br>2. View the Transactions page in the frontend |
| **Expected Result** | Merchant name displays as literal text; no alert dialog or script execution |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-26: Pydantic Validation — Invalid Data Types

| Field | Value |
|-------|-------|
| **Category** | Input Validation |
| **Description** | Verify the API rejects malformed request bodies |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. POST `/api/transactions/` with `{"amount": "not-a-number", "date": "invalid-date"}`<br>2. POST `/api/budgets/` with `{"amount": -100, "period": "biweekly"}` |
| **Expected Result** | HTTP 422 — Validation errors for each invalid field |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-27: Category Color Validation

| Field | Value |
|-------|-------|
| **Category** | Input Validation |
| **Description** | Verify category color must match hex format `#RRGGBB` |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. POST `/api/categories/` with `{"name": "Test", "color": "red"}`<br>2. POST `/api/categories/` with `{"name": "Test2", "color": "#GGG999"}` |
| **Expected Result** | HTTP 422 — Color does not match pattern `^#[0-9A-Fa-f]{6}$` |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 7. File Upload Security

### SEC-28: Upload Non-Supported File Type

| Field | Value |
|-------|-------|
| **Category** | File Upload |
| **Description** | Verify only PDF and CSV files are accepted for statement upload |
| **Pre-conditions** | Valid access token; have a `.exe` or `.txt` file ready |
| **Steps** | 1. POST `/api/imports/upload` with a `.exe` file<br>2. POST `/api/imports/upload` with a `.txt` file |
| **Expected Result** | HTTP 400 or 422 — File type not supported; file is not processed |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-29: Upload Empty File

| Field | Value |
|-------|-------|
| **Category** | File Upload |
| **Description** | Verify an empty CSV/PDF is handled gracefully |
| **Pre-conditions** | Valid access token; create a 0-byte `.csv` file |
| **Steps** | 1. POST `/api/imports/upload` with empty CSV file |
| **Expected Result** | Appropriate error message (e.g., "No transactions found"); no server crash (500) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-30: Upload Malicious CSV Content

| Field | Value |
|-------|-------|
| **Category** | File Upload / Injection |
| **Description** | Verify CSV with formula injection payloads is safely parsed |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. Create a CSV file with a row: `2025-01-01,=CMD('calc'),Food,50.00`<br>2. POST `/api/imports/upload` with this file |
| **Expected Result** | The formula string is treated as literal text in the merchant/description field; no command execution |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 8. CORS (Cross-Origin Resource Sharing)

### SEC-31: CORS Allows Configured Origins

| Field | Value |
|-------|-------|
| **Category** | CORS |
| **Description** | Verify requests from allowed origins include CORS headers |
| **Pre-conditions** | Backend running on `localhost:8000`; frontend on `localhost:5173` |
| **Steps** | 1. Open browser DevTools → Network tab<br>2. From the frontend (`localhost:5173`), make any API call (e.g., login)<br>3. Inspect the response headers |
| **Expected Result** | Response includes `Access-Control-Allow-Origin: http://localhost:5173` (or `http://localhost:3000`) |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-32: CORS Blocks Unauthorized Origins

| Field | Value |
|-------|-------|
| **Category** | CORS |
| **Description** | Verify requests from non-configured origins are blocked |
| **Pre-conditions** | Backend running |
| **Steps** | 1. Using cURL or Postman, send a request with header `Origin: http://evil-site.com`<br>   ```bash<br>   curl -i -H "Origin: http://evil-site.com" http://localhost:8000/api/health<br>   ```<br>2. Inspect the response headers |
| **Expected Result** | Response does NOT include `Access-Control-Allow-Origin: http://evil-site.com`; browsers would block the response |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 9. Session & Token Expiry

### SEC-33: Access Token Expiry is 30 Minutes

| Field | Value |
|-------|-------|
| **Category** | Token Management |
| **Description** | Verify the access token `exp` claim is set to 30 minutes from issue time |
| **Pre-conditions** | Valid access token (from SEC-08) |
| **Steps** | 1. Decode the access token at [jwt.io](https://jwt.io)<br>2. Check the `exp` field and compare to current time |
| **Expected Result** | `exp` is approximately 30 minutes after the token was issued |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-34: 2FA Pending Token Expiry is 5 Minutes

| Field | Value |
|-------|-------|
| **Category** | Token Management |
| **Description** | Verify the 2FA pending token has a short (5 min) expiry |
| **Pre-conditions** | `2fa_pending` token from login (SEC-05) |
| **Steps** | 1. Decode the 2FA pending token at [jwt.io](https://jwt.io)<br>2. Check the `exp` field |
| **Expected Result** | `exp` is approximately 5 minutes after the token was issued |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 10. Password Security

### SEC-35: Passwords are Hashed (Not Stored in Plaintext)

| Field | Value |
|-------|-------|
| **Category** | Password Security |
| **Description** | Verify the database stores hashed passwords, not plaintext |
| **Pre-conditions** | Access to the database (e.g., via DB client or Swagger seed data) |
| **Steps** | 1. Query the `users` table directly (via DB client or check logs)<br>2. Inspect the `hashed_password` column for any user |
| **Expected Result** | Password is a PBKDF2-SHA256 hash string (starts with `$pbkdf2-sha256$`), not the original password |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-36: API Never Returns Password Hash

| Field | Value |
|-------|-------|
| **Category** | Data Exposure |
| **Description** | Verify no API endpoint leaks the password hash |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. GET `/api/auth/me`<br>2. Search the entire JSON response for `password` or `hashed_password` |
| **Expected Result** | Response contains only `id`, `email`, `full_name`, `created_at` — no password fields |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 11. Frontend Security

### SEC-37: Protected Routes Redirect to Login

| Field | Value |
|-------|-------|
| **Category** | Frontend Auth |
| **Description** | Verify accessing protected pages without login redirects to Login |
| **Pre-conditions** | Not logged in (clear localStorage) |
| **Steps** | 1. Clear browser localStorage<br>2. Navigate directly to `http://localhost:5173/dashboard`<br>3. Try `/transactions`, `/budgets`, `/insights`, `/anomalies`, `/settings` |
| **Expected Result** | All protected routes redirect to the Login page |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-38: Token Stored in localStorage

| Field | Value |
|-------|-------|
| **Category** | Frontend Auth |
| **Description** | Verify the frontend stores the access token in localStorage after successful 2FA |
| **Pre-conditions** | Complete full login + 2FA flow |
| **Steps** | 1. Complete login + 2FA via the frontend<br>2. Open DevTools → Application → Local Storage → `localhost:5173`<br>3. Look for the token key |
| **Expected Result** | Token is stored; it is a valid JWT with `access` scope |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-39: Logout Clears Token

| Field | Value |
|-------|-------|
| **Category** | Frontend Auth |
| **Description** | Verify logout removes the stored token |
| **Pre-conditions** | Logged in |
| **Steps** | 1. Click Logout in the UI<br>2. Open DevTools → Application → Local Storage<br>3. Check that the token is removed<br>4. Try navigating to `/dashboard` |
| **Expected Result** | Token is removed from localStorage; user is redirected to Login page |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 12. API Error Handling & Information Disclosure

### SEC-40: 404 Responses Do Not Leak Internal Details

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Description** | Verify 404 responses don't reveal database structure or internal paths |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. GET `/api/accounts/99999` (non-existent ID)<br>2. GET `/api/categories/99999`<br>3. GET `/api/nonexistent-endpoint` |
| **Expected Result** | Generic "not found" messages; no SQL errors, stack traces, or internal file paths |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-41: Server Errors Don't Expose Stack Traces

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Description** | Verify 500 errors (if any) don't leak code or stack traces to the client |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. Attempt to trigger a server error (e.g., send malformed data that bypasses Pydantic)<br>2. Check the response body |
| **Expected Result** | Response contains a generic error message, NOT a Python traceback |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## 13. Sensitive Data Handling

### SEC-42: Credit Card Numbers Are Not Stored in Full

| Field | Value |
|-------|-------|
| **Category** | Data Protection |
| **Description** | Verify only last 4 digits of card numbers are stored |
| **Pre-conditions** | Valid access token |
| **Steps** | 1. POST `/api/transactions/` with `card_last_four: "1234"`<br>2. POST `/api/accounts/` with `card_last_four: "5678"`<br>3. GET both records back and inspect |
| **Expected Result** | Only last 4 digits stored; no field accepts or returns a full card number |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

### SEC-43: Swagger UI Accessible (Documentation)

| Field | Value |
|-------|-------|
| **Category** | API Documentation |
| **Description** | Verify the Swagger UI is available and shows all endpoints |
| **Pre-conditions** | Backend running |
| **Steps** | 1. Open `http://localhost:8000/docs`<br>2. Verify all endpoint groups are listed: auth, transactions, budgets, insights, anomalies, imports, settings, accounts, categories |
| **Expected Result** | Swagger UI loads; all endpoints documented with request/response schemas |
| **Actual Result** | |
| **Pass / Fail** | |
| **Screenshot** | |

---

## Summary Tracker

| Test ID | Category | Result |
|---------|----------|--------|
| SEC-01 | Registration | |
| SEC-02 | Registration – Duplicate | |
| SEC-03 | Registration – Invalid Email | |
| SEC-04 | Registration – Oversized Password | |
| SEC-05 | Login – 2FA Pending | |
| SEC-06 | Login – Wrong Password | |
| SEC-07 | Login – Non-Existent User | |
| SEC-08 | 2FA – Correct Code | |
| SEC-09 | 2FA – Wrong Code | |
| SEC-10 | 2FA – Scope Enforcement (access → 2fa) | |
| SEC-11 | 2FA – Scope Enforcement (pending → routes) | |
| SEC-12 | 2FA – Frontend UI Flow | |
| SEC-13 | No Token – All Endpoints | |
| SEC-14 | Invalid Token | |
| SEC-15 | Expired Token | |
| SEC-16 | Token – No Password Leak | |
| SEC-17 | Data Isolation – Transactions | |
| SEC-18 | Data Isolation – Budgets | |
| SEC-19 | Data Isolation – Accounts | |
| SEC-20 | Data Isolation – Categories | |
| SEC-21 | Data Isolation – Cross-User Deletion | |
| SEC-22 | SQL Injection – Login | |
| SEC-23 | SQL Injection – Query Params | |
| SEC-24 | XSS – Category Name | |
| SEC-25 | XSS – Merchant Name | |
| SEC-26 | Pydantic Validation | |
| SEC-27 | Category Color Validation | |
| SEC-28 | File Upload – Wrong Type | |
| SEC-29 | File Upload – Empty File | |
| SEC-30 | File Upload – Malicious CSV | |
| SEC-31 | CORS – Allowed Origins | |
| SEC-32 | CORS – Blocked Origins | |
| SEC-33 | Token Expiry – 30 min | |
| SEC-34 | Token Expiry – 2FA 5 min | |
| SEC-35 | Password Hashing | |
| SEC-36 | No Password in API | |
| SEC-37 | Frontend – Protected Routes | |
| SEC-38 | Frontend – Token Storage | |
| SEC-39 | Frontend – Logout | |
| SEC-40 | 404 – No Info Leak | |
| SEC-41 | 500 – No Stack Trace | |
| SEC-42 | No Full Card Numbers | |
| SEC-43 | Swagger UI Available | |

---

**Total Test Cases: 43**

| Category | Count |
|----------|-------|
| Authentication (Registration + Login) | 7 |
| Two-Factor Authentication | 5 |
| Token Security | 4 |
| Data Isolation (Multi-User) | 5 |
| Input Validation & Injection | 6 |
| File Upload Security | 3 |
| CORS | 2 |
| Session & Token Expiry | 2 |
| Password Security | 2 |
| Frontend Security | 3 |
| Error Handling & Info Disclosure | 2 |
| Sensitive Data & Documentation | 2 |

---

> **Note**: Capture screenshots for every test result. These are required for the course submission's Technical Details Document under "Testing & CI/CD".
