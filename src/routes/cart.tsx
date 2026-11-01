import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Panel } from "@/components/shell";
import { naira, quoteCart } from "@/lib/market/money";
import { useMarket } from "@/lib/market/store";

export const Route = createFileRoute("/cart")({ component: CartPage });

function CartPage() {
  const cart = useMarket((state) => state.cart);
  const setQty = useMarket((state) => state.setQty);
  const quote = quoteCart(cart);

  return (
    <AppShell>
      <p className="text-xs tracking-wide text-brass uppercase">Basket</p>
      <h1 className="font-display text-4xl tracking-tight">What leaves the floor</h1>
      {quote.lines.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          The basket is empty.{" "}
          <Link to="/" className="text-brass">
            Walk the floor.
          </Link>
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <ul className="space-y-3">
            {quote.lines.map((line) => (
              <li key={line.sku} className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-3">
                <div>
                  <p className="font-medium">{line.name}</p>
                  <p className="text-xs text-muted">
                    {line.stallName} · {naira(line.unitPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid h-11 grid-cols-3 overflow-hidden rounded-full border border-line">
                    <button type="button" className="w-10" onClick={() => setQty(line.sku, line.qty - 1)} aria-label="Decrease">
                      −
                    </button>
                    <span className="grid w-8 place-items-center text-sm">{line.qty}</span>
                    <button type="button" className="w-10" onClick={() => setQty(line.sku, line.qty + 1)} aria-label="Increase">
                      +
                    </button>
                  </div>
                  <p className="w-24 text-right text-sm">{naira(line.lineTotal)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Panel title="How Novac would split it" eyebrow="Settlement">
            <SplitRows
              rows={[
                ...quote.stalls.map((stall) => [stall.name, stall.settlement] as const),
                ["Haulage", quote.logistics] as const,
                ["Platform keeps", quote.platform] as const,
              ]}
            />
            <p className="mt-3 text-sm">
              Basket <span className="float-right">{naira(quote.subtotal)}</span>
            </p>
            <p className="mt-2 text-xs text-muted">
              Stall and haulage amounts are flat splits. The platform share stays on the primary settlement account.
            </p>
            <Link
              to="/checkout"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-brass text-sm font-medium text-brass-ink"
            >
              Pay {naira(quote.subtotal)}
            </Link>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}

function SplitRows({ rows }: { rows: readonly (readonly [string, number])[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {rows.map(([label, amount]) => (
        <li key={label} className="flex justify-between gap-3 border-b border-line pb-2">
          <span className="text-muted">{label}</span>
          <span>{naira(amount)}</span>
        </li>
      ))}
    </ul>
  );
}
