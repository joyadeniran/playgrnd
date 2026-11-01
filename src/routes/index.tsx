import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GoodCard } from "@/components/good-card";
import { AppShell } from "@/components/shell";
import { goods, stalls } from "@/lib/market/catalog";

export const Route = createFileRoute("/")({ component: Floor });

function Floor() {
  const [stallId, setStallId] = useState("all");
  const visible = stallId === "all" ? goods : goods.filter((good) => good.stallId === stallId);

  return (
    <AppShell>
      <p className="text-xs tracking-wide text-brass uppercase">Wholesale floor</p>
      <h1 className="mt-1 max-w-xl font-display text-4xl leading-tight tracking-tight">
        Three stalls. One basket. Novac splits the take.
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Playgrnd is a fictional market for trying Novac before any of it is wired into a live store.
        Nothing here is Supplya — not the goods, not the accounts, not the payment rail.
      </p>
      <div className="mt-5 flex min-w-0 gap-2 overflow-x-auto pb-1">
        <FilterChip active={stallId === "all"} onClick={() => setStallId("all")}>
          All stalls
        </FilterChip>
        {stalls.map((stall) => (
          <FilterChip key={stall.id} active={stallId === stall.id} onClick={() => setStallId(stall.id)}>
            {stall.name}
          </FilterChip>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {visible.map((good) => (
          <li key={good.sku}>
            <GoodCard good={good} />
          </li>
        ))}
      </ul>
      <ul className="mt-8 grid gap-3 md:grid-cols-3">
        {stalls.map((stall) => (
          <li key={stall.id} className="rounded-card border border-line bg-surface p-4">
            <p className="text-xs text-brass">{stall.neighbourhood}</p>
            <h2 className="font-display text-xl tracking-tight">{stall.name}</h2>
            <p className="mt-1 text-sm text-muted">{stall.line}</p>
            <Link to="/stall/$slug" params={{ slug: stall.id }} className="mt-3 inline-flex h-11 items-center text-sm text-brass">
              Open stall
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 shrink-0 rounded-full px-4 text-sm ${
        active ? "bg-brass text-brass-ink" : "border border-line text-fg"
      }`}
    >
      {children}
    </button>
  );
}
