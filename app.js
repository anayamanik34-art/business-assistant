"use strict";

/* ===================================================================
   Eksoch Business Assistant — an AI helper for small businesses that
   runs fully in the browser. The Anthropic API key, business profile,
   chats and saved documents live in this device's localStorage. The key
   is sent only to api.anthropic.com.
   =================================================================== */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const main = $("#main");

// ---------- Storage (wrapped: storage can be blocked or full) ----------
const K = { ai: "eba.anthropicKey", demo: "eba.demo", pro: "eba.proCode", profile: "eba.profile", chats: "eba.chats", docs: "eba.docs" };
const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) {
    try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); return true; }
    catch { toast("Couldn't save: this device's storage is full or blocked."); return false; }
  },
  json(k, fallback) { try { return JSON.parse(store.get(k)) ?? fallback; } catch { return fallback; } },
  setJson(k, v) { return store.set(k, JSON.stringify(v)); },
};

// ?demo=1 opens a sample bakery business (used for Store screenshots and demo links).
const startParams = new URLSearchParams(location.search);
if (startParams.get("demo") === "1") store.set(K.demo, "1");
const isDemo = () => store.get(K.demo) === "1";

// In demo mode nothing is saved: chats and documents live in memory only.
const DEMO_PROFILE = {
  name: "Saffron Lane Bakery", what: "Home bakery making custom cakes, cookies and festive gift boxes, with eggless options",
  customers: "Families celebrating birthdays and offices ordering for staff and clients", where: "Pune, India",
  currency: "INR (₹)", tone: "Warm and friendly", extra: "Orders by WhatsApp and Instagram. Delivery within 8 km.",
};
const mem = { chats: [], docs: [] };
// ?demo=1&sample=1 also shows finished answers straight away (for Store/AppSumo screenshots).
const showSample = isDemo() && startParams.get("sample") === "1";
if (showSample) {
  const q = Object.keys(self.DEMO_CHAT)[0];
  mem.chats = [{ id: "sample", title: q, created: Date.now(), messages: [{ role: "user", content: q }, { role: "assistant", content: self.DEMO_CHAT[q] }] }];
  mem.docs = [
    ["Social media posts: Diwali gift boxes", "Social media posts", self.DEMO_ANSWERS.social],
    ["30-day marketing plan: Diwali orders", "30-day marketing plan", self.DEMO_ANSWERS.marketing],
    ["Customer email reply: Meera's birthday cake", "Customer email reply", self.DEMO_ANSWERS.reply],
    [q, "Ask", self.DEMO_CHAT[q]],
  ].map(([title, source, body], i) => ({ id: "s" + i, title, source, body, created: Date.now() - i * 86400000 }));
}
const getProfile = () => (isDemo() ? DEMO_PROFILE : store.json(K.profile, null));
const getChats = () => (isDemo() ? mem.chats : store.json(K.chats, []));
const setChats = (c) => (isDemo() ? ((mem.chats = c), true) : store.setJson(K.chats, c));
const getDocs = () => (isDemo() ? mem.docs : store.json(K.docs, []));
const setDocs = (d) => (isDemo() ? ((mem.docs = d), true) : store.setJson(K.docs, d));
const ready = () => isDemo() || (!!store.get(K.ai) && !!getProfile());

// ---------- Pro (unlocked with an AppSumo code, checked on this device) ----------
// pro-codes.js holds one-way hashes of the valid codes, made by make_appsumo_codes.js.
const PRO_SALT = "eksoch-business-assistant|";
const FREE = { chats: 3, docs: 15 };
const normalizeCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
async function codeIsValid(code) {
  const norm = normalizeCode(code);
  if (norm.length < 10 || !self.PRO_CODE_HASHES || !crypto?.subtle) return false;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PRO_SALT + norm));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
  return self.PRO_CODE_HASHES.has(hex);
}
let proActive = false;
const hasPro = () => proActive || isDemo();
const toolOpen = (t) => t.free || hasPro();

// ---------- Helpers ----------
class AppError extends Error {}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const shortDate = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}
const errorBox = (e) => `<div class="msg error">${esc(e instanceof AppError ? e.message : "Something went wrong. Please try again.")}</div>`;
window.addEventListener("unhandledrejection", (ev) => { if (!(ev.reason instanceof AppError)) console.error(ev.reason); });

function download(filename, text, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileSafe = (s) => String(s || "document").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document";

// Copy as plain text without Markdown symbols, so it pastes cleanly into email and WhatsApp.
const plain = (md) => md
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/\*\*(.+?)\*\*/g, "$1")
  .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1$2")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/^\s*[-*]\s+/gm, "• ")
  .replace(/^---+$/gm, "");
async function copy(text) {
  try { await navigator.clipboard.writeText(plain(text)); toast("Copied ✅"); }
  catch { toast("Couldn't copy: select the text and press Ctrl+C."); }
}

