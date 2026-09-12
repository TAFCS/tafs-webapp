# Development rules — TAFSync webapp

Fixed rules. They are not suggestions and not defaults to be weighed against
convenience: if a change breaks one, the change is wrong, not the rule.

Finance invariants live in `tafs-backend/CLAUDE.md`. Backend conventions live in
`tafs-backend/CODING_PRACTICES.md`.

---

## Rule 1 — every filter is multi-select

Any filter added to any page accepts **more than one value**. Campus,
department, staff category, status, class, section, segment, discipline — all of
them, including ones that feel naturally singular today.

- The control is a multi-select (chips or a checklist), never a `<select>` that
  holds one value.
- **Empty means "all", not "none".** An untouched filter must never hide rows.
- State is an array, and it round-trips through the URL as a repeated or
  comma-joined query param, so a filtered view can be shared and reloaded.
- Clearing is always available and always returns to the unfiltered list.

`app/(dashboard)/hr/employees/page.tsx` is the reference: `campusIds`,
`departmentIds`, `categoryIds` and `statuses` are all `number[]` / `string[]`
driven by `toggleId`, with a single Clear Filters control.

Do not ship a single-value filter and plan to widen it later. Widening one after
the fact means touching every caller, every URL that has been shared, and every
`=== value` comparison written against it.

---

## Rule 2 — every page has a real search, matched to what the page is for

A page that lists records carries a search box wired to a **server-side search
endpoint for that kind of record**. Not a client-side `.filter()` over whatever
the page happened to load — that only searches the rows already fetched, which
silently stops working the moment the list is paginated or scoped.

Pick the endpoint by what the page is about:

| The page lists | Use |
|---|---|
| Students | `GET /v1/students/search-simple` |
| Employees / staff | `GET /v1/hr/employees/search-simple` |
| Accounts, users, access | `GET /v1/users/search-simple` — **does not exist yet; build it** |
| Anything else | A new `search-simple` on that module, in the same shape |

### The shape a search endpoint must follow

Copy `StudentsService.searchSimple` / `EmployeesService.searchSimple` rather than
inventing a variant:

- `GET <module>/search-simple`, query `q` plus optional narrowing ids that
  mirror the page's filters (`campus_id`, `class_id`, `section_id`, …).
- An empty `q` returns `[]`. It does not return the whole table.
- Returns a **small identifying projection** — id, display name, code — never
  the full record. The list endpoint is what returns full rows.
- Matches the identifiers people actually type: name, code, GR / employee code,
  CNIC, username. `EmployeesService.searchSimple` also reconstructs code
  patterns from raw PIN digits, because that is what gets typed off a device.
- **Merges the caller's scope** (`ScopeService.whereForEmployees` /
  `whereForStudents`). A search that ignores scope is a way to read records the
  list already refuses to show — the same hole the Excel exports had.
- Guarded by the same `@CheckPolicies` / `@RequireAction` as the list it serves.

### On the client

Go through the service layer (`students.service.ts`, `hr.service.ts`), not a
bare `api.get` in a page component, so the contract has one definition. Debounce
input, and make the empty state say whether it found nothing or is still typing.

---

## Where these bite

Today the Employee Directory and People & Access both filter in memory over a
full list fetch. Both predate these rules. When either is next touched, move it
onto a real search endpoint rather than extending the in-memory filter — and
People & Access needs `/v1/users/search-simple` written first.
