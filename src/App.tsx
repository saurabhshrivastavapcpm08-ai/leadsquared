import { useEffect, useState } from "react";
import { AgentPanel } from "./AgentPanel";
import { CapturePanel } from "./CapturePanel";
import { FieldDay, LiveCard } from "./FieldDay";
import { Leads, Tasks } from "./Records";
import { REP } from "./seed";
import { useStore, type TabId } from "./store";
import { Icon, Logo } from "./ui";

type Surface = "phone" | "lock" | "adaptive";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "day", label: "Field", icon: "home" },
  { id: "leads", label: "Leads", icon: "leads" },
  { id: "capture", label: "Capture", icon: "mic" },
  { id: "tasks", label: "Tasks", icon: "tasks" },
  { id: "ask", label: "Ask", icon: "spark" },
];

export function App() {
  const [surface, setSurface] = useState<Surface>("phone");
  return (
    <div className={`stage surface-${surface}`}>
      <div className="switcher" role="tablist" aria-label="Preview">
        <button type="button" role="tab" aria-selected={surface === "phone"} data-testid="surface-phone" onClick={() => setSurface("phone")}>
          Phone
        </button>
        <button type="button" role="tab" aria-selected={surface === "lock"} data-testid="surface-lock" onClick={() => setSurface("lock")}>
          Lock Screen
        </button>
        <button type="button" role="tab" aria-selected={surface === "adaptive"} data-testid="surface-adaptive" onClick={() => setSurface("adaptive")}>
          Large screen
        </button>
      </div>
      {surface === "phone" && <Phone />}
      {surface === "lock" && (
        <div className="device lock-device">
          <LockScreen />
        </div>
      )}
      {surface === "adaptive" && <Adaptive />}
      <Overlays />
    </div>
  );
}

function Phone() {
  const store = useStore();
  return (
    <div className="device">
      <header className="app-bar">
        <Logo />
        <div className="bar-actions">
          <button type="button" className={store.data.offline ? "offline-on" : ""} data-testid="offline-toggle" onClick={store.toggleOffline}>
            {store.data.offline ? "Offline" : "Online"}
            {store.pendingSync > 0 ? ` · ${store.pendingSync}` : ""}
          </button>
        </div>
      </header>
      <p className="rep-line">
        {REP.name} · {REP.role} · {REP.tenant}
      </p>
      <main>
        {store.tab === "day" && <FieldDay />}
        {store.tab === "leads" && <Leads />}
        {store.tab === "capture" && <CapturePanel />}
        {store.tab === "tasks" && <Tasks />}
        {store.tab === "ask" && <AgentPanel />}
      </main>
      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`tab-${tab.id}`}
            className={store.tab === tab.id ? "active" : ""}
            onClick={() => store.setTab(tab.id)}
          >
            <Icon name={tab.icon} />
            {tab.label}
          </button>
        ))}
      </nav>
      <Toast />
    </div>
  );
}

function LockScreen() {
  return (
    <div className="lock">
      <p className="lock-time">11:32</p>
      <p className="lock-date">Wednesday, 23 September</p>
      <LiveCard />
      <p className="footnote light">Live Activity · updates from today’s beat without opening the CRM.</p>
      <Toast />
    </div>
  );
}

function Adaptive() {
  const store = useStore();
  return (
    <div className="workspace">
      <header className="app-bar">
        <Logo />
        <div>
          <strong>Field workspace</strong>
          <p className="rep-line">
            {REP.name} · {REP.territory} · {REP.tenant}
          </p>
        </div>
        <button type="button" className={store.data.offline ? "offline-on" : ""} onClick={store.toggleOffline}>
          {store.data.offline ? "Offline" : "Online"}
        </button>
      </header>
      <div className="workspace-grid">
        <FieldDay part="route" />
        <FieldDay part="hero" />
        <div className="workspace-side">
          <CapturePanel compact />
          <AgentPanel compact />
        </div>
      </div>
      <Toast />
    </div>
  );
}

function Toast() {
  const store = useStore();
  useEffect(() => {
    if (!store.toast) return;
    const timer = window.setTimeout(store.dismissToast, 4200);
    return () => window.clearTimeout(timer);
  }, [store.toast, store.dismissToast]);
  if (!store.toast) return null;
  return (
    <div className="toast" role="status">
      <span>{store.toast}</span>
      <button type="button" onClick={store.undo}>
        Undo
      </button>
      <button type="button" onClick={store.dismissToast} aria-label="Dismiss">
        <Icon name="close" />
      </button>
    </div>
  );
}

function Overlays() {
  const store = useStore();
  return (
    <>
      {store.dial && (
        <div className="sheet-backdrop" role="presentation" onClick={store.dismissDial}>
          <div className="sheet" role="dialog" aria-label="Call" onClick={(event) => event.stopPropagation()}>
            <p className="eyebrow">Call</p>
            <h3>{store.dial.name}</h3>
            <p>{store.dial.phone}</p>
            <a className="primary dial" href={`tel:${store.dial.phone.replace(/\s/g, "")}`}>
              Open dialer
            </a>
            <button type="button" onClick={store.dismissDial}>
              Close
            </button>
          </div>
        </div>
      )}
      <button type="button" className="reset" data-testid="reset-demo" onClick={store.resetDemo}>
        Reset day
      </button>
    </>
  );
}