// ---------- A small, safe Markdown renderer (escapes everything first) ----------
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
function md(src) {
  const lines = String(src || "").replace(/\r/g, "").split("\n");
  let html = "", para = [], list = null;
  const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join("<br>")}</p>`; para = []; } };
  const flushList = () => { if (list) { html += `<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`; list = null; } };
  const flush = () => { flushPara(); flushList(); };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    let m;
    if (!ln.trim()) { flush(); continue; }
    if ((m = ln.match(/^(#{1,4})\s+(.*)$/))) { flush(); html += `<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`; continue; }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(ln)) { flush(); html += "<hr>"; continue; }
    if (/^\s*\|.*\|\s*$/.test(ln) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || "")) {
      flush();
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(ln);
      i++;
      const rows = [];
      while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) rows.push(cells(lines[++i]));
      html += `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${
        rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      continue;
    }
    if ((m = ln.match(/^\s*>\s?(.*)$/))) { flush(); html += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
    if ((m = ln.match(/^\s*(?:[-*•])\s+(.*)$/)) || (m = ln.match(/^\s*\d+[.)]\s+(.*)$/))) {
      const tag = /^\s*\d/.test(ln) ? "ol" : "ul";
      flushPara();
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(ln)) { list.items[list.items.length - 1] += " " + ln.trim(); continue; }
    flushList();
    para.push(ln);
  }
  flush();
  return html;
}

// ===================================================================
// Claude (direct from the browser, streamed)
// ===================================================================
const AI_MODEL = "claude-opus-5-5";

function systemPrompt() {
  const p = getProfile() || {};
  const facts = [
    ["Business name", p.name], ["What we do", p.what], ["Customers", p.customers], ["Location", p.where],
    ["Currency", p.currency], ["Preferred tone", p.tone], ["Other notes", p.extra],
  ].filter(([, v]) => String(v || "").trim()).map(([k, v]) => `- ${k}: ${String(v).trim()}`).join("\n");
  return `You are a practical, friendly business assistant for a small business owner. You help with customers, marketing, sales, planning, pricing, hiring, admin and everyday decisions.

About the owner's business:
${facts || "- (No details given yet.)"}

How to work:
- Tailor every answer to this business, its customers, location and currency. Write in the preferred tone when drafting anything customers will read.
- Be concrete and brief: lead with the answer or the ready-to-use text, then short supporting points. Busy owners skim.
- Never invent facts about the business (prices, policies, addresses, statistics, reviews). Where a detail is needed and unknown, use a [square-bracket placeholder].
- Show your working for any calculation.
- For legal, tax, employment, medical or financial questions, give clear general information and recommend checking with a qualified professional for important decisions; don't refuse ordinary business questions.
- Format with Markdown: short headings, bullet lists and simple tables when they help. No preamble like "Certainly!".`;
}

function aiError(status, detail) {
  if (status === 401) return new AppError("Your Anthropic API key was rejected. Add a new one in Settings.");
  if (status === 403) return new AppError("This API key isn't allowed to use the model. Check your Anthropic account.");
  if (status === 429) return new AppError("Too many requests right now. Wait a minute and try again.");
  if (status === 400 && /credit/i.test(detail)) return new AppError("Your Anthropic account is out of credit. Add credit at console.anthropic.com.");
  if (status === 529 || status >= 500) return new AppError("Anthropic is busy right now. Try again in a minute.");
  return new AppError(`Anthropic error (${status})${detail ? ": " + detail : ""}`);
}
const baseHeaders = (apiKey) => ({
  "x-api-key": apiKey,
  "anthropic-version": "2026-10-21",
  "anthropic-dangerous-direct-browser-access": "true",
  "content-type": "application/json",
});

// Used to check a key before saving it.
async function checkKey(apiKey) {
  let r;
  try { r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: baseHeaders(apiKey) }); }
  catch { throw new AppError("Couldn't reach Anthropic. Check your internet connection."); }
  if (r.ok) return;
  let detail = "";
  try { detail = (await r.json()).error?.message || ""; } catch { /* keep empty */ }
  throw aiError(r.status, detail);
}

// Streams an answer; calls onText(fullTextSoFar) as text arrives. Returns the final text.
async function ask({ messages, effort = "low", onText, signal, demoText }) {
  if (isDemo()) return fakeStream(demoText || self.DEMO_FALLBACK, onText, signal);
  const apiKey = store.get(K.ai);
  if (!apiKey) throw new AppError("Add your Anthropic API key in Settings first.");
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: { ...baseHeaders(apiKey), "anthropic-beta": "server-side-fallback-2026-07-01" },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 32000, stream: true, fallbacks: "default",
        cache_control: { type: "ephemeral" },
        output_config: { effort },
        system: systemPrompt(),
        messages,
      }),
    });
  } catch (e) {
    if (e.name === "AbortError") return "";
    throw new AppError("Couldn't reach Anthropic. Check your internet connection.");
  }
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json()).error?.message || ""; } catch { /* keep empty */ }
    throw aiError(r.status, detail);
  }
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", text = "", stop = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let cut;
      while ((cut = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (!data) continue;
        let ev;
        try { ev = JSON.parse(data); } catch { continue; }
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") { text += ev.delta.text; onText(text); }
        else if (ev.type === "message_delta" && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === "error") throw aiError(ev.error?.type === "overloaded_error" ? 529 : 500, ev.error?.message);
      }
    }
  } catch (e) {
    if (e.name === "AbortError") return text;
    throw e instanceof AppError ? e : new AppError("The connection dropped while the answer was coming in. Please try again.");
  }
  if (stop === "refusal" && !text.trim()) throw new AppError("The AI declined this request. Try rewording it.");
  if (stop === "max_tokens") text += "\n\n_(The answer was cut off because it was very long.)_";
  return text;
}

