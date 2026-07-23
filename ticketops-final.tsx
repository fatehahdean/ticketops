import { useState, useEffect } from "react";

// ================= TicketOps =================
// ITR-lifecycle ticketing console, built step by step.
// Design rules:
//   1. Store facts (timestamps), compute everything else.
//   2. Never mutate state - always replace with a modified copy.
//   3. Rules live in lookup tables, not scattered if-statements.

// ---- Rules as data ----
const SLA_MINUTES = { P1: 60, P2: 240, P3: 1440, P4: 4320 };
const PRIORITY_COLORS = { P1: "#C93A32", P2: "#D98E04", P3: "#3272B8", P4: "#5E7285" };
const PRIORITY_SOFT = { P1: "#FBEAE8", P2: "#FCF3E0", P3: "#E8F0F9", P4: "#EDF1F5" };
const CATEGORIES = ["Compute", "Storage", "Network", "Database", "Billing & Quota", "Access & IAM"];

const PRIORITY_MATRIX = {
  "High|High": "P1", "High|Medium": "P2", "High|Low": "P3",
  "Medium|High": "P2", "Medium|Medium": "P3", "Medium|Low": "P3",
  "Low|High": "P3", "Low|Medium": "P3", "Low|Low": "P4",
};
const computePriority = (impact, urgency) => PRIORITY_MATRIX[`${impact}|${urgency}`];

const NEXT_STATUSES = {
  "New": ["In Progress", "Escalated"],
  "In Progress": ["Escalated", "Resolved"],
  "Escalated": ["In Progress", "Resolved"],
  "Resolved": ["Closed", "In Progress"],
  "Closed": [],
};

const STATUS_COLORS = {
  "New": "#5E7285", "In Progress": "#0E7C7B", "Escalated": "#C93A32",
  "Resolved": "#2E7D4F", "Closed": "#8FA3B8",
};

const BUTTON_LABELS = {
  "In Progress": "Start work", "Escalated": "Escalate",
  "Resolved": "Mark resolved", "Closed": "Close ticket",
};

const STATUS_FILTERS = ["Open", "All", "New", "In Progress", "Escalated", "Resolved", "Closed"];

const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

// ---- SLA math: pure functions of stored facts ----
const isOpen = (t) => t.status !== "Resolved" && t.status !== "Closed";
const isFinished = (t) => !!t.resolvedAt;
const slaDeadline = (t) => t.createdAt + SLA_MINUTES[t.priority] * 60 * 1000;
const slaMet = (t) => t.resolvedAt <= slaDeadline(t);

function formatCountdown(msLeft) {
  const negative = msLeft < 0;
  const abs = Math.abs(msLeft);
  const pad = (n) => String(n).padStart(2, "0");
  return `${negative ? "-" : ""}${pad(Math.floor(abs / 3600000))}:${pad(Math.floor((abs % 3600000) / 60000))}:${pad(Math.floor((abs % 60000) / 1000))}`;
}

function formatDuration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// ---- Components ----
function SlaBadge({ ticket, now }) {
  const mono = { fontFamily: MONO, fontSize: 13, fontWeight: 700 };
  if (!isOpen(ticket)) {
    const met = ticket.resolvedAt && slaMet(ticket);
    return (
      <span style={{ ...mono, color: met ? "#2E7D4F" : "#C93A32" }}>
        {met ? "SLA MET" : "SLA MISSED"}
        {ticket.resolvedAt && ` · ${formatDuration(ticket.resolvedAt - ticket.createdAt)}`}
      </span>
    );
  }
  const msLeft = slaDeadline(ticket) - now;
  const breached = msLeft < 0;
  const warning = !breached && msLeft < 30 * 60 * 1000;
  return (
    <span style={{
      ...mono,
      color: breached ? "white" : warning ? "#C93A32" : "#13202F",
      background: breached ? "#C93A32" : "transparent",
      padding: breached ? "2px 8px" : 0, borderRadius: 4,
    }}>
      {breached ? `BREACHED ${formatCountdown(msLeft)}` : `SLA ${formatCountdown(msLeft)}`}
    </span>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "white", border: "1px solid #D7DEE6", borderTop: `3px solid ${accent}`,
      borderRadius: 8, padding: "12px 14px", flex: "1 1 140px", minWidth: 140,
    }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#5E7285", fontWeight: 700 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: "#13202F", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#5E7285", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Chip({ text, color, soft }) {
  return (
    <span style={{
      background: soft, color, border: `1px solid ${color}33`,
      fontFamily: MONO, fontSize: 11, fontWeight: 700,
      padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap",
    }}>
      {text}
    </span>
  );
}

