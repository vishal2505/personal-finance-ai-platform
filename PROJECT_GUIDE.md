# Personal Finance AI Platform – Project Build Guide

> Course: SMU – Modern Software Solution Development  
> Repository: personal-finance-ai-platform  
> Purpose: Internal master guide for development (not a submission document)

---

## 1. Problem Statement

People spend across multiple credit cards and banks, making it difficult to:
- consolidate transactions into one view,
- understand spending patterns,
- detect unusual expenses,
- and plan budgets or financial goals consistently.

This project builds a **unified AI-driven platform** that allows users to:
- import monthly credit card statements,
- automatically categorize transactions,
- generate AI-driven insights,
- detect anomalies,
- and track budgets and goals.

---

## 2. Key Limitation (Singapore Banking Constraint)

Most Singapore banks **do not provide public consumer APIs** to retrieve credit card statements automatically.

As a result:
- Bank emails often say *“statement is available in the bank app”*
- Third-party apps cannot fetch statements programmatically

### Design Decision
The platform will support:
- **Manual statement import (PDF / CSV upload)** as the primary ingestion method
- Optional email-forwarding **only when attachments exist**

This constraint is explicitly acknowledged and shapes the system architecture.

---

## 3. What We Must Deliver (Course Requirements)

The system must demonstrate evidence of:

- Agile process + DevOps practices
- CRUD backend APIs
- Persistent database
- Security (authentication & authorization)
- Swagger / OpenAPI documentation
- Integration and benefits of AI service(s)
- Testing, CI, code review, refactoring, pair programming
- Public cloud deployment
- Git + Agile evidence
- Two demos:
  - Week 6 (video)
  - Week 10 (live demo)
- Documentation with screenshots

---

## 4. Product Vision & Scope

### 4.1 MVP (Baseline – must be ready by Week 6)

The MVP must include:
- User authentication & security
- Statement upload and transaction import
- CRUD for transactions and categories
- Basic expense dashboard
- AI monthly insights (at least one AI service)
- Swagger UI
- Database persistence
- Publicly deployed application URL

---

### 4.2 Beyond-Baseline Features (for extra marks)

Select 4–8 user-visible features:
- Import review workflow (bulk category mapping)
- Multi-card support (3–4 cards)
- Budgets and alerts
- Anomaly detection with explanation
- Natural language queries (e.g. “show my food spend last 2 weeks”)
- Export reports (CSV / PDF)
- Recurring transactions
- Goal tracking (e.g. save $X, reduce category spend)

Each feature should be sprint-sized (~2 weeks).

---

## 5. High-Level Architecture

### 5.1 Proposed Stack

- **Frontend**: React or Vue
- **Backend**: FastAPI (Python) or Node.js (NestJS)
- **Database**: PostgreSQL (or MySQL for staging)
- **AI Module**:
  - LLM for insight generation
  - Rules / ML for anomaly scoring
- **Storage**: S3 or equivalent for uploaded statements (optional)
- **Deployment**:
  - Frontend: Vercel / Netlify
  - Backend & DB: AWS

---

### 5.2 Security Design

- JWT-based authentication
- Role-based access control (user / admin)
- Never store full credit card numbers
  - Only card nickname + last 4 digits (optional)
- Uploaded files:
  - Stored securely or deleted after parsing (decision must be documented)

---

### 5.3 API-First Design

- OpenAPI / Swagger enabled from Day 1
- All endpoints documented with request/response schemas

---

## 6. Database Design

Core tables:
- users
- accounts / cards
- categories
- transactions
- import_jobs
- merchant_mapping_rules
- budgets
- insights
- anomalies

Performance indexes:
- (user_id, txn_date)
- (user_id, category_id)

---

## 7. Backend API Design

### Authentication
- POST `/auth/register`
- POST `/auth/login`

### Accounts / Cards
- GET / POST `/accounts`
- PUT / DELETE `/accounts/{id}`

### Categories
- GET / POST `/categories`
- PUT / DELETE `/categories/{id}`

### Transactions
- GET `/transactions?from=&to=&category=&merchant=`
- POST `/transactions`
- PUT / DELETE `/transactions/{id}`

### Statement Import
- POST `/imports/upload` (PDF / CSV)
- GET `/imports/{id}/status`
- POST `/imports/{id}/confirm`

### AI
- POST `/ai/monthly-insights?month=`
- POST `/ai/anomaly-check?month=`

---

## 8. Statement Import Pipeline

### Core Flow
1. User selects card/account and month
2. Uploads PDF or CSV statement
3. Backend creates an `import_job`
4. Parser extracts transactions
5. Data normalized into internal schema
6. Auto-categorization:
   - merchant rules first
   - AI for unknown merchants
7. User reviews imported data
8. User confirms → data persisted → dashboard updates

### Limitation Handling
If a forwarded email contains **no attachment**:
- Show message:
  > “No attachment found. Please upload the PDF/CSV downloaded from your bank app.”

---

## 9. Frontend Screens

Required UI screens:
- Login / Register
- Dashboard
- Upload Statement
- Import Review (bulk mapping)
- Transactions list (filters by date/category)
- Budgets
- Insights
- Anomalies
- Settings (categories, merchant rules)

---

## 10. AI Integration

### 10.1 Monthly Insights
Input (structured):
- totals per category
- month-over-month changes
- top merchants

Output:
- 3–5 bullet summary
- top spending drivers
- 3 actionable suggestions

Store AI output in `insights` table.

---

### 10.2 Anomaly Detection
- Compute anomaly score (z-score / isolation forest)
- AI explanation:
  > “This transaction is unusual because…”

Safety:
- Informational only (no financial advice)
- Explanations grounded in imported data

---

## 11. Testing & Code Quality

### Testing
- Unit tests:
  - parsing logic
  - budget calculations
  - anomaly scoring
- API tests:
  - auth
  - CRUD
  - import confirm flow
- Security tests:
  - unauthorized access → 401 / 403

### Code Quality Practices
- Feature branches only
- Mandatory PR reviews (≥1 reviewer)
- Refactoring commits documented
- Pair programming sessions noted

---

## 12. CI/CD Pipeline

Use GitHub Actions to:
- Lint / format
- Run tests
- Build application
- Deploy on merge to `main`

Capture:
- Green pipeline screenshots
- Deployment logs

---

## 13. Cloud Deployment (Staging First)

- AWS ECS (on EC2 for low cost)
- Managed database (MySQL/Postgres)
- Public URL for demo
- Separate configs for staging vs production

---

## 14. Demo Plan

### Week 6 Demo
- Login
- Statement upload
- Import review
- Dashboard
- AI insights
- Swagger UI
- Deployed URL

### Week 10 Demo
- Full workflow
- AI insights + anomalies
- Budgets & goals
- Extra features
- Architecture & DevOps walkthrough

---

## 15. Documentation for Submission (Later)

### Software Process Document
- Agile process
- Jira screenshots
- Sprint artifacts
- Git contribution stats

### Technical Details Document
- Architecture diagram
- Swagger screenshots
- DB ERD
- Security design
- AI integration
- Testing & CI/CD
- Deployment details

### Contributions Summary
- Member → responsibilities and contributions

---

## 16. Development Principle

This guide is a **living document**.
Update it as:
- scope evolves,
- decisions change,
- features are added.

All submission documents will be derived from this guide later.
