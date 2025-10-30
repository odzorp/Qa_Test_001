# QA Incident Simulation

This repository reproduces a customer validation issue and documents the exact problem, the implemented fix, and how to verify it. Keep this single README as the canonical reference for future engineers.

---

## Background

- The app validates user names against an external service at `https://schoolbaseapp.com/validate-name`.
- Sample data lives in `data/users.json`.
- The Express app iterates the names and forwards each to the external validator; logs and API responses report the validator results.

Files of interest (repository-relative)
- Application: `src/server.ts`
- Test files: `src/tests/nameValidation.test.ts`
- Data: `data/users.json`
- Jest config: `jest.config.js`
- Package config: `package.json`

---

## Exact Problem

The external validator returned 400 (Bad Request) for specific names in `data/users.json`. The failing entries contained non-ASCII characters:

- Smart/curly apostrophes (Unicode variants) found in:
  - `Luc O‘Connor` (U+2018)
  - `Sara O’Malley` (U+2019)
  - `Renee O‘Connor` (U+2018)
- Accented letters (diacritics) in:
  - `María López` (accented í, ó; combining marks U+0300–U+036F)

Root cause: the remote validator expects ASCII punctuation and base letters (e.g., ASCII apostrophe U+0027). Smart quotes and diacritical marks caused rejections even though the logical names were valid.

Note: The dataset does not contain leading/trailing spaces or multiple internal spaces — whitespace handling was added defensively.

---

## Solution (exact & minimal)

Normalize every name before sending it to the external validation service:

- Convert smart/curly single and double quotes to ASCII `'` and `"`.
- Decompose Unicode characters and remove combining diacritical marks (remove accents).
- Collapse repeated spaces and trim edges (defensive).

Implementation (placed in `src/server.ts` and used by `validateUser`):

```typescript
// filepath: src/server.ts
function normalizeName(name: string): string {
  return name
    .normalize('NFKD') // decompose letters + diacritics
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'") // smart single quotes → '
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // smart double quotes → "
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritical marks
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim(); // remove leading/trailing spaces
}
```

Ensure `validateUser` uses the normalized name:

```typescript
// filepath: src/server.ts
async function validateUser(name: string) {
  const normalized = normalizeName(name);
  const url = `${VALIDATION_URL}?name=${encodeURIComponent(normalized)}`;
  // send request to external service and return/log the result
}
```

---

## Tests added

- Unit tests for `normalizeName`:
  - Smart/curly quotes → ASCII apostrophe
  - Diacritic removal (e.g., `María López` → `Maria Lopez`)
  - Whitespace normalization (defensive)
- Integration test for `/api/validate-users`:
  - Verifies the endpoint processes every entry in `data/users.json` and returns the expected structure.

Example test file:
- `src/tests/nameValidation.test.ts`


Run tests:
```bash
npm test
```

---

## Manual verification — expected API result

Start the dev server:
```bash
npm run dev
```

Call the validation endpoint (PowerShell / curl):
```powershell
curl http://localhost:3000/api/validate-users
```

Expected PowerShell-like response (full Content JSON):

```text
StatusCode        : 200
StatusDescription : OK
Content           : {"validated":9,"results":[
  {"name":"Aminah Bello","status":"valid","message":"Name is valid."},
  {"name":"Jason Smith","status":"valid","message":"Name is valid."},
  {"name":"Luc O‘Connor","status":"valid","message":"Name is valid."},
  {"name":"María López","status":"valid","message":"Name is valid."},
  {"name":"T'Challa Udaku","status":"valid","message":"Name is valid."},
  {"name":"Sara O’Malley","status":"valid","message":"Name is valid."},
  {"name":"Renee O‘Connor","status":"valid","message":"Name is valid."},
  {"name":"Noah Johnson","status":"valid","message":"Name is valid."},
  {"name":"Chidera Obi","status":"valid","message":"Name is valid."}
]}
RawContent        : HTTP/1.1 200 OK
                    Connection: keep-alive
                    Keep-Alive: timeout=5
                    Content-Length: 649
                    Content-Type: application/json; charset=utf-8
                    Date: <date>
RawContentLength  : 649
```

Key verification points:
- `validated: 9` confirms all entries processed.
- Each `results` entry has `"status":"valid"` and `"message":"Name is valid."`

