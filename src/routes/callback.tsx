import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, JsonBlock, Panel } from "@/components/shell";
import { naira } from "@/lib/market/money";
import { useMarket } from "@/lib/market/store";
import { callNovac } from "@/lib/novac/browser";
import type { OrderStatus, ProxyResult } from "@/lib/novac/types";

export const Route = createFileRoute("/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    reference: typeof search.reference === "string" ? search.reference : "",
    status: typeof search.status === "string" ? search.status : "",
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const { reference, status } = Route.useSearch();
  const forceSandbox = useMarket((state) => state.forceSandbox);
  const order = useMarket((state) => state.orders.find((row) => row.reference === reference));
  const [result, setResult] = useState<ProxyResult | null>(null);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    void callNovac("verify", { reference, simulate: forceSandbox }).then((verified) => {
      if (cancelled) return;
      setResult(verified);
      const state = useMarket.getState();
      state.pushEvent({
        source: verified.mode === "novac" ? "server" : "simulator",
        title: "Verify",
        payload: verified,
      });
      const data =
        verified.response && typeof verified.response === "object"
          ? (verified.response as { data?: { status?: string; channel?: string } }).data
          : undefined;
      const next = (data?.status || status || "pending") as OrderStatus;
      if (state.orders.some((row) => row.reference === reference)) {
        state.patchOrder(reference, { status: next, channel: data?.channel });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reference, forceSandbox, status]);

  const verifiedStatus =
    result?.response && typeof result.response === "object"
      ? (result.response as { data?: { status?: string } }).data?.status
      : status;

  return (
    <AppShell>
      <p className="text-xs tracking-wide text-brass uppercase">Return URL</p>
      <h1 className="font-display text-4xl tracking-tight">
        {verifiedStatus === "successful" ? "Payment landed" : verifiedStatus ? `Marked ${verifiedStatus}` : "Checking payment"}
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">{reference || "No reference on the URL"}</p>
      {order ? (
        <div className="mt-6">
          <Panel title={naira(order.subtotal)} eyebrow={order.mode === "novac" ? "Novac" : "Sandbox"}>
            <ul className="space-y-2 text-sm">
              {order.lines.map((line) => (
                <li key={line.sku} className="flex justify-between">
                  <span>{line.name}</span>
                  <span>{naira(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
      <div className="mt-4">
        {result ? <JsonBlock value={result} /> : <p className="text-sm text-muted">Asking the verify endpoint…</p>}
      </div>
      <Link to="/orders" className="mt-4 inline-flex h-11 items-center text-sm text-brass">
        Open orders
      </Link>
    </AppShell>
  );
}
