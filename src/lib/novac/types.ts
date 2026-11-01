export type ProxyMode = "sandbox" | "novac";

export type ProxyResult = {
  ok: boolean;
  mode: ProxyMode;
  novac: { method: string; path: string; status?: number };
  request: unknown;
  response: unknown;
  message?: string;
};

export type OrderStatus = "initiated" | "successful" | "failed" | "abandoned" | "reversed" | "pending";

export const RAILS = ["CARD", "PWBT", "USSD", "OPAY", "PALMPAY"] as const;
export type Rail = (typeof RAILS)[number];

export const RAIL_LABEL: Record<Rail, string> = {
  CARD: "Card",
  PWBT: "Bank transfer",
  USSD: "USSD",
  OPAY: "OPay",
  PALMPAY: "PalmPay",
};
