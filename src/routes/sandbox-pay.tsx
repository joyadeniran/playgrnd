import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PrimaryButton } from "@/components/shell";
import { useMarket } from "@/lib/market/store";
import { callNovac } from "@/lib/novac/browser";

export const Route = createFileRoute("/sandbox-pay")({
  validateSearch: (search: Record<string, unknown>) => ({
    reference: typeof search.reference === "string" ? search.reference : "",
  }),
  component: SandboxPay,
});

const OUTCOMES = [
  { label: "Card succeeds", status: "successful", channel: "card" },
  { label: "Card declined", status: "failed", channel: "card" },
  { label: "Bank transfer", status: "successful", channel: "bank_transfer" },
  { label: "USSD", status: "successful", channel: "ussd" },
  { label: "OPay", status: "successful", channel: "opay" },
  { label: "PalmPay", status: "successful", channel: "palmpay" },
  { label: "Leave unpaid", status: "abandoned", channel: "" },
] as const;

function SandboxPay() {
  const { reference } = Route.useSearch();
  const navigate = useNavigate();
  const pushEvent = useMarket((state) => state.pushEvent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(status: string, channel: string) {
    setBusy(true);
    setError("");
    const result = await callNovac("sandbox-outcome", { reference, status, channel });
    pushEvent({ source: "simulator", title: `Sandbox ${status}`, payload: result });
    if (!result.ok) {
      setError(result.message || "That reference is not in the simulator ledger.");
      setBusy(false);
      return;
    }
    await navigate({ to: "/callback", search: { reference, status } });
  }

  return (
    <AppShell>
      <p className="text-xs tracking-wide text-rust uppercase">Simulator · not Novac</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">Pretend checkout</h1>
      <p className="mt-3 max-w-lg text-sm text-muted">
        This page stands in for Novac’s hosted checkout while no secret is being sent. It does not ask for a card,
        PIN, or OTP. Published test cards stay in the lab as documentation only.
      </p>
      <p className="mt-4 font-mono text-xs text-brass">{reference || "Missing reference"}</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {OUTCOMES.map((outcome) => (
          <PrimaryButton key={outcome.label} disabled={busy || !reference} onClick={() => void choose(outcome.status, outcome.channel)}>
            {outcome.label}
          </PrimaryButton>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm text-rust">{error}</p> : null}
    </AppShell>
  );
}