// Demo mode: "stream" a pre-written answer.
async function fakeStream(full, onText, signal) {
  const parts = full.match(/\S+\s*/g) || [];
  let text = "";
  await new Promise((res) => setTimeout(res, 350));
  for (let i = 0; i < parts.length; i++) {
    if (signal?.aborted) return text;
    text += parts[i];
    if (i % 3 === 2 || i === parts.length - 1) { onText(text); await new Promise((res) => setTimeout(res, 18)); }
  }
  return text;
}

// Renders streamed text into an element, at most once per frame.
function liveRenderer(el) {
  let pending = null;
  el.classList.add("cursor");
  return {
    update(text) {
      pending = text;
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = 0; el.innerHTML = md(pending); });
    },
    done(text) { cancelAnimationFrame(this.raf); this.raf = 0; el.classList.remove("cursor"); el.innerHTML = md(text); },
  };
}

// ===================================================================
// Library (saved documents)
// ===================================================================
function saveDoc(title, body, source) {
  const docs = getDocs();
  if (!hasPro() && docs.length >= FREE.docs) {
    toast(`The free plan keeps ${FREE.docs} documents. Delete some or unlock Pro.`);
    return null;
  }
  const doc = { id: uid(), title: String(title || "Untitled").slice(0, 120), body, source, created: Date.now() };
  if (!setDocs([doc, ...docs])) return null;
  toast("Saved to your library 📚");
  return doc;
}

async function viewLibrary() {
  const docs = getDocs();
  main.innerHTML = `
    <div class="row spread"><h2>📚 Library</h2>
      <input id="libSearch" type="search" placeholder="Search your documents" style="max-width:320px;margin:0" aria-label="Search your documents"></div>
    ${hasPro() ? "" : `<div class="card small"><strong>${docs.length} of ${FREE.docs}</strong> free documents used
      <div class="meter"><div style="width:${Math.min(100, (docs.length / FREE.docs) * 100)}%"></div></div>
      <a href="#pro">Unlock Pro</a> for unlimited documents and backups.</div>`}
    <div class="docs" id="docList"></div>`;
  const list = $("#docList");
  const draw = () => {
    const q = $("#libSearch").value.trim().toLowerCase();
    const shown = docs.filter((d) => !q || (d.title + " " + d.body).toLowerCase().includes(q));
    list.innerHTML = shown.length
      ? shown.map((d) => `<a class="doc" href="#doc/${d.id}"><span>${esc(d.title)}</span><small>${esc(d.source || "")} · ${shortDate(d.created)}</small></a>`).join("")
      : `<div class="card muted">${docs.length ? "No documents match your search." : "Nothing saved yet. Click <strong>Save to library</strong> under any answer to keep it here."}</div>`;
  };
  $("#libSearch").addEventListener("input", draw);
  draw();
}

async function viewDoc(id) {
  const doc = getDocs().find((d) => d.id === id);
  if (!doc) { main.innerHTML = '<div class="card">That document was not found. <a href="#library">Back to the library</a></div>'; return; }
  main.innerHTML = `
    <p><a href="#library">← Library</a></p>
    <div class="card">
      <div class="row spread"><h2 style="margin:0">${esc(doc.title)}</h2><span class="muted small">${esc(doc.source || "")} · ${shortDate(doc.created)}</span></div>
      <div class="row" style="margin:12px 0">
        <button class="btn small" id="dCopy" type="button">📋 Copy</button>
        <button class="btn small" id="dDown" type="button">⬇️ Download</button>
        <button class="btn small" id="dRename" type="button">✏️ Rename</button>
        <button class="btn small danger" id="dDel" type="button">🗑️ Delete</button>
      </div>
      <div class="md">${md(doc.body)}</div>
    </div>`;
  $("#dCopy").onclick = () => copy(doc.body);
  $("#dDown").onclick = () => download(fileSafe(doc.title) + ".md", `# ${doc.title}\n\n${doc.body}\n`);
  $("#dRename").onclick = () => {
    const t = prompt("New name", doc.title);
    if (!t?.trim()) return;
    setDocs(getDocs().map((d) => (d.id === id ? { ...d, title: t.trim().slice(0, 120) } : d)));
    route();
  };
  $("#dDel").onclick = () => {
    if (!confirm("Delete this document? This can't be undone.")) return;
    setDocs(getDocs().filter((d) => d.id !== id));
    toast("Deleted");
    location.hash = "#library";
  };
}

// ===================================================================
// Ask (chat)
// ===================================================================
const STARTERS = [
  "How can I get more repeat customers?",
  "Give me 5 low-cost promotion ideas for this month",
  "Write a WhatsApp message announcing a new product",
  "What should I track every week to know my business is healthy?",
];
let activeChat = null; // AbortController while an answer is streaming

function chatTitle(text) { const t = text.replace(/\s+/g, " ").trim(); return t.length > 48 ? t.slice(0, 46) + "…" : t; }

