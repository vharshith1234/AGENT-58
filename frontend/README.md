# FMA — Faculty Management Agent (Frontend)

Phase 0: Official Vignan's-branded login UI for Agent 58.

## Run

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Login routes

| Role | URL |
|------|-----|
| Faculty | `/login/faculty` |
| HR | `/login/hr` |
| HOD | `/login/hod` |
| Dean | `/login/dean` |
| Principal | `/login/principal` |

Use **Use Sample Credentials** on each page, then Login. Auth is UI-only until Phase 2 (JWT).

## Branding

- Vignan's crest banner: `public/brand/vignan-logo.png`
- Title: **FMA — Faculty Management Agent**
- Split login card matching the institutional DRIMS-style template
