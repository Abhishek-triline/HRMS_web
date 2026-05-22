# @nexora/web

Nexora HRMS — web app.

**Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind 3
· TanStack Query 5 · React Hook Form · zod · iron-session.

This repo is the `apps/web` submodule of the meta repo at
[github.com/Abhishek-triline/HRMS_app](https://github.com/Abhishek-triline/HRMS_app).
You should **work from the meta clone**, not from a standalone clone of
this repo — the workspace dependency `@nexora/contracts` lives in the
meta repo's `packages/contracts/` and won't resolve without it.

---

## Quick start (from the meta clone)

```bash
# At the meta root — not inside apps/web
git clone --recurse-submodules https://github.com/Abhishek-triline/HRMS_app.git
cd HRMS_app
pnpm install

# Point at the API
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local — set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Run the dev server (port 3000)
pnpm --filter web dev
```

The API server must be running on the host configured in
`NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`). See the
sibling repo [HRMS_api](https://github.com/Abhishek-triline/HRMS_api)
for how to start it.

---

## Repository layout

```
apps/web/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # login · first-login · forgot/reset password
│   │   ├── (admin)/admin/         # Admin (HR) routes — full management surface
│   │   ├── (manager)/manager/     # Manager routes — team + approvals
│   │   ├── (employee)/employee/   # Employee routes — self-service
│   │   ├── (payroll)/payroll/     # PayrollOfficer routes — runs + tax + payslips
│   │   └── api/auth/              # BFF session shim
│   ├── components/
│   │   ├── ui/                    # Generic primitives (Button, Input, StatusBadge…)
│   │   ├── attendance/            # AttendanceCalendar, CheckInPanel, LateMarkBanner…
│   │   ├── leave/                 # MyLeaveShell, LeaveBalanceGrid, LeaveRequestForm…
│   │   ├── employees/             # ProfileHero, EmployeeForm, EmployeePicker…
│   │   ├── payroll/               # PayrollRunStatusBadge, MoneyDisplay, RunSummaryCard…
│   │   └── performance/           # CycleStatusBadge, CloseCycleModal, GoalList…
│   ├── features/                  # Feature-scoped views shared across roles
│   │   ├── attendance/            # MyAttendanceView, MyCheckInView
│   │   ├── leave-encashment/      # MyEncashmentView, EncashmentStatusBadge
│   │   ├── profile/               # ProfileView, AdminSelfProfileEditor
│   │   ├── admin/                 # AuditLogPageClient
│   │   └── configuration/         # ConfigTabs + per-tab panels
│   └── lib/
│       ├── api/                   # Typed fetch wrappers per domain + qk query keys
│       ├── hooks/                 # TanStack Query hooks (useMe, useLeave, …)
│       └── status/maps.ts         # INT status maps mirroring @nexora/contracts
└── package.json
```

---

## Architecture in one paragraph

The app is a Next.js 14 App Router project with four role-scoped layout
groups (`(admin)`, `(manager)`, `(employee)`, `(payroll)`). Most "My X"
pages — My Leave, My Attendance, My Encashment, My Check-in, Profile —
render a **shared view component** from `features/<domain>/components/`
that every role's wrapper page calls with role-specific props. Forms
use React Hook Form + zod (schemas imported from `@nexora/contracts`).
Server state goes through TanStack Query hooks in `lib/hooks/` against
the typed fetch wrappers in `lib/api/`. Status codes are INT
everywhere — never strings — and badges go through entity-specific
wrappers (`LeaveStatusBadge`, `PayrollRunStatusBadge`, etc.) which use
the maps in `lib/status/maps.ts`.

Full UI/UX playbook (theme tokens, 16 canonical patterns,
prototype↔React route map, common pitfalls): see the meta repo's
Claude Code skill
[.claude/skills/nexora-frontend-ui/](https://github.com/Abhishek-triline/HRMS_app/tree/main/.claude/skills/nexora-frontend-ui).

---

## Scripts

| Command | Action |
|---|---|
| `pnpm dev` | Next.js dev server with HMR (port 3000) |
| `pnpm build` | Production build → `.next/` |
| `pnpm start` | Run the compiled production server |
| `pnpm lint` | ESLint + Next.js lint rules |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (unit tests) |
| `pnpm e2e` | Playwright end-to-end suite |

All commands must run inside the meta clone — none of them resolve
`@nexora/contracts` standalone.

---

## Status codes & badges

Every status on the wire is an INT. Source of truth: the meta repo's
`packages/contracts/`. Mirrored client-side in
[`src/lib/status/maps.ts`](src/lib/status/maps.ts) with constants and
human-readable maps.

Always use the **entity-specific badge wrapper**, never raw `<span>`:

| Wrapper | Use for |
|---|---|
| `AttendanceStatusBadge` | Daily attendance |
| `LeaveStatusBadge` | Leave requests |
| `PayrollRunStatusBadge` | Payroll runs |
| `PayslipStatusBadge` | Individual payslips |
| `EncashmentStatusBadge` | Encashment requests |
| `CycleStatusBadge` | Performance cycles |

Badge padding is fixed at `px-2 py-0.5`. Don't override.

---

## Theme tokens — strict palette

Tailwind classes may only reference these tokens:

```
forest · emerald · mint · softmint · sage · richgreen · greenbg
charcoal · slate · offwhite
umber · umberbg
crimson · crimsonbg
lockedbg · lockedfg
amber-*    (reserved for leave-only UI)
```

**No arbitrary hex.** Exception: hero gradients (`data-tod=morning/day/
evening/night`) already exist as inline styles in `globals.css` — they've
been iterated many times and should not be touched without explicit
owner approval.

---

## Configuration

Env vars (see `.env.example`):

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | API host — e.g. `http://localhost:4000` (dev), `https://api.nexora.in` (prod) |
| `SESSION_SECRET` | iron-session encryption key (must match the API's) |

---

## Working in this sub-repo

Submodules default to a **detached HEAD** after
`git submodule update --init`. Switch to a branch before editing:

```bash
cd apps/web
git checkout main
git pull --ff-only origin main
git checkout -b feat/<thing>
# … edit, test, push …
git push -u origin feat/<thing>
# Open PR on github.com/Abhishek-triline/HRMS_web
```

After the PR merges into `main` here, the meta repo's gitlink is still
on the old SHA. Bump it from the meta root:

```bash
cd /path/to/HRMS_app
git submodule update --remote apps/web
git add apps/web
git commit -m "chore: bump apps/web to <short-sha>"
git push
```

---

## Related repos & docs

- Meta repo: https://github.com/Abhishek-triline/HRMS_app
- API sub-repo: https://github.com/Abhishek-triline/HRMS_api
- Shared contracts package (`@nexora/contracts`): in the meta repo
  under `packages/contracts/`
- Prototype mock-ups (visual reference): in the meta repo under
  `prototype/<role>/*.html` — referenced from many component
  JSDoc blocks; treat as the design-truth alongside this code
- UI conventions: [`docs/design/ui-conventions.md`](https://github.com/Abhishek-triline/HRMS_app/blob/main/docs/design/ui-conventions.md) in the meta repo
- Multi-repo setup playbook: [`docs/repo_setup/MULTI_REPO_SETUP.md`](https://github.com/Abhishek-triline/HRMS_app/blob/main/docs/repo_setup/MULTI_REPO_SETUP.md)
