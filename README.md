# Playgrnd

A fictional wholesale stall market used to try [Novac](https://developer.novacpayment.com/docs/introduction/welcome-to-novac) before any of it is proposed for a live store.

This is **not** Supplya. It does not import Supplya code, catalogs, brands, Paystack, or Anchor. Read [SPEC.md](SPEC.md) before changing payment behaviour. History lives in [CHANGELOG.md](CHANGELOG.md).

## What you can do

- Buy from three stalls in one basket. One checkout. Flat splits for each stall and for haulage. The platform remainder stays on the primary settlement account.
- Finish in a labeled simulator when Novac keys are absent. The simulator never asks for a card.
- When keys exist, the same buttons call `https://api.novacpayment.com` from the server.
- Lab benches: sub-settlement accounts, reserved and checkout virtual accounts, payout name-enquiry and transfer, payment-link checkout, NGN recurring initiate, webhook inbox.
- Orders: verify, full refund, partial refund.

## Keys

Set these on the server only. Never prefix them with `VITE_`. Never commit them.

| Name | Used for |
| --- | --- |
| `NOVAC_PUBLIC_KEY` | Checkout initiate, payment-link initiate, recurring initiate |
| `NOVAC_SECRET_KEY` | Verify, splits, virtual accounts, payouts, refunds |

Test and live are the same base URL. The key pair decides the environment. Leave both empty to stay in sandbox. The lab switch **Force sandbox** skips Novac even if keys are present.

A live split also needs a primary settlement account on the Novac dashboard. Live payouts need Novac to whitelist the server IP (`support@novacpayment.com`).

## Layout

```text
src/lib/market/     fictional catalog, quote, browser store
src/lib/novac/      proxy types, browser client, server adapter
src/routes/         floor, stall, basket, checkout, simulator, orders, lab
src/routes/api/novac/$action.ts
SPEC.md             agent contract and backlog
```

Proxy responses always look like:

```json
{
  "ok": true,
  "mode": "sandbox",
  "novac": { "method": "POST", "path": "/api/v1/initiate" },
  "request": {},
  "response": {}
}
```

`mode` is `novac` only when that call actually left the server.

## Assumptions the next agent must not silently change

- Amounts are **whole naira**, matching Novac’s marketplace sample (`"amount": 20000`). Confirm with a ₦100 live charge before treating that as settled.
- Split override sends `use_preconfiguration` (OpenAPI). One curl sample in the docs spells it `use_preconguration`. If live initiate returns 400, try the other spelling in `src/lib/novac/client.server.ts` and record it here.
- Stall account numbers in the catalog are fake. Replace them before a live split or payout.
- Do not collect card PANs in this app. Hosted checkout only, until the encryption guide is implemented on the server.
- Orders, basket, and the local event list live in `localStorage` (`playgrnd-market`). There is no login and no database. Do not add auth unless the product ask changes.
- Do not copy files out of the Supplya repositories into this one.
