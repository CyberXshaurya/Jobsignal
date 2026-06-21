/* CMD//SIGNAL — frontend (vanilla JS, no build step) */

const state = {
  step: "intake",
  cv: "", prefs: { roles: "", locations: "", mode: "Remote", salary: "", seniority: "", industries: "", must: "", avoid: "", notes: "" },
  profile: null, tab: "signals",
  signals: [], jobs: [], people: [], drafts: [], pipeline: [],
  jobsScanned: false,
  busy: null, err: "",
};

/* ---------- tiny icon set ---------- */
const P = {
  radar: '<circle cx="12" cy="12" r="9"/><path d="M12 12 L19 8"/><path d="M12 3a9 9 0 0 1 7 14.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 6a3 3 0 0 1 0 6M21 20c0-2-1-3.5-3-4.3"/>',
  send: '<path d="M22 2 11 13M22 2 15 22l-4-9-9-4z"/>',
  workflow: '<rect x="3" y="3" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M6.5 9v3a3 3 0 0 0 3 3h5"/>',
  sparkles: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  mappin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  alert: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  bolt: '<path d="M12 2v8M5 9l7-7 7 7M6 14h12l-2 8H8z"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24">${P[n] || ""}</svg>`;

/* ---------- helpers ---------- */
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (n = "") => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
function tier(s) { if (s >= 85) return "var(--mint)"; if (s >= 70) return "var(--signal)"; if (s >= 55) return "var(--cyan)"; return "var(--faint)"; }
function sigColor(t) { return t === "funding" ? "var(--mint)" : t === "leadership" ? "var(--cyan)" : "var(--signal)"; }
function gauge(score, label = "match") {
  const r = 24, c = 2 * Math.PI * r, col = tier(score);
  return `<div class="gauge"><svg width="62" height="62" viewBox="0 0 62 62">
    <circle cx="31" cy="31" r="${r}" fill="none" stroke="var(--line)" stroke-width="4"/>
    <circle cx="31" cy="31" r="${r}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}" transform="rotate(-90 31 31)"/>
  </svg><span class="num" style="color:${col}">${score}</span><span class="lab">${label}</span></div>`;
}
async function api(path, body) {
  const r = await fetch("/api" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({ error: "Bad response from server" }));
  if (!r.ok || data.error) throw new Error(data.error || "Server " + r.status);
  return data;
}

/* ---------- loader with rotating lines ---------- */
let loaderTimer = null;
function loader(lines) {
  return `<div class="loadwrap"><div class="scanner"></div><p data-loader='${esc(JSON.stringify(lines))}'>${esc(lines[0])}</p></div>`;
}
function startLoader() {
  clearInterval(loaderTimer);
  const node = document.querySelector("[data-loader]");
  if (!node) return;
  let lines; try { lines = JSON.parse(node.getAttribute("data-loader")); } catch (e) { return; }
  let i = 0;
  loaderTimer = setInterval(() => { const n = document.querySelector("[data-loader]"); if (!n) { clearInterval(loaderTimer); return; } i = (i + 1) % lines.length; n.textContent = lines[i]; }, 1600);
}

/* ---------- INTAKE ---------- */
function renderIntake() {
  const p = state.prefs;
  return `<div class="shell">
    <div class="hero">
      <div class="sweep"><div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div><div class="arm"></div>
        <div class="blip" style="top:18px;left:70px"></div>
        <div class="blip" style="top:84px;left:30px;background:var(--cyan);box-shadow:0 0 10px var(--cyan)"></div>
        <div class="blip" style="top:52px;left:96px;background:var(--mint);box-shadow:0 0 10px var(--mint)"></div></div>
      <div class="eyebrow" style="margin-bottom:14px">AI job-search command center</div>
      <h1>Catch the hire<br><em>before</em> the job posts.</h1>
      <p>Drop your CV and what you want. The engine detects companies about to hire — from funding, leadership moves and expansion — ranks live openings, finds the humans who can hire you, and writes the timely outreach.</p>
    </div>
    <div class="intake">
      ${state.err ? `<div class="errbar">${icon("alert")}${esc(state.err)}</div>` : ""}
      <div class="field"><label>${icon("file")}Your CV / background <span class="req">*</span></label>
        <textarea id="cv" rows="7" placeholder="Paste your CV text, or a few lines: your title, top skills, years of experience, notable work, and what you're aiming for next…">${esc(state.cv)}</textarea></div>
      <div class="two">
        <div class="field"><label>${icon("target")}Target roles</label><input id="roles" class="inp" value="${esc(p.roles)}" placeholder="AI Product Manager, Founding Engineer…"></div>
        <div class="field"><label>${icon("mappin")}Locations</label><input id="locations" class="inp" value="${esc(p.locations)}" placeholder="Bangalore, Remote, Berlin…"></div>
      </div>
      <div class="field"><label>${icon("zap")}Work mode</label><div class="three" id="modegrp">
        ${["Remote", "Hybrid", "On-site"].map((m) => `<div class="toggle ${p.mode === m ? "on" : ""}" data-act="mode" data-mode="${m}">${m}</div>`).join("")}</div></div>
      <div class="two">
        <div class="field"><label>Salary target</label><input id="salary" class="inp" value="${esc(p.salary)}" placeholder="₹40L / $120k / open"></div>
        <div class="field"><label>Seniority</label><input id="seniority" class="inp" value="${esc(p.seniority)}" placeholder="Senior / Lead / Mid"></div>
      </div>
      <div class="two">
        <div class="field"><label>Industries you like</label><input id="industries" class="inp" value="${esc(p.industries)}" placeholder="AI, fintech, dev tools…"></div>
        <div class="field"><label>Companies to avoid</label><input id="avoid" class="inp" value="${esc(p.avoid)}" placeholder="Optional"></div>
      </div>
      <div class="field"><label>${icon("sparkles")}Anything else</label><input id="notes" class="inp" value="${esc(p.notes)}" placeholder="e.g. only product companies, must sponsor visa, early-stage preferred…"></div>
      <button class="solid" style="width:100%;justify-content:center;padding:13px;font-size:15px" data-act="launch">${icon("radar")} Build my command center</button>
      <p style="text-align:center;color:var(--faint);font-size:12px;margin-top:14px;font-family:var(--mono)">Signals first · sending always waits for your approval</p>
    </div>
  </div>`;
}

/* ---------- APP shell ---------- */
const NAV = [
  { k: "signals", label: "Signals", icon: "bolt", ct: () => state.signals.length },
  { k: "matches", label: "Matches", icon: "briefcase", ct: () => state.jobs.length },
  { k: "companies", label: "Companies", icon: "building", ct: () => new Set(state.jobs.map((j) => j.company)).size },
  { k: "people", label: "Decision makers", icon: "users", ct: () => state.people.length },
  { k: "outreach", label: "Outreach", icon: "send", ct: () => state.drafts.length },
  { k: "pipeline", label: "Pipeline", icon: "workflow", ct: () => state.pipeline.length },
];
const STAGES = ["Found", "Drafted", "Applied", "Contacted", "Replied", "Interview"];

function renderApp() {
  const pr = state.profile || {};
  return `<div class="topbar">
    <div class="brand"><div class="dot">${icon("radar")}</div><div>CMD//SIGNAL<small>JOB INTELLIGENCE</small></div></div>
    <div class="statrow">
      <div class="stat"><b>${state.signals.length}</b><span>Signals</span></div>
      <div class="stat"><b>${state.jobs.length}</b><span>Matches</span></div>
      <div class="stat"><b>${state.people.length}</b><span>People</span></div>
      <div class="stat"><b>${state.drafts.length}</b><span>Drafts</span></div>
    </div>
    <button class="ghost" data-act="scan-signals" ${state.busy === "signals" ? "disabled" : ""}>${icon("refresh")} Re-scan signals</button>
  </div>
  <div class="shell"><div class="layout">
    <div class="rail">
      <div class="card" style="margin-bottom:12px;padding:14px">
        <div class="eyebrow">Operating as</div>
        <div class="disp" style="font-size:15px;margin-top:5px">${esc(pr.candidate_title || "…")}</div>
        <div style="color:var(--muted);font-size:11.5px;margin-top:4px">${esc(pr.headline || pr.seniority || "")}</div>
      </div>
      ${NAV.map((n) => `<div class="navitem ${state.tab === n.k ? "on" : ""}" data-act="tab" data-tab="${n.k}">${icon(n.icon)}${n.label}<span class="ct">${n.ct()}</span></div>`).join("")}
    </div>
    <div>
      ${state.err ? `<div class="errbar">${icon("alert")}${esc(state.err)}</div>` : ""}
      ${renderTab()}
    </div>
  </div></div>`;
}

function renderTab() {
  if (state.tab === "signals") return tabSignals();
  if (state.tab === "matches") return tabMatches();
  if (state.tab === "companies") return tabCompanies();
  if (state.tab === "people") return tabPeople();
  if (state.tab === "outreach") return tabOutreach();
  if (state.tab === "pipeline") return tabPipeline();
  return "";
}

/* ---------- SIGNALS (the differentiator) ---------- */
function tabSignals() {
  let body;
  if (state.busy === "signals") body = loader(["Scanning funding announcements…", "Tracking leadership moves…", "Reading expansion signals…", "Merging and ranking by fit…"]);
  else if (!state.signals.length) body = `<div class="empty"><div class="ic">${icon("bolt")}</div><h3>No signals scanned yet</h3><p>Find companies about to hire — before the role is even posted.</p><button class="solid" style="margin-top:16px" data-act="scan-signals">${icon("radar")} Scan for signals</button></div>`;
  else body = `<div class="grid">${state.signals.map((s) => {
    const key = String(s.company).toLowerCase().trim();
    return `<div class="card jobcard">${gauge(s.score, "signal")}<div class="jobmain">
      <div class="row"><span class="company">${esc(s.company)}</span>${s.window ? `<span class="tag" style="background:var(--signal-dim);color:var(--signal);border-color:#f5b33c33">act in ${esc(s.window)}</span>` : ""}</div>
      <div class="chips">${s.signals.map((sg) => `<span class="chip" style="color:${sigColor(sg.type)}">${esc(sg.type)}</span>`).join("")}</div>
      ${s.signals.map((sg) => `<div class="reason" style="border-color:${sigColor(sg.type)}">${esc(sg.evidence || "")}${sg.source ? ` <span style="color:var(--faint)">· ${esc(sg.source)}</span>` : ""}</div>`).join("")}
      ${s.why_now ? `<div style="color:var(--muted);font-size:12.5px;margin-top:10px">Why now — ${esc(s.why_now)}</div>` : ""}
      ${(s.inferred_roles && s.inferred_roles.length) ? `<div class="chips" style="margin-top:10px">${s.inferred_roles.map((r) => `<span class="chip" style="color:var(--text)">likely: ${esc(r)}</span>`).join("")}</div>` : ""}
      <div class="actions">
        <button class="tinybtn amber" data-act="sig-people" data-key="${esc(key)}" ${state.busy ? "disabled" : ""}>${icon("users")}Find decision-maker</button>
        <button class="tinybtn" data-act="sig-draft" data-key="${esc(key)}" ${state.busy ? "disabled" : ""}>${icon("send")}Draft timely note</button>
      </div>
    </div></div>`;
  }).join("")}</div>`;
  const scanBtn = `<button class="solid" data-act="scan-signals" ${state.busy ? "disabled" : ""}>${icon("refresh")}${state.signals.length ? "Re-scan" : "Scan for signals"}</button>`;
  return `<div class="sectionhead"><div><div class="eyebrow">Before the job is even posted</div><h2>Hiring signals</h2></div>${state.signals.length ? scanBtn : ""}</div>${body}`;
}

function tabMatches() {
  let body;
  if (state.busy === "jobs") body = loader(["Sweeping live job boards…", "Cross-checking against your skills…", "Scoring fit and recency…", "Locking signal…"]);
  else if (!state.jobs.length) body = `<div class="empty"><div class="ic">${icon("briefcase")}</div><h3>No matches yet</h3><p>Run a scan to pull live openings.</p><button class="solid" style="margin-top:16px" data-act="rescan">${icon("radar")} Scan now</button></div>`;
  else body = `<div class="grid">${state.jobs.map((j) => `
    <div class="card jobcard">${gauge(j.match_score)}<div class="jobmain">
      <div class="row"><span class="company">${esc(j.company)}</span>${icon("chevron")}<span class="role">${esc(j.role)}</span></div>
      <div class="meta">
        ${j.location ? `<span>${icon("mappin")}${esc(j.location)}</span>` : ""}
        ${j.work_mode ? `<span>${icon("zap")}${esc(j.work_mode)}</span>` : ""}
        ${j.salary ? `<span>💰 ${esc(j.salary)}</span>` : ""}
        ${j.posted ? `<span style="color:var(--faint)">${esc(j.posted)}</span>` : ""}
        ${j.source ? `<span style="color:var(--faint)">via ${esc(j.source)}</span>` : ""}
      </div>
      ${j.reason ? `<div class="reason">${esc(j.reason)}</div>` : ""}
      ${j.breakdown ? `<div class="chips">${Object.entries(j.breakdown).map(([k, v]) => `<span class="chip" style="color:${tier(v)}">${esc(k)} ${esc(v)}</span>`).join("")}</div>` : ""}
      <div class="actions">
        <button class="tinybtn amber" data-act="findpeople" data-id="${j.id}" ${state.busy === "job:" + j.id ? "disabled" : ""}>${icon("users")}${state.busy === "job:" + j.id ? "Finding…" : "Find people"}</button>
        <a class="tinybtn" target="_blank" rel="noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(j.apply_query || j.company + " " + j.role + " careers apply")}">${icon("external")}Apply</a>
        <button class="tinybtn" data-act="addpipeline" data-id="${j.id}">${icon("plus")}Pipeline</button>
      </div>
    </div></div>`).join("")}</div>`;
  return `<div class="sectionhead"><div><div class="eyebrow">Ranked against your profile</div><h2>Live matches</h2></div></div>${body}`;
}

function tabCompanies() {
  if (!state.jobs.length) return head("Grouped by employer", "Companies hiring now") + empty("building", "Nothing yet", "Open the Matches tab to pull live openings.");
  const groups = {};
  state.jobs.forEach((j) => { (groups[j.company] = groups[j.company] || { company: j.company, roles: [], best: 0, signals: j.signals }); groups[j.company].roles.push(j); groups[j.company].best = Math.max(groups[j.company].best, j.match_score); });
  const list = Object.values(groups).sort((a, b) => b.best - a.best).map((co) => `
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div class="row"><span class="company">${esc(co.company)}</span>
          <span class="tag" style="background:var(--signal-dim);color:var(--signal);border-color:#f5b33c33">${co.roles.length} open · best ${co.best}%</span></div>
        <button class="tinybtn amber" data-act="findpeople" data-id="${co.roles[0].id}" ${state.busy === "job:" + co.roles[0].id ? "disabled" : ""}>${icon("users")}Find decision makers</button>
      </div>
      ${co.signals ? `<div class="reason" style="margin-top:12px">Signal — ${esc(co.signals)}</div>` : ""}
      <div class="chips" style="margin-top:12px">${co.roles.map((r) => `<span class="chip" style="color:var(--text)">${esc(r.role)} · ${r.match_score}%</span>`).join("")}</div>
    </div>`).join("");
  return head("Grouped by employer", "Companies hiring now") + `<div class="grid">${list}</div>`;
}

function tabPeople() {
  let body;
  if (state.busy && state.busy.indexOf && (state.busy.indexOf("job:") === 0 || state.busy.indexOf("sig:") === 0) && !state.people.length) body = loader(["Searching public profiles…", "Spotting recruiters & hiring managers…", "Ranking by relevance…"]);
  else if (!state.people.length) body = empty("users", "No people yet", `Open a signal or match and tap <b style="color:var(--signal)">Find decision-maker</b>.`);
  else body = `<div class="grid">${[...state.people].sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).map((p) => `
    <div class="card person"><div class="pavatar">${esc(initials(p.name))}</div>
      <div style="flex:1;min-width:0">
        <div class="row" style="justify-content:space-between">
          <div class="row"><span class="company" style="font-size:15px">${esc(p.name)}</span><span class="tag">${esc((p.outreach_type || "contact").replace("_", " "))}</span></div>
          ${gauge(Math.round(p.relevance || 0), "fit")}
        </div>
        <div style="color:var(--muted);font-size:13px;margin-top:2px">${esc(p.title || "")} · ${esc(p.company)}</div>
        ${p.why ? `<div class="reason" style="margin-top:10px;border-color:var(--cyan)">${esc(p.why)}</div>` : ""}
        ${p.signal ? `<div style="color:var(--cyan);font-size:11.5px;margin-top:8px">↳ timely angle: ${esc(p.signal)}</div>` : ""}
        <div class="row" style="margin-top:12px;gap:8px"><input class="inp" style="flex:1;padding:8px 11px;font-size:12.5px" placeholder="their email (optional, to enable send)" value="${esc(p.email || "")}" data-field="pemail" data-id="${p.id}"></div>
        <div class="actions">
          <button class="tinybtn amber" data-act="draft" data-pid="${p.id}" ${state.busy ? "disabled" : ""}>${icon("send")}Draft outreach</button>
          <a class="tinybtn cyan" target="_blank" rel="noreferrer" href="https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(p.linkedin_query || p.name + " " + p.company)}">${icon("external")}Find on LinkedIn</a>
        </div>
      </div></div>`).join("")}</div>`;
  const allBtn = state.people.length ? `<button class="solid" data-act="draftall" ${state.busy ? "disabled" : ""}>${icon("sparkles")}Draft outreach for all</button>` : "";
  return `<div class="sectionhead"><div><div class="eyebrow">The humans who can hire you</div><h2>Decision makers</h2></div>${allBtn}</div>${body}`;
}

function tabOutreach() {
  let body;
  if (state.busy === "all") body = loader(["Writing each message…", "Tailoring to every recipient…"]);
  else if (!state.drafts.length) body = empty("send", "No drafts yet", `Generate outreach from a <b style="color:var(--signal)">Signal</b> or the <b style="color:var(--cyan)">Decision makers</b> tab.`);
  else body = `<div class="grid">${state.drafts.map((d) => `
    <div class="draft">
      <div class="dh"><div class="pavatar" style="width:34px;height:34px;font-size:13px">${esc(initials(d.to))}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:13.5px">${esc(d.to)}</div>
          <div style="color:var(--faint);font-size:11px">${esc(d.company)} · ${esc((d.type || "").replace("_", " "))}</div></div>
        <span class="tag">${d.email ? "ready" : "add email"}</span></div>
      <div class="db">
        <input class="subj" value="${esc(d.subject)}" data-field="dsubject" data-id="${d.id}">
        <textarea class="body" data-field="dbody" data-id="${d.id}">${esc(d.body)}</textarea>
        <div class="row" style="margin-top:12px;gap:8px">
          <input class="inp" style="flex:1;padding:8px 11px;font-size:12.5px" placeholder="recipient email" value="${esc(d.email)}" data-field="demail" data-id="${d.id}">
          <button class="solid" style="padding:9px 14px" data-act="send" data-did="${d.id}">${icon("mail")}Open in email</button>
          <button class="tinybtn" data-act="copy" data-did="${d.id}">${icon("copy")}Copy</button>
          <button class="tinybtn" data-act="deldraft" data-did="${d.id}">${icon("x")}</button>
        </div>
      </div>
    </div>`).join("")}</div>`;
  const warn = state.drafts.length ? `<div class="warn">${icon("alert")}<span>Keep cold outreach to ~20–40 a day and personalize each one. Review every message — “Open in email” hands it to your own inbox so nothing sends without you.</span></div>` : "";
  return `<div class="sectionhead"><div><div class="eyebrow">Personalized · approval-gated</div><h2>Outreach</h2></div></div>${warn}${body}`;
}

function tabPipeline() {
  if (!state.pipeline.length) return head("Every opportunity, one board", "Application pipeline") + empty("workflow", "Pipeline is empty", `Add matches from the <b style="color:var(--signal)">Matches</b> tab to track them here.`);
  const cols = STAGES.map((s, si) => `
    <div class="col"><div class="colh"><span>${s}</span><span>${state.pipeline.filter((p) => p.stage === si).length}</span></div>
      ${state.pipeline.filter((p) => p.stage === si).map((p) => `
        <div class="pcard"><div class="pc">${esc(p.company)}</div><div class="pr">${esc(p.role)}</div>
          <div class="pbtns">
            ${si > 0 ? `<button data-act="move" data-id="${p.id}" data-dir="-1">←</button>` : ""}
            ${si < 5 ? `<button data-act="move" data-id="${p.id}" data-dir="1">Advance ${icon("chevron")}</button>` : ""}
          </div></div>`).join("")}
    </div>`).join("");
  return head("Every opportunity, one board", "Application pipeline") + `<div class="kanban">${cols}</div>`;
}

const head = (eye, h) => `<div class="sectionhead"><div><div class="eyebrow">${eye}</div><h2>${h}</h2></div></div>`;
const empty = (ic, h, p) => `<div class="empty"><div class="ic">${icon(ic)}</div><h3>${h}</h3><p>${p}</p></div>`;

/* ---------- render ---------- */
function render() {
  const root = document.getElementById("root");
  root.innerHTML = state.step === "intake" ? renderIntake() : renderApp();
  startLoader();
}

/* ---------- actions ---------- */
function readIntake() {
  const g = (id) => (document.getElementById(id) || {}).value || "";
  state.cv = g("cv");
  state.prefs = { ...state.prefs, roles: g("roles"), locations: g("locations"), salary: g("salary"), seniority: g("seniority"), industries: g("industries"), avoid: g("avoid"), notes: g("notes") };
}

async function launch() {
  readIntake();
  if (state.cv.trim().length < 40) { state.err = "Add a bit more of your CV / background so the engine has signal to work with."; render(); return; }
  state.err = ""; state.step = "app"; state.busy = "profile"; state.tab = "signals"; render();
  try {
    const { profile } = await api("/parse", { cv: state.cv, prefs: state.prefs });
    state.profile = profile;
    await scanSignals();
  } catch (e) {
    state.err = friendly(e.message); state.busy = null; render();
  }
}

async function scanSignals() {
  state.busy = "signals"; state.err = ""; state.tab = "signals"; render();
  try {
    const { signals } = await api("/signals", { profile: state.profile });
    state.signals = signals || [];
    if (!state.signals.length) state.err = "No fresh signals surfaced — try broader industries, or scan again.";
  } catch (e) { state.err = friendly(e.message); }
  state.busy = null; render();
}

async function discover() {
  state.busy = "jobs"; state.err = ""; state.jobsScanned = true; render();
  try {
    const { jobs } = await api("/jobs", { profile: state.profile });
    state.jobs = (jobs || []).map((j, i) => ({ id: "j" + Date.now() + i, ...j }));
    if (!state.jobs.length) state.err = "Job scan came back empty — re-scan or widen your roles/locations.";
  } catch (e) { state.err = friendly(e.message); }
  state.busy = null; render();
}

async function runFindPeople(company, role, groupKey, signal) {
  state.busy = groupKey; state.err = ""; state.tab = "people"; render();
  try {
    const { people } = await api("/people", { company, role });
    const found = (people || []).map((p, i) => ({ id: "p" + Date.now() + i, groupKey, jobRole: role, company, email: "", signal: signal || "", ...p }));
    state.people = [...state.people.filter((p) => p.groupKey !== groupKey), ...found];
    if (!found.length) state.err = `No clear decision-makers surfaced for ${company}. Try the LinkedIn search.`;
  } catch (e) { state.err = friendly(e.message); }
  state.busy = null; render();
}
function findPeopleJob(jobId) { const j = state.jobs.find((x) => x.id === jobId); if (j) runFindPeople(j.company, j.role, "job:" + jobId, ""); }
function findPeopleSignal(key) {
  const s = state.signals.find((x) => String(x.company).toLowerCase().trim() === key); if (!s) return;
  const role = (s.inferred_roles && s.inferred_roles[0]) || "";
  const sig = (s.signals.map((x) => x.evidence).filter(Boolean)[0]) || s.why_now || "";
  runFindPeople(s.company, role, "sig:" + key, sig);
}

async function makeDraft(pid) {
  const person = state.people.find((p) => p.id === pid); if (!person) return;
  state.busy = "draft"; render();
  try {
    const { draft } = await api("/outreach", { profile: state.profile, person, role: person.jobRole, signal: person.signal || "" });
    state.drafts.unshift({ id: "d" + Date.now() + Math.random().toString(36).slice(2, 6), to: person.name, email: person.email || "", subject: draft.subject || `Re: ${person.jobRole} at ${person.company}`, body: draft.body || "", type: person.outreach_type, company: person.company });
    state.tab = "outreach";
  } catch (e) { state.err = friendly(e.message); }
  state.busy = null; render();
}

async function draftSignal(key) {
  const s = state.signals.find((x) => String(x.company).toLowerCase().trim() === key); if (!s) return;
  state.busy = "draft"; render();
  const sig = (s.signals.map((x) => x.evidence).filter(Boolean)[0]) || s.why_now || "";
  const role = (s.inferred_roles && s.inferred_roles[0]) || "a relevant role";
  const pseudo = { name: "Hiring team", title: "Hiring team", company: s.company, outreach_type: "recruiter", jobRole: role };
  try {
    const { draft } = await api("/outreach", { profile: state.profile, person: pseudo, role, signal: sig });
    state.drafts.unshift({ id: "d" + Date.now() + Math.random().toString(36).slice(2, 6), to: "Hiring team @ " + s.company, email: "", subject: draft.subject || `Re: ${role} at ${s.company}`, body: draft.body || "", type: "recruiter", company: s.company });
    state.tab = "outreach";
  } catch (e) { state.err = friendly(e.message); }
  state.busy = null; render();
}

async function draftAll() {
  state.busy = "all"; state.tab = "outreach"; render();
  for (const person of state.people) {
    try {
      const { draft } = await api("/outreach", { profile: state.profile, person, role: person.jobRole, signal: person.signal || "" });
      state.drafts.unshift({ id: "d" + Date.now() + Math.random().toString(36).slice(2, 6), to: person.name, email: person.email || "", subject: draft.subject || `Re: ${person.jobRole} at ${person.company}`, body: draft.body || "", type: person.outreach_type, company: person.company });
    } catch (e) { /* skip one, continue */ }
  }
  state.busy = null; render();
}

function sendDraft(did) {
  const d = state.drafts.find((x) => x.id === did); if (!d) return;
  if (!d.email) { state.err = "Add the recipient's email on that draft first."; render(); return; }
  window.open(`mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`, "_blank");
}
function copyDraft(did) {
  const d = state.drafts.find((x) => x.id === did); if (!d) return;
  navigator.clipboard && navigator.clipboard.writeText(`${d.subject}\n\n${d.body}`);
}

const friendly = (m) => /tavily/i.test(m)
  ? "Live search needs a Tavily key — add TAVILY_API_KEY to your .env and restart."
  : (/gemini|api key|missing/i.test(m)
    ? "AI key issue — check GEMINI_API_KEY in your .env and restart."
    : "Something went wrong: " + m);

/* ---------- event wiring (delegated, survives re-renders) ---------- */
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const act = t.getAttribute("data-act");
  if (act === "launch") return launch();
  if (act === "scan-signals") return scanSignals();
  if (act === "rescan") return discover();
  if (act === "tab") {
    state.tab = t.getAttribute("data-tab"); render();
    if (state.tab === "matches" && !state.jobsScanned && !state.busy) discover();
    return;
  }
  if (act === "mode") {
    state.prefs.mode = t.getAttribute("data-mode");
    document.querySelectorAll("#modegrp .toggle").forEach((el) => el.classList.toggle("on", el === t));
    return;
  }
  if (act === "findpeople") return findPeopleJob(t.getAttribute("data-id"));
  if (act === "sig-people") return findPeopleSignal(t.getAttribute("data-key"));
  if (act === "sig-draft") return draftSignal(t.getAttribute("data-key"));
  if (act === "addpipeline") {
    const j = state.jobs.find((x) => x.id === t.getAttribute("data-id"));
    if (j && !state.pipeline.some((p) => p.id === j.id)) state.pipeline.push({ id: j.id, company: j.company, role: j.role, stage: 0 });
    return render();
  }
  if (act === "draft") return makeDraft(t.getAttribute("data-pid"));
  if (act === "draftall") return draftAll();
  if (act === "send") return sendDraft(t.getAttribute("data-did"));
  if (act === "copy") return copyDraft(t.getAttribute("data-did"));
  if (act === "deldraft") { state.drafts = state.drafts.filter((x) => x.id !== t.getAttribute("data-did")); return render(); }
  if (act === "move") {
    const id = t.getAttribute("data-id"), dir = parseInt(t.getAttribute("data-dir"), 10);
    state.pipeline = state.pipeline.map((p) => p.id === id ? { ...p, stage: Math.max(0, Math.min(5, p.stage + dir)) } : p);
    return render();
  }
});

/* keep edits in state without re-rendering (no focus loss) */
document.addEventListener("input", (e) => {
  const t = e.target.closest("[data-field]"); if (!t) return;
  const f = t.getAttribute("data-field"), id = t.getAttribute("data-id"), v = t.value;
  if (f === "pemail") { const p = state.people.find((x) => x.id === id); if (p) p.email = v; }
  else if (f === "dsubject") { const d = state.drafts.find((x) => x.id === id); if (d) d.subject = v; }
  else if (f === "dbody") { const d = state.drafts.find((x) => x.id === id); if (d) d.body = v; }
  else if (f === "demail") { const d = state.drafts.find((x) => x.id === id); if (d) d.email = v; }
});

/* live CV/pref persistence so a re-render never wipes typed text */
document.addEventListener("input", (e) => {
  if (state.step !== "intake") return;
  const id = e.target.id;
  if (id === "cv") state.cv = e.target.value;
  else if (["roles", "locations", "salary", "seniority", "industries", "avoid", "notes"].includes(id)) state.prefs[id] = e.target.value;
});

render();
