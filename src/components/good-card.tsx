import { stallById, type Good } from "@/lib/market/catalog";
import { naira } from "@/lib/market/money";
import { useMarket } from "@/lib/market/store";

export function GoodCard({ good }: { good: Good }) {
  const qty = useMarket((state) => state.cart.find((item) => item.sku === good.sku)?.qty ?? 0);
  const add = useMarket((state) => state.add);
  const setQty = useMarket((state) => state.setQty);
  const stall = stallById(good.stallId);

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <img src={good.image} alt={good.name} className="aspect-square w-full object-cover" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-xs text-brass">{stall?.name}</p>
        <h3 className="font-display text-lg leading-tight tracking-tight">{good.name}</h3>
        <p className="text-sm text-muted">{good.blurb}</p>
        <p className="mt-auto pt-2 text-sm">
          {naira(good.price)} <span className="text-muted">/ {good.unit}</span>
        </p>
        {qty === 0 ? (
          <button
            type="button"
            onClick={() => add(good.sku)}
            className="h-11 rounded-full bg-brass text-sm font-medium text-brass-ink"
          >
            Add to basket
          </button>
        ) : (
          <div className="grid h-11 grid-cols-3 overflow-hidden rounded-full border border-line">
            <button type="button" className="text-lg" onClick={() => setQty(good.sku, qty - 1)} aria-label={`Remove one ${good.name}`}>
              −
            </button>
            <span className="grid place-items-center text-sm">{qty}</span>
            <button type="button" className="text-lg" onClick={() => setQty(good.sku, qty + 1)} aria-label={`Add one ${good.name}`}>
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