// ---- Seed data: a realistic queue on first load ----
const SEED = [
  {
    id: "TKT-1001",
    title: "Server randomly disconnects a few times a day",
    requester: "Jaehyun Jeong", category: "Compute",
    impact: "High", urgency: "High", priority: "P1",
    status: "New", createdAt: Date.now() - 12 * 60 * 1000,
    recentChange: "OS patch applied 22:00 last night", resolutionNotes: "",
  },
  {
    id: "TKT-1000",
    title: "Payment API returning 502 during peak hours",
    requester: "Mei Ling Tan", category: "Network",
    impact: "High", urgency: "High", priority: "P1",
    status: "Escalated", createdAt: Date.now() - 95 * 60 * 1000,
    escalatedAt: Date.now() - 40 * 60 * 1000,
    recentChange: "Load balancer config tuned yesterday", resolutionNotes: "",
  },
  {
    id: "TKT-1002",
    title: "Request: increase vCPU quota for launch",
    requester: "Sarah Lim", category: "Billing & Quota",
    impact: "Low", urgency: "Low", priority: "P4",
    status: "New", createdAt: Date.now() - 60 * 60 * 1000,
    recentChange: "None", resolutionNotes: "",
  },
  {
    id: "TKT-0999",
    title: "Cannot attach data disk to existing VM",
    requester: "Hafiz Osman", category: "Storage",
    impact: "Medium", urgency: "Medium", priority: "P3",
    status: "Closed",
    createdAt: Date.now() - 30 * 60 * 60 * 1000,
    resolvedAt: Date.now() - 26 * 60 * 60 * 1000,
    recentChange: "None",
    resolutionNotes: "Disk was in a different availability zone. Created disk in the correct zone and attached successfully.",
  },
];

