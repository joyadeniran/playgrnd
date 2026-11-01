import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Field, GhostButton, inputClass, JsonBlock, Panel, PrimaryButton } from "@/components/shell";
import { logisticsAccount, stalls } from "@/lib/market/catalog";
import { makeRef, personas, useMarket } from "@/lib/market/store";
import { callNovac } from "@/lib/novac/browser";
import type { ProxyResult } from "@/lib/novac/types";

export const Route = createFileRoute("/lab")({ component: LabPage });

const CHIPS = [
  ["status", "Connection"],
  ["splits", "Splits"],
  ["accounts", "Accounts"],
  ["payouts", "Payouts"],
  ["links", "Links"],
  ["inbox", "Inbox"],
  ["atlas", "Atlas"],
] as const;

function LabPage() {
  return (
    <AppShell>
      <p className="text-xs tracking-wide text-brass uppercase">Novac lab</p>
      <h1 className="font-display text-4xl tracking-tight">Every rail, one desk</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Each bench shows the request it sent and the body that came back. Sandbox responses are marked
        simulated. Live calls use server keys only — this page never asks you to paste one.
      </p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {CHIPS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex h-11 shrink-0 items-center rounded-full border border-line px-4 text-sm">
            {label}
          </a>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        <Connection />
        <SplitsBench />
        <AccountsBench />
        <PayoutBench />
        <LinksBench />
        <InboxBench />
        <Atlas />
      </div>
    </AppShell>
  );
}

function Connection() {
  const forceSandbox = useMarket((state) => state.forceSandbox);
  const setForceSandbox = useMarket((state) => state.setForceSandbox);
  const [result, setResult] = useState<ProxyResult | null>(null);
  useEffect(() => {
    void callNovac("status", undefined, "GET").then(setResult);
  }, []);
  const body = result?.response as { publicKey?: boolean; secretKey?: boolean; note?: string } | null;
  return (
      <Panel id="status" title="Keys stay on the server" eyebrow="Connection">
      <p className="text-sm text-muted">{body?.note ?? "Checking…"}</p>
      <p className="mt-2 text-sm">
        Public key {body?.publicKey ? "present" : "missing"} · Secret key {body?.secretKey ? "present" : "missing"}
      </p>
      <label className="mt-3 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={forceSandbox}
          onChange={(event) => setForceSandbox(event.target.checked)}
          className="size-5 accent-brass"
        />
        Force sandbox even if keys are set
      </label>
    </Panel>
  );
}

function SplitsBench() {
  const forceSandbox = useMarket((state) => state.forceSandbox);
  const rememberSplit = useMarket((state) => state.rememberSplit);
  const pushEvent = useMarket((state) => state.pushEvent);
  const [result, setResult] = useState<ProxyResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const accounts = [
      ...stalls.map((stall) => ({
        split_name: stall.id,
        bank_code: stall.bankCode,
        account_number: stall.accountNumber,
        split_value: 1000,
      })),
      {
        split_name: logisticsAccount.splitName,
        bank_code: logisticsAccount.bankCode,
        account_number: logisticsAccount.accountNumber,
        split_value: 500,
      },
    ];
    const created = await callNovac("splits", { simulate: forceSandbox, accounts });
    setResult(created);
    pushEvent({ source: "server", title: "Save splits", payload: created });
    const data = (created.response as { data?: { split_name?: string; split_payment_reference?: string }[] } | null)?.data;
    if (Array.isArray(data)) {
      for (const row of data) {
        if (row.split_name && row.split_payment_reference) rememberSplit(row.split_name, row.split_payment_reference);
      }
    }
    setBusy(false);
  }

  async function list() {
    setBusy(true);
    const listed = await callNovac("splits", { simulate: forceSandbox }, "GET");
    setResult(listed);
    setBusy(false);
  }

  return (
    <Panel id="splits" title="Sub-settlement accounts" eyebrow="Splits">
      <p className="text-sm text-muted">
        Saves the three stalls plus haulage as flat splits using fictional account numbers. Checkout reuses the
        references. A live call needs a primary settlement account already set on the Novac dashboard.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton disabled={busy} onClick={() => void save()}>
          Save sandbox splits
        </PrimaryButton>
        <GhostButton disabled={busy} onClick={() => void list()}>
          List splits
        </GhostButton>
      </div>
      {result ? <div className="mt-3"><JsonBlock value={result} /></div> : null}
    </Panel>
  );
}

