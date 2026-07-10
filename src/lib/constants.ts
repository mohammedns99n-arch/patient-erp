export type CaseType = "Medical" | "Surgical";
export const CASE_TYPES: CaseType[] = ["Medical", "Surgical"];

export type StatusCode = 0 | 1 | 2 | 3;

export const STATUS: Record<
  StatusCode,
  { label: string; short: string; rowBg: string; strong: string }
> = {
  // rowBg = pastel table-row background (per spec); strong = saturated colour
  // for charts, dots and cards where the pastel is too light.
  0: { label: "Visit", short: "Visit", rowBg: "#E0E0E0", strong: "#9E9E9E" },
  1: { label: "Treated", short: "Treated", rowBg: "#FFF9C4", strong: "#F2C94C" },
  2: { label: "Invoice Submitted", short: "Invoiced", rowBg: "#C8E6C9", strong: "#6FCF97" },
  3: { label: "Payment Received", short: "Paid", rowBg: "#BBDEFB", strong: "#5B8DEF" },
};

export const STATUS_CODES: StatusCode[] = [0, 1, 2, 3];
