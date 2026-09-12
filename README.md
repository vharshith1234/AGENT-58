# Agent 58 — Faculty Workload System

## Quick start

### Backend
```bash
cd backend
npm install --legacy-peer-deps
# Uses local Postgres from backend/.env (avoids Neon sleep / P1001)
npx prisma db push
npm run db:seed:real
npm run db:seed:demo-depts
npm run db:section7:logins
npm run db:enrich:official
npm run db:sync:official
npm run start:dev
```
API: http://localhost:3000/api

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App: http://localhost:5173/login

## Logins

Every account uses the same pattern:

- **Email:** `name@vignan.ac.in`
- **Password:** `Vignan@` followed by 8 random digits

Sign in at http://localhost:5173/login with the email and password below. Each account opens the matching dashboard.

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

CSE academic data is **REAL**. Other departments use **DEMO** timetable/workload data until a real timetable is imported. Identities, photos, and profile details for those departments come from https://vignan.ac.in/newvignan/people.php

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

## Seed / import

```bash
cd backend
npm run db:import:section7
npm run db:section7:logins
npm run db:seed:demo-depts
npm run db:enrich:official
npm run db:sync:official
```

## Engine tests
```bash
cd backend
npm run test:engine
```

## Notes
- Weights/norms come from DB; what-if never writes; mutations recalculate snapshots.
- Agent 25/56 feeds are stub provider interfaces in the HOD module (no fake rows unless you insert them).