function AccountsBench() {
  const forceSandbox = useMarket((state) => state.forceSandbox);
  const persona = personas[useMarket((state) => state.persona)];
  const pushEvent = useMarket((state) => state.pushEvent);
  const [accountType, setAccountType] = useState<"reserved" | "checkout">("reserved");
  const [name, setName] = useState("Teni Adebayo");
  const [amount, setAmount] = useState("15000");
  const [result, setResult] = useState<ProxyResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const created = await callNovac("virtual-account", {
      simulate: forceSandbox,
      reference: makeRef("VA"),
      accountType,
      accountName: name,
      bankCode: "000036",
      amount: Number(amount),
      expiryInMinutes: 30,
      firstName: persona.firstName,
      lastName: persona.lastName,
      customerEmail: persona.email,
    });
    setResult(created);
    pushEvent({ source: "server", title: "Virtual account", payload: created });
    setBusy(false);
  }

  return (
    <Panel id="accounts" title="Dedicated and checkout accounts" eyebrow="Virtual accounts">
      <p className="text-sm text-muted">
        Reserved accounts stay open for repeat transfers. Checkout accounts expire — useful for a one-off invoice.
        Inflow still settles to the business account; the number is for reconciliation.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Account name">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Type">
          <select className={inputClass} value={accountType} onChange={(event) => setAccountType(event.target.value as "reserved" | "checkout")}>
            <option value="reserved">Reserved</option>
            <option value="checkout">Checkout</option>
          </select>
        </Field>
        {accountType === "checkout" ? (
          <Field label="Exact amount (naira)">
            <input className={inputClass} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
        ) : null}
      </div>
      <div className="mt-3">
        <PrimaryButton disabled={busy} onClick={() => void create()}>
          Create account
        </PrimaryButton>
      </div>
      {result ? <div className="mt-3"><JsonBlock value={result} /></div> : null}
    </Panel>
  );
}

