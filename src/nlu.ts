import type { AgentInterpretation, Entity, FieldCapture, Lead, Stage } from "./types";
import { parseWhen } from "./time";

export interface LeadRef {
  id: string;
  name: string;
  company: string;
}

const STAGES: Stage[] = ["New", "Qualified", "Visit scheduled", "Proposal", "Negotiation", "Won", "Lost"];

const PRODUCTS = [
  "dealer finance",
  "vehicle finance",
  "personal loan",
  "education loan",
  "home loan",
  "working capital",
  "medical equipment loan",
  "rate card",
  "sanction",
  "dsa",
];

export function clean(text: string): string {
  return text
    .toLowerCase()
    .replace(/₹/g, " rs ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rankLeads(text: string, leads: LeadRef[]): { lead: LeadRef; score: number }[] {
  const t = clean(text);
  return leads
    .map((lead) => {
      const name = clean(lead.name);
      const company = clean(lead.company);
      let score = 0;
      if (name && t.includes(name)) score += 6;
      if (company && t.includes(company)) score += 6;
      for (const part of name.split(" ")) {
        if (part.length > 2 && new RegExp(`\\b${part}\\b`).test(t)) score += 2;
      }
      for (const part of company.split(" ")) {
        if (part.length > 3 && new RegExp(`\\b${part}\\b`).test(t)) score += 2;
      }
      return { lead, score };
    })
    .filter((row) => row.score >= 2)
    .sort((a, b) => b.score - a.score || a.lead.name.localeCompare(b.lead.name));
}

export function pickLead(text: string, leads: LeadRef[]):
  | { kind: "none" }
  | { kind: "one"; lead: LeadRef }
  | { kind: "many"; options: LeadRef[] } {
  const ranked = rankLeads(text, leads);
  if (!ranked.length) return { kind: "none" };
  const [top, second] = ranked;
  if (second && second.score >= top.score - 1) {
    return { kind: "many", options: ranked.slice(0, 3).map((row) => row.lead) };
  }
  return { kind: "one", lead: top.lead };
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clipIntent(value: string): string {
  return value
    .replace(/\s+(and\s+)?(then\s+)?(asked|follow[- ]?up|call|remind|come back).*/i, "")
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function customerIntent(text: string): string {
  const unavailable = text.match(/\b(not in|wasn'?t in|unavailable|stepped out)\b/i);
  if (unavailable) return "Customer unavailable";
  const notInterested = text.match(/\bnot interested\b(?:\s+in\s+([^.]+))?/i);
  if (notInterested) {
    return notInterested[1] ? `Not interested in ${clipIntent(notInterested[1])}` : "Not interested";
  }
  const patterns: RegExp[] = [
    /\b(?:interested in|interest in)\s+([^.]+)/i,
    /\b(?:wants|want|looking for|asked (?:us )?(?:for|to|about)|needs|need)\s+([^.]+)/i,
    /\bready to\s+([^.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const phrase = clipIntent(match[1]);
      if (phrase.length > 2) {
        const verb = /\binterested/i.test(match[0]) ? "Interested in" : "Wants";
        return `${verb} ${phrase}`.replace(/^Wants (the|a|an)\b/i, "Wants $1");
      }
    }
  }
  const first = sentences(text)[0] ?? text;
  return clipIntent(first).slice(0, 140);
}

function stripTimeWords(value: string): string {
  return value
    .replace(
      /\b(today|tomorrow|day after tomorrow|next week|next\s+\w+day|this\s+\w+day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|in\s+\d+\s+days?|morning|afternoon|evening|eod|end of day|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function tidyAction(value: string): string {
  if (/come back/i.test(value)) return "Visit again";
  const about = value.match(/(?:about|regarding)\s+(.+)/i);
  if (/follow/i.test(value) && about) return `Follow up about ${about[1].replace(/[.]+$/, "")}`;
  let next = stripTimeWords(value).replace(/^[\s,.-]+/, "").replace(/[.]+$/, "");
  next = next.replace(/^(to|and)\s+/i, "");
  if (/^call$/i.test(next)) return "Call the customer";
  if (/^come back$/i.test(next)) return "Visit again";
  if (/^follow(?:\s*up)?$/i.test(next)) return "Follow up";
  if (!next) return "Follow up";
  return next.charAt(0).toUpperCase() + next.slice(1);
}

function nextActionFrom(text: string): string | undefined {
  const all = sentences(text);
  const hit =
    all.find((sentence) => /follow[- ]?up|call back|come back|\bremind\b/i.test(sentence)) ??
    all.find((sentence) => /\bcall\b|\bsend\b|\bcollect\b|\bshare\b|\bschedule\b/i.test(sentence));
  if (!hit) return undefined;
  const send = hit.match(/\bsend\s+(.+)/i);
  if (send && !/follow/i.test(hit)) return tidyAction(`Send ${send[1]}`);
  return tidyAction(hit);
}

function moneyEntities(text: string): Entity[] {
  const found: Entity[] = [];
  const pattern = /(?:₹|rs\.?\s*)?\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|crore|crores|cr|k|thousand)?/gi;
  for (const match of text.matchAll(pattern)) {
    const unit = match[2]?.toLowerCase();
    if (!unit && match[1].replace(".", "").length > 6) continue;
    if (!unit && !/[₹]|rs/i.test(match[0]) && Number(match[1]) < 100) continue;
    const unitLabel = unit === "lac" || unit === "lakhs" ? "lakh" : unit === "crores" || unit === "cr" ? "crore" : unit;
    found.push({ label: "Amount", value: unitLabel ? `₹${match[1]} ${unitLabel}` : `₹${match[1]}` });
  }
  const count = text.match(/\b(\d+)\s+(dsas?|dealers?|customers?)\b/i);
  if (count) found.push({ label: "Count", value: `${count[1]} ${count[2].toUpperCase() === "DSA" || /dsa/i.test(count[2]) ? "DSAs" : count[2]}` });
  return found;
}

function productEntities(text: string): Entity[] {
  const t = text.toLowerCase();
  return PRODUCTS.filter((product) => t.includes(product)).map((product) => ({
    label: "Product",
    value: product.replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

function stageSuggestion(text: string): Stage | undefined {
  const match = text.match(
    /\b(?:move|update|change|set)(?:\s+\w+){0,4}\s+to\s+(new|qualified|visit scheduled|proposal|negotiation|won|lost)\b/i,
  );
  if (!match) return undefined;
  const wanted = match[1].toLowerCase();
  return STAGES.find((stage) => stage.toLowerCase() === wanted);
}

function piiWarnings(text: string): string[] {
  const warnings: string[] = [];
  if (/\b[6-9]\d{9}\b/.test(text.replace(/\s+/g, "")) || /\b[6-9]\d{4}\s?\d{5}\b/.test(text)) {
    warnings.push("A phone number is in this note. It stays on this device until you confirm.");
  }
  if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(text) || /@/.test(text)) {
    warnings.push("This note may include personal data. Review it before it is written to the CRM.");
  }
  return warnings;
}

export function extractFieldNote(transcript: string, leads: LeadRef[], now = new Date()): FieldCapture {
  const text = transcript.trim();
  const picked = pickLead(text, leads);
  const when = parseWhen(text, now);
  const intent = customerIntent(text);
  const action = nextActionFrom(text);
  const entities: Entity[] = [...moneyEntities(text), ...productEntities(text)];
  const stage = stageSuggestion(text);
  const warnings = [...piiWarnings(text)];

  let leadId: string | undefined;
  let matchLabel: string | undefined;
  let ambiguous: { id: string; label: string }[] = [];
  if (picked.kind === "one") {
    leadId = picked.lead.id;
    matchLabel = `${picked.lead.name} · ${picked.lead.company}`;
    entities.unshift({ label: "Customer", value: picked.lead.name }, { label: "Company", value: picked.lead.company });
  } else if (picked.kind === "many") {
    ambiguous = picked.options.map((lead) => ({ id: lead.id, label: `${lead.name} · ${lead.company}` }));
    warnings.unshift("More than one customer matches. Choose who this note is about.");
  } else {
    warnings.unshift("No customer matched. Choose a record before saving.");
  }
  if (!action) warnings.push("No next action detected. You can add one before confirming.");
  if (intent.length < 12) warnings.push("Intent is thin. Check the draft so a guess is not saved as fact.");

  let confidence = 0.42;
  if (leadId) confidence += 0.24;
  if (entities.some((entity) => entity.label === "Amount" || entity.label === "Product")) confidence += 0.14;
  if (when) confidence += 0.1;
  if (action) confidence += 0.1;
  if (ambiguous.length) confidence -= 0.15;
  confidence = Math.max(0.28, Math.min(0.96, confidence));

  const company = picked.kind === "one" ? picked.lead.company : "Unassigned";
  return {
    transcript: text,
    customerIntent: intent,
    entities,
    nextAction: action,
    dueAt: when?.iso,
    dueLabel: when?.label,
    leadId,
    matchLabel,
    ambiguous,
    stageSuggestion: stage,
    confidence,
    warnings,
    activityTitle: `Visit note · ${company}`,
    activityDetail: intent,
  };
}

function findStage(text: string): Stage | undefined {
  const lowered = text.toLowerCase();
  return [...STAGES].reverse().find((stage) => lowered.includes(stage.toLowerCase()));
}

export function interpretCommand(
  command: string,
  leads: LeadRef[],
  context: { nextLeadId?: string },
  now = new Date(),
): AgentInterpretation {
  const raw = command.trim();
  const text = raw.replace(/\s+/g, " ");
  const base = { command: raw };

  if (!text) {
    return {
      ...base,
      action: { type: "unknown", message: "Say what you want done, for example “Log my visit with Apex Motors”." },
      needsConfirmation: false,
      summary: "Waiting for a command",
    };
  }

  if (/\bnext\b/.test(text.toLowerCase()) && /\b(task|visit|appointment|meeting|customer)\b/.test(text.toLowerCase())) {
    return {
      ...base,
      action: { type: "next_task" },
      needsConfirmation: false,
      summary: "Read your next task and visit. Nothing will be changed.",
    };
  }

  const log = text.match(/\blog (?:my )?(?:visit|meeting)(?: with)? (.+)/i);
  if (log) return mutationForLead(base, log[1], leads, "log_visit", "Log a visit");

  const checkIn = text.match(/\bcheck[- ]?in(?: at| with)? (.+)/i);
  if (checkIn) return mutationForLead(base, checkIn[1], leads, "check_in", "Check in");

  if (/\b(complete|finish|mark done)\b/i.test(text)) {
    const named = text.match(/\b(?:with|at|for)\s+(.+)/i);
    if (named) return mutationForLead(base, named[1], leads, "complete", "Complete the visit");
    if (context.nextLeadId) {
      return {
        ...base,
        action: { type: "complete", leadId: context.nextLeadId },
        needsConfirmation: true,
        summary: "Complete the visit that is currently in progress.",
        riskNote: "This closes the visit on the customer record.",
      };
    }
  }

  const call = text.match(/\bcall\s+(.+)/i);
  if (call && !/follow/i.test(text)) return mutationForLead(base, call[1], leads, "call", "Call");

  if (/\b(update|move|change|set)\b/i.test(text) && findStage(text)) {
    const stage = findStage(text)!;
    const withoutStage = text.replace(new RegExp(stage, "i"), " ");
    const named = withoutStage.match(/\b(?:update|move|change|set)(?:\s+stage(?:\s+of|\s+for)?)?\s+(.+?)\s+(?:stage\s+)?to\s*$/i)
      ?? withoutStage.match(/\b(?:of|for)\s+(.+)/i);
    const name = named?.[1]?.replace(/\b(stage|to)\b/gi, " ").trim() ?? withoutStage;
    const picked = pickLead(name, leads);
    if (picked.kind === "many") return clarify(base, "Which customer’s stage should change?", picked.options);
    if (picked.kind === "none") {
      return {
        ...base,
        action: { type: "unknown", message: `No customer matched for a stage change to ${stage}.` },
        needsConfirmation: false,
        summary: "No matching customer",
      };
    }
    return {
      ...base,
      action: { type: "update_stage", leadId: picked.lead.id, stage },
      needsConfirmation: true,
      summary: `Move ${picked.lead.name} · ${picked.lead.company} to ${stage}.`,
      riskNote: "Stage changes are visible to the whole team on this record.",
    };
  }

  if (/\bfollow[- ]?up\b|\bremind\b|\bcreate (?:a )?(?:task|follow)/i.test(text)) {
    const when = parseWhen(text, now) ?? parseWhen("tomorrow morning", now)!;
    const about = text.match(/\babout\s+(.+)/i);
    const named = text.match(/\b(?:with|for)\s+(.+)/i);
    const nameSource = (named?.[1] ?? "").replace(/\b(tomorrow|today|morning|afternoon|evening|next \w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ");
    const picked = pickLead(nameSource, leads);
    if (picked.kind === "many") return clarify(base, "Which customer is this follow-up for?", picked.options);
    const lead = picked.kind === "one" ? picked.lead : leads.find((item) => item.id === context.nextLeadId);
    if (!lead) {
      return {
        ...base,
        action: { type: "clarify", question: "Which customer is this follow-up for?", options: leads.slice(0, 4).map(labelOf) },
        needsConfirmation: false,
        summary: "A customer is required before a task is created.",
      };
    }
    const title = about ? `Follow up about ${about[1].replace(/[.]+$/, "")}` : `Follow up with ${lead.name}`;
    return {
      ...base,
      action: { type: "create_followup", leadId: lead.id, dueAt: when.iso, title },
      needsConfirmation: true,
      summary: `${title} · ${when.label}.`,
      riskNote: "Confirming creates a task on this customer.",
    };
  }

  return {
    ...base,
    action: {
      type: "unknown",
      message: "I can log a visit, create a follow-up, update a stage, check in, call, or tell you the next task.",
    },
    needsConfirmation: false,
    summary: "Command not recognized",
  };
}

function labelOf(lead: LeadRef): { id: string; label: string } {
  return { id: lead.id, label: `${lead.name} · ${lead.company}` };
}

function clarify(
  base: { command: string },
  question: string,
  options: LeadRef[],
): AgentInterpretation {
  return {
    ...base,
    action: { type: "clarify", question, options: options.map(labelOf) },
    needsConfirmation: false,
    summary: question,
    riskNote: "Nothing is saved until you pick a customer and confirm.",
  };
}

function mutationForLead(
  base: { command: string },
  name: string,
  leads: LeadRef[],
  type: "log_visit" | "check_in" | "complete" | "call",
  verb: string,
): AgentInterpretation {
  const picked = pickLead(name, leads);
  if (picked.kind === "many") return clarify(base, `${verb} — which customer?`, picked.options);
  if (picked.kind === "none") {
    return {
      ...base,
      action: { type: "unknown", message: `No customer matches “${name.trim()}”.` },
      needsConfirmation: false,
      summary: "No matching customer",
    };
  }
  const lead = picked.lead;
  const risk =
    type === "call"
      ? "This places a call and logs the attempt on the record."
      : type === "complete"
        ? "This closes the visit on the customer record."
        : "This writes an update to the customer record.";
  return {
    ...base,
    action: { type, leadId: lead.id },
    needsConfirmation: true,
    summary: `${verb} · ${lead.name} · ${lead.company}.`,
    riskNote: risk,
  };
}

export function leadRefs(leads: Lead[]): LeadRef[] {
  return leads.map(({ id, name, company }) => ({ id, name, company }));
}
