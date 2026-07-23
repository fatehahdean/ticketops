# TicketOps 🎫

A cloud-support ticketing console that models the full **ITR (Issue-to-Resolution) lifecycle** built with React, designed around how real ITSM systems (ServiceNow, Jira Service Management) actually work.

**Live demo:** _(add your GitHub Pages / CodeSandbox link here)_

## Why I built this

Support engineering runs on the ticket lifecycle: intake → triage → work → escalation → resolution → closure, all under SLA pressure. I built TicketOps to understand that lifecycle from the inside, not just as a user of a ticketing tool, but as the person who has to make its rules explicit in code.

## Features

- **ITIL-style priority derivation** — the form captures *Impact* (how wide?) and *Urgency* (how fast?), and the system computes P1–P4 from an Impact × Urgency matrix. Priority is system-assigned, the same model ServiceNow uses, so classification is consistent and defensible.
- **Live SLA countdown timers** — every open ticket ticks down in real time (P1: 1h, P2: 4h, P3: 24h, P4: 72h). Breached tickets flip to a red BREACHED badge automatically.
- **Lifecycle state machine** — tickets move New → In Progress → Escalated → Resolved → Closed through valid transitions only, driven by a lookup table (no illegal jumps). Resolved ≠ Closed: the engineer resolves, the customer confirms closure, and reopening is supported.
- **Resolution notes** — resolving requires documenting root cause, fix, and verification, separating the customer's reported symptom from the engineer's diagnosis.
- **Derived metrics dashboard** — open count, active SLA breaches, SLA compliance %, and MTTR. No metric is stored; everything is computed from timestamps, so metrics can never drift out of sync with the tickets.
- **Filter pipeline** — status tabs, clickable priority strip, and free-text search, chained as `filter → filter → filter → sort`, with the queue ordered by nearest SLA deadline (work-next-on-what-breaches-first).

## Design principles

1. **Store facts, compute everything else.** The ticket stores `createdAt` and `resolvedAt`; deadlines, countdowns, breach states, compliance % and MTTR are all derived. Stored values go stale; math on facts never does.
2. **Rules as data.** SLA targets, the priority matrix, valid lifecycle transitions and colors all live in lookup tables — readable, changeable, and testable in one place.
3. **Never mutate state.** Every update replaces an object/array with a modified copy, keeping React's rendering in sync with the data.

## Sample lifecycle walkthrough

1. Customer reports: *"Server randomly disconnects a few times a day"* → ticket created, Impact High × Urgency High → **P1, SLA clock locks at 1h**
2. Engineer starts work; root cause is beyond frontline scope → **Escalate** (deadline doesn't move — the customer's promise is the promise)
3. Backend team fixes it → **Resolve** with notes: root cause, mitigation, verification, follow-up
4. Customer confirms → **Close**. Resolution time feeds MTTR; on-time resolution feeds compliance %.

## Running locally

```bash
npm create vite@latest ticketops -- --template react
cd ticketops
# replace src/App.jsx with TicketOps.jsx from this repo
npm install
npm run dev
```

## What I'd add for production

- Persistence (database) instead of in-memory state
- Authentication and per-engineer assignment
- Auto-close after N days in Resolved
- Priority-change audit log with required justification
- Business-hours SLA calendars (clock pauses outside support hours)
- Ticket intake via API/webhook from monitoring alerts

## Stack

React (hooks: `useState`, `useEffect`) · no external dependencies · zero-cost hosting
