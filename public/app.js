/* Presenting Structure — app logic.
   The facilitator emits a [[state phase=... candidates=...]] line at the end
   of each reply; the UI parses it to drive the rail, then strips it. */

const STRUCTURES = [
  "Structure 1", "Structure 2", "Structure 3",
  "Craving & Seeking", "Aversion",
  "Strong Concentration, Weak Insight", "Strong Insight, Weak Stabilization",
  "Devotional Temperament", "Skeptical / Inquiry Temperament",
  "Trauma-Loaded / Parts-Dominated", "Late Stage: Transparent Priors",
];
// Note: names 1–3 are placeholders; update to match the framework document
// (they're labels only — diagnosis itself comes from the embedded document).

const STATE_RE = /\[\[state\s+phase=([a-z]+)\s+candidates=([\d,\s]*|none)\]\]\s*$/i;

let turns = [];   // {role, content} — content includes the state line for model context
let busy = false;

const $ = (id) => document.getElementById(id);
const landing = $("landing");
const assessment = $("assessment");
const thread = $("thread");
const input = $("input");
const sendBtn = $("send");
const railEl = $("structure-rail");
const phaseEl = $("phase-label");

// ---------- rail ----------
function renderRail(candidates = []) {
  railEl.innerHTML = "";
  STRUCTURES.forEach((name, i) => {
    const li = document.createElement("li");
    const n = i + 1;
    li.innerHTML = `<span class="n">${n}</span><span class="name">${name}</span>`;
    if (candidates.includes(n)) li.classList.add("candidate");
    railEl.appendChild(li);
  });
}

function applyState(text) {
  const m = text.match(STATE_RE);
  if (!m) return text;
  const phase = m[1];
  const cands =
    m[2].trim().toLowerCase() === "none" || !m[2].trim()
      ? []
      : m[2].split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);
  phaseEl.textContent = phase;
  renderRail(cands);
  return text.replace(STATE_RE, "").trim();
}

// ---------- thread ----------
function addMsg(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  if (role === "facilitator") {
    const sp = document.createElement("span");
    sp.className = "speaker";
    sp.textContent = "Facilitator";
    div.appendChild(sp);
    const body = document.createElement("span");
    body.textContent = content;
    div.appendChild(body);
  } else {
    div.textContent = content;
  }
  thread.appendChild(div);
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function callApi() {
  const dot = document.createElement("span");
  dot.className = "thinking";
  thread.appendChild(dot);

  try {
    const resp = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: turns }),
    });
    const data = await resp.json();
    dot.remove();

    if (!resp.ok || data.error) {
      addMsg("error", data.error || "The connection failed. Try sending again.");
      return;
    }
    turns.push({ role: "assistant", content: data.reply });
    addMsg("facilitator", applyState(data.reply));
  } catch {
    dot.remove();
    addMsg("error", "The connection failed. Try sending again.");
  }
}

async function send() {
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true;
  sendBtn.disabled = true;
  input.value = "";

  turns.push({ role: "user", content: text });
  addMsg("person", text);
  await callApi();

  busy = false;
  sendBtn.disabled = false;
  input.focus();
}

// ---------- export ----------
function exportTranscript() {
  const now = new Date();
  const lines = [
    `# Presenting Structure — reading of ${now.toISOString().slice(0, 10)}`,
    ``,
    ...turns.map((t) => {
      const clean = t.content.replace(STATE_RE, "").trim();
      return t.role === "user" ? `**You:** ${clean}\n` : `**Facilitator:** ${clean}\n`;
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `structure-reading-${now.toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- wiring ----------
$("begin").onclick = async () => {
  landing.classList.add("hidden");
  assessment.classList.remove("hidden");
  renderRail([]);
  // Kick off: the facilitator's first turn is the screening.
  turns = [{ role: "user", content: "I'm ready to begin the reading." }];
  busy = true;
  sendBtn.disabled = true;
  await callApi();
  busy = false;
  sendBtn.disabled = false;
  input.focus();
};

sendBtn.onclick = send;
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
$("export").onclick = exportTranscript;
$("restart").onclick = () => {
  if (!confirm("Start over? The current reading will be discarded (export it first if you want it).")) return;
  turns = [];
  thread.innerHTML = "";
  assessment.classList.add("hidden");
  landing.classList.remove("hidden");
};

renderRail([]);