async function viewAsk(chatId) {
  const chats = getChats();
  const chat = chats.find((c) => c.id === chatId) || null;
  if (chatId && !chat) { location.hash = "#ask"; return; }
  const name = getProfile()?.name || "your business";
  main.innerHTML = `
    <div class="chat">
      <aside class="card convs" aria-label="Conversations">
        <a href="#ask" ${chat ? "" : 'aria-current="true"'}>➕ New conversation</a>
        ${chats.map((c) => `<a href="#ask/${c.id}" ${c.id === chatId ? 'aria-current="true"' : ""} title="${esc(c.title)}">${esc(c.title)}</a>`).join("")}
        ${hasPro() ? "" : `<p class="muted small" style="margin:8px 10px 0">Free plan: ${Math.min(chats.length, FREE.chats)} of ${FREE.chats} conversations</p>`}
      </aside>
      <section>
        <div class="thread" id="thread">
          ${chat ? "" : `
            <div class="card">
              <h2 style="margin-top:0">Hi! What can I help ${esc(name)} with today?</h2>
              <p class="muted">Ask anything about customers, marketing, pricing, planning or admin. I know the details in <a href="#business">My business</a>.</p>
              <div class="starters">${STARTERS.map((s) => `<button class="btn" type="button" data-starter="${esc(s)}">${esc(s)}</button>`).join("")}</div>
            </div>`}
        </div>
        ${chat ? '<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn small danger" id="delChat" type="button">🗑️ Delete conversation</button></div>' : ""}
        <form class="composer" id="composer">
          <textarea name="q" rows="2" placeholder="Ask your business assistant…" aria-label="Your message" required></textarea>
          <button class="btn primary" type="submit" id="sendBtn">Send</button>
        </form>
        <div id="chatMsg"></div>
      </section>
    </div>`;

  const thread = $("#thread");
  const form = $("#composer");
  const ta = form.q;
  const addBubble = (m, i) => {
    const el = document.createElement("div");
    el.className = "bubble " + (m.role === "user" ? "user" : "ai");
    if (m.role === "user") el.textContent = m.content;
    else {
      el.innerHTML = `<div class="md">${md(m.content)}</div><div class="acts">
        <button class="chip" type="button" data-act="copy">📋 Copy</button>
        <button class="chip" type="button" data-act="save">📚 Save to library</button></div>`;
      el.dataset.i = i;
    }
    thread.append(el);
    return el;
  };
  if (chat) chat.messages.forEach(addBubble);

  thread.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.starter) { ta.value = b.dataset.starter; form.requestSubmit(); return; }
    const c = getChats().find((x) => x.id === (form.dataset.chatId || chatId));
    const m = c?.messages[Number(b.closest(".bubble")?.dataset.i)];
    if (!m) return;
    if (b.dataset.act === "copy") copy(m.content);
    if (b.dataset.act === "save") saveDoc(c.messages[Number(b.closest(".bubble").dataset.i) - 1]?.content ? chatTitle(c.messages[Number(b.closest(".bubble").dataset.i) - 1].content) : c.title, m.content, "Ask");
  });
  $("#delChat")?.addEventListener("click", () => {
    if (!confirm("Delete this conversation?")) return;
    setChats(getChats().filter((c) => c.id !== chatId));
    location.hash = "#ask";
  });
  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); form.requestSubmit(); }
  });
  if (chat && !showSample) requestAnimationFrame(() => thread.lastElementChild?.scrollIntoView({ block: "start" }));
  ta.focus();

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = $("#sendBtn");
    if (activeChat) { activeChat.abort(); return; } // the Send button doubles as Stop
    const q = ta.value.trim();
    if (!q) return;
    $("#chatMsg").innerHTML = "";
    let all = getChats();
    let c = all.find((x) => x.id === (form.dataset.chatId || chatId));
    if (!c) {
      if (!hasPro() && all.length >= FREE.chats) {
        $("#chatMsg").innerHTML = `<div class="msg warn">The free plan keeps ${FREE.chats} conversations. Delete an old one, or <a href="#pro">unlock Pro</a> for unlimited conversations.</div>`;
        return;
      }
      c = { id: uid(), title: chatTitle(q), created: Date.now(), messages: [] };
      thread.innerHTML = "";
      form.dataset.chatId = c.id;
    }
    c.messages.push({ role: "user", content: q });
    addBubble(c.messages[c.messages.length - 1]);
    ta.value = "";
    const aiEl = document.createElement("div");
    aiEl.className = "bubble ai";
    aiEl.innerHTML = '<div class="md"><span class="muted">Thinking…</span></div>';
    thread.append(aiEl);
    aiEl.scrollIntoView({ block: "nearest" });
    const view = liveRenderer($(".md", aiEl));
    activeChat = new AbortController();
    btn.textContent = "Stop";
    try {
      const history = c.messages.slice(-30).map(({ role, content }) => ({ role, content }));
      const text = await ask({
        messages: history, effort: "low", signal: activeChat.signal,
        demoText: self.DEMO_CHAT[q], onText: (t) => view.update(t),
      });
      view.done(text || "_(Stopped.)_");
      aiEl.remove();
      if (text) c.messages.push({ role: "assistant", content: text });
      else c.messages.pop();
    } catch (e) {
      aiEl.remove();
      c.messages.pop();
      ta.value = q;
      $("#chatMsg").innerHTML = errorBox(e) + (isDemo() ? "" : '<p class="small"><a href="#settings">Open Settings</a></p>');
    } finally {
      activeChat = null;
      btn.textContent = "Send";
    }
    if (!c.messages.length) return;
    all = getChats().filter((x) => x.id !== c.id);
    setChats([c, ...all]);
    // Re-render so the bubbles get their buttons and the list shows this chat.
    if (location.hash !== "#ask/" + c.id) location.hash = "#ask/" + c.id; else route();
  });
}

