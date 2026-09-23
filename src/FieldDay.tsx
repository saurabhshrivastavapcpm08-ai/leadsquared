import { useState } from "react";
import { REP } from "./seed";
import { useStore } from "./store";
import { formatDue, headerDate } from "./time";
import { Icon, Logo, StageChip, StatusChip } from "./ui";

export function FieldDay({ part = "all" }: { part?: "all" | "route" | "hero" }) {
  const store = useStore();
  const [directionsFor, setDirectionsFor] = useState<string>();
  const leads = Object.fromEntries(store.data.leads.map((lead) => [lead.id, lead]));
  const done = store.data.visits.filter((visit) => visit.status === "completed").length;
  const onBeat = Boolean(store.data.checkedInAt && !store.data.checkedOutAt);
  const next = store.nextVisit;
  const nextLead = next ? leads[next.leadId] : undefined;

  const route = (
    <section className="route">
      <div className="section-head">
        <h2>Today’s beat</h2>
        <span>
          {done}/{store.data.visits.length} done
        </span>
      </div>
      <ol className="timeline">
        {store.data.visits.map((visit) => {
          const lead = leads[visit.leadId];
          const current = next?.id === visit.id;
          return (
            <li key={visit.id} className={current ? "current" : visit.status}>
              <button type="button" onClick={() => store.openLead(lead.id)}>
                <span className="time">{visit.time}</span>
                <span>
                  <strong>{lead.company}</strong>
                  <em>
                    {lead.name} · {lead.area}
                  </em>
                </span>
                <StatusChip status={visit.status} />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );

  const hero = (
    <section className="hero-card" data-testid="next-customer">
      <div className="kicker">
        <span>Field Day</span>
        <span>{headerDate()}</span>
      </div>
      {!store.data.checkedInAt || store.data.checkedOutAt ? (
        <div className="start-block">
          <h2>{store.data.checkedOutAt ? "Beat checked out" : "Start the beat"}</h2>
          <p>
            {store.data.checkedOutAt
              ? "Live updates are paused until the next check-in."
              : `${REP.name} · ${store.data.visits.length} customers across ${REP.territory}. Check in to publish Field Day on the lock screen.`}
          </p>
          <button type="button" className="primary" data-testid="check-in-day" onClick={store.checkInDay}>
            {store.data.checkedOutAt ? "Check in again" : "Check in"}
          </button>
        </div>
      ) : next && nextLead ? (
        <>
          <div className="hero-top">
            <div>
              <p className="eyebrow">Up next · {next.time}</p>
              <h2>{nextLead.name}</h2>
              <p className="company">{nextLead.company}</p>
            </div>
            <div className="distance">
              <strong>{next.distanceKm.toFixed(1)}</strong>
              <span>km</span>
            </div>
          </div>
          <div className="meta-row">
            <StageChip stage={nextLead.stage} />
            <StatusChip status={next.status} />
            <span className="quiet">{nextLead.product}</span>
          </div>
          <p className="address">
            <Icon name="pin" />
            {nextLead.address}
          </p>
          <div className="action-grid">
            <button type="button" data-testid="visit-navigate" onClick={() => setDirectionsFor(next.id)}>
              <Icon name="nav" /> Navigate
            </button>
            <button type="button" data-testid="visit-call" onClick={() => store.placeCall(nextLead.id)}>
              <Icon name="phone" /> Call
            </button>
            <button
              type="button"
              data-testid="visit-check-in"
              disabled={next.status === "checked-in"}
              onClick={() => store.checkInVisit(next.id)}
            >
              Check in
            </button>
            <button type="button" className="primary" data-testid="visit-complete" onClick={() => store.completeVisit(next.id)}>
              Complete
            </button>
          </div>
        </>
      ) : (
        <div className="start-block">
          <h2>Beat clear</h2>
          <p>Every visit on today’s plan is done. Check out when you leave the field.</p>
        </div>
      )}
      {onBeat && (
        <button type="button" className="text-btn" data-testid="check-out-day" onClick={store.checkOutDay}>
          Check out of the beat
        </button>
      )}
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${(done / store.data.visits.length) * 100}%` }} />
      </div>
    </section>
  );

  return (
    <div className="day">
      {part !== "route" && hero}
      {part !== "hero" && route}
      {store.openTasks[0] && part !== "route" && (
        <button type="button" className="task-peek" onClick={() => store.setTab("tasks")}>
          <span>Next task</span>
          <strong>{store.openTasks[0].title}</strong>
          <em>{formatDue(store.openTasks[0].dueAt)}</em>
        </button>
      )}
      {directionsFor && (
        <div className="sheet-backdrop" role="presentation" onClick={() => setDirectionsFor(undefined)}>
          <div className="sheet" role="dialog" aria-label="Directions" onClick={(event) => event.stopPropagation()}>
            <h3>Directions · {nextLead?.area}</h3>
            <ol className="steps">
              <li>Head toward {nextLead?.area} on the inner ring.</li>
              <li>{nextLead?.address}</li>
              <li>Check in when you are on site. The live card stays on the lock screen.</li>
            </ol>
            <button
              type="button"
              className="primary"
              onClick={() => {
                store.markEnroute(directionsFor);
                setDirectionsFor(undefined);
              }}
            >
              Start navigation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LiveCard() {
  const store = useStore();
  const next = store.nextVisit;
  const lead = store.data.leads.find((item) => item.id === next?.leadId);
  const onBeat = Boolean(store.data.checkedInAt && !store.data.checkedOutAt);
  return (
    <article className="live-card" data-testid="live-card">
      <header>
        <Logo light={false} />
        <span className="live-pill">{onBeat ? "Live" : "Paused"}</span>
      </header>
      {!onBeat || !next || !lead ? (
        <>
          <p className="eyebrow">Field Day</p>
          <h2>{store.data.checkedOutAt ? "Checked out" : "Waiting for check-in"}</h2>
          <button type="button" className="primary" onClick={store.checkInDay}>
            Check in
          </button>
        </>
      ) : (
        <>
          <p className="eyebrow">{next.status === "checked-in" ? "On site" : next.status === "enroute" ? "On the way" : "Up next"}</p>
          <h2>{lead.name}</h2>
          <p className="company">
            {lead.company} · {next.time} · {next.distanceKm.toFixed(1)} km
          </p>
          <div className="action-grid">
            <button type="button" onClick={() => store.markEnroute(next.id)}>
              Navigate
            </button>
            <button type="button" onClick={() => store.placeCall(lead.id)}>
              Call
            </button>
            <button type="button" onClick={() => store.checkInVisit(next.id)} disabled={next.status === "checked-in"}>
              Check in
            </button>
            <button type="button" className="primary" onClick={() => store.completeVisit(next.id)}>
              Complete
            </button>
          </div>
        </>
      )}
    </article>
  );
}
