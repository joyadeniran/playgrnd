import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Field, inputClass, Panel, PrimaryButton } from "@/components/shell";
import { naira, quoteCart } from "@/lib/market/money";
import { makeRef, personas, useMarket } from "@/lib/market/store";
import { callNovac, redirectFrom } from "@/lib/novac/browser";
import { RAIL_LABEL, RAILS, type Rail } from "@/lib/novac/types";

export const Route = createFileRoute("/checkout")({ component: CheckoutPage });

function CheckoutPage() {
  const navigate = useNavigate();
  const cart = useMarket((state) => state.cart);
  const personaId = useMarket((state) => state.persona);
  const persona = personas[personaId];
  const forceSandbox = useMarket((state) => state.forceSandbox);
  const splitRefs = useMarket((state) => state.splitRefs);
  const rememberSplit = useMarket((state) => state.rememberSplit);
  const upsertOrder = useMarket((state) => state.upsertOrder);
  const clearCart = useMarket((state) => state.clearCart);
  const pushEvent = useMarket((state) => state.pushEvent);
  const quote = quoteCart(cart);
  const [rails, setRails] = useState<Rail[]>([...RAILS]);
  const [email, setEmail] = useState(persona.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    if (!quote.subtotal || busy) return;
    setBusy(true);
    setError("");
    const reference = makeRef("PG");
    try {
      const missing = quote.splits.filter((split) => !splitRefs[split.split_name]);
      const nextRefs = { ...splitRefs };
      if (missing.length) {
        const created = await callNovac("splits", {
          simulate: forceSandbox,
          accounts: missing.map((split) => ({
            split_name: split.split_name,
            bank_code: split.bank_code,
            account_number: split.account_number,
            split_value: split.split_value,
          })),
        });
        pushEvent({ source: "simulator", title: "Split accounts", payload: created });
        if (!created.ok) {
          setError(created.message || "Novac rejected the split accounts. The raw response is in the lab ledger.");
          setBusy(false);
          return;
        }
        const data = (created.response as { data?: { split_name?: string; split_payment_reference?: string }[] } | null)?.data;
        if (Array.isArray(data)) {
          for (const row of data) {
            if (row.split_name && row.split_payment_reference) {
              nextRefs[row.split_name] = row.split_payment_reference;
              rememberSplit(row.split_name, row.split_payment_reference);
            }
          }
        }
      }
      const started = await callNovac("checkout", {
        simulate: forceSandbox,
        reference,
        amount: quote.subtotal,
        rails,
        description: quote.lines.map((line) => line.name).join(", "),
        customer: {
          email: email || persona.email,
          firstName: persona.firstName,
          lastName: persona.lastName,
          phoneNumber: persona.phone,
        },
        splits: quote.splits.map((split) => ({
          split_reference_code: nextRefs[split.split_name] ?? "",
          split_value: split.split_value,
        })),
      });
      pushEvent({ source: started.mode === "novac" ? "server" : "simulator", title: "Checkout initiate", payload: started });
      upsertOrder({
        reference,
        createdAt: new Date().toISOString(),
        status: started.ok ? "initiated" : "failed",
        mode: started.mode,
        subtotal: quote.subtotal,
        platform: quote.platform,
        logistics: quote.logistics,
        lines: quote.lines,
        splits: quote.splits,
        email: email || persona.email,
        refunds: [],
      });
      const url = redirectFrom(started);
      if (!started.ok || !url) {
        setError(started.message || "Checkout did not return a payment URL.");
        setBusy(false);
        return;
      }
      clearCart();
      if (url.startsWith("/")) {
        await navigate({ to: "/sandbox-pay", search: { reference } });
        return;
      }
      window.location.assign(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout failed");
      setBusy(false);
    }
  }

  function toggleRail(rail: Rail) {
    setRails((current) => {
      const next = current.includes(rail) ? current.filter((item) => item !== rail) : [...current, rail];
      return next.length ? next : current;
    });
  }

  return (
    <AppShell>
      <p className="text-xs tracking-wide text-brass uppercase">Checkout</p>
      <h1 className="font-display text-4xl tracking-tight">Pay the basket once</h1>
      {quote.subtotal === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Nothing to pay. <Link to="/cart" className="text-brass">Open the basket.</Link>
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]">
          <Panel title={naira(quote.subtotal)} eyebrow="Buyer pays">
            <ul className="space-y-2 text-sm">
              {quote.lines.map((line) => (
                <li key={line.sku} className="flex justify-between gap-3">
                  <span>
                    {line.qty} × {line.name}
                  </span>
                  <span>{naira(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <Field label="Receipt email">
              <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <p className="mt-4 text-sm text-muted">Rails on the hosted checkout</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RAILS.map((rail) => (
                <button
                  key={rail}
                  type="button"
                  onClick={() => toggleRail(rail)}
                  className={`h-11 rounded-full px-3 text-sm ${
                    rails.includes(rail) ? "bg-brass text-brass-ink" : "border border-line text-muted"
                  }`}
                >
                  {RAIL_LABEL[rail]}
                </button>
              ))}
            </div>
            {error ? <p className="mt-3 text-sm text-rust">{error}</p> : null}
            <div className="mt-4">
              <PrimaryButton onClick={() => void pay()} disabled={busy}>
                {busy ? "Opening checkout…" : forceSandbox ? "Pay in simulator" : "Open Novac checkout"}
              </PrimaryButton>
            </div>
            <p className="mt-3 text-xs text-muted">
              Card numbers are never typed here. With keys, this opens Novac. Without keys, a labeled simulator stands in.
            </p>
          </Panel>
          <Panel title="Split on success" eyebrow="Flat naira">
            <ul className="space-y-2 text-sm">
              {quote.splits.map((split) => (
                <li key={split.split_name} className="flex justify-between gap-3 border-b border-line pb-2">
                  <span>
                    {split.account_name}
                    <span className="block text-xs text-muted">{split.account_number}</span>
                  </span>
                  <span>{naira(split.split_value)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3">
                <span className="text-muted">Platform remainder</span>
                <span>{naira(quote.platform)}</span>
              </li>
            </ul>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
