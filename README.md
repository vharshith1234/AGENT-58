# Agent 58 — Faculty Workload System

Multi-role web application for **Vignan's Foundation for Science, Technology & Research** to calculate, balance, approve, and report faculty workload across schools and departments.

CSE academic data is treated as **REAL** (Section-7 timetable import). Other departments use **DEMO** timetable/workload while keeping official directory identities and photos.

**Repository:** https://github.com/vharshith1234/AGENT-58

---

## Table of contents

1. [Features overview](#features-overview)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [Role functionality](#role-functionality)
5. [Workload engine](#workload-engine)
6. [Approval & correction flows](#approval--correction-flows)
7. [Data sources (REAL vs DEMO)](#data-sources-real-vs-demo)
8. [Quick start](#quick-start)
9. [Environment variables](#environment-variables)
10. [Seed & import scripts](#seed--import-scripts)
11. [API overview](#api-overview)
12. [Demo logins](#demo-logins)
13. [Tests & notes](#tests--notes)

---

## Features overview

| Area | What it does |
|---|---|
| **Authentication** | Email/password login, JWT access + refresh tokens, role-based dashboards |
| **Workload calculation** | Deterministic engine for teaching, projects, research, admin, committees, PhD |
| **Norms & policies** | HR-managed activity weights and min/expected/max norms |
| **HOD operations** | Courses, allocations, timetable (incl. Excel import), projects, research, balancing, what-if |
| **Faculty self-service** | View load, verify, request corrections, download statements, manage photo |
| **Dean / Principal** | Cross-dept comparison, overload/underload, approvals, institution compliance & reports |
| **Reports** | Department/institution Excel & CSV; compliance PDF; faculty PDF/XLSX/CSV statements |
| **Profiles & photos** | Official Vignan directory sync + optional Cloudinary / local uploads |
| **Notifications** | In-app alerts for corrections and approval events |
| **Caching** | In-memory response cache + frontend GET cache for faster dashboards |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS |
| Backend | NestJS, Prisma, Passport JWT, bcrypt, pdf-lib, xlsx, compression |
| Database | PostgreSQL (local recommended; Neon optional) |
| Auth | JWT access + refresh; RBAC permissions guard |
| Optional | Cloudinary for profile photos |

---

## Architecture

```
frontend (Vite :5173) ──HTTP──► backend NestJS (:3000/api) ──Prisma──► PostgreSQL
                                      │
                                      ├── /uploads  (local photos)
                                      └── workload engine (pure calc + snapshots)
```

- **Frontend:** `frontend/` — role shells, dashboards, charts, login UI  
- **Backend:** `backend/` — Nest modules per role + shared workload/reports/auth  
- **Schema:** `backend/prisma/schema.prisma`  
- **API prefix:** `/api`  
- **Static uploads:** `/uploads/` (outside `/api`)

---

## Role functionality

### HR (`/hr/*`)

Institutional master data and policy control.

- Dashboard with institution workload health (REAL + DEMO combined)
- Faculty management (create/update, search, profiles)
- Departments & schools
- Workload **policies** (activity weights) and **norms** (min / expected / max)
- Weightings UI, analytics, history
- Review **correction requests**
- Compliance view and report exports
- Notifications & profile

### HOD (`/hod/*`)

Department academic operations and load balancing.

- Dashboard and faculty list (department-scoped)
- Courses, course allocations, timetable (CRUD + Excel import/preview)
- Project supervision, research entries
- Administration roles & committees
- Workload table and **balancing** suggestions / apply
- **What-if simulation** (read-only; never persists)
- Correction review, analytics, department reports
- **Submit department package** for Dean approval

### Faculty (`/faculty/*`)

Personal workload and statements.

- Dashboard, my courses / timetable / projects / research / responsibilities
- My workload breakdown and status (NORMAL / OVERLOAD / UNDERLOAD)
- Verify workload; submit correction requests
- Download workload statement (PDF / Excel / CSV)
- Profile photo upload/delete
- Notifications

### Dean (`/dean/*`)

School / cross-department oversight.

- Institution-wide dashboard counts and department cards
- Department comparison, workload analysis
- Overload / underload faculty lists
- Approvals: approve, send back, or **escalate to Principal**
- Trends, reports, notifications, profile

### Principal (`/principal/*`)

Institution-level governance.

- Principal overview with schools/departments/faculty stats
- Institution overview (schools → departments)
- Faculty directory, analytics, compliance
- Overload / underload metric cards, trends
- Approvals: approve, **finalize**, or send back
- Institution reports & compliance PDF

---

## Workload engine

Implemented in `backend/src/workload/workload.engine.ts` (pure, deterministic).

**Activity types:** THEORY, TUTORIAL, LAB, UG/PG projects, PhD, COMMITTEE, ADMIN_ROLE, RESEARCH  

**Status bands** (against norms):

| Status | Meaning |
|---|---|
| `UNDERLOAD` | Below minimum |
| `NORMAL` | Within min–max |
| `OVERLOAD` | Above maximum |
| `INDETERMINATE` | Insufficient data |

**Rules of note**

- Official **teaching load** comes from **course allocations** (timetable is schedule/evidence, not double-counted).
- Weights and norms are always read from the database (HR-managed).
- Mutations recalculate and persist **snapshots**.
- What-if / simulate endpoints compute without writing.
- DEMO activity rows are kept separate from REAL for reporting splits.

Run unit tests:

```bash
cd backend
npm run test:engine
```

---

## Approval & correction flows

```
HOD submits package
        │
        ▼
   Dean review ──approve──► (optional escalate)
        │                         │
     send-back                    ▼
                           Principal review
                                  │
                     ┌────────────┼────────────┐
                     ▼            ▼            ▼
                 finalize      approve      send-back
```

- Faculty can open **correction requests**; HOD and HR can review them.
- Approval actions write audit logs and notifications.

---

## Data sources (REAL vs DEMO)

| Kind | Departments | Academic data | Identities / photos |
|---|---|---|---|
| **REAL** | CSE (School of Computing) | Section-7 timetable / allocations | Official + seeded |
| **DEMO** | IT, CA, ACSE, ECE, EEE, MECH, CIVIL, DMS | Synthetic timetable/workload until import | [Vignan people directory](https://vignan.ac.in/newvignan/people.php) |

Dashboards often show **REAL** and **DEMO** metrics separately, plus combined institution totals.

---

## Quick start

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (recommended)

Create DB/user example:

- Database: `agent58`
- User: `agent58`
- Password: `agent58_local_dev`
- Host: `127.0.0.1:5432`

### Backend

```bash
cd backend
cp .env.example .env   # edit if your Postgres credentials differ
npm install --legacy-peer-deps
npx prisma db push
npm run db:seed:real
npm run db:seed:demo-depts
npm run db:section7:logins
npm run db:enrich:official
npm run db:sync:official
npm run start:dev
```

API: http://localhost:3000/api

> Local Postgres avoids Neon free-tier sleep / Prisma `P1001` (“Can't reach database server”).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173/login

---

## Environment variables

Copy `backend/.env.example` → `backend/.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PRISMA_CLIENT_ENGINE_TYPE` | Use `binary` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | e.g. `15m` / `7d` |
| `PORT` | Backend port (default `3000`) |
| `CLOUDINARY_*` | Optional cloud photo storage |

Frontend (optional `frontend/.env`):

| Variable | Default |
|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` |

**Do not commit** `backend/.env` (gitignored).

---

## Seed & import scripts

| Command | Purpose |
|---|---|
| `npm run db:seed:real` | Seed SOCI/CSE, policies, norms, admin + CSE faculty |
| `npm run db:import:section7` | Import CSE Section-7 timetable as REAL |
| `npm run db:section7:logins` | Ensure Section-7 faculty login accounts |
| `npm run db:seed:demo-depts` | Additive DEMO departments + demo academics |
| `npm run db:enrich:official` | Enrich profiles from official directory |
| `npm run db:sync:official` | Sync official photo/profile URLs into DB |
| `npm run db:reset:logins` | Reset passwords from credential store |

Optional CSE import after real seed:

```bash
cd backend
npm run db:import:section7
npm run db:section7:logins
npm run db:enrich:official
npm run db:sync:official
```

---

## API overview

Base URL: `http://localhost:3000/api`

| Prefix | Capabilities |
|---|---|
| `/auth` | login, refresh, logout, me, profile photo |
| `/hr` | faculty/departments CRUD, policies, norms, corrections, compliance |
| `/hod` | courses, allocations, timetable, projects, research, balancing, submit-approval |
| `/faculty` | own workload, corrections, statements, photo |
| `/dean` | dashboard, departments, approvals |
| `/principal` | dashboard, hierarchy, faculty, approvals finalize |
| `/workload` | summary, history, recalculate, simulate, balance |
| `/reports` | department/institution Excel & CSV, compliance PDF |
| `/notifications` | list, unread count, mark read |

All protected routes require `Authorization: Bearer <accessToken>` (except login/forgot).

---

## Demo logins

Sign in at http://localhost:5173/login.

**Password pattern:** `Vignan@` + 8 digits (see tables below).

### Admin

| Name | Role | Email | Password |
|---|---|---|---|
| Mr. Uttej Kumar Nannapaneni | HR | uttejkumarn@vignan.ac.in | Vignan@44655544 |
| Dr. Venkatrama Phani Kumar S | HOD | svphanikumar@vignan.ac.in | Vignan@79565614 |
| Dr. K.V. Krishna Kishore | DEAN | kvkrishnakishore@vignan.ac.in | Vignan@69135562 |
| Dr. S. Deva Kumar | PRINCIPAL | sdevakumar@vignan.ac.in | Vignan@97536569 |

### CSE faculty (REAL)

| Name | Email | Password |
|---|---|---|
| Dr. Gabbi Reddy Keerthi | gabbireddykeerthi@vignan.ac.in | Vignan@43142376 |
| Mr. Senthil D | dsenthil@vignan.ac.in | Vignan@39206076 |
| Mr. Syed Nafees Ahamed | syednafeesahamed@vignan.ac.in | Vignan@61505252 |
| Ms. Pushya Chaparala | chpushya@vignan.ac.in | Vignan@75997638 |
| Bhathula Ninnagari | bhathulaninnagari@vignan.ac.in | Vignan@60996958 |
| Mrs. V. Sai Spandana | saispandanaverella@vignan.ac.in | Vignan@91700717 |
| Dr. J. Veeranjaneyulu | jveeranjaneyulu@vignan.ac.in | Vignan@51854048 |

### Other-department faculty (DEMO academic data)

CSE academic data is **REAL**. Other departments use **DEMO** timetable/workload until a real timetable is imported. Identities, photos, and profile details come from https://vignan.ac.in/newvignan/people.php

| Department | Name | Email | Password |
|---|---|---|---|
| IT | Dr. Bhaskaru Obulapu | bhaskaruobulapu@vignan.ac.in | Vignan@91622904 |
| IT | Dr. Hemanta Kumar Bhuyan | hemantakumarbhuyan@vignan.ac.in | Vignan@85828152 |
| IT | Dr. Kamepalli Sujatha | kamepallisujatha@vignan.ac.in | Vignan@87986385 |
| IT | Dr. Nerella Sameera | nerellasameera@vignan.ac.in | Vignan@79460514 |
| IT | Dr. Peram Subba Rao | peramsubbarao@vignan.ac.in | Vignan@25828074 |
| CA | Dr. Kurra Santhi Sri | kurrasanthisri@vignan.ac.in | Vignan@73652801 |
| CA | Dr. N. Veeranjaneyulu | nveeranjaneyulu@vignan.ac.in | Vignan@21782060 |
| CA | Dr. R S Padma Priya | rspadmapriya@vignan.ac.in | Vignan@74131364 |
| CA | Mr. Irfan Sayyad | irfansayyad@vignan.ac.in | Vignan@45219451 |
| CA | Ms. Kota Lakshmi Thanuja | kotalakshmithanuja@vignan.ac.in | Vignan@11441501 |
| ACSE | Dr. Nirupama Bhat Mundukur | nirupamabhatmundukur@vignan.ac.in | Vignan@40594193 |
| ACSE | Dr. Sreekantha Reddy | sreekanthareddy@vignan.ac.in | Vignan@94404895 |
| ACSE | Dr. Venkatesulu Dondeti | venkatesuludondeti@vignan.ac.in | Vignan@52497442 |
| ACSE | Mr. Srinivasarao Pallanti | srinivasaraopallanti@vignan.ac.in | Vignan@12862470 |
| ACSE | Ms. Kondapalli Krupa Sagari | kondapallikrupasagari@vignan.ac.in | Vignan@11957888 |
| ECE | Dr. B Seetha Ramanjaneyulu | bseetharamanjaneyulu@vignan.ac.in | Vignan@64838902 |
| ECE | Dr. M.S.S. Rukmini | mssrukmini@vignan.ac.in | Vignan@70557577 |
| ECE | Dr. Ravi Sekhar Yarrabothu | ravisekharyarrabothu@vignan.ac.in | Vignan@91655727 |
| ECE | Dr. Sarada Musala | saradamusala@vignan.ac.in | Vignan@92011235 |
| ECE | Dr. Shaik Jakeer Hussain | shaikjakeerhussain@vignan.ac.in | Vignan@23765248 |
| EEE | Dr. Anil Kumar D | anilkumard@vignan.ac.in | Vignan@10271495 |
| EEE | Dr. Attuluri Rakada Vijay Babu | attulurirakadavijaybabu@vignan.ac.in | Vignan@52384998 |
| EEE | Dr. Mercy Rosalina | mercyrosalina@vignan.ac.in | Vignan@35632266 |
| EEE | Dr. Polamraju V S Sobhan | polamrajuvssobhan@vignan.ac.in | Vignan@95382361 |
| EEE | Dr. Srinivasarao Gorantla | srinivasaraogorantla@vignan.ac.in | Vignan@46762207 |
| MECH | Dr. B Nageswara Rao | bnageswararao@vignan.ac.in | Vignan@21812187 |
| MECH | Dr. Dusanapudi Satyanarayana | dusanapudisatyanarayana@vignan.ac.in | Vignan@37231289 |
| MECH | Dr. M Ramakrishna | mramakrishna@vignan.ac.in | Vignan@30921370 |
| MECH | Dr. N Narayan Rao | nnarayanrao@vignan.ac.in | Vignan@44909553 |
| MECH | Dr. Y. Jyothi | yjyothi@vignan.ac.in | Vignan@71008827 |
| CIVIL | Dr. A.V.A. Bharat Kumar | avabharatkumar@vignan.ac.in | Vignan@33449965 |
| CIVIL | Dr. Asadi Siva Sankar | asadisivasankar@vignan.ac.in | Vignan@57992295 |
| CIVIL | Dr. P Sundara Kumar | psundarakumar@vignan.ac.in | Vignan@15750792 |
| CIVIL | Mr. Anirudh Maddi | anirudhmaddi@vignan.ac.in | Vignan@12951116 |
| CIVIL | Mr. Dasari Ravi Kanth | dasariravikanth@vignan.ac.in | Vignan@53789340 |
| DMS | Dr. B. Madhusudhan Rao | bmadhusudhanrao@vignan.ac.in | Vignan@40997884 |
| DMS | Dr. Bandaru Srinivasa Rao | bandarusrinivasarao@vignan.ac.in | Vignan@64999171 |
| DMS | Dr. Ch Hymavathi | chhymavathi@vignan.ac.in | Vignan@33424102 |
| DMS | Dr. Dhulipalla Vijay Krishna | dhulipallavijaykrishna@vignan.ac.in | Vignan@21929529 |
| DMS | Dr. K. Siva Nageswara Rao | ksivanageswararao@vignan.ac.in | Vignan@80844766 |

---

## Tests & notes

```bash
cd backend
npm run test:engine
```

- Prefer **local Postgres** for development; Neon free tier can sleep and cause connection errors.
- After reseeding, always run `db:enrich:official` and `db:sync:official` so faculty photos appear.
- Agent 25 (PhD) / Agent 56 (committees) are stub provider interfaces in the HOD module — no invented rows unless you insert data.
- What-if never writes; live mutations recalculate snapshots.
