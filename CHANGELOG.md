# Changelog

## 0.1.0 — 2026-11-01

Playgrnd exists as a Novac sandbox market. Supplya repositories were read, not modified, and none of their code or catalog was copied.

- Floor, three stalls, six goods, basket, and a single checkout that quotes a 4% platform remainder plus an 8% haulage flat and per-stall flats.
- Server proxy at `/api/novac/$action` for initiate, verify, splits, virtual accounts, banks, name enquiry, transfer, balance, full refund, partial refund, payment-link initiate, recurring initiate, and webhooks.
- Sandbox mode when `NOVAC_PUBLIC_KEY` / `NOVAC_SECRET_KEY` are missing, plus a force-sandbox switch. Simulator checkout does not collect card data.
- Lab benches and an atlas of Novac features that are wired, queued, or out of scope.
- Orders can verify and refund against the proxy.
- Agent contract in `SPEC.md`.
