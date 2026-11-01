import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, GhostButton, inputClass, JsonBlock, PrimaryButton } from "@/components/shell";
import { naira } from "@/lib/market/money";
import { useMarket, type MarketOrder } from "@/lib/market/store";
import { callNovac } from "@/lib/novac/browser";
import type { OrderStatus, ProxyResult } from "@/lib/novac/types";

export const Route = createFileRoute("/orders")({ component: OrdersPage });

function OrdersPage() {
  const orders = useMarket((state) => state.orders);
  return (
    <AppShell>
      <p className="text-xs tracking-wide text-brass uppercase">Orders</p>
      <h1 className="font-display text-4xl tracking-tight">What the desk can still touch</h1>
      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders on this browser yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li key={order.reference}>
              <OrderRow order={order} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function OrderRow({ order }: { order: MarketOrder }) {
  const forceSandbox = useMarket((state) => state.forceSandbox);
  const patchOrder = useMarket((state) => state.patchOrder);
  const pushEvent = useMarket((state) => state.pushEvent);
  const [open, setOpen] = useState(false);
  const [partial, setPartial] = useState("");
  const [trace, setTrace] = useState<ProxyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const refunded = order.refunds.reduce((sum, row) => sum + row.amount, 0);
  const remaining = Math.max(0, order.subtotal - refunded);

  async function verify() {
    setBusy(true);
    const result = await callNovac("verify", { reference: order.reference, simulate: forceSandbox });
    setTrace(result);
    pushEvent({ source: result.mode === "novac" ? "server" : "simulator", title: "Verify", payload: result });
    const status = (result.response as { data?: { status?: OrderStatus } } | null)?.data?.status;
    if (status) patchOrder(order.reference, { status });
    setBusy(false);
  }

  async function refund(full: boolean) {
    const amount = full ? remaining : Number(partial);
    if (!(amount > 0) || amount > remaining) return;
    setBusy(true);
    const result = await callNovac(full || amount === remaining ? "refund" : "partial-refund", {
      simulate: forceSandbox,
      reference: order.reference,
      amount,
      customer_note: "Buyer asked the stall to take it back",
      merchant_note: "Playgrnd desk",
    });
    setTrace(result);
    pushEvent({ source: result.mode === "novac" ? "server" : "simulator", title: "Refund", payload: result });
    if (result.ok) {
      const nextRefunds = [
        ...order.refunds,
        { reference: `local-${Date.now()}`, amount, at: new Date().toISOString() },
      ];
      patchOrder(order.reference, {
        refunds: nextRefunds,
        status: amount >= remaining ? "reversed" : order.status,
      });
    }
    setBusy(false);
  }

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">{order.reference}</p>
          <h2 className="font-display text-2xl tracking-tight">{naira(order.subtotal)}</h2>
          <p className="text-sm text-muted">
            {order.status}
            {order.channel ? ` · ${order.channel}` : ""} · {order.mode}
          </p>
        </div>
        <GhostButton onClick={() => setOpen((value) => !value)}>{open ? "Hide" : "Settle"}</GhostButton>
      </div>
      {open ? (
        <div className="mt-4 space-y-3">
          <ul className="text-sm text-muted">
            {order.lines.map((line) => (
              <li key={line.sku}>
                {line.qty} × {line.name} · {line.stallName}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton disabled={busy} onClick={() => void verify()}>
              Verify
            </PrimaryButton>
            <PrimaryButton disabled={busy || order.status !== "successful" || remaining <= 0} onClick={() => void refund(true)}>
              Refund all
            </PrimaryButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputClass} max-w-40`}
              inputMode="numeric"
              placeholder="Partial ₦"
              value={partial}
              onChange={(event) => setPartial(event.target.value)}
            />
            <GhostButton disabled={busy || order.status !== "successful"} onClick={() => void refund(false)}>
              Partial refund
            </GhostButton>
          </div>
          <p className="text-xs text-muted">Still with the stalls: {naira(remaining)}</p>
          {trace ? <JsonBlock value={trace} /> : null}
        </div>
      ) : null}
    </article>
  );
}
