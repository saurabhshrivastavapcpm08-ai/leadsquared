import { describe, expect, it } from "vitest";
import { extractFieldNote, interpretCommand, pickLead } from "./nlu";
import { seedData } from "./seed";
import { formatDue } from "./time";

const NOW = new Date("2026-09-23T04:30:00Z");
const leads = seedData().leads.map(({ id, name, company }) => ({ id, name, company }));

describe("on-device field capture", () => {
  it("turns a spoken visit into intent, entities, next action and a date", () => {
    const note = extractFieldNote(
      "Met Rohan at Apex Motors. He wants the ₹12 lakh dealer finance line and asked us to send the sanction note. Follow up tomorrow morning about stamped documents.",
      leads,
      NOW,
    );
    expect(note.leadId).toBe("rohan");
    expect(note.customerIntent.toLowerCase()).toContain("dealer finance");
    expect(note.entities.some((entity) => entity.value.includes("12") && entity.value.includes("lakh"))).toBe(true);
    expect(note.nextAction?.toLowerCase()).toContain("stamped documents");
    expect(note.dueLabel).toBe("Tomorrow · 10:00 AM");
    expect(formatDue(note.dueAt!, NOW)).toBe("Tomorrow · 10:00 AM");
    expect(note.confidence).toBeGreaterThan(0.7);
  });

  it("asks which Apex when the name is ambiguous", () => {
    const picked = pickLead("log the visit with apex", leads);
    expect(picked.kind).toBe("many");
    const note = extractFieldNote("Spoke with Apex about pricing. Follow up Friday afternoon.", leads, NOW);
    expect(note.ambiguous.map((item) => item.id).sort()).toEqual(["rohan", "vikram"]);
    expect(note.dueLabel).toBe("Fri 25 Sep · 2:00 PM");
  });

  it("flags a thin note and personal data", () => {
    const note = extractFieldNote("Call Kavya on 9845011220 tomorrow.", leads, NOW);
    expect(note.leadId).toBe("kavya");
    expect(note.warnings.some((warning) => /phone/i.test(warning))).toBe(true);
  });

  it("captures an unavailable customer and a return visit", () => {
    const note = extractFieldNote(
      "Dr Iyer was not in. Reception said to come back next Monday.",
      leads,
      NOW,
    );
    expect(note.leadId).toBe("iyer");
    expect(note.customerIntent).toBe("Customer unavailable");
    expect(note.nextAction).toBe("Visit again");
    expect(note.dueLabel).toMatch(/Mon 28 Sep/);
  });
});

describe("agent commands", () => {
  it("reads the next task without asking to confirm", () => {
    const result = interpretCommand("What's my next task", leads, { nextLeadId: "rohan" }, NOW);
    expect(result.action.type).toBe("next_task");
    expect(result.needsConfirmation).toBe(false);
  });

  it("confirms a follow-up for tomorrow against the current visit when no name is spoken", () => {
    const result = interpretCommand("Create a follow-up for tomorrow", leads, { nextLeadId: "rohan" }, NOW);
    expect(result.needsConfirmation).toBe(true);
    expect(result.action).toMatchObject({ type: "create_followup", leadId: "rohan" });
    if (result.action.type === "create_followup") {
      expect(formatDue(result.action.dueAt, NOW)).toBe("Tomorrow · 10:00 AM");
    }
  });

  it("refuses an unknown customer instead of guessing", () => {
    const result = interpretCommand("Log my visit with ABC Traders", leads, {}, NOW);
    expect(result.action.type).toBe("unknown");
    expect(result.needsConfirmation).toBe(false);
  });

  it("disambiguates Apex before a visit can be logged", () => {
    const result = interpretCommand("Log my visit with Apex", leads, {}, NOW);
    expect(result.action.type).toBe("clarify");
  });

  it("stages a confirmed stage change", () => {
    const result = interpretCommand("Update Rohan Desai to Negotiation", leads, {}, NOW);
    expect(result.action).toMatchObject({ type: "update_stage", leadId: "rohan", stage: "Negotiation" });
    expect(result.needsConfirmation).toBe(true);
  });
});
