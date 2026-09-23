export type Stage =
  | "New"
  | "Qualified"
  | "Visit scheduled"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost";

export type VisitStatus = "upcoming" | "enroute" | "checked-in" | "completed";

export interface Lead {
  id: string;
  name: string;
  company: string;
  role: string;
  phone: string;
  area: string;
  address: string;
  stage: Stage;
  product: string;
  valueLabel: string;
}

export interface Visit {
  id: string;
  leadId: string;
  time: string;
  distanceKm: number;
  status: VisitStatus;
}

export interface Activity {
  id: string;
  leadId: string;
  title: string;
  detail: string;
  at: string;
  source: "voice" | "agent" | "manual";
  synced: boolean;
}

export interface TaskItem {
  id: string;
  leadId: string;
  title: string;
  dueAt: string;
  done: boolean;
  source: "voice" | "agent" | "manual";
  synced: boolean;
}

export interface AuditEvent {
  id: string;
  at: string;
  text: string;
  synced: boolean;
}

export interface AppData {
  offline: boolean;
  checkedInAt?: string;
  checkedOutAt?: string;
  leads: Lead[];
  visits: Visit[];
  activities: Activity[];
  tasks: TaskItem[];
  audit: AuditEvent[];
}

export interface Entity {
  label: string;
  value: string;
}

export interface FieldCapture {
  transcript: string;
  customerIntent: string;
  entities: Entity[];
  nextAction?: string;
  dueAt?: string;
  dueLabel?: string;
  leadId?: string;
  matchLabel?: string;
  ambiguous: { id: string; label: string }[];
  stageSuggestion?: Stage;
  confidence: number;
  warnings: string[];
  activityTitle: string;
  activityDetail: string;
}

export type AgentAction =
  | { type: "next_task" }
  | { type: "log_visit"; leadId: string }
  | { type: "create_followup"; leadId: string; dueAt: string; title: string }
  | { type: "update_stage"; leadId: string; stage: Stage }
  | { type: "check_in"; leadId: string }
  | { type: "complete"; leadId: string }
  | { type: "call"; leadId: string }
  | { type: "clarify"; question: string; options: { id: string; label: string }[] }
  | { type: "unknown"; message: string };

export interface AgentInterpretation {
  command: string;
  action: AgentAction;
  needsConfirmation: boolean;
  summary: string;
  riskNote?: string;
}
