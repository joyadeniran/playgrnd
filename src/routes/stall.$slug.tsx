import { createFileRoute, Link } from "@tanstack/react-router";
import { GoodCard } from "@/components/good-card";
import { AppShell } from "@/components/shell";
import { goodsForStall, stallById } from "@/lib/market/catalog";

export const Route = createFileRoute("/stall/$slug")({ component: StallPage });

function StallPage() {
  const { slug } = Route.useParams();
  const stall = stallById(slug);
  if (!stall) {
    return (
      <AppShell>
        <h1 className="font-display text-3xl">No stall by that name.</h1>
        <Link to="/" className="mt-4 inline-flex h-11 items-center text-brass">
          Back to the floor
        </Link>
      </AppShell>
    );
  }
  const list = goodsForStall(stall.id);
  return (
    <AppShell>
      <p className="text-xs tracking-wide text-brass uppercase">{stall.neighbourhood}</p>
      <h1 className="font-display text-4xl tracking-tight">{stall.name}</h1>
      <p className="mt-2 max-w-lg text-sm text-muted">{stall.line}</p>
      <p className="mt-3 text-xs text-muted">
        Sandbox settlement {stall.accountNumber} · bank {stall.bankCode}. These numbers are fake.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {list.map((good) => (
          <li key={good.sku}>
            <GoodCard good={good} />
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