// ===================================================================
// Tools
// ===================================================================
async function viewTools() {
  const cats = [...new Set(self.TOOLS.map((t) => t.cat))];
  main.innerHTML = `
    <h2>🧰 AI tools</h2>
    <p class="muted">Fill in a short form and get ready-to-use text, written for ${esc(getProfile()?.name || "your business")}.</p>
    ${cats.map((cat) => `
      <h3 class="cat">${esc(cat)}</h3>
      <div class="grid tools">
        ${self.TOOLS.filter((t) => t.cat === cat).map((t) => `
          <a class="tool" href="#tool/${t.id}">
            ${toolOpen(t) ? "" : '<span class="lock">🔒 Pro</span>'}
            <span class="ic" aria-hidden="true">${t.icon}</span><strong>${esc(t.name)}</strong><p>${esc(t.desc)}</p>
          </a>`).join("")}
      </div>`).join("")}`;
}

const fieldHtml = (f) => {
  const val = isDemo() ? f.demo || "" : "";
  const label = `${esc(f.label)}${f.hint ? ` <span class="hint">${esc(f.hint)}</span>` : ""}`;
  if (f.type === "select") return `<label>${label}<select name="${f.name}">${f.options.map((o) => `<option ${o === val ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  if (f.type === "textarea") return `<label>${label}<textarea name="${f.name}" ${f.required ? "required" : ""} maxlength="20000">${esc(val)}</textarea></label>`;
  return `<label>${label}<input name="${f.name}" value="${esc(val)}" ${f.required ? "required" : ""} maxlength="500"></label>`;
};

const REFINE = ["Make it shorter", "Make it more friendly", "Make it more professional", "Give me another version", "Translate to Hindi", "Add emojis"];

async function viewTool(id) {
  const t = self.TOOLS.find((x) => x.id === id);
  if (!t) { location.hash = "#tools"; return; }
  if (!toolOpen(t)) return viewLocked(`The ${t.name} tool`);
  main.innerHTML = `
    <p><a href="#tools">← All tools</a></p>
    <h2>${t.icon} ${esc(t.name)}</h2>
    <div class="work">
      <form class="card" id="toolForm">
        <p class="muted small" style="margin-top:0">${esc(t.desc)}</p>
        ${t.fields.map(fieldHtml).join("")}
        <button class="btn primary" type="submit" id="genBtn">✨ Write it</button>
      </form>
      <section class="card output" aria-live="polite">
        <div class="md" id="out"><p class="placeholder">Your result will appear here.</p></div>
        <div id="outActs" hidden>
          <div class="row" style="margin-top:14px">
            <button class="btn small" id="oCopy" type="button">📋 Copy</button>
            <button class="btn small" id="oSave" type="button">📚 Save to library</button>
            <button class="btn small" id="oDown" type="button">⬇️ Download</button>
          </div>
          <div class="chips" aria-label="Quick changes">${REFINE.map((r) => `<button class="chip" type="button" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
          <form class="row" id="refineForm" style="flex-wrap:nowrap">
            <input name="r" placeholder="Or ask for a change…" aria-label="Ask for a change" style="margin:0">
            <button class="btn" type="submit">Update</button>
          </form>
        </div>
        <div id="toolMsg"></div>
      </section>
    </div>`;

  const out = $("#out");
  const form = $("#toolForm");
  const gen = $("#genBtn");
  let convo = [];       // messages for this tool session, so changes build on the last answer
  let result = "";
  let abort = null;
  let firstValues = null;

  const busy = (on) => {
    gen.textContent = on ? "■ Stop" : "✨ Write it";
    $$("#outActs button, #refineForm input").forEach((b) => { b.disabled = on; });
  };
  async function run(userText, demoText) {
    if (abort) { abort.abort(); return; }
    $("#toolMsg").innerHTML = "";
    const prev = result;
    out.innerHTML = '<p class="placeholder">Writing…</p>';
    const view = liveRenderer(out);
    abort = new AbortController();
    busy(true);
    const messages = [...convo, { role: "user", content: userText }];
    try {
      const text = await ask({ messages, effort: "medium", signal: abort.signal, demoText, onText: (x) => view.update(x) });
      if (text) {
        result = text;
        convo = [...messages, { role: "assistant", content: text }].slice(-12);
        view.done(text);
        $("#outActs").hidden = false;
      } else { view.done(prev || ""); if (!prev) out.innerHTML = '<p class="placeholder">Stopped.</p>'; }
    } catch (e) {
      view.done(prev);
      if (!prev) out.innerHTML = '<p class="placeholder">Your result will appear here.</p>';
      $("#toolMsg").innerHTML = errorBox(e) + (isDemo() ? "" : '<p class="small"><a href="#settings">Open Settings</a></p>');
    } finally { abort = null; busy(false); }
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (abort) { abort.abort(); return; }
    const v = Object.fromEntries(new FormData(form));
    firstValues = v;
    convo = [];
    run(t.prompt(v), self.DEMO_ANSWERS[t.id]);
  });
  const refine = (r) => {
    if (!r || !result) return;
    run(`${r}. Give the full updated result.`, isDemo() ? `_(Demo mode: with your own API key this would apply "${r}".)_\n\n${result}` : undefined);
  };
  $$(".chip", main).forEach((c) => c.addEventListener("click", () => refine(c.dataset.r)));
  $("#refineForm").addEventListener("submit", (ev) => { ev.preventDefault(); const r = ev.target.r.value.trim(); ev.target.r.value = ""; refine(r); });
  const title = () => `${t.name}: ${String(Object.values(firstValues || {}).find((x) => String(x).trim().length > 3) || "").slice(0, 60)}`;
  $("#oCopy").onclick = () => copy(result);
  $("#oSave").onclick = () => saveDoc(title(), result, t.name);
  $("#oDown").onclick = () => download(fileSafe(title()) + ".md", `# ${title()}\n\n${result}\n`);
  if (showSample && self.DEMO_ANSWERS[t.id]) form.requestSubmit();
}

// ===================================================================
// My business (profile)
// ===================================================================
const PROFILE_FIELDS = [
  { name: "name", label: "Business name", required: true, ph: "e.g. Saffron Lane Bakery" },
  { name: "what", label: "What you sell or do", required: true, area: true, ph: "e.g. Custom cakes and cookies for birthdays and offices, eggless options" },
  { name: "customers", label: "Your typical customers", area: true, ph: "e.g. Families nearby, office HR teams" },
  { name: "where", label: "Location / area you serve", ph: "e.g. Pune, India · or Online, worldwide" },
  { name: "currency", label: "Currency", ph: "e.g. USD ($), INR (₹), GBP (£), EUR (€)" },
  { name: "tone", label: "Your brand voice", ph: "e.g. Warm and friendly · Professional · Fun and playful" },
  { name: "extra", label: "Anything else the assistant should know", area: true, ph: "e.g. Prices, opening hours, delivery area, what makes you different" },
];

function profileForm(id, p = {}) {
  return `<form id="${id}">
    ${PROFILE_FIELDS.map((f) => `<label>${esc(f.label)}${f.required ? "" : ' <span class="hint">(optional)</span>'}
      ${f.area ? `<textarea name="${f.name}" placeholder="${esc(f.ph)}" ${f.required ? "required" : ""} maxlength="3000" style="min-height:70px">${esc(p[f.name] || "")}</textarea>`
        : `<input name="${f.name}" value="${esc(p[f.name] || "")}" placeholder="${esc(f.ph)}" ${f.required ? "required" : ""} maxlength="300">`}</label>`).join("")}
    <button class="btn primary" type="submit">Save</button>
  </form>`;
}
const readProfile = (form) => Object.fromEntries(PROFILE_FIELDS.map((f) => [f.name, form[f.name].value.trim()]));

async function viewBusiness() {
  main.innerHTML = `
    <h2>🏢 My business</h2>
    <div class="card">
      <p class="muted" style="margin-top:0">The assistant uses these details in every answer, so the more specific you are, the better the results.</p>
      ${isDemo() ? '<div class="msg info">Demo mode uses a sample bakery. Leave demo mode in Settings to enter your own business.</div>' : ""}
      ${profileForm("bizForm", getProfile() || {})}
    </div>`;
  const form = $("#bizForm");
  if (isDemo()) { $$("input, textarea, button", form).forEach((el) => { el.disabled = true; }); return; }
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (store.setJson(K.profile, readProfile(form))) { toast("Business details saved ✅"); updateChrome(); }
  });
}

