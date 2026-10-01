# Development rules — TAFSync webapp

Fixed rules. They are not suggestions and not defaults to be weighed against
convenience: if a change breaks one, the change is wrong, not the rule.

Finance invariants live in `tafs-backend/CLAUDE.md`. Backend conventions live in
`tafs-backend/CODING_PRACTICES.md`.

---

## Coral9 tickets
This repo is Coral9 project `tafs-digital-transformation`. The coral9 MCP server is connected.
Before any task that changes code: search_tickets, then start_work (existing ticket or a new one).
When the work is done: finish_work with a summary. Keep ticket status true to reality.

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

---

## Coral9 tickets

This repo is Coral9 project `tafs-digital-transformation`. The connection is pinned to it, so you can omit `project` on every call. The `coral9` MCP server is connected and acts as the developer whose token it holds.

**No untracked work.** Every task that changes code, config, content or deliverables maps to a ticket, and the ticket reflects reality. Small changes are not an exception.

### Before changing anything
1. `search_tickets` with a few key words from the task.
2. A matching open ticket exists: `start_work` with its number. That assigns you and moves it to In Progress.
3. Nothing matches: `start_work` with a `title` and `description`. Do not ask permission first.
   - Title: like a good commit subject. What changes, not how.
   - Description: why, scope, and acceptance criteria.
   - Add `tags` (bug, feature, design) when obvious. Leave `priority` at medium unless told; `urgent` pings people on Discord immediately.
4. Skip tracking only for questions, explanations, or reading code with no change.
5. `start_work` returns `branch` — ignore it. This repo works directly on `main`: no feature branches, worktrees or PRs. Put the ticket's KEY-NUMBER (like ACME-42) in every commit message so the commit shows on the ticket. Since no PR merge moves the ticket, `finish_work` is what moves it.

One ticket per deliverable, not per file or command. Follow-ups on the same deliverable stay on the same ticket.

### While working
- `comment_on_ticket` for decisions, blockers, scope changes, or questions for the PM. Do not narrate every step.
- Found separate work you are not doing now (a bug, a follow-up): `create_ticket` for it instead of widening the current ticket. Use `parent` for a subticket.
- Work handed to someone else ("have Sara fix the invoice PDF"): `create_ticket` with `assignees` set to them. They get notified.
- Resuming a ticket: `get_ticket` first to read its description and recent comments.

### When done
- `finish_work` with a summary: what changed, key files, how to verify, anything left open. It moves the ticket to Under Review and pings the reviewers.
- Pass `status: "completed"` (Shipped) only when the user says no review is needed.
- Stopping before it is done: leave the ticket In Progress and comment what is left. If the user drops the work, `move_ticket` it back to Ready or Backlog with a note.
- Never move a ticket to Done unless the user, as a reviewer, tells you to.

### The board
Backlog → Ready → In Progress → Shipped → Under Review → Done. `move_ticket` walks the steps and checks permission at each.
- Change fields with `update_ticket`, people with `assign_ticket`, status with `move_ticket`, when the user asks. Then confirm.
- `my_tickets`: everything assigned to you. `get_project`: people, modules, counts per status.

### Always
- Never put secrets, tokens, passwords or personal data in tickets or comments.
- Tickets and comments are internal. Set `visible_to_client` only when the user says the client should see it.
- After every ticket write, give the user the ticket number and link in one line.
- If a coral9 call fails or the server is not connected, say so once and continue the work. Do not silently skip tracking.
