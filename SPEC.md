# Playgrnd spec

Status: 0.1.0, 2026-11-01. Audience: the next agent. Product surface is a stall market. The contract for how it talks to Novac is this file plus `src/lib/novac/client.server.ts`.

## Why this repo exists

[playgrnd](https://github.com/joyadeniran/playgrnd) is a sandbox for APIs. This app uses it to see what [Novac](https://developer.novacpayment.com/docs/introduction/welcome-to-novac) could take on for a Nigerian multi-vendor market, without touching the live product.

Non-goals:

- Do not change, import, or vendor anything from Supplya repositories.
- Do not recreate Supplya’s wallet, BNPL loan book, KYC, banners, or admin.
- Do not put card numbers, PINs, or OTP entry in this UI.
- Do not add accounts or a database unless a later ask explicitly wants sign-in or shared durable orders.

## What Supplya is (read 2026-11-01, not modified)

The live product is a B2B marketplace for Nigerian retailers and vendors. It is split across private repos under `joyadeniran`. None of that code was copied.

| Repo | What it is | Last push seen |
| --- | --- | --- |
| `supplya-backend` | Express, Mongo, JWT. Production notes point at Azure and also Render. | 2026-09-30, branch `master` |
| `supplya-frontend` | React (Vite). README calls it a B2B store and lists a Paystack public key. | 2026-09-ish |
| `supplya-mobile` | Expo / React Native app. | 2026-09-29 |
| `Supplya-Corporate` | Marketing site. | 2026-06-26 |
| `SupplyaPay`, `supplya-pay`, `supplyapay-*` | Older payment-app experiments. Not the current market API. | early 2026 |

Backend README (resource map, not source): auth, users, products (25 routes), orders, vendors, wallet & BNPL (17 routes), withdrawals via models `Wallet` and `Withdrawal`, Anchor KYC (`/anchor`), Paystack named only on the web env example, Cloudinary, Termii SMS, webhooks at the root (not under `/api/v1`). Models include `Order`, `Payment`, `BNPLLoan`, `Store`.

So today a buyer pays (Paystack on the web, Anchor around wallet and KYC), vendors are paid out as withdrawals, and BNPL is its own loan model. Novac is being tested here as a possible replacement for **collection, split settlement, virtual accounts, payouts, refunds, and a light recurring charge** — not as a loan engine.

## Mapping

| Job in a market like Supplya | Today (observed, not copied) | Playgrnd bench | Novac |
| --- | --- | --- | --- |
| One buyer, many vendors | Orders | Basket checkout | `POST /api/v1/initiate` with split override |
| Vendor + logistics + platform | Manual withdrawal | Quote: flat splits, platform is the remainder | Split payment. Primary account keeps what is not split. |
| Wallet account number | Anchor | Lab → reserved virtual account | `POST /api/v1/virtual-account` `accountType: reserved` |
| One-off transfer invoice | — | Lab → checkout virtual account | `accountType: checkout`, `expiryInMinutes` |
| Pay a vendor | Withdrawal | Lab → payout | `POST /api/v1/banks/account/verify`, `POST /api/v1/transfers` |
| Take a payment back | — | Orders | `POST /api/v1/refund`, `POST /api/v1/partial-refund` |
| Share a payment link | — | Lab | Dashboard link, then `POST /api/v1/paymentlink/initiate` |
| Repeat charge (not a loan) | BNPL loan model — do not port | Lab recurring | NGN only, via a dashboard recurring link. `POST /api/v1/recurring/initiate`. Frequency is **not** an API field. |
| Know it was paid | Webhooks | `/callback` verify + `/api/novac/webhook` | Verify `GET /api/v1/checkout/{ref}/verify`. Webhook `notify` / `notifyType`. |

## Product rules already in the UI

- Stalls: Irepantry (Ikeja), Creek & Kernel (Apapa), Lagoon Smoke (Makoko). Goods and prices are in `src/lib/market/catalog.ts`.
- View-as switch (Buyer Teni, Stall Adaeze, Desk) is local only. It is not authentication.
- Quote (`src/lib/market/money.ts`): platform 4% stays on the primary account. Haulage 8% is a flat split. Each stall gets a flat equal to its share of the remainder. Last stall absorbs rounding so the parts sum to the basket.
- Checkout reference is at least 16 characters. Payout reference is at least 10 and at most 32.
- Rails offered: `CARD`, `PWBT` (bank transfer), `USSD`, `OPAY`, `PALMPAY`.
- Sandbox checkout redirects to `/sandbox-pay`. That page posts an outcome, writes a fake webhook, then sends the browser to `/callback?reference&status`.
- With keys and force-sandbox off, checkout redirects to Novac’s `paymentRedirectUrl`. Callback must be this app’s `/callback`.

## Server adapter

File: `src/lib/novac/client.server.ts`. Route: `src/routes/api/novac/$action.ts`.

Base URL: `https://api.novacpayment.com`. Auth header: `Authorization: Bearer <key>`. Public key for initiate endpoints. Secret key for everything else in this file.

| Action | Method | Novac | Key |
| --- | --- | --- | --- |
| `status` | GET | none | — |
| `checkout` | POST | `POST /api/v1/initiate` | public |
| `verify` | POST | `GET /api/v1/checkout/{reference}/verify` | secret |
| `splits` | POST | `POST /api/v1/split-payment` body is an **array** | secret |
| `splits` | GET | `GET /api/v1/split-payment` | secret |
| `virtual-account` | POST | `POST /api/v1/virtual-account` | secret |
| `banks` | GET | `GET /api/v1/banks/{country}` country `NG` | secret |
| `verify-account` | POST | `POST /api/v1/banks/account/verify` fields `account_number`, `bank_code`, `currency` | secret |
| `payout` | POST | `POST /api/v1/transfers` | secret |
| `balance` | GET | `GET /api/v1/balance/NGN` | secret |
| `refund` | POST | `POST /api/v1/refund` `{ reference, customer_note, merchant_note }` | secret |
| `partial-refund` | POST | `POST /api/v1/partial-refund` adds `amount` | secret |
| `payment-link` | POST | `POST /api/v1/paymentlink/initiate` | public |
| `recurring` | POST | `POST /api/v1/recurring/initiate` | public |
| `webhook` | POST | inbound from Novac | none |
| `sandbox-outcome` | POST | none | none |

Client passes `simulate: true` to force sandbox. GET flags travel as query `simulate=1`.

Every response is `{ ok, mode, novac, request, response, message? }`. `ok` is false when HTTP fails or the JSON has `status: false` or `success: false`. Secret-shaped strings (`nc_…sk_…`) are redacted before the body is returned. Do not log keys.

Sandbox state (transactions, splits, webhook ring) is an in-memory `globalThis` map. It dies on a new instance. The browser store is the durable copy for a single device.

### Doc conflicts to respect

- Split override: send `splitPaymentTransactionInfo.use_preconfiguration` (OpenAPI). A guide curl uses `use_preconguration`. Change the adapter only after a live 400, and note the winner in README and CHANGELOG.
- Marketplace use-case page shows `POST /api/v1/checkout` with `splitPayment: true`. The initiate guide, which has the real body, is `POST /api/v1/initiate`. This app follows initiate.
- Refund OpenAPI returns the refund object itself, not `{ status, data }`. The UI treats HTTP 2xx without `status: false` as success.
- Webhook samples show no signature header. Do not invent HMAC verification. If Novac later documents a signature, verify it in the webhook action before trusting `notifyType`.
- Amount unit is assumed to be naira, not kobo. Prove it with one live charge.

### Test cards

Novac publishes these for **their** checkout. Success `5555555555554444`, expiry `12/30`, CVC `123`, PIN `1234`. Decline `1234567898765432`. OTP any 6 digits. The atlas may display them. No form in this app may submit them.

## Backlog (do in this order)

1. Put test keys in the host env and run one ₦100 checkout with force-sandbox off. Record whether amount `100` charges ₦100 or ₦1.00. Update this spec.
2. Replace catalog account numbers with real test accounts after name enquiry succeeds. Save returned `split_payment_reference` values; they are required on later checkouts.
3. Confirm the split boolean spelling against that same charge.
4. If webhook delivery works, stop trusting the redirect status alone. Fulfil only when verify says `successful`.
5. Bills bench: airtime, data, electricity. Read `docs/make-payment/bills/*` first. Keep it in the lab, not on the floor.
6. Custom checkout rails (USSD, OPay, PalmPay complete-payment endpoints) only behind the server. Still no PAN fields.
7. Direct card charge is last and only with `docs/api-basics/encryption.md` implemented server-side.
8. Mobile money (GHS, KES) and GBP open banking are out of scope until someone asks.
9. Persistence: if orders must survive a new browser, add unowned rows only after an explicit ask. Do not bolt on login “while you are there”.
10. Do not merge this into `supplya-backend` until the mapping table above is accepted. A port would be a new payment service, not a paste.

## File map

| Path | Owns |
| --- | --- |
| `src/lib/market/catalog.ts` | Stalls, goods, fake settlement accounts |
| `src/lib/market/money.ts` | Naira format and the split quote |
| `src/lib/market/store.ts` | `localStorage` basket, orders, split refs, events |
| `src/lib/novac/client.server.ts` | The only module allowed to call Novac |
| `src/lib/novac/browser.ts` | Browser → proxy |
| `src/routes/index.tsx` | Floor |
| `src/routes/stall.$slug.tsx` | One stall |
| `src/routes/cart.tsx` | Basket and quote |
| `src/routes/checkout.tsx` | Initiate |
| `src/routes/sandbox-pay.tsx` | Simulator |
| `src/routes/callback.tsx` | Verify after return |
| `src/routes/orders.tsx` | Verify and refund |
| `src/routes/lab.tsx` | Benches |
| `public/goods/*` | Generated still-life photos, not Supplya assets |

Visual system: ink `#14120e`, paper `#f4efe6`, brass `#d6a15a`, moss for success, rust for failure. Fraunces + Outfit. Do not introduce a second palette.