function PayoutBench() {
  const forceSandbox = useMarket((state) => state.forceSandbox);
  const pushEvent = useMarket((state) => state.pushEvent);
  const [account, setAccount] = useState("9010002202");
  const [bank, setBank] = useState("000013");
  const [amount, setAmount] = useState("5000");
  const [resolved, setResolved] = useState("");
  const [result, setResult] = useState<ProxyResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(step: "banks" | "verify" | "balance" | "pay") {
    setBusy(true);
    let next: ProxyResult;
    if (step === "banks") next = await callNovac("banks", { simulate: forceSandbox, country: "NG" }, "GET");
    else if (step === "balance") next = await callNovac("balance", { simulate: forceSandbox }, "GET");
    else if (step === "verify") {
      next = await callNovac("verify-account", { simulate: forceSandbox, account_number: account, bank_code: bank });
      const name = (next.response as { data?: unknown } | null)?.data;
      setResolved(typeof name === "string" ? name : "");
    } else {
      next = await callNovac("payout", {
        simulate: forceSandbox,
        reference: makeRef("PO"),
        amount: Number(amount),
        bankCode: bank,
        bankName: "Harbor Bank",
        accountNumber: account,
        accountName: resolved || "PLAYGRND SANDBOX ACCOUNT",
        narration: "Stall settlement",
      });
    }
    setResult(next);
    pushEvent({ source: "server", title: `Payout ${step}`, payload: next });
    setBusy(false);
  }

  return (
    <Panel id="payouts" title="Pay a stall out" eyebrow="Payouts">
      <p className="text-sm text-muted">
        Banks, name enquiry, optional balance, then transfer. Live payouts need Novac to whitelist the server IP.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Account number">
          <input className={inputClass} value={account} onChange={(event) => setAccount(event.target.value)} />
        </Field>
        <Field label="Bank code">
          <input className={inputClass} value={bank} onChange={(event) => setBank(event.target.value)} />
        </Field>
        <Field label="Amount (naira)">
          <input className={inputClass} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
      </div>
      {resolved ? <p className="mt-2 text-sm text-moss">Name enquiry: {resolved}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <GhostButton disabled={busy} onClick={() => void run("banks")}>Banks</GhostButton>
        <GhostButton disabled={busy} onClick={() => void run("verify")}>Verify account</GhostButton>
        <GhostButton disabled={busy} onClick={() => void run("balance")}>Balance</GhostButton>
        <PrimaryButton disabled={busy} onClick={() => void run("pay")}>Send payout</PrimaryButton>
      </div>
      {result ? <div className="mt-3"><JsonBlock value={result} /></div> : null}
    </Panel>
  );
}

function LinksBench() {
  const forceSandbox = useMarket((state) => state.forceSandbox);
  const persona = personas.buyer;
  const pushEvent = useMarket((state) => state.pushEvent);
  const [link, setLink] = useState("oeXQckL");
  const [amount, setAmount] = useState("8000");
  const [result, setResult] = useState<ProxyResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(kind: "payment-link" | "recurring") {
    setBusy(true);
    const next = await callNovac(kind, {
      simulate: forceSandbox,
      paymentLinkReference: link,
      amount: Number(amount),
      reference: makeRef("PL"),
      customer: {
        email: persona.email,
        firstName: persona.firstName,
        lastName: persona.lastName,
        phoneNumber: persona.phone,
      },
    });
    setResult(next);
    pushEvent({ source: "server", title: kind, payload: next });
    setBusy(false);
  }

  return (
    <Panel id="links" title="Links and NGN recurring" eyebrow="Collections">
      <p className="text-sm text-muted">
        Payment links are created on the Novac dashboard. This bench only starts a checkout against a link
        reference. Recurring frequency is also set on that dashboard link, and only for NGN cards.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Payment link reference">
          <input className={inputClass} value={link} onChange={(event) => setLink(event.target.value)} />
        </Field>
        <Field label="Amount (naira)">
          <input className={inputClass} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton disabled={busy} onClick={() => void run("payment-link")}>Start from link</PrimaryButton>
        <GhostButton disabled={busy} onClick={() => void run("recurring")}>Start recurring</GhostButton>
      </div>
      {result ? <div className="mt-3"><JsonBlock value={result} /></div> : null}
    </Panel>
  );
}

function InboxBench() {
  const events = useMarket((state) => state.events);
  const [server, setServer] = useState<ProxyResult | null>(null);

  return (
    <Panel id="inbox" title="What Novac would POST" eyebrow="Webhooks">
      <p className="text-sm text-muted">
        Point a Novac test webhook at <span className="text-fg">/api/novac/webhook</span>. The simulator also
        writes a transaction event when a pretend payment finishes. Server memory is per instance.
      </p>
      <div className="mt-3">
        <GhostButton onClick={() => void callNovac("webhook", undefined, "GET").then(setServer)}>
          Pull server inbox
        </GhostButton>
      </div>
      {server ? <div className="mt-3"><JsonBlock value={server} /></div> : null}
      <ul className="mt-4 space-y-3">
        {events.length === 0 ? <li className="text-sm text-muted">No local events yet.</li> : null}
        {events.slice(0, 8).map((event) => (
          <li key={event.id}>
            <p className="text-sm">
              {event.title} <span className="text-muted">· {event.source}</span>
            </p>
            <JsonBlock value={event.payload} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Atlas() {
  const rows = [
    ["Hosted checkout + split override", "Wired", "Basket → Pay"],
    ["Verify on callback", "Wired", "Return URL and Orders"],
    ["Sub-settlement accounts", "Wired", "This lab"],
    ["Reserved and checkout virtual accounts", "Wired", "This lab"],
    ["Payout name enquiry + transfer", "Wired", "This lab"],
    ["Full and partial refund", "Wired", "Orders"],
    ["Payment link initiate", "Wired", "Needs a dashboard link reference"],
    ["NGN recurring via payment link", "Wired", "Frequency is not an API field"],
    ["Webhooks", "Wired", "POST /api/novac/webhook"],
    ["Direct card charge", "Not started", "Do not collect PAN here until encryption is in"],
    ["Bills: airtime, data, electricity", "Not started", "SPEC backlog"],
    ["Open banking (GBP)", "Out of scope", "Not a naira market rail"],
    ["Mobile money GHS / KES", "Not started", "SPEC backlog"],
    ["USD card token recurring", "Not started", "Different from NGN payment-link recurring"],
  ];
  return (
    <Panel id="atlas" title="What else Novac can do" eyebrow="Atlas">
      <ul className="divide-y divide-line text-sm">
        {rows.map(([feature, state, where]) => (
          <li key={feature} className="grid gap-1 py-3 sm:grid-cols-[1.4fr_0.6fr_1fr]">
            <span>{feature}</span>
            <span className={state === "Wired" ? "text-moss" : "text-muted"}>{state}</span>
            <span className="text-muted">{where}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Test cards published by Novac, for their hosted page only: success 5555555555554444, expiry 12/30, CVC 123,
        PIN 1234. Decline 1234567898765432. OTP any 6 digits. Do not type them into Playgrnd.
      </p>
    </Panel>
  );
}
