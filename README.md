# LeadSquared Field Day

A working mobile CRM for a field sales rep. It follows LeadSquared’s beat: check in, travel the route, capture the visit, and confirm the follow-up before anything is written.

Three platform capabilities sit on that loop:

1. **On-device capture** — a note or spoken sentence becomes customer intent, entities, a next action and a date. The draft stays on the device until the rep confirms it.
2. **Agent-ready actions** — commands such as “Log my visit with Apex Motors” or “Create a follow-up for tomorrow” preview the change and wait for confirmation.
3. **Field workspace** — the next customer, status and actions (navigate, call, check in, complete) on the phone, on a lock-screen Live Activity, and on a large-screen layout.

The visual language follows the current LeadSquared site: white surfaces, `#0047FF` actions, deep navy, and a squared mark.

```bash
npm install
npm test
npm run dev
```

Open the app and use Phone, Lock Screen, or Large screen at the top. Offline mode keeps new notes and tasks on the device until you go back online. Reset day restores the sample beat.