// ===================================================================
// Welcome / setup
// ===================================================================
const KEY_STEPS = `
  <ol>
    <li>Go to <strong>console.anthropic.com</strong> and sign up or sign in.</li>
    <li>Under <strong>Billing</strong>, add a little credit (US $5 lasts most small businesses a long time).</li>
    <li>Open <strong>API keys</strong>, click <strong>Create key</strong> and copy it.</li>
    <li>Paste it below. It is saved only on this device.</li>
  </ol>`;

function keyForm(id) {
  return `<form id="${id}">
    <label>Anthropic API key <input type="password" name="key" autocomplete="off" spellcheck="false" required placeholder="sk-ant-…"></label>
    <div class="formMsg"></div>
    <button class="btn primary" type="submit">Save key</button>
  </form>`;
}
function wireKeyForm(form, after) {
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const key = form.key.value.trim();
    const msg = $(".formMsg", form);
    msg.innerHTML = "";
    if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(key)) { msg.innerHTML = errorBox(new AppError("That doesn't look like an Anthropic API key (it starts with sk-ant-).")); return; }
    const btn = $("button", form);
    btn.disabled = true; btn.textContent = "Checking…";
    try {
      await checkKey(key);
      if (store.set(K.ai, key)) { toast("API key saved ✅"); after(); }
    } catch (e) { msg.innerHTML = errorBox(e); }
    finally { btn.disabled = false; btn.textContent = "Save key"; }
  });
}

