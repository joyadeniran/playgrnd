import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrderStatus, ProxyMode } from "@/lib/novac/types";
import type { Quote, SplitDraft } from "./money";

export type PersonaId = "buyer" | "stall" | "desk";

export type Persona = {
  id: PersonaId;
  label: string;
  name: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
};

export const personas: Record<PersonaId, Persona> = {
  buyer: {
    id: "buyer",
    label: "Buyer",
    name: "Teni Adebayo",
    email: "teni.adebayo@playgrnd.test",
    phone: "08030000001",
    firstName: "Teni",
    lastName: "Adebayo",
  },
  stall: {
    id: "stall",
    label: "Stall",
    name: "Creek & Kernel",
    email: "adaeze@creekkernel.test",
    phone: "08030000002",
    firstName: "Adaeze",
    lastName: "Okoye",
  },
  desk: {
    id: "desk",
    label: "Desk",
    name: "Playgrnd desk",
    email: "desk@playgrnd.test",
    phone: "08030000003",
    firstName: "Desk",
    lastName: "Playgrnd",
  },
};

export type MarketOrder = {
  reference: string;
  createdAt: string;
  status: OrderStatus;
  channel?: string;
  mode: ProxyMode;
  subtotal: number;
  platform: number;
  logistics: number;
  lines: Quote["lines"];
  splits: SplitDraft[];
  email: string;
  refunds: { reference: string; amount: number; at: string }[];
};

export type LedgerEvent = {
  id: string;
  at: string;
  source: "simulator" | "server";
  title: string;
  payload: unknown;
};

type MarketState = {
  persona: PersonaId;
  cart: { sku: string; qty: number }[];
  orders: MarketOrder[];
  splitRefs: Record<string, string>;
  forceSandbox: boolean;
  events: LedgerEvent[];
  setPersona: (persona: PersonaId) => void;
  setForceSandbox: (value: boolean) => void;
  add: (sku: string) => void;
  setQty: (sku: string, qty: number) => void;
  clearCart: () => void;
  rememberSplit: (name: string, reference: string) => void;
  upsertOrder: (order: MarketOrder) => void;
  patchOrder: (reference: string, patch: Partial<MarketOrder>) => void;
  pushEvent: (event: Omit<LedgerEvent, "id" | "at"> & { at?: string }) => void;
};

export const useMarket = create<MarketState>()(
  persist(
    (set) => ({
      persona: "buyer",
      cart: [],
      orders: [],
      splitRefs: {},
      forceSandbox: false,
      events: [],
      setPersona: (persona) => set({ persona }),
      setForceSandbox: (forceSandbox) => set({ forceSandbox }),
      add: (sku) =>
        set((state) => {
          const existing = state.cart.find((item) => item.sku === sku);
          const cart = existing
            ? state.cart.map((item) => (item.sku === sku ? { ...item, qty: item.qty + 1 } : item))
            : [...state.cart, { sku, qty: 1 }];
          return { cart };
        }),
      setQty: (sku, qty) =>
        set((state) => ({
          cart:
            qty <= 0
              ? state.cart.filter((item) => item.sku !== sku)
              : state.cart.map((item) => (item.sku === sku ? { ...item, qty } : item)),
        })),
      clearCart: () => set({ cart: [] }),
      rememberSplit: (name, reference) =>
        set((state) => ({ splitRefs: { ...state.splitRefs, [name]: reference } })),
      upsertOrder: (order) =>
        set((state) => {
          const index = state.orders.findIndex((row) => row.reference === order.reference);
          const orders = [...state.orders];
          if (index >= 0) orders[index] = order;
          else orders.unshift(order);
          return { orders };
        }),
      patchOrder: (reference, patch) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.reference === reference ? { ...order, ...patch } : order,
          ),
        })),
      pushEvent: (event) =>
        set((state) => ({
          events: [
            {
              id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              at: event.at ?? new Date().toISOString(),
              source: event.source,
              title: event.title,
              payload: event.payload,
            },
            ...state.events,
          ].slice(0, 40),
        })),
    }),
    {
      name: "playgrnd-market",
      skipHydration: true,
      partialize: (state) => ({
        persona: state.persona,
        cart: state.cart,
        orders: state.orders,
        splitRefs: state.splitRefs,
        forceSandbox: state.forceSandbox,
        events: state.events,
      }),
    },
  ),
);

export function makeRef(prefix: string): string {
  const raw = `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 32).padEnd(16, "X");
}
