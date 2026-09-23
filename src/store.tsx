import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { interpretCommand, leadRefs } from "./nlu";
import { REP, seedData } from "./seed";
import { isoInKolkata, kolkataParts } from "./time";
import type { Activity, AgentInterpretation, AppData, Stage, TaskItem, Visit } from "./types";

const KEY = "lsq-field-crm-v1";

export type TabId = "day" | "leads" | "capture" | "tasks" | "ask";

interface CaptureInput {
  leadId: string;
  intent: string;
  transcript: string;
  nextAction?: string;
  dueAt?: string;
  createTask: boolean;
  stage?: Stage;
}

interface StoreValue {
  data: AppData;
  tab: TabId;
  openLeadId?: string;
  toast?: string;
  agentResult?: AgentInterpretation;
  agentReply?: string;
  dial?: { name: string; phone: string };
  setTab: (tab: TabId) => void;
  openLead: (id?: string) => void;
  dismissToast: () => void;
  toggleOffline: () => void;
  checkInDay: () => void;
  checkOutDay: () => void;
  markEnroute: (visitId: string) => void;
  checkInVisit: (visitId: string) => void;
  completeVisit: (visitId: string) => void;
  saveCapture: (input: CaptureInput) => void;
  previewAgent: (command: string) => void;
  chooseAgentLead: (leadId: string) => void;
  confirmAgent: () => void;
  dismissAgent: () => void;
  placeCall: (leadId: string) => void;
  dismissDial: () => void;
  toggleTask: (taskId: string) => void;
  undo: () => void;
  resetDemo: () => void;
  nextVisit?: Visit;
  openTasks: TaskItem[];
  pendingSync: number;
}

const StoreContext = createContext<StoreValue | null>(null);

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedData();
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.leads?.length || !parsed.visits?.length) return seedData();
    return parsed;
  } catch {
    return seedData();
  }
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso(): string {
  const date = kolkataParts();
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const [hours, minutes] = time.split(":").map(Number);
  return isoInKolkata(date, hours, minutes);
}