function viewWelcome() {
  const p = getProfile();
  const step = !p ? 1 : 2;
  main.innerHTML = `
    <div class="welcome">
      <div class="card">
        <h2 style="margin-top:0">Your AI business assistant 👋</h2>
        <p>Answers your business questions and writes the everyday stuff (customer replies, social posts, marketing plans, job ads, policies) in your voice, for your business.</p>
        <ul>
          <li>💬 <strong>Ask anything</strong> about customers, marketing, pricing or planning</li>
          <li>🧰 <strong>13 ready-made tools</strong> for the jobs you do every week</li>
          <li>📚 <strong>A library</strong> of everything you want to keep</li>
          <li>🔒 <strong>Private:</strong> no account, no server; your data stays on this device</li>
        </ul>
        <div class="row"><button class="btn" id="tryDemo" type="button">👀 Try the demo first</button></div>
      </div>
      <div class="card">
        <h3>Step ${step} of 2: ${step === 1 ? "Tell us about your business" : "Connect the AI"}</h3>
        ${step === 1 ? profileForm("wBiz") : `
          <p>The assistant runs on Claude by Anthropic, using your own Anthropic account, so you only pay for what you use (usually a few cents per answer).</p>
          ${KEY_STEPS}${keyForm("wKey")}
          <p class="small"><a href="#" id="editBiz">← Change business details</a></p>`}
      </div>
    </div>`;
  $("#tryDemo").addEventListener("click", () => { store.set(K.demo, "1"); location.hash = "#ask"; route(); });
  if (step === 1) {
    $("#wBiz").addEventListener("submit", (ev) => { ev.preventDefault(); if (store.setJson(K.profile, readProfile(ev.target))) route(); });
  } else {
    wireKeyForm($("#wKey"), () => { location.hash = "#ask"; route(); });
    $("#editBiz").addEventListener("click", (ev) => { ev.preventDefault(); store.set(K.profile, ""); route(); });
  }
}

// ===================================================================
// Pro
// ===================================================================
const PRO_FEATURES = `
  <ul>
    <li>🧰 <strong>All ${self.TOOLS.length} AI tools</strong> (free: ${self.TOOLS.filter((t) => t.free).length}): review replies, marketing plans, business plans, pricing, job posts, policies, outreach, newsletters and more</li>
    <li>💬 <strong>Unlimited conversations</strong> (free: ${FREE.chats})</li>
    <li>📚 <strong>Unlimited library</strong> (free: ${FREE.docs} documents)</li>
    <li>💾 <strong>Backup &amp; restore</strong> to move everything to another device</li>
    <li>♾️ <strong>Lifetime</strong>: pay once, keep it, including future tools</li>
  </ul>`;

function proCodeForm(id) {
  return `<form id="${id}">
    <label>Your code <span class="hint">(for example EBA-ABCD-EFGH-JKMN)</span>
      <input name="code" autocomplete="off" spellcheck="false" autocapitalize="characters" required></label>
    <div class="formMsg"></div>
    <button class="btn primary" type="submit">Unlock Pro</button>
  </form>`;
}
function wireProCodeForm(form) {
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $(".formMsg", form);
    const code = form.code.value.trim();
    const btn = $("button", form);
    btn.disabled = true; btn.textContent = "Checking…";
    try {
      if (!(await codeIsValid(code))) throw new AppError("That code isn't valid. Check it against your AppSumo purchase and try again.");
      store.set(K.pro, normalizeCode(code));
      proActive = true;
      toast("Pro unlocked ✅");
      route();
    } catch (e) { msg.innerHTML = errorBox(e); }
    finally { btn.disabled = false; btn.textContent = "Unlock Pro"; }
  });
}
function viewLocked(what) {
  main.innerHTML = `
    <p><a href="#tools">← All tools</a></p>
    <div class="card">
      <h2>🔒 ${esc(what)} is part of Pro</h2>
      <p>Pro adds:</p>${PRO_FEATURES}
      <p>Have a code from AppSumo? Enter it below. It unlocks Pro for good on this device.</p>
      ${proCodeForm("lockForm")}
    </div>`;
  wireProCodeForm($("#lockForm"));
}

async function viewPro() {
  if (proActive) {
    main.innerHTML = `
      <h2>⭐ Pro</h2>
      <div class="card">
        <p>✅ <strong>Pro is unlocked</strong> on this device.</p>${PRO_FEATURES}
        <p class="muted small">Your code is saved only on this device. To use Pro on another device, enter the same code there.</p>
        <button class="btn danger small" id="rmPro" type="button">Remove the code from this device</button>
      </div>`;
    $("#rmPro").addEventListener("click", () => {
      if (!confirm("Remove your Pro code from this device? Keep a copy of it so you can enter it again.")) return;
      store.set(K.pro, ""); proActive = false; toast("Pro code removed"); route();
    });
    return;
  }
  main.innerHTML = `
    <h2>⭐ Unlock Pro</h2>
    <div class="card">
      <p>${isDemo() ? "Demo mode shows every Pro feature. " : ""}The chat and three tools are free. Pro adds:</p>${PRO_FEATURES}
      <h3>Enter your AppSumo code</h3>${proCodeForm("proForm")}
    </div>`;
  wireProCodeForm($("#proForm"));
}

