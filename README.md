# CMD//SIGNAL — AI job-search command center (100% free)

Runs on your own machine, $0/month, no credit card. It detects companies about to
hire **before** the role is posted (funding, leadership moves, expansion), ranks
live openings, finds the humans who can hire you, and writes timely outreach.

**Free stack:** Google Gemini (the AI) + Tavily (live web search). Both have free
tiers with **no credit card**.

---

## Get the 2 free keys (no card)

**1. Gemini key** — the AI brain
- Go to **https://aistudio.google.com**
- Sign in with Google → click **"Get API key"** → **Create API key**
- Copy it (a long string)

**2. Tavily key** — live web search (1,000 searches/month free)
- Go to **https://tavily.com** → **Sign up** (email or Google, no card)
- On the dashboard, copy your key (starts with `tvly-`)

---

## Run it (3 steps)

```bash
# 1. install
npm install

# 2. add your two keys
copy .env.example .env       # Windows
#   then open .env and paste both keys

# 3. start
npm start
```

Open **http://localhost:3000**

You should see in the terminal:
```
gemini: loaded ✓
tavily: loaded ✓
```

---

## Free-tier limits (fine for personal use)

- **Gemini free:** ~5–15 requests/minute, ~100–1,000/day. One full scan uses a few
  requests, so pace yourself — a handful of scans per day is comfortable.
- **Tavily free:** 1,000 searches/month. Each scan uses a few searches.

If you ever outgrow them, add a little Gemini credit or a paid Tavily tier — the
code doesn't change.

---

## Configuration (.env)

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | — | **required** (free) |
| `TAVILY_API_KEY` | — | **required for live search** (free) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | or `gemini-2.5-flash-lite` (lighter/faster) |
| `MAX_TOKENS` | `4000` | higher = more results per scan |
| `PORT` | `3000` | |

---

## What it does

- **Hiring-signal engine** — 3 parallel scanners (funding, leadership, expansion)
  find companies about to hire, merged + deduped + ranked by fit.
- **Signal-aware outreach** — drafts that open by referencing the fresh signal.
- **Live job matches** — real openings via web search, scored 0–100 against your CV.
- **Decision-makers** — recruiters / hiring managers / founders, with LinkedIn search.
- **Outreach** — personalized messages; sending always goes through your own email.
- **Pipeline** — Found → Drafted → Applied → Contacted → Replied → Interview.

Your keys live only on your machine (in `.env`), never in the browser.

---

## Files

```
server.js          backend — calls Gemini + Tavily (your keys live here)
public/index.html  shell
public/styles.css  the UI
public/app.js      all front-end logic (vanilla JS)
.env.example       copy to .env and fill in your 2 free keys
```
