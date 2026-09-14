# Agent 58 — Faculty Workload System (README v2)

**This is Version 2 documentation** — new features added after the original README.  
For the full original docs (architecture, API, tech stack, complete setup), see **[README.md](./README.md)**.

---

## What’s new in v2

| Area | Update |
|---|---|
| **Workload authority** | Uttej (HR) is the primary Accept/Reject + assign controller; HOD & Dean monitor only |
| **CSE-only default** | Faculty Management, Workload Controller, and Reports show **CSE only** for Uttej |
| **Secret unlock** | Phrase `previous data unlock` restores all departments / previous multi-dept features |
| **Real-time transfer** | Faculty Leave & Transfer uses **today’s timetable only** |
| **Dual recommendations** | Same course/subject (academic fit) + By workload (capacity fit) |
| **CSE period reports** | Day / week / month Excel & CSV with Faculty sheet + optional faculty filter |
| **CSE Odd-2026 import** | Official workbook import scripts (`db:import:cse-odd2026`) |

---

## Forgot password OTP (Brevo) — new in v2

Forgot Password sends a **6-digit OTP** by email via **Brevo** (API preferred, SMTP fallback), then **Gmail SMTP** if configured.

| Step | API |
|---|---|
| Send OTP | `POST /api/auth/forgot` `{ email }` |
| Verify OTP | `POST /api/auth/forgot/verify` `{ email, otp }` → `resetToken` |
| Set password | `POST /api/auth/forgot/reset` `{ resetToken, newPassword }` |

### If Brevo returns “SMTP account is not yet activated”

Your Brevo account currently has **`relay.enabled: false`**. Transactional sending needs **manual activation** by Brevo (not a code bug).

1. Brevo → **Support & Tickets** → request **Transactional / SMTP activation**
2. Or email `contact@brevo.com` (website URL, password-reset OTPs, ~volume)
3. Wait for approval (often 1–2 business days)

### Deliver OTPs to inbox right now (Gmail fallback)

Until Brevo activates, set in `backend/.env`:

```env
GMAIL_USER=vemulaharshith1476@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

Create the App Password at: https://myaccount.google.com/apppasswords  
(Requires Google 2-Step Verification.) Restart backend after saving.

Also keep:

```env
BREVO_API_KEY=xkeysib-...
BREVO_SMTP_KEY=xsmtpsib-...
BREVO_FROM_EMAIL=medichain123@gmail.com
OTP_DEV_FALLBACK=1
```

**Important:** `BREVO_FROM_EMAIL` must be an **active verified sender** in Brevo.  
If keys were pasted in chat, **rotate them** in Brevo after setup.

See also placeholders in `backend/.env.example`.

---

## Secret unlock key (retrieve everything back)

By default Uttej sees **CSE only** on Faculty, Workload Controller, and Reports.

| Item | Value |
|---|---|
| **Unlock phrase** | `previous data unlock` |
| **Where to type** | Access panel on Faculty / Workload Controller / Reports |
| **Browser storage** | `localStorage` → `agent58_previous_data_unlock` |
| **Lock again** | Button **Lock to CSE again** |

**After unlock you get back:**
- All departments in Faculty Management
- Department picker on Workload Controller
- Institution Excel / CSV / Compliance PDF
- Any-department report downloads

Unlock does **not** delete data — it only switches UI/export scope in the browser.

---

## Roles & authority (v2 story)

```text
Uttej (HR / Workload Controller)  →  assign + Accept/Reject
HOD                               →  monitor only
Dean                              →  monitor only
Faculty                           →  leave + transfer (customer)
Principal                         →  still in system (not central to this flow)
```

| Role | Path examples | Behaviour |
|---|---|---|
| **Uttej (HR)** | `/hr/workload-control`, `/hr/faculty`, `/hr/reports` | Assign load; Accept/Reject `PENDING_UTESH`; CSE-only until unlock |
| **HOD** | Workload Requests (Monitor) | View list + stats only |
| **Dean** | Workload Requests (Monitor) | View list + stats only |
| **Faculty** | Leave & Work Transfer | Real-time today classes → pick receiver → submit to Uttej |

### Key admin login (unchanged)

| Name | Role | Email | Password |
|---|---|---|---|
| Mr. Uttej Kumar Nannapaneni | HR / Workload Controller | uttejkumarn@vignan.ac.in | Vignan@44655544 |
| Dr. Venkatrama Phani Kumar S | HOD | svphanikumar@vignan.ac.in | Vignan@79565614 |
| Dr. K.V. Krishna Kishore | DEAN | kvkrishnakishore@vignan.ac.in | Vignan@69135562 |
| Dr. S. Deva Kumar | PRINCIPAL | sdevakumar@vignan.ac.in | Vignan@97536569 |

More logins: see [README.md — Demo logins](./README.md#demo-logins) and `backend/prisma/login-credentials.json`.

---

## Real-time leave & work transfer

1. Faculty opens **Leave & Work Transfer**.
2. System loads **today’s timetable slots only** (real calendar day → `dayOfWeek`).
3. No class today (Sunday / holiday / no slots) → empty list (by design).
4. Faculty selects a **real class**, then chooses a receiver from:
   - **Same course / subject** — peers already teaching that course/subject, still within load
   - **By workload** — underload / normal after taking those hours
5. Request → `PENDING_UTESH` → Uttej **Accept** or **Reject**.
6. On Accept: engine recalculates; HOD/Dean see it in monitor views.

> Data note: many imported slots may be Monday-only (`dayOfWeek = 1`). Recommendations appear when the logged-in faculty has a real class **today**.

---

## Reports (v2)

**Path:** `/hr/reports` (CSE-only until unlock)

| Export | Contents |
|---|---|
| Period day / week / month | Faculty sheet + workload, timetable, leave, reassignments |
| Faculty filter | All CSE faculty or one faculty |
| CSE Compliance PDF / Excel / CSV | Snapshot exports |
| CSE Department Excel / CSV | Department package |
| After unlock | Institution-wide + any department |

---

## New / updated scripts

```bash
cd backend

# CSE Odd Semester 2026 official workbook → DB
npm run db:import:cse-odd2026

# Section-7 (non-destructive by default; wipe only with ALLOW_SECTION7_WIPE=1)
npm run db:import:section7

# Profile dedupe only (does NOT remove Odd-2026 allocation rows)
node prisma/dedupe-database.js
```

Other seed commands remain as documented in [README.md](./README.md).

---

## Quick start (same as v1)

```bash
# Backend
cd backend
npm install --legacy-peer-deps
npx prisma db push
npm run start:dev
# → http://localhost:3000/api

# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173/login
```

---

## Feature map (v2 pages)

| Feature | Route | Notes |
|---|---|---|
| Workload Controller | `/hr/workload-control` | Uttej assign + Accept/Reject |
| Faculty Management | `/hr/faculty` | CSE-only until unlock |
| Reports | `/hr/reports` | CSE period + unlock for all |
| Leave & Work Transfer | Faculty nav | Real-time today only |
| Workload Requests (Monitor) | HOD / Dean | View only |

---

## Relation to README.md (v1)

| File | Use it for |
|---|---|
| **README.md** | Original full docs: architecture, engine, approvals, env vars, API overview, complete feature list |
| **README-v2.md** (this file) | New Uttej flow, unlock key, real-time transfer, dual recommendations, CSE reports, Odd-2026 |

Keep both. v2 does not replace v1.