function leadName(data: AppData, id: string): string {
  const lead = data.leads.find((item) => item.id === id);
  return lead ? `${lead.name} · ${lead.company}` : "Customer";
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);
  const [past, setPast] = useState<AppData[]>([]);
  const [tab, setTab] = useState<TabId>("day");
  const [openLeadId, setOpenLeadId] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [agentResult, setAgentResult] = useState<AgentInterpretation>();
  const [agentReply, setAgentReply] = useState<string>();
  const [dial, setDial] = useState<{ name: string; phone: string }>();

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [data]);

  const commit = (recipe: (current: AppData) => AppData, message: string) => {
    setPast((stack) => [data, ...stack].slice(0, 12));
    setData((current) => recipe(current));
    setToast(message);
  };

  const nextVisit = data.visits.find((visit) => visit.status !== "completed");
  const openTasks = [...data.tasks].filter((task) => !task.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const pendingSync =
    data.activities.filter((item) => !item.synced).length +
    data.tasks.filter((item) => !item.synced).length +
    data.audit.filter((item) => !item.synced).length;

  const value = useMemo<StoreValue>(() => {
    const synced = !data.offline;
    const stamp = (text: string): AppData["audit"][number] => ({
      id: uid("e"),
      at: nowIso(),
      text,
      synced,
    });

    const context = { nextLeadId: nextVisit?.leadId };

    const describeNext = (current: AppData): string => {
      const visit = current.visits.find((item) => item.status !== "completed");
      const task = current.tasks.filter((item) => !item.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
      const visitLine = visit
        ? `Next visit ${visit.time} · ${leadName(current, visit.leadId)} · ${visit.status.replace("-", " ")}`
        : "No visits left on today's beat.";
      const taskLine = task ? `Next task · ${task.title}` : "No open tasks.";
      return `${visitLine}\n${taskLine}`;
    };

    return {
      data,
      tab,
      openLeadId,
      toast,
      agentResult,
      agentReply,
      dial,
      nextVisit,
      openTasks,
      pendingSync,
      setTab: (next) => {
        setTab(next);
        setOpenLeadId(undefined);
      },
      openLead: (id) => setOpenLeadId(id),
      dismissToast: () => setToast(undefined),
      toggleOffline: () => {
        setData((current) => {
          if (current.offline) {
            return {
              ...current,
              offline: false,
              activities: current.activities.map((item) => ({ ...item, synced: true })),
              tasks: current.tasks.map((item) => ({ ...item, synced: true })),
              audit: current.audit.map((item) => ({ ...item, synced: true })),
            };
          }
          return { ...current, offline: true };
        });
        setToast(data.offline ? "Back online. Queued updates synced." : "Offline. Notes and tasks stay on this phone.");
      },
      checkInDay: () => {
        if (data.checkedInAt && !data.checkedOutAt) return;
        commit(
          (current) => ({
            ...current,
            checkedInAt: nowIso(),
            checkedOutAt: undefined,
            audit: [stamp(`${REP.name} checked in for the beat.`), ...current.audit],
          }),
          "You're checked in. Field Day is live.",
        );
      },
      checkOutDay: () => {
        if (!data.checkedInAt || data.checkedOutAt) return;
        commit(
          (current) => ({
            ...current,
            checkedOutAt: nowIso(),
            audit: [stamp(`${REP.name} checked out.`), ...current.audit],
          }),
          "Beat checked out.",
        );
      },
      markEnroute: (visitId) => {
        commit(
          (current) => ({
            ...current,
            visits: current.visits.map((visit) =>
              visit.id === visitId && visit.status === "upcoming" ? { ...visit, status: "enroute" } : visit,
            ),
          }),
          "Navigation started. The live card now shows you are on the way.",
        );
      },
      checkInVisit: (visitId) => {
        if (!data.checkedInAt || data.checkedOutAt) {
          setToast("Check in to your beat before checking in at a customer.");
          return;
        }
        const visit = data.visits.find((item) => item.id === visitId);
        if (!visit || visit.status === "completed") return;
        commit(
          (current) => ({
            ...current,
            visits: current.visits.map((item) => (item.id === visitId ? { ...item, status: "checked-in" } : item)),
            audit: [stamp(`Checked in at ${leadName(current, visit.leadId)}.`), ...current.audit],
          }),
          "Checked in on site.",
        );
      },
      completeVisit: (visitId) => {
        const visit = data.visits.find((item) => item.id === visitId);
        if (!visit) return;
        if (visit.status !== "checked-in") {
          setToast("Check in at the customer before completing the visit.");
          return;
        }
        commit(
          (current) => ({
            ...current,
            visits: current.visits.map((item) => (item.id === visitId ? { ...item, status: "completed" } : item)),
            activities: [
              activity(current, visit.leadId, "Visit completed", "Marked complete from Field Day.", "manual", synced),
              ...current.activities,
            ],
            audit: [stamp(`Completed visit with ${leadName(current, visit.leadId)}.`), ...current.audit],
          }),
          "Visit complete. Field Day moved to the next customer.",
        );
      },
      saveCapture: (input) => {
        commit(
          (current) => {
            const lead = current.leads.find((item) => item.id === input.leadId);
            const title = `Visit note · ${lead?.company ?? "Customer"}`;
            const detail = [input.intent, input.transcript].filter(Boolean).join("\n\n");
            let tasks = current.tasks;
            if (input.createTask && input.nextAction && input.dueAt) {
              const task: TaskItem = {
                id: uid("t"),
                leadId: input.leadId,
                title: input.nextAction,
                dueAt: input.dueAt,
                done: false,
                source: "voice",
                synced,
              };
              tasks = [task, ...tasks];
            }
            return {
              ...current,
              leads: input.stage
                ? current.leads.map((item) => (item.id === input.leadId ? { ...item, stage: input.stage! } : item))
                : current.leads,
              activities: [activity(current, input.leadId, title, detail, "voice", synced), ...current.activities],
              tasks,
              audit: [stamp(`Confirmed a voice draft for ${leadName(current, input.leadId)}.`), ...current.audit],
            };
          },
          data.offline ? "Draft saved on this phone. It will sync when you are online." : "Draft saved to the customer record.",
        );
      },
      previewAgent: (command) => {
        const result = interpretCommand(command, leadRefs(data.leads), context);
        setAgentResult(result);
        if (result.action.type === "next_task") {
          setAgentReply(describeNext(data));
        } else {
          setAgentReply(undefined);
        }
      },
      chooseAgentLead: (leadId) => {
        if (!agentResult || agentResult.action.type !== "clarify") return;
        const lead = data.leads.find((item) => item.id === leadId);
        if (!lead) return;
        const rewritten = `${agentResult.command} ${lead.name} ${lead.company}`;
        const result = interpretCommand(rewritten, leadRefs(data.leads), context);
        setAgentResult(result);
      },
      confirmAgent: () => {
        if (!agentResult?.needsConfirmation) return;
        const action = agentResult.action;
        if (action.type === "check_in" && (!data.checkedInAt || data.checkedOutAt)) {
          setToast("Check in to your beat before checking in at a customer.");
          return;
        }
        if (action.type === "complete") {
          const visit = data.visits.find((item) => item.leadId === action.leadId && item.status !== "completed");
          if (!visit || visit.status !== "checked-in") {
            setToast("Check in at the customer before completing the visit.");
            return;
          }
        }
        if (action.type === "call") {
          const lead = data.leads.find((item) => item.id === action.leadId);
          if (lead) setDial({ name: lead.name, phone: lead.phone });
        }
        commit((current) => applyAgent(current, action, synced), "Confirmed. The CRM record is updated.");
        setAgentResult(undefined);
        setAgentReply(undefined);
      },
      dismissAgent: () => {
        setAgentResult(undefined);
        setAgentReply(undefined);
      },
      placeCall: (leadId) => {
        const lead = data.leads.find((item) => item.id === leadId);
        if (!lead) return;
        setDial({ name: lead.name, phone: lead.phone });
        commit(
          (current) => ({
            ...current,
            activities: [
              activity(current, leadId, "Call attempted", `Dialed ${lead.phone}.`, "manual", synced),
              ...current.activities,
            ],
            audit: [stamp(`Call attempted · ${leadName(current, leadId)}.`), ...current.audit],
          }),
          `Calling ${lead.name}. The attempt is on the record.`,
        );
      },
      dismissDial: () => setDial(undefined),
      toggleTask: (taskId) => {
        commit(
          (current) => ({
            ...current,
            tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done, synced } : task)),
          }),
          "Task updated.",
        );
      },
      undo: () => {
        setPast((stack) => {
          const [previous, ...rest] = stack;
          if (!previous) return stack;
          setData(previous);
          return rest;
        });
        setToast("Undone.");
      },
      resetDemo: () => {
        setData(seedData());
        setPast([]);
        setAgentResult(undefined);
        setAgentReply(undefined);
        setOpenLeadId(undefined);
        setTab("day");
        setToast("Demo day reset.");
      },
    };

    function activity(
      _current: AppData,
      leadId: string,
      title: string,
      detail: string,
      source: Activity["source"],
      isSynced: boolean,
    ): Activity {
      return { id: uid("a"), leadId, title, detail, at: nowIso(), source, synced: isSynced };
    }

    function applyAgent(current: AppData, action: AgentInterpretation["action"], isSynced: boolean): AppData {
      if (action.type === "log_visit") {
        const visit = current.visits.find((item) => item.leadId === action.leadId && item.status !== "completed");
        return {
          ...current,
          visits: current.visits.map((item) =>
            visit && item.id === visit.id ? { ...item, status: "completed" } : item,
          ),
          activities: [
            activity(current, action.leadId, "Visit logged", "Logged from the on-device assistant.", "agent", isSynced),
            ...current.activities,
          ],
          audit: [stamp(`Assistant logged a visit with ${leadName(current, action.leadId)}.`), ...current.audit],
        };
      }
      if (action.type === "create_followup") {
        const task: TaskItem = {
          id: uid("t"),
          leadId: action.leadId,
          title: action.title,
          dueAt: action.dueAt,
          done: false,
          source: "agent",
          synced: isSynced,
        };
        return {
          ...current,
          tasks: [task, ...current.tasks],
          audit: [stamp(`Assistant created “${action.title}”.`), ...current.audit],
        };
      }
      if (action.type === "update_stage") {
        return {
          ...current,
          leads: current.leads.map((lead) => (lead.id === action.leadId ? { ...lead, stage: action.stage } : lead)),
          activities: [
            activity(current, action.leadId, `Stage · ${action.stage}`, "Stage updated from the assistant.", "agent", isSynced),
            ...current.activities,
          ],
          audit: [stamp(`Stage for ${leadName(current, action.leadId)} set to ${action.stage}.`), ...current.audit],
        };
      }
      if (action.type === "check_in") {
        return {
          ...current,
          visits: current.visits.map((visit) =>
            visit.leadId === action.leadId && visit.status !== "completed" ? { ...visit, status: "checked-in" } : visit,
          ),
          audit: [stamp(`Assistant checked in at ${leadName(current, action.leadId)}.`), ...current.audit],
        };
      }
      if (action.type === "complete") {
        return {
          ...current,
          visits: current.visits.map((visit) =>
            visit.leadId === action.leadId && visit.status === "checked-in" ? { ...visit, status: "completed" } : visit,
          ),
          activities: [
            activity(current, action.leadId, "Visit completed", "Completed from the assistant.", "agent", isSynced),
            ...current.activities,
          ],
          audit: [stamp(`Assistant completed the visit with ${leadName(current, action.leadId)}.`), ...current.audit],
        };
      }
        if (action.type === "call") {
          const lead = current.leads.find((item) => item.id === action.leadId);
          return {
          ...current,
          activities: [
            activity(current, action.leadId, "Call attempted", `Dialed ${lead?.phone ?? "the customer"}.`, "agent", isSynced),
            ...current.activities,
          ],
          audit: [stamp(`Call attempted · ${leadName(current, action.leadId)}.`), ...current.audit],
        };
      }
      return current;
    }
  }, [agentResult, data, dial, nextVisit, openLeadId, openTasks, pendingSync, past, tab, toast, agentReply]);

  void past;

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Store missing");
  return value;
}
