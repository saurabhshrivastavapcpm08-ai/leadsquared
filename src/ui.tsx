import { useId, type ReactNode } from "react";
import type { Stage, VisitStatus } from "./types";

export function Logo({ light = false }: { light?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
        <rect x="8" y="8" width="16" height="16" rx="3" fill="none" stroke="white" strokeWidth="2.4" />
        <rect x="13" y="13" width="6" height="6" rx="1" fill="white" />
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#0047FF" />
            <stop offset="1" stopColor="#5B3CF0" />
          </linearGradient>
        </defs>
      </svg>
      LeadSquared
    </span>
  );
}

export function StageChip({ stage }: { stage: Stage }) {
  return <span className={`chip stage-${stage.toLowerCase().split(" ")[0]}`}>{stage}</span>;
}

export function StatusChip({ status }: { status: VisitStatus }) {
  const label = { upcoming: "Upcoming", enroute: "On the way", "checked-in": "On site", completed: "Done" }[status];
  return <span className={`chip status-${status}`}>{label}</span>;
}

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-8.5Z" />,
    leads: (
      <>
        <circle cx="9" cy="9" r="2.2" />
        <circle cx="15.5" cy="9.5" r="1.8" />
        <path d="M4.8 17.5c.5-2 2.2-3 4.2-3s3.7 1 4.2 3" />
        <path d="M13.2 14.8c1.6-.3 3.2.4 3.8 2.2" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3.5" width="6" height="10" rx="3" />
        <path d="M7 11a5 5 0 0 0 10 0M12 16v3.5M8.5 19.5h7" />
      </>
    ),
    tasks: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 12.2 10.4 14.5 16 9" />
      </>
    ),
    spark: (
      <path d="M12 3.5 13.6 9H19l-4.2 3.2 1.6 5.3L12 14.8 7.6 17.5l1.6-5.3L5 9h5.4L12 3.5Z" />
    ),
    pin: (
      <>
        <path d="M12 21s6-5.2 6-9.2A6 6 0 0 0 6 11.8C6 15.8 12 21 12 21Z" />
        <circle cx="12" cy="11.5" r="1.8" />
      </>
    ),
    phone: (
      <path d="M8 4.5h2.2l1.2 3-1.6 1a12 12 0 0 0 5.5 5.5l1-1.6 3 1.2V16a1.5 1.5 0 0 1-1.6 1.5A13.5 13.5 0 0 1 6.5 6.1 1.5 1.5 0 0 1 8 4.5Z" />
    ),
    nav: (
      <>
        <path d="M5 18.5 19 5" />
        <path d="M10 5h9v9" />
      </>
    ),
    close: (
      <>
        <path d="M7 7l10 10M17 7 7 17" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
