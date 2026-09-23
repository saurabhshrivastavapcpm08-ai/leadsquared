import { useMemo, useState } from "react";
import { extractFieldNote, leadRefs } from "./nlu";
import { useStore } from "./store";
import { formatDue, fromDateTimeLocal, parseWhen, toDateTimeLocal } from "./time";
import type { FieldCapture, Stage } from "./types";

const SAMPLES = [
  "Met Rohan at Apex Motors. He wants the ₹12 lakh dealer finance line and asked us to send the sanction note. Follow up tomorrow morning about stamped documents.",
  "Neha at Mehta Distributors is interested in onboarding 20 DSAs. Not ready to sign. Call Friday afternoon.",
  "Dr Iyer was not in. Reception said to come back next Monday. No documents collected.",
];

interface SpeechEngine {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export function CapturePanel({ compact = false }: { compact?: boolean }) {
  const store = useStore();
  const [transcript, setTranscript] = useState(SAMPLES[0]);
  const [draft, setDraft] = useState<FieldCapture>();
  const [leadId, setLeadId] = useState("");
  const [intent, setIntent] = useState("");
  const [action, setAction] = useState("");
  const [due, setDue] = useState("");
  const [createTask, setCreateTask] = useState(true);
  const [applyStage, setApplyStage] = useState(false);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState("");
  const [modelReady, setModelReady] = useState(true);

  const leads = leadRefs(store.data.leads);

  const applyDraft = (next: FieldCapture) => {
    setDraft(next);
    setLeadId(next.leadId ?? "");
    setIntent(next.customerIntent);
    setAction(next.nextAction ?? "");
    setDue(next.dueAt ? toDateTimeLocal(next.dueAt) : "");
    setCreateTask(Boolean(next.nextAction));
    setApplyStage(false);
  };

  const extract = (text = transcript) => {
    if (!modelReady) return;
    applyDraft(extractFieldNote(text, leads));
  };

  const listen = () => {
    const ctor = (window as unknown as { SpeechRecognition?: new () => SpeechEngine; webkitSpeechRecognition?: new () => SpeechEngine })
      .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechEngine }).webkitSpeechRecognition;
    if (!ctor) {
      setMicNote("No speech engine on this device. Type the note or use a sample. Extraction still stays on device.");
      return;
    }
    const engine = new ctor();
    engine.lang = "en-IN";
    engine.interimResults = true;
    setListening(true);
    setMicNote("");
    engine.onresult = (event) => {
      let said = "";
      for (let index = 0; index < event.results.length; index += 1) said += event.results[index][0].transcript;
      setTranscript(said);
    };
    engine.onerror = () => setListening(false);
    engine.onend = () => setListening(false);
    engine.start();
  };

  const selected = store.data.leads.find((lead) => lead.id === leadId);
  const confidence = draft ? Math.round(draft.confidence * 100) : 0;
  const dueLabel = useMemo(() => (due ? formatDue(fromDateTimeLocal(due)) : "No time set"), [due]);

  return (
    <section className={`capture ${compact ? "compact" : ""}`}>
      <div className="section-head">
        <h2>Voice capture</h2>
        <span className={modelReady ? "model-ok" : "model-off"}>{modelReady ? "On device" : "No model"}</span>
      </div>
      <p className="lede">Speak the way you would after a meeting. The note becomes a draft activity and task. Nothing is saved until you confirm.</p>
      <label className="field">
        <span>What happened</span>
        <textarea
          data-testid="transcript"
          rows={compact ? 4 : 5}
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
        />
      </label>
      <div className="row-btns">
        <button type="button" className="primary" data-testid="extract" disabled={!modelReady || !transcript.trim()} onClick={() => extract()}>
          {listening ? "Listening…" : "Extract on device"}
        </button>
        <button type="button" onClick={listen} disabled={listening}>
          Speak
        </button>
      </div>
      {micNote && <p className="hint">{micNote}</p>}
      <div className="samples">
        {SAMPLES.map((sample, index) => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setTranscript(sample);
              if (modelReady) extract(sample);
            }}
          >
            Sample {index + 1}
          </button>
        ))}
      </div>
      {!modelReady && <p className="warning">This device has no on-device model. You can still save the raw note, without structured fields.</p>}
      {draft && modelReady && (
        <div className="draft" data-testid="draft">
          <div className="section-head">
            <h3>Draft</h3>
            <span>{confidence}% confidence</span>
          </div>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${confidence}%` }} />
          </div>
          {draft.warnings.map((warning) => (
            <p key={warning} className="warning">
              {warning}
            </p>
          ))}
          <label className="field">
            <span>Customer</span>
            <select data-testid="draft-lead" value={leadId} onChange={(event) => setLeadId(event.target.value)}>
              <option value="">Choose a customer</option>
              {store.data.leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} · {lead.company}
                </option>
              ))}
            </select>
          </label>
          {draft.ambiguous.length > 0 && (
            <div className="choices">
              {draft.ambiguous.map((option) => (
                <button key={option.id} type="button" onClick={() => setLeadId(option.id)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <label className="field">
            <span>Customer intent</span>
            <input value={intent} onChange={(event) => setIntent(event.target.value)} />
          </label>
          {draft.entities.length > 0 && (
            <div className="entities">
              {draft.entities.map((entity) => (
                <span key={`${entity.label}-${entity.value}`}>
                  {entity.label}: {entity.value}
                </span>
              ))}
            </div>
          )}
          <label className="field">
            <span>Next action</span>
            <input value={action} onChange={(event) => setAction(event.target.value)} />
          </label>
          <label className="field">
            <span>When · {dueLabel}</span>
            <input
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
          </label>
          <label className="check">
            <input data-testid="task-toggle" type="checkbox" checked={createTask} onChange={(event) => setCreateTask(event.target.checked)} />
            Create a task from the next action
          </label>
          {draft.stageSuggestion && (
            <label className="check">
              <input
                data-testid="stage-toggle"
                type="checkbox"
                checked={applyStage}
                onChange={(event) => setApplyStage(event.target.checked)}
              />
              Also move stage to {draft.stageSuggestion}
            </label>
          )}
          <button
            type="button"
            className="primary"
            data-testid="confirm-draft"
            disabled={!leadId || !intent.trim()}
            onClick={() => {
              const fallback = action ? parseWhen(action) : undefined;
              store.saveCapture({
                leadId,
                intent: intent.trim(),
                transcript,
                nextAction: action.trim() || undefined,
                dueAt: due ? fromDateTimeLocal(due) : fallback?.iso,
                createTask: createTask && Boolean(action.trim()),
                stage: applyStage ? (draft.stageSuggestion as Stage) : undefined,
              });
              setDraft(undefined);
              store.setTab("day");
            }}
          >
            Confirm draft {selected ? `· ${selected.company}` : ""}
          </button>
        </div>
      )}
      {!modelReady && (
        <button
          type="button"
          className="primary"
          disabled={!transcript.trim() || !store.nextVisit}
          onClick={() => {
            const lead = store.nextVisit?.leadId;
            if (!lead) return;
            store.saveCapture({ leadId: lead, intent: transcript.trim(), transcript, createTask: false });
          }}
        >
          Save unstructured note
        </button>
      )}
      <button type="button" className="text-btn" onClick={() => setModelReady((ready) => !ready)}>
        {modelReady ? "Simulate a phone without an on-device model" : "Restore on-device model"}
      </button>
      <p className="footnote">Processed locally in the app. Audio and the transcript are not uploaded. Confirm before a CRM record changes.</p>
    </section>
  );
}
