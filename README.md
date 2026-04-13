# Phantom — Synthetic User Testing

Test your website through the eyes of diverse AI personas. Each persona has a detailed cognitive model — tech-illiterate grandparents, impatient teens, screen reader users, non-native speakers — and actually navigates your site using Claude + Playwright.

## How it works

1. Enter a URL and pick a task (sign up, find pricing, contact support, etc.)
2. Select up to 4 personas — pre-built archetypes or describe your own
3. AI agents browse your site, narrating their confusion in character
4. Get a per-persona report with friction points, confusion scores, and screenshots

## Personas

| Persona | Profile |
|---|---|
| Eleanor Marsh, 72 | Retired librarian, first PC in 2018. Thinks placeholder text = pre-filled. |
| Marcus Rodriguez, 17 | Gen Z, phone-native. Rage-quits after 3 form fields. |
| Alex Chen, 34 | Blind software engineer, NVDA + keyboard only. Full a11y auditor. |
| Priya Nair, 29 | Non-native English. Confused by idioms and ambiguous UI copy. |
| Bob Harrington, 55 | New smartphone owner. Fat-finger syndrome. Wants phone numbers. |
| Sarah Williams, 37 | Marketing director, 3 kids. One-handed, session must persist. |
| Derek Foster, 28 | Full-stack dev. Breaks things, reads DevTools, finds edge cases. |
| Amara Osei, 43 | Teacher in Accra. Slow 3G, mid-range Android, data-conscious. |

You can also describe a custom persona and Claude builds the full cognitive model.

## Stack

- **Frontend**: Next.js 14 + Tailwind → Vercel
- **Backend**: FastAPI + Playwright + Anthropic SDK → Railway
- **Streaming**: Server-Sent Events for real-time progress

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
playwright install chromium
cp .env.example .env   # Add ANTHROPIC_API_KEY
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # Set NEXT_PUBLIC_API_URL
npm run dev
```

## Deploy

### Backend → Railway
1. Create new project from GitHub repo
2. Set root directory to `backend/`
3. Add env vars: `ANTHROPIC_API_KEY`, `FRONTEND_URL`
4. Railway auto-detects the Dockerfile

### Frontend → Vercel
1. Import GitHub repo
2. Set root directory to `frontend/`
3. Add env var: `NEXT_PUBLIC_API_URL` (your Railway URL)