// ===================================================================
// Settings
// ===================================================================
async function viewSettings() {
  const hasKey = !!store.get(K.ai);
  main.innerHTML = `
    <h2>⚙️ Settings</h2>
    ${isDemo() ? `<div class="card"><h3>Demo mode</h3><p>You're exploring a sample business with pre-written answers. Nothing is saved.</p>
      <button class="btn primary" id="leaveDemo" type="button">Leave demo mode and set up my business</button></div>` : ""}
    <div class="card">
      <h3>AI connection</h3>
      <p>${hasKey ? "✅ Anthropic API key saved." : "No Anthropic API key yet."} <span class="muted small">Uses your own Anthropic account (model: Claude Opus 5.5). Most answers cost a few US cents.</span></p>
      <details ${hasKey ? "" : "open"}><summary>${hasKey ? "Replace the API key" : "Add an API key"}</summary>${KEY_STEPS}${keyForm("sKey")}</details>
      ${hasKey ? '<p><button class="btn danger small" id="rmKey" type="button">Remove API key</button></p>' : ""}
    </div>
    <div class="card">
      <h3>Backup &amp; restore ${hasPro() ? "" : '<span class="pill">Pro</span>'}</h3>
      <p class="muted small">Save your business details, conversations and library to a file, then restore it on another device. The API key is not included.</p>
      <div class="row">
        <button class="btn" id="backup" type="button" ${hasPro() && !isDemo() ? "" : "disabled"}>⬇️ Download backup</button>
        <label class="btn" style="margin:0" ${hasPro() && !isDemo() ? "" : 'aria-disabled="true"'}>⬆️ Restore from file
          <input type="file" id="restore" accept="application/json,.json" hidden ${hasPro() && !isDemo() ? "" : "disabled"}></label>
      </div>
      ${hasPro() ? "" : '<p class="small"><a href="#pro">Unlock Pro</a> to use backups.</p>'}
    </div>
    <div class="card">
      <h3>This device</h3>
      <p class="muted small">Everything is stored only in this app on this device. Your questions are sent only to Anthropic to get answers.</p>
      <button class="btn danger" id="forget" type="button" ${isDemo() ? "disabled" : ""}>Delete all my data from this device</button>
    </div>`;
  wireKeyForm($("#sKey"), route);
  $("#leaveDemo")?.addEventListener("click", () => { store.set(K.demo, ""); mem.chats = []; mem.docs = []; location.hash = ""; route(); });
  $("#rmKey")?.addEventListener("click", () => { if (confirm("Remove the Anthropic API key from this device?")) { store.set(K.ai, ""); toast("API key removed"); location.hash = ""; route(); } });
  $("#backup").addEventListener("click", () => {
    const data = { app: "eksoch-business-assistant", version: 1, saved: new Date().toISOString(), profile: getProfile(), chats: getChats(), docs: getDocs() };
    download(`business-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
  });
  $("#restore").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== "eksoch-business-assistant") throw new Error();
      if (!confirm("Replace your business details, conversations and library with this backup?")) return;
      const clean = (arr) => (Array.isArray(arr) ? arr.filter((x) => x && typeof x.id === "string") : []);
      if (data.profile && typeof data.profile === "object") store.setJson(K.profile, data.profile);
      setChats(clean(data.chats));
      setDocs(clean(data.docs));
      toast("Backup restored ✅");
      route();
    } catch { toast("That file isn't a Business Assistant backup."); }
  });
  $("#forget").addEventListener("click", () => {
    if (!confirm("Delete your API key, business details, conversations and library from this device? This can't be undone. (Your Pro code is kept.)")) return;
    [K.ai, K.profile, K.chats, K.docs, K.demo].forEach((k) => store.set(k, ""));
    location.hash = "";
    toast("All data deleted");
    route();
  });
}

// ===================================================================
// Shell & routing
// ===================================================================
function updateChrome() {
  $("#tabs").hidden = !ready();
  $("#demoBadge").hidden = !isDemo();
  $("#proBadge").hidden = !proActive || isDemo();
  const p = getProfile();
  $("#bizLine").textContent = isDemo() ? "Exploring with a sample bakery" : ready() && p?.name ? `Working for ${p.name}` : "Your AI helper for running a small business";
}

async function route() {
  if (activeChat) { activeChat.abort(); activeChat = null; }
  updateChrome();
  const [page, arg] = location.hash.slice(1).split("/");
  if (!ready() && page !== "pro") return viewWelcome();
  const tab = { ask: "ask", tools: "tools", tool: "tools", library: "library", doc: "library", business: "business", pro: "pro", settings: "settings" }[page] || "ask";
  $$("#tabs a").forEach((a) => (a.dataset.page === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  try {
    if (page === "tools") await viewTools();
    else if (page === "tool") await viewTool(arg);
    else if (page === "library") await viewLibrary();
    else if (page === "doc") await viewDoc(arg);
    else if (page === "business") await viewBusiness();
    else if (page === "pro") await viewPro();
    else if (page === "settings") await viewSettings();
    else await viewAsk(page === "ask" ? arg : undefined);
  } catch (e) { main.innerHTML = errorBox(e); }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

(async () => {
  const saved = store.get(K.pro);
  proActive = !!saved && await codeIsValid(saved).catch(() => false);
  route();
})();
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
