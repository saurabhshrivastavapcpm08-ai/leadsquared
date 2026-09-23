import { useState } from "react";
import { useStore } from "./store";
import { formatDue, formatStamp } from "./time";
import { StageChip } from "./ui";

export function Leads() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const open = store.data.leads.find((lead) => lead.id === store.openLeadId);
  const filtered = store.data.leads.filter((lead) => {
    const hay = `${lead.name} ${lead.company} ${lead.area}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  if (open) {
    const activities = store.data.activities.filter((item) => item.leadId === open.id);
    const tasks = store.data.tasks.filter((item) => item.leadId === open.id);
    return (
      <section className="record">
        <button type="button" className="text-btn" onClick={() => store.openLead(undefined)}>
          All leads
        </button>
        <h2>{open.name}</h2>
        <p className="company">{open.role} · {open.company}</p>
        <div className="meta-row">
          <StageChip stage={open.stage} />
          <span data-testid="lead-stage">{open.stage}</span>
        </div>
        <p className="address">{open.address}</p>
        <p className="quiet">{open.product} · {open.valueLabel}</p>
        <div className="row-btns">
          <button type="button" onClick={() => store.placeCall(open.id)}>Call</button>
          <button type="button" className="primary" onClick={() => store.setTab("capture")}>Capture note</button>
        </div>
        <h3>Activity</h3>
        <ul className="feed">
          {activities.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <em>
                {formatStamp(item.at)} · {item.source}
                {item.synced ? "" : " · waiting to sync"}
              </em>
            </li>
          ))}
          {activities.length === 0 && <li>No activity yet.</li>}
        </ul>
        <h3>Tasks</h3>
        <ul className="feed">
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.done ? "Done · " : ""}{task.title}</strong>
              <em>{formatDue(task.dueAt)}</em>
            </li>
          ))}
          {tasks.length === 0 && <li>No tasks.</li>}
        </ul>
      </section>
    );
  }

  return (
    <section className="record">
      <div className="section-head">
        <h2>Leads</h2>
        <span>{filtered.length}</span>
      </div>
      <label className="field">
        <span>Search</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, company, area" />
      </label>
      <ul className="lead-list">
        {filtered.map((lead) => (
          <li key={lead.id}>
            <button type="button" onClick={() => store.openLead(lead.id)}>
              <strong>{lead.name}</strong>
              <em>
                {lead.company} · {lead.area}
              </em>
              <StageChip stage={lead.stage} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Tasks() {
  const store = useStore();
  const leads = Object.fromEntries(store.data.leads.map((lead) => [lead.id, lead]));
  return (
    <section className="record">
      <div className="section-head">
        <h2>Tasks</h2>
        <span>{store.openTasks.length} open</span>
      </div>
      <ul className="task-list" data-testid="task-list">
        {store.data.tasks
          .slice()
          .sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt.localeCompare(b.dueAt))
          .map((task) => (
            <li key={task.id} className={task.done ? "done" : ""}>
              <label>
                <input type="checkbox" checked={task.done} onChange={() => store.toggleTask(task.id)} />
                <span>
                  <strong>{task.title}</strong>
                  <em>
                    {leads[task.leadId]?.company} · {formatDue(task.dueAt)} · {task.source}
                    {task.synced ? "" : " · on device"}
                  </em>
                </span>
              </label>
            </li>
          ))}
      </ul>
      {store.pendingSync > 0 && <p className="hint">{store.pendingSync} updates waiting to sync.</p>}
      {store.data.audit.length > 0 && (
        <>
          <h3>Confirmation log</h3>
          <ul className="feed">
            {store.data.audit.slice(0, 6).map((event) => (
              <li key={event.id}>
                <p>{event.text}</p>
                <em>{formatStamp(event.at)}</em>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
