import { Link, useRouterState } from "@tanstack/react-router";
import { FlaskConical, LayoutGrid, Receipt, ShoppingBag } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { personas, useMarket, type PersonaId } from "@/lib/market/store";

const NAV = [
  { to: "/", label: "Floor", icon: LayoutGrid },
  { to: "/cart", label: "Basket", icon: ShoppingBag },
  { to: "/orders", label: "Orders", icon: Receipt },
  { to: "/lab", label: "Lab", icon: FlaskConical },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const persona = useMarket((state) => state.persona);
  const setPersona = useMarket((state) => state.setPersona);
  const cart = useMarket((state) => state.cart);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void useMarket.persist.rehydrate();
    setReady(true);
  }, []);

  const count = ready ? cart.reduce((sum, item) => sum + item.qty, 0) : 0;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-brass font-display text-sm text-brass">
              Pg
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg leading-none tracking-tight">Playgrnd</span>
              <span className="block text-xs text-muted">Stall market · Novac sandbox</span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-full px-3 py-2 text-sm ${
                  pathname === item.to ? "bg-surface-2 text-fg" : "text-muted"
                }`}
              >
                {item.label}
                {item.to === "/cart" && count > 0 ? ` ${count}` : ""}
              </Link>
            ))}
          </nav>
          <label className="ml-auto md:ml-0">
            <span className="sr-only">View as</span>
            <select
              className="h-11 rounded-full border border-line bg-surface px-3 text-sm text-fg"
              value={ready ? persona : "buyer"}
              onChange={(event) => setPersona(event.target.value as PersonaId)}
            >
              {(Object.keys(personas) as PersonaId[]).map((id) => (
                <option key={id} value={id}>
                  View as {personas[id].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${
                    active ? "text-brass" : "text-muted"
                  }`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                  {item.to === "/cart" && count > 0 ? ` (${count})` : ""}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Panel({
  id,
  title,
  eyebrow,
  children,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-card border border-line bg-surface p-4">
      {eyebrow ? <p className="text-xs tracking-wide text-brass uppercase">{eyebrow}</p> : null}
      <h2 className="font-display text-xl tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg outline-none focus:border-brass";

export function PrimaryButton({
  children,
  type = "button",
  disabled,
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center rounded-full bg-brass px-4 text-sm font-medium text-brass-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 text-sm text-fg disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg bg-bg p-3 text-xs leading-relaxed text-muted">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
