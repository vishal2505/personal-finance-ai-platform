# Pull Request #46 — PDF Parser Enhancement

**Branch:** `feature/pdf-parser` → `main`  
**Merged:** February 2026  
**Status:** ✅ Merged  

---

## Overview

This PR significantly enhances the PDF statement import pipeline with improved parsing reliability, a regex-based fallback parser, and a consolidated upload endpoint. It also adds several frontend improvements to the Import Review page including bulk delete, transaction summaries, and import history.

---

## Changes Summary

| Area | Files Changed | Insertions | Deletions |
|------|:------------:|:----------:|:---------:|
| Backend | 5 | — | — |
| Frontend | 2 | — | — |
| Test Data | 2 | — | — |
| **Total** | **10** | **+483** | **-512** |

---

## Commits

| Commit | Description |
|--------|-------------|
| `0494332` | Add 2 PDF test data from Cynthia |
| `945e178` | PDF import enhancement with regex parsing fallback and improved header detection |
| `2e54f53` | Consolidate statement upload endpoint into imports router, enhancing PDF parsing and including bank/card details for new transactions |
| `0d19d6d` | Add transaction count and total amount summary to the Import Review page header |
| `c80f11d` | Add bulk delete functionality for selected transactions on the Import Review page |
| `577a93d` | Implement import history display and include total amount in import process |
| `65f17ce` | Add `import_job_id` to ensure filters are unique |

---

## Backend Changes

### 1. Consolidated Upload Endpoint (`imports.py`)
- **Removed** the standalone `upload.py` router (297 lines deleted).
- **Moved** the `/upload` endpoint into the imports router for a single source of truth.
- Added `bank_name` and `card_last_four` optional parameters to the upload endpoint so bank/card metadata is stored on each imported transaction.
- Response now returns both the `ImportJob` and the list of created `Transaction` objects via a new `UploadResponse` schema.

### 2. Improved PDF Table Parsing
- Expanded date keywords to include `"date of trans"`.
- Expanded amount keywords to include `"amount (sgd)"` and `"amount(sgd)"` for OCBC statement support.
- Improved merchant column detection to avoid accidentally selecting the amount column.
- Added filtering to skip total/subtotal/balance rows.
- Enhanced cell value cleaning (newline replacement, whitespace trimming).

### 3. Regex Fallback Parser (`_parse_text_fallback`)
- New function that activates when `pdfplumber` table extraction returns no results.
- Uses regex to identify transaction patterns in raw page text (e.g., `DD/MM/YYYY MERCHANT 123.45`).
- Handles various date formats and comma-separated amounts.

### 4. Model & Schema Updates
- **`ImportJob` model:** Added `total_amount` column (`Float`, default `0.0`).
- **`ImportJobResponse` schema:** Added `total_amount` field.
- **New `UploadResponse` schema:** Wraps `ImportJobResponse` + `List[TransactionResponse]`.

### 5. Main App Router Update (`main.py`)
- Removed the now-deleted upload router include.

---

## Frontend Changes

### 1. Import Review Page (`ImportReview.tsx`)
- **Transaction count & total amount** displayed in the page header.
- **Bulk delete** — users can select multiple transactions and delete them at once.
- **`import_job_id` filtering** — ensures the review page only shows transactions from the current import job.

### 2. Upload Statement Page (`UploadStatement.tsx`)
- **Import history section** — displays previously imported statement jobs.
- Updated to work with the new consolidated upload endpoint and `UploadResponse` format.
- Includes bank/card detail fields in the upload flow.

---

## Test Data Added

- `test-data/OCBC_Statement_Dec2025.pdf`
- `test-data/OCBC_Statement_Jan2026.pdf`

These are sample OCBC bank statements used for testing the enhanced PDF parser.

---

## How to Test

1. **Start the backend:**
   ```bash
   cd personal-finance-ai-platform && ./start-backend.sh
   ```
2. **Start the frontend:**
   ```bash
   cd personal-finance-ai-platform && ./start-frontend.sh
   ```
3. **Upload a PDF statement** via the Upload Statement page — verify transactions are parsed and shown on Import Review.
4. **Test bulk delete** — select multiple transactions on Import Review and delete them.
5. **Verify import history** — after uploading, check that the import job appears in the history section on the Upload Statement page.
6. **Test fallback parser** — upload a PDF where table extraction fails (e.g., a statement without clear table borders) and verify regex parsing kicks in.

---

## Related Issues

- PR #46: [feature/pdf-parser](https://github.com/vishal2505/personal-finance-ai-platform/pull/46)
