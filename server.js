import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_BASE = process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com/v1beta";
const TAVILY_URL = process.env.TAVILY_URL || "https://api.tavily.com/search";
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "4000", 10);
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: "3mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ---------- Google Gemini (free tier, no card) ---------- */
async function callGemini(userText, { system } = {}) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY is missing — add it to your .env file.");
  const body = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.4, responseMimeType: "application/json" },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const r = await fetch(`${GEMINI_BASE}/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Gemini ${r.status}: ${t.slice(0, 280)}`);
  }
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("\n").trim();
}

/* ---------- Tavily (free tier, no card) — live web search ---------- */
async function tavilySearch(query, max = 5) {
  if (!TAVILY_KEY) throw new Error("TAVILY_API_KEY is missing — add it to your .env to enable live web search.");
  const r = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_KEY, query, max_results: max, search_depth: "basic" }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Tavily ${r.status}: ${t.slice(0, 200)}`);
  }
  const d = await r.json();
  return (d.results || []).map((x) => `- ${x.title}: ${x.content} (source: ${x.url})`).join("\n");
}
const searchMany = async (queries, per = 4) =>
  (await Promise.all(queries.map((q) => tavilySearch(q, per).catch(() => "")))).filter(Boolean).join("\n");

/* ---------- salvage complete JSON objects, even from truncated text ---------- */
function extractObjects(text) {
  if (!text) return [];
  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") { depth--; if (depth === 0 && start >= 0) { try { out.push(JSON.parse(text.slice(start, i + 1))); } catch (e) {} start = -1; } }
  }
  return out;
}
const firstObject = (t) => extractObjects(t)[0] || null;
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { console.error("\u2717", e.message); res.status(502).json({ error: e.message }); }
};

/* ---------- routes ---------- */
app.get("/api/health", (req, res) =>
  res.json({ ok: true, model: MODEL, hasKey: !!GEMINI_KEY, hasSearch: !!TAVILY_KEY }));

app.post("/api/parse", wrap(async (req, res) => {
  const { cv = "", prefs = {} } = req.body;
  const txt = await callGemini(
    `Parse this candidate into a JSON profile. Output ONLY one JSON object.\n\n` +
    `CV / BACKGROUND:\n${cv}\n\nPREFERENCES:\n` +
    `target_roles: ${prefs.roles || ""}\nlocations: ${prefs.locations || ""}\nwork_mode: ${prefs.mode || ""}\n` +
    `salary_target: ${prefs.salary || ""}\nseniority: ${prefs.seniority || ""}\nindustries: ${prefs.industries || ""}\n` +
    `must_haves: ${prefs.must || ""}\navoid_companies: ${prefs.avoid || ""}\nnotes: ${prefs.notes || ""}\n\n` +
    `Keys: candidate_title, headline, years_experience, seniority, locations (array), work_mode, ` +
    `salary_target, skills (array, max 14), industries (array), preferred_roles (array), ` +
    `strengths (array of 3 short), deal_breakers (array), summary (1 sentence).`,
    { system: "You are a precise CV parsing engine. Reply with strict JSON only." }
  );
  const profile = firstObject(txt);
  if (!profile) throw new Error("Could not parse a profile from that input.");
  res.json({ profile });
}));

app.post("/api/jobs", wrap(async (req, res) => {
  const { profile = {} } = req.body;
  const roles = (profile.preferred_roles || [profile.candidate_title]).filter(Boolean).slice(0, 2).join(" OR ");
  const loc = (profile.locations || []).slice(0, 2).join(" ");
  const inds = (profile.industries || []).slice(0, 2).join(" ");
  const results = await searchMany([
    `${roles} jobs hiring ${loc} ${inds} 2026`,
    `${roles} careers openings ${inds} apply`,
  ], 6);
  const txt = await callGemini(
    `From these REAL web search results, extract current job openings that fit the candidate. ` +
    `Output ONLY a JSON array (max 8).\n\nCANDIDATE: ${JSON.stringify({
      title: profile.candidate_title, roles: profile.preferred_roles, skills: profile.skills,
      locations: profile.locations, mode: profile.work_mode, seniority: profile.seniority,
    })}\n\nWEB RESULTS:\n${results}\n\n` +
    `Each object: {"company","role","location","work_mode","salary","source",` +
    `"apply_query" (google query to reach the posting),"posted","match_score" (0-100),` +
    `"reason" (<=16 words),"breakdown":{"skills":0-100,"title":0-100,"location":0-100,"seniority":0-100},` +
    `"signals" (<=8 words)}. Only real companies present in the results. JSON array only.`,
    { system: "You extract structured jobs from web results. Reply with a strict JSON array only." }
  );
  const jobs = extractObjects(txt).filter((j) => j.company && j.role)
    .map((j) => ({ ...j, match_score: Math.round(j.match_score || 0) }))
    .sort((a, b) => b.match_score - a.match_score);
  res.json({ jobs });
}));

app.post("/api/people", wrap(async (req, res) => {
  const { company, role } = req.body;
  const results = await searchMany([
    `${company} recruiter OR "talent acquisition" OR "head of talent" LinkedIn`,
    `${company} hiring manager OR "VP" OR "head of" ${role}`,
  ], 5);
  const txt = await callGemini(
    `From these REAL web search results, identify likely hiring decision-makers at "${company}" for "${role}". ` +
    `Recruiters, talent acquisition, hiring managers, dept heads, or founder/CEO for startups. ` +
    `Public info only. Do NOT invent emails. Output ONLY a JSON array (max 5).\n\nWEB RESULTS:\n${results}\n\n` +
    `Each object: {"name","title","company","relevance" (0-100),"why" (<=12 words),` +
    `"outreach_type" (recruiter|hiring_manager|founder|referral),"linkedin_query"}. JSON array only.`,
    { system: "You extract real people from web results. Reply with a strict JSON array only." }
  );
  const people = extractObjects(txt).filter((p) => p.name);
  res.json({ people });
}));

app.post("/api/outreach", wrap(async (req, res) => {
  const { profile = {}, person = {}, role = "", signal = "" } = req.body;
  const signalLine = signal ? `TIMELY SIGNAL (reference this naturally — it's why you're reaching out now): ${signal}\n` : "";
  const txt = await callGemini(
    `Write a concise, personalized outreach message. Output ONLY JSON: {"subject","body"}.\n\n` +
    `FROM: ${profile.candidate_title}. Strengths: ${(profile.strengths || []).join("; ")}. ` +
    `Skills: ${(profile.skills || []).slice(0, 6).join(", ")}.\n` +
    `TO: ${person.name}, ${person.title} at ${person.company} (outreach type: ${person.outreach_type}).\n` +
    `ROLE: ${role || person.jobRole}.\n` + signalLine + `\n` +
    `Body 70-100 words. ${signal ? "Open by referencing the signal so it feels timely. " : ""}` +
    `One specific reason their team/role fits this candidate. Warm, direct, respectful, no buzzwords, ` +
    `one clear ask, sign off with [Your name]. Subject under 8 words.`,
    { system: "You write sharp, human recruiter-outreach. Reply with strict JSON only." }
  );
  res.json({ draft: firstObject(txt) || { subject: "", body: "" } });
}));

/* ---------- pre-posting hiring-signal engine ---------- */
function signalQuery(kind, focus) {
  const i = focus.industries || focus.roles;
  const heads = {
    funding: `recent funding round seed OR "Series A" OR "Series B" 2026 ${i} startup raised million`,
    leadership: `new CTO OR "VP Engineering" OR "Head of Product" hired OR appointed 2026 ${i}`,
    expansion: `company expanding OR "new office" OR "scaling team" OR "hiring spree" 2026 ${i}`,
  };
  return heads[kind];
}
async function signalScan(kind, focus) {
  const results = await tavilySearch(signalQuery(kind, focus), 5).catch(() => "");
  if (!results) return [];
  const txt = await callGemini(
    `From these REAL web search results, extract fresh hiring signals of type "${kind}" relevant to a candidate ` +
    `targeting ${focus.roles} in ${focus.industries}. ${kind === "funding" ? "New funding implies new hiring." : kind === "leadership" ? "New leaders build teams; departures create backfills." : "Expansion implies hiring."} ` +
    `Output ONLY a JSON array (max 4).\n\nWEB RESULTS:\n${results}\n\n` +
    `Each object: {"company","signal_type":"${kind}","evidence" (<=18 words),"source","date",` +
    `"inferred_roles" (array 1-3),"why_now" (<=12 words),"window" (e.g. "2-4 weeks"),` +
    `"confidence" (0-100),"recency" (0-100),"fit" (0-100)}. Real companies only. JSON array only.`,
    { system: "You are a hiring-signal detection agent. Reply with a strict JSON array only." }
  );
  return extractObjects(txt).filter((s) => s.company).map((s) => ({ ...s, signal_type: s.signal_type || kind }));
}

app.post("/api/signals", wrap(async (req, res) => {
  const { profile = {} } = req.body;
  const focus = {
    roles: [].concat(profile.preferred_roles || [], profile.candidate_title || []).filter(Boolean).join(", "),
    industries: (profile.industries || []).join(", ") || (profile.candidate_title || ""),
  };
  const kinds = ["funding", "leadership", "expansion"];
  const results = await Promise.all(kinds.map((k) => signalScan(k, focus).catch(() => [])));

  const map = new Map();
  for (const arr of results) {
    for (const s of arr) {
      const key = String(s.company).toLowerCase().trim();
      if (!key) continue;
      const item = { type: s.signal_type, evidence: s.evidence, source: s.source, date: s.date };
      if (!map.has(key)) {
        map.set(key, {
          company: s.company, signals: [item], inferred_roles: s.inferred_roles || [],
          why_now: s.why_now || "", window: s.window || "",
          confidence: s.confidence || 0, recency: s.recency || 0, fit: s.fit || 0,
        });
      } else {
        const e = map.get(key);
        e.signals.push(item);
        e.confidence = Math.max(e.confidence, s.confidence || 0);
        e.recency = Math.max(e.recency, s.recency || 0);
        e.fit = Math.max(e.fit, s.fit || 0);
        e.inferred_roles = [...new Set([...(e.inferred_roles || []), ...(s.inferred_roles || [])])].slice(0, 4);
        if (!e.why_now && s.why_now) e.why_now = s.why_now;
        if (!e.window && s.window) e.window = s.window;
      }
    }
  }
  const signals = [...map.values()]
    .map((s) => {
      const multi = s.signals.length > 1 ? 6 : 0;
      const score = Math.min(100, Math.round(0.4 * s.confidence + 0.3 * s.recency + 0.3 * s.fit) + multi);
      return { ...s, score };
    })
    .sort((a, b) => b.score - a.score);
  res.json({ signals });
}));

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`\n  CMD//SIGNAL  \u2192  http://localhost:${PORT}`);
  console.log(`  model:  ${MODEL} (Google Gemini)`);
  console.log(`  gemini: ${GEMINI_KEY ? "loaded \u2713" : "MISSING \u2717  \u2192 add GEMINI_API_KEY to .env"}`);
  console.log(`  tavily: ${TAVILY_KEY ? "loaded \u2713" : "MISSING \u2717  \u2192 add TAVILY_API_KEY to .env (live search)"}\n`);
});
