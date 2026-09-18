# INN-68: Role-filter the sidebar and tidy auth-form error handling — Implementation Plan

**Git branch:** `INN-68-role-filter-sidebar-and-auth-forms`

## Context

Review-found UI nits: sidebar shows destinations the signed-in role cannot use; mixed `patient` + clinical roles land on the patient dashboard; LoginForm still prints raw Convex `error.message`; ChangePasswordForm hardcodes password length; audit actor label and action filter are brittle.

---

## Scope

- [x] Sidebar: clinicians get search / requests / emergency; reviewers get security / facilities; everyone gets dashboard + audit
- [x] Dashboard: check `isClinician` before `isPatient`
- [x] LoginForm catch uses `toUserFacingError` (other three auth forms already do)
- [x] ChangePasswordForm uses `MIN_PASSWORD_LENGTH` / `PASSWORD_TOO_SHORT_MESSAGE`
- [x] Audit: actor label from name or email; keep last seen name when the action filter is empty; controlled native `<select>`
- [x] `npm run check`

---

## Implementation

### Part A — `AppSidebar.tsx` and `page.tsx`

Match page guards (`isClinician`, `isSecurityOfficer || isAdmin`).

### Part B — auth forms

`LoginForm.tsx`, `ChangePasswordForm.tsx`.

### Part C — `AuditEventsTable.tsx`

---

## Open questions

- Facilities is not role-gated today; still hide it from patients and clinicians so the nav matches least-privilege demo.