export default function TicketOps() {
  const [tickets, setTickets] = useState(SEED);

  // One heartbeat drives every countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [nextNum, setNextNum] = useState(1003);
  const [form, setForm] = useState({
    title: "", requester: "", category: "Compute",
    impact: "Medium", urgency: "Medium", recentChange: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [resolving, setResolving] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [search, setSearch] = useState("");

  const previewPriority = computePriority(form.impact, form.urgency);

  // ---- Metrics: computed from all tickets, never stored ----
  const openTickets = tickets.filter(isOpen);
  const breachedTickets = openTickets.filter(t => now > slaDeadline(t));
  const finishedTickets = tickets.filter(isFinished);
  const metTickets = finishedTickets.filter(slaMet);
  const compliance = finishedTickets.length ? Math.round((metTickets.length / finishedTickets.length) * 100) : 100;
  const mttr = finishedTickets.length
    ? finishedTickets.reduce((sum, t) => sum + (t.resolvedAt - t.createdAt), 0) / finishedTickets.length
    : 0;
  const openByPriority = {};
  Object.keys(SLA_MINUTES).forEach(p => {
    openByPriority[p] = openTickets.filter(t => t.priority === p).length;
  });

  function createTicket() {
    if (!form.title.trim() || !form.requester.trim()) return;
    const newTicket = {
      id: `TKT-${nextNum}`, ...form,
      priority: previewPriority, status: "New", createdAt: Date.now(),
      recentChange: form.recentChange || "None", resolutionNotes: "",
    };
    setTickets([newTicket, ...tickets]);
    setNextNum(nextNum + 1);
    setForm({ title: "", requester: "", category: "Compute", impact: "Medium", urgency: "Medium", recentChange: "" });
    setShowForm(false);
  }

  function transition(id, newStatus, notes) {
    setTickets(tickets.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, status: newStatus };
      if (newStatus === "Escalated" && !t.escalatedAt) updated.escalatedAt = Date.now();
      if (newStatus === "Resolved") {
        updated.resolvedAt = Date.now();
        updated.resolutionNotes = notes || t.resolutionNotes;
      }
      if (newStatus === "In Progress" && t.status === "Resolved") updated.resolvedAt = null;
      return updated;
    }));
  }

  function handleActionClick(t, status) {
    if (status === "Resolved") {
      setResolving(t.id);
      setNotesDraft(t.resolutionNotes || "");
    } else {
      transition(t.id, status);
    }
  }

  function confirmResolve(id) {
    transition(id, "Resolved", notesDraft);
    setResolving(null);
    setNotesDraft("");
  }

  // ---- Filter pipeline: status -> priority -> search -> sort ----
  const queue = tickets
    .filter(t => {
      if (statusFilter === "Open") return isOpen(t);
      if (statusFilter === "All") return true;
      return t.status === statusFilter;
    })
    .filter(t => priorityFilter === "All" || t.priority === priorityFilter)
    .filter(t => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${t.id} ${t.title} ${t.requester} ${t.category} ${t.recentChange}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
      return slaDeadline(a) - slaDeadline(b);
    });

  const input = { width: "100%", padding: 9, border: "1px solid #D7DEE6", borderRadius: 6, marginBottom: 10, boxSizing: "border-box", fontSize: 14, background: "#FAFCFE" };
  const label = { fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#5E7285", display: "block", marginBottom: 4 };
  const actionBtn = (status) => ({
    background: status === "Escalated" ? "#C93A32" : status === "Resolved" ? "#2E7D4F" : status === "Closed" ? "#5E7285" : "#0E7C7B",
    color: "white", border: "none", borderRadius: 6, padding: "7px 14px",
    fontSize: 13, fontWeight: 700, cursor: "pointer", marginRight: 8, marginTop: 8,
  });

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#EEF2F6", minHeight: "100vh" }}>

      {/* ------- HEADER: ops-console bar ------- */}
      <div style={{ background: "#13202F", padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: "white" }}>
            Ticket<span style={{ color: "#5FC2C1" }}>Ops</span>
          </div>
          <div style={{ fontSize: 12, color: "#8FA3B8" }}>Cloud support · ITR lifecycle console</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: "#8FA3B8" }}>
            {new Date(now).toLocaleTimeString("en-GB")}
          </span>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: "#0E7C7B", color: "white", border: "none", borderRadius: 6, padding: "9px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {showForm ? "Hide form" : "+ New ticket"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 16px 60px" }}>

        {/* ------- METRICS ------- */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <Stat label="Open tickets" value={openTickets.length} accent="#0E7C7B" sub="currently in the queue" />
          <Stat label="SLA breached" value={breachedTickets.length}
            accent={breachedTickets.length ? "#C93A32" : "#2E7D4F"}
            sub={breachedTickets.length ? "needs action now" : "queue healthy"} />
          <Stat label="SLA compliance" value={`${compliance}%`}
            accent={compliance >= 90 ? "#2E7D4F" : "#D98E04"}
            sub={`${metTickets.length}/${finishedTickets.length} resolved in time`} />
          <Stat label="MTTR" value={mttr ? formatDuration(mttr) : "—"} accent="#3272B8" sub="mean time to resolve" />
        </div>

        {/* ------- PRIORITY STRIP (click to filter) ------- */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {Object.keys(SLA_MINUTES).map(p => (
            <button key={p}
              onClick={() => setPriorityFilter(priorityFilter === p ? "All" : p)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: priorityFilter === p ? PRIORITY_SOFT[p] : "white",
                border: `1px solid ${priorityFilter === p ? PRIORITY_COLORS[p] : "#D7DEE6"}`,
                borderRadius: 6, padding: "6px 12px", cursor: "pointer",
              }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: PRIORITY_COLORS[p] }} />
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "#13202F" }}>{p}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#5E7285" }}>{openByPriority[p]} open</span>
            </button>
          ))}
        </div>

        {/* ------- NEW TICKET FORM (collapsible) ------- */}
        {showForm && (
          <div style={{ background: "white", borderRadius: 8, padding: 16, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 560 }}>
            <h3 style={{ marginTop: 0, color: "#13202F" }}>New ticket · TKT-{nextNum}</h3>

            <label style={label}>Title (what the customer reported)</label>
            <input style={input} value={form.title} placeholder="e.g. Server randomly disconnects a few times a day"
              onChange={e => setForm({ ...form, title: e.target.value })} />

            <label style={label}>Requester</label>
            <input style={input} value={form.requester} placeholder="Customer name"
              onChange={e => setForm({ ...form, requester: e.target.value })} />

            <label style={label}>Category</label>
            <select style={input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Impact (how wide?)</label>
                <select style={input} value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Urgency (how fast?)</label>
                <select style={input} value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
            </div>

            <label style={label}>Recent change (if any)</label>
            <input style={input} value={form.recentChange} placeholder="e.g. OS patch last night"
              onChange={e => setForm({ ...form, recentChange: e.target.value })} />

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#5E7285" }}>System-assigned priority:</span>
              <span style={{ background: PRIORITY_COLORS[previewPriority], color: "white", padding: "4px 12px", borderRadius: 6, fontWeight: 700, fontSize: 14 }}>
                {previewPriority} · SLA {SLA_MINUTES[previewPriority] / 60}h
              </span>
            </div>

            <button onClick={createTicket}
              disabled={!form.title.trim() || !form.requester.trim()}
              style={{ background: "#0E7C7B", color: "white", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: !form.title.trim() || !form.requester.trim() ? 0.5 : 1 }}>
              Create ticket
            </button>
          </div>
        )}

        {/* ------- FILTER BAR ------- */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              style={{
                background: statusFilter === f ? "#13202F" : "transparent",
                color: statusFilter === f ? "white" : "#5E7285",
                border: `1px solid ${statusFilter === f ? "#13202F" : "#D7DEE6"}`,
                borderRadius: 999, padding: "5px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}>
              {f}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search ID, title, requester, category, change..."
          style={{ ...input, maxWidth: 380 }} />

        {/* ------- QUEUE ------- */}
        <p style={{ color: "#5E7285", fontSize: 13 }}>
          Showing {queue.length} of {tickets.length} ticket(s) · sorted by nearest deadline
        </p>

        {queue.length === 0 && (
          <div style={{ background: "white", border: "1px dashed #D7DEE6", borderRadius: 8, padding: 28, textAlign: "center", color: "#5E7285" }}>
            No tickets match this view. Try clearing the filters or search.
          </div>
        )}

        {queue.map(t => (
          <div key={t.id} style={{
            background: "white", borderLeft: `5px solid ${PRIORITY_COLORS[t.priority]}`,
            borderRadius: 8, padding: 14, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            opacity: t.status === "Closed" ? 0.65 : 1,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "#5E7285" }}>{t.id}</span>
                <Chip text={t.priority} color={PRIORITY_COLORS[t.priority]} soft={PRIORITY_SOFT[t.priority]} />
                <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLORS[t.status] }}>{t.status}</span>
              </div>
              <SlaBadge ticket={t} now={now} />
            </div>

            <div style={{ margin: "6px 0", color: "#13202F", fontWeight: 600 }}>{t.title}</div>
            <small style={{ color: "#5E7285" }}>
              Requester: {t.requester} · Category: {t.category} · Impact: {t.impact} · Urgency: {t.urgency} ·
              SLA: {SLA_MINUTES[t.priority] / 60}h · age {formatDuration(now - t.createdAt)} · Change: {t.recentChange}
            </small>

            {t.resolutionNotes && (
              <div style={{ marginTop: 10, padding: 10, background: "#E6F3EB", borderRadius: 6, fontSize: 13, color: "#13202F" }}>
                <b>Resolution:</b> {t.resolutionNotes}
              </div>
            )}

            {resolving === t.id ? (
              <div style={{ marginTop: 12, padding: 12, background: "#FAFCFE", border: "1px solid #D7DEE6", borderRadius: 6 }}>
                <label style={label}>What did you find and do? (resolution notes)</label>
                <textarea style={{ ...input, minHeight: 70 }} value={notesDraft}
                  placeholder="Root cause, fix applied, verification done"
                  onChange={e => setNotesDraft(e.target.value)} />
                <button style={{ ...actionBtn("Resolved"), opacity: notesDraft.trim() ? 1 : 0.5 }}
                  onClick={() => confirmResolve(t.id)} disabled={!notesDraft.trim()}>
                  Confirm resolve
                </button>
                <button style={{ ...actionBtn("cancel"), background: "transparent", color: "#5E7285", border: "1px solid #D7DEE6" }}
                  onClick={() => setResolving(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                {NEXT_STATUSES[t.status].map(s => (
                  <button key={s} style={actionBtn(s)} onClick={() => handleActionClick(t, s)}>
                    {t.status === "Resolved" && s === "In Progress" ? "Reopen" : BUTTON_LABELS[s]}
                  </button>
                ))}
                {NEXT_STATUSES[t.status].length === 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#8FA3B8" }}>Lifecycle complete.</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
