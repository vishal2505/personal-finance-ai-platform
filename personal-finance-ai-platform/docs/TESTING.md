# Testing Strategy

This document describes the testing pyramid, what is covered, how to run tests, and how to generate coverage reports for the **personal-finance-ai-platform** codebase.

---

## 1. Testing Pyramid

```
            ┌────────────────────┐
            │    E2E / Manual    │   (not automated yet)
            ├────────────────────┤
            │ Integration (API)  │   ← FastAPI TestClient + SQLite in-memory
            ├────────────────────┤
            │  Component Tests   │   ← Vitest + @testing-library/react
            ├────────────────────┤
            │   Unit Tests       │   ← pytest functions / vitest functions
            └────────────────────┘
```

The bulk of automated tests live at the **integration** and **component** layers to give the highest confidence with the least maintenance overhead.

---

## 2. Backend Tests (FastAPI / pytest)

### Technology stack

| Tool | Version | Purpose |
|------|---------|---------|
| pytest | 7.4.x | Test runner |
| httpx / FastAPI TestClient | — | HTTP-level route testing |
| SQLAlchemy + SQLite `:memory:` | — | Isolated per-test database |
| `StaticPool` | — | Ensures all SQLAlchemy sessions share one in-memory DB |

### Test files

| File | Endpoint prefix | Description |
|------|-----------------|-------------|
| `tests/conftest.py` | — | Shared engine, session, `get_db` override, and common fixtures (`test_db`, `test_user`, `auth_headers`, `system_category`) |
| `tests/test_categories.py` | `/api/categories` | Full CRUD for the primary categories router: create, list (filter by type / include_inactive / hidden), get, update (duplicate, circular-reference, valid-parent-chain), delete, bulk-reorder, stats |
| `tests/test_settings_categories.py` | `/api/settings/categories` | CRUD for the simplified Settings-UI categories router: create (success, duplicate, isolation, unauthenticated), list (own-only, excludes-inactive, excludes-hidden, field-check), update (success, 404, isolation, unauthenticated), delete (success, 404, isolation, unauthenticated) |
| `tests/test_merchant_rules.py` | `/api/settings/merchant-rules` | Full CRUD + toggle: create (success, exact-match, invalid-category, other-user's-category, unauthenticated), list (own-only, empty, isolation, field-check, unauthenticated), update (success, change-category, 404, invalid-category, isolation, unauthenticated), delete (success, 404, isolation, unauthenticated), toggle (activates/deactivates, 404, isolation, unauthenticated) |
| `tests/security/test_2fa.py` | `/api/auth` | Two-factor-authentication flow |
| `tests/test_imports.py` | `/api/imports` | Import / parsing flow |

### How isolation works

Every test function that touches the database uses the `test_db` fixture, which calls `Base.metadata.create_all(bind=engine)` before the test and `Base.metadata.drop_all(bind=engine)` after. This gives each test a perfectly clean slate.

The FastAPI `get_db` dependency is replaced globally in `conftest.py`:

```python
app.dependency_overrides[get_db] = override_get_db
```

This ensures every HTTP request made via `TestClient` hits the in-memory SQLite database, not a real MySQL instance.

### Running backend tests

```bash
cd backend

# Run all tests
pytest

# Run a specific file
pytest tests/test_merchant_rules.py

# Run with verbose output
pytest -v

# Run with coverage report (requires pytest-cov)
pip install pytest-cov
pytest --cov=app --cov-report=term-missing
```

### Estimated backend coverage

| Router / module | Covered scenarios | Approx. line coverage |
|----------------|-------------------|-----------------------|
| `routers/categories.py` | Create, list (4 filter combos), get, update (6 variants), delete, reorder, stats | ~95 % |
| `routers/settings.py` – categories | Create, list, update, delete (auth + isolation) | ~90 % |
| `routers/settings.py` – merchant rules | Full CRUD + toggle (auth + isolation) | ~95 % |
| `routers/auth.py` | 2FA happy path + error paths | ~80 % |
| `routers/imports.py` | Import upload flow | ~70 % |
| **Overall backend target** | — | **≥ 80 %** |

---

## 3. Frontend Tests (React / Vitest)

### Technology stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.x | Test runner (configured in `vite.config.ts`) |
| @testing-library/react | 16.x | Component rendering and interaction |
| @testing-library/user-event | 14.x | Realistic user interactions |
| @testing-library/jest-dom | 6.x | Custom DOM matchers (`toBeInTheDocument`, etc.) |
| happy-dom | 20.x | Lightweight DOM environment |

Vitest is configured inside `vite.config.ts`:

```typescript
test: {
  globals: true,
  environment: 'happy-dom',
  setupFiles: './src/test/setup.ts',
  css: false,
}
```

`src/test/setup.ts` imports `@testing-library/jest-dom` to make DOM matchers available in all tests.

### Test files

| File | Component | Description |
|------|-----------|-------------|
| `src/test/security/TwoFactorAuth.test.tsx` | `TwoFactorAuth` | 13 tests: rendering, digit input, auto-focus, backspace, paste (valid/invalid), submit button state, form submission, error display, debounce |
| `src/pages/__tests__/UploadStatement.test.tsx` | `UploadStatement` | 11 tests: initial render, drag-and-drop (PDF, CSV), Remove, unsupported file type (drop + input), file-input selection, submit button state, axios.post call |

### Mocking strategy

Axios is mocked with `vi.mock('axios')` so that:
- `axios.get` (import history) returns `{ data: [] }` by default (no network call).
- `axios.post` (upload) can be configured per test to simulate success or failure.

`react-router-dom` is mocked to stub out `useNavigate` without requiring a real Router.

Lucide-React icons are replaced with plain `<span>` elements to avoid SVG rendering overhead in the DOM environment.

### Stable selectors

The `UploadStatement` dropzone div has a `data-testid="statement-dropzone"` attribute, making tests robust against CSS-class renames:

```tsx
<div data-testid="statement-dropzone" onDragOver={...} onDrop={...}>
```

### Running frontend tests

```bash
cd frontend

# Single run (CI mode)
npm test                  # runs: vitest run

# Watch mode (development)
npm run test:watch        # runs: vitest

# With coverage (add @vitest/coverage-v8 if not installed)
npm install -D @vitest/coverage-v8
npx vitest run --coverage
```

### Estimated frontend coverage

| Component | Covered scenarios | Approx. line coverage |
|-----------|-------------------|-----------------------|
| `UploadStatement.tsx` | Drop (PDF/CSV/unsupported), file-input, remove, submit, axios call | ~80 % |
| `TwoFactorAuth.tsx` | All digit-input interactions, submit, error | ~90 % |
| **Overall frontend target** | — | **≥ 75 %** |

---

## 4. Good Practices and Conventions

### Determinism
- Backend: every test owns its database state via `test_db` (create_all / drop_all).
- Frontend: axios is always mocked; no network calls reach a real server.

### Fixture layering (backend)

```
conftest.py
  └─ test_db          (creates/drops tables)
       └─ test_user   (inserts test user)
            └─ auth_token  (creates JWT with "access" scope)
                 └─ auth_headers
```

Test-specific fixtures (e.g. `category`, `other_user`) are defined in the file that needs them and depend on `test_db`.

### Auth token scope

Protected routes require the `"access"` JWT scope. Tokens are always created with:

```python
create_access_token(data={"sub": user.email, "scopes": ["access"]})
```

### Ownership isolation

Every CRUD test suite includes at least one test that verifies a user cannot access or mutate another user's resources (expects HTTP 404 rather than 403 to avoid leaking resource existence).

### File-naming conventions

| Layer | Location | Pattern |
|-------|----------|---------|
| Backend API tests | `backend/tests/test_*.py` | `test_<feature>.py` |
| Frontend component tests | `frontend/src/**/\_\_tests\_\_/*.test.tsx` | `ComponentName.test.tsx` |

---

## 5. CI Integration

Tests run automatically in the CI pipeline. The commands used are:

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm test
```

No additional environment variables are required for tests: the DATABASE_URL is **unconditionally overridden** to `sqlite:///:memory:` inside `conftest.py` before any app module is imported, so any value already present in the shell or CI environment is safely replaced.
