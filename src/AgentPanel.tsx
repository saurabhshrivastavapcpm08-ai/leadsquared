import { useState } from "react";
import { useStore } from "./store";

const SUGGESTIONS = [
  "What's my next task",
  "Log my visit with Apex Motors",
  "Log my visit with Apex",
  "Create a follow-up for tomorrow",
  "Update Rohan Desai to Negotiation",
  "Check in at Apex Motors",
];

export function AgentPanel({ compact = false }: { compact?: boolean }) {
  const store = useStore();
  const [command, setCommand] = useState("Create a follow-up for tomorrow");
  const result = store.agentResult;

  return (
    <section className={`agent ${compact ? "compact" : ""}`}>
      <div className="section-head">
        <h2>Ask LeadSquared</h2>
        <span>Permissioned</span>
      </div>
      <p className="lede">The same actions a rep can take in the app, callable from Siri, Spotlight or an Android agent. Writes wait for confirmation.</p>
      <label className="field">
        <span>Command</span>
        <input
          data-testid="agent-input"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") store.previewAgent(command);
          }}
        />
      </label>
      <button type="button" className="primary" data-testid="agent-run" onClick={() => store.previewAgent(command)}>
        Run
      </button>
      <div className="samples">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setCommand(suggestion);
              store.previewAgent(suggestion);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      {store.agentReply && <pre className="reply" data-testid="agent-reply">{store.agentReply}</pre>}
      {result && result.action.type === "unknown" && <p className="warning">{result.action.message}</p>}
      {result && result.action.type === "clarify" && (
        <div className="draft">
          <h3>{result.action.question}</h3>
          <div className="choices">
            {result.action.options.map((option) => (
              <button key={option.id} type="button" data-testid="clarify-option" onClick={() => store.chooseAgentLead(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
          <p className="footnote">{result.riskNote}</p>
        </div>
      )}
      {result?.needsConfirmation && (
        <div className="sheet-backdrop" role="presentation">
          <div className="sheet" role="dialog" aria-label="Confirm action">
            <p className="eyebrow">Confirm before saving · {store.data.offline ? "offline queue" : "Northstar Finance"}</p>
            <h3>{result.summary}</h3>
            {result.riskNote && <p>{result.riskNote}</p>}
            <div className="row-btns">
              <button type="button" data-testid="cancel-agent" onClick={store.dismissAgent}>
                Cancel
              </button>
              <button type="button" className="primary" data-testid="confirm-agent" onClick={store.confirmAgent}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
