import { RAILS, type ProxyMode, type ProxyResult, type Rail } from "./types";

const BASE = "https://api.novacpayment.com";

type SimTxn = {
  reference: string;
  amount: number;
  status: string;
  channel?: string;
  currency: string;
  email?: string;
};

type SimSplit = {
  split_name: string;
  split_payment_reference: string;
  split_type: string;
  split_value: number;
  bank_code: string;
  account_number: string;
};

const memory = globalThis as typeof globalThis & {
  __playgrndTxns?: Map<string, SimTxn>;
  __playgrndSplits?: Map<string, SimSplit>;
  __playgrndHooks?: unknown[];
};

function txns() {
  memory.__playgrndTxns ??= new Map();
  return memory.__playgrndTxns;
}
function splits() {
  memory.__playgrndSplits ??= new Map();
  return memory.__playgrndSplits;
}
function hooks() {
  memory.__playgrndHooks ??= [];
  return memory.__playgrndHooks;
}

function keys() {
  const publicKey = process.env.NOVAC_PUBLIC_KEY?.trim() || "";
  const secretKey = process.env.NOVAC_SECRET_KEY?.trim() || "";
  return { publicKey, secretKey };
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/nc_[a-z0-9]*sk_[a-z0-9]+/gi, "nc_***sk_redacted");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redact(entry);
    }
    return out;
  }
  return value;
}

function json(body: ProxyResult, status = 200): Response {
  return new Response(JSON.stringify(redact(body)), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function envelope(
  mode: ProxyMode,
  method: string,
  path: string,
  request: unknown,
  response: unknown,
  ok: boolean,
  httpStatus?: number,
  message?: string,
): ProxyResult {
  return {
    ok,
    mode,
    novac: { method, path, status: httpStatus },
    request: redact(request),
    response: redact(response),
    message,
  };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const fromQuery: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    fromQuery[key] = key === "simulate" ? value === "1" : value;
  });
  if (request.method === "GET" || request.method === "HEAD") return fromQuery;
  const text = await request.text();
  if (!text) return fromQuery;
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON object expected");
  }
  return { ...(parsed as Record<string, unknown>), ...fromQuery };
}

function wantsSandbox(body: Record<string, unknown>, key: string): boolean {
  return body.simulate === true || !key;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function originOf(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const url = new URL(request.url);
  return url.origin;
}

function railsOf(value: unknown): string {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : RAILS;
  const picked = raw
    .map((item) => String(item).trim().toUpperCase())
    .filter((item): item is Rail => (RAILS as readonly string[]).includes(item));
  return (picked.length ? picked : [...RAILS]).join(",");
}

async function novacCall(
  method: string,
  path: string,
  key: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let parsed: unknown = { raw: text };
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text.slice(0, 2000) };
    }
  }
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const flagged =
    record != null &&
    (("status" in record && record.status === false) || ("success" in record && record.success === false));
  return { ok: response.ok && !flagged, status: response.status, json: parsed };
}

function customerOf(body: Record<string, unknown>) {
  const customer =
    body.customer && typeof body.customer === "object"
      ? (body.customer as Record<string, unknown>)
      : {};
  return {
    email: asString(customer.email || body.email),
    firstName: asString(customer.firstName || body.firstName, "Teni"),
    lastName: asString(customer.lastName || body.lastName, "Adebayo"),
    phoneNumber: asString(customer.phoneNumber || body.phoneNumber),
  };
}

function checkoutPayload(body: Record<string, unknown>, request: Request, reference: string) {
  const amount = asNumber(body.amount);
  const customer = customerOf(body);
  const splitRows = Array.isArray(body.splits) ? body.splits : [];
  const payload: Record<string, unknown> = {
    transactionReference: reference,
    amount,
    currency: "NGN",
    metaData: JSON.stringify({ source: "playgrnd" }),
    redirectUrl: `${originOf(request)}/callback`,
    allowedPaymentOptions: railsOf(body.rails),
    checkoutCustomerData: customer,
    checkoutCustomizationData: {
      logoUrl: "",
      paymentDescription: asString(body.description, "Playgrnd market order"),
      checkoutModalTitle: "Playgrnd",
    },
  };
  if (splitRows.length) {
    payload.splitPaymentTransactionInfo = {
      use_preconfiguration: false,
      splitDetails: splitRows.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          split_reference_code: asString(item.split_reference_code),
          split_type: "flat",
          split_value: asNumber(item.split_value),
        };
      }),
    };
  }
  return { amount, customer, payload };
}

export async function handleNovac(request: Request): Promise<Response> {
  const action = new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "";
  let body: Record<string, unknown> = {};
  try {
    body = await readBody(request);
  } catch {
    return json(
      envelope("sandbox", request.method, action, null, null, false, 400, "Request body must be a JSON object"),
      400,
    );
  }

  try {
    if (action === "status" && request.method === "GET") return statusResult();
    if (action === "webhook" && request.method === "GET") return webhookList();
    if (action === "webhook" && request.method === "POST") return webhookIn(body);
    if (request.method !== "POST" && action !== "banks" && action !== "balance" && action !== "splits") {
      return json(envelope("sandbox", request.method, `/${action}`, body, null, false, 405, "Method not allowed"), 405);
    }
    switch (action) {
      case "checkout":
        return await checkout(body, request);
      case "verify":
        return await verify(body);
      case "splits":
        return request.method === "GET" ? await listSplits(body) : await createSplits(body);
      case "virtual-account":
        return await virtualAccount(body);
      case "banks":
        return await banks(body);
      case "verify-account":
        return await verifyAccount(body);
      case "payout":
        return await payout(body);
      case "balance":
        return await balance(body);
      case "refund":
        return await refund(body, false);
      case "partial-refund":
        return await refund(body, true);
      case "payment-link":
        return await paymentLink(body, request);
      case "recurring":
        return await recurring(body, request);
      case "sandbox-outcome":
        return sandboxOutcome(body);
      default:
        return json(envelope("sandbox", request.method, `/${action}`, body, null, false, 404, "Unknown bench"), 404);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Novac call failed";
    return json(envelope("novac", request.method, `/${action}`, body, null, false, 502, message), 502);
  }
}

function statusResult(): Response {
  const { publicKey, secretKey } = keys();
  return json(
    envelope("sandbox", "GET", "/status", null, {
      publicKey: Boolean(publicKey),
      secretKey: Boolean(secretKey),
      baseUrl: BASE,
      note: publicKey || secretKey
        ? "Keys are present on the server. Benches call Novac unless Force sandbox is on."
        : "No Novac keys on the server. Every bench is a labeled simulator.",
    }, true),
  );
}

function webhookList(): Response {
  return json(envelope("sandbox", "GET", "/api/novac/webhook", null, hooks().slice(0, 30), true));
}

function webhookIn(body: Record<string, unknown>): Response {
  const event = { receivedAt: new Date().toISOString(), body };
  hooks().unshift(event);
  hooks().splice(30);
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  const reference = asString(data.transactionReference || data.reference);
  const status = asString(data.status || body.notifyType);
  if (reference && status) {
    const current = txns().get(reference);
    txns().set(reference, {
      reference,
      amount: current?.amount ?? (asNumber(data.amount) || 0),
      status,
      channel: asString(data.channel, current?.channel),
      currency: asString(data.currency, "NGN"),
      email: current?.email,
    });
  }
  return json(envelope("sandbox", "POST", "/api/novac/webhook", body, { received: true }, true));
}

async function checkout(body: Record<string, unknown>, request: Request): Promise<Response> {
  const reference = asString(body.reference);
  const amount = asNumber(body.amount);
  if (reference.length < 16) {
    return json(envelope("sandbox", "POST", "/api/v1/initiate", body, null, false, 400, "Reference must be at least 16 characters"), 400);
  }
  if (!(amount > 0)) {
    return json(envelope("sandbox", "POST", "/api/v1/initiate", body, null, false, 400, "Amount must be greater than 0"), 400);
  }
  const { publicKey } = keys();
  const { customer, payload } = checkoutPayload(body, request, reference);
  const path = "/api/v1/initiate";
  if (wantsSandbox(body, publicKey)) {
    txns().set(reference, { reference, amount, status: "pending", currency: "NGN", email: customer.email });
    const response = {
      status: true,
      message: "Transaction Initialized successfully",
      data: {
        transactionReference: reference,
        amount,
        statusCode: "01",
        statusMessage: "Transaction initiated successfully",
        paymentRedirectUrl: `${originOf(request)}/sandbox-pay?reference=${encodeURIComponent(reference)}`,
        collectionPaymentOptions: railsOf(body.rails),
        simulated: true,
      },
    };
    return json(envelope("sandbox", "POST", path, payload, response, true));
  }
  const result = await novacCall("POST", path, publicKey, payload);
  return json(envelope("novac", "POST", path, payload, result.json, result.ok, result.status));
}

async function verify(body: Record<string, unknown>): Promise<Response> {
  const reference = asString(body.reference);
  if (reference.length < 10) {
    return json(envelope("sandbox", "GET", "/api/v1/checkout/{ref}/verify", body, null, false, 400, "Reference is missing"), 400);
  }
  const path = `/api/v1/checkout/${encodeURIComponent(reference)}/verify`;
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    const txn = txns().get(reference);
    const response = {
      status: true,
      message: txn ? "Transaction retrieved" : "No sandbox transaction for that reference yet",
      data: {
        transactionReference: reference,
        amount: txn?.amount ?? 0,
        status: txn?.status ?? "pending",
        currency: "NGN",
        channel: txn?.channel ?? "",
        gatewayResponseCode: txn?.status === "successful" ? "00" : "",
        simulated: true,
      },
    };
    return json(envelope("sandbox", "GET", path, { reference }, response, Boolean(txn)));
  }
  const result = await novacCall("GET", path, secretKey);
  return json(envelope("novac", "GET", path, { reference }, result.json, result.ok, result.status));
}

async function createSplits(body: Record<string, unknown>): Promise<Response> {
  const rows = Array.isArray(body.accounts) ? body.accounts : [];
  const payload = rows.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      split_name: asString(item.split_name),
      bank_code: asString(item.bank_code),
      account_number: asString(item.account_number),
      split_type: "flat",
      split_value: asNumber(item.split_value),
    };
  });
  if (!payload.length || payload.some((row) => !row.split_name || !row.account_number || !(row.split_value > 0))) {
    return json(envelope("sandbox", "POST", "/api/v1/split-payment", payload, null, false, 400, "Each split needs a name, account, and amount"), 400);
  }
  const path = "/api/v1/split-payment";
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    const data = payload.map((row) => {
      const saved: SimSplit = {
        ...row,
        split_payment_reference: `31${row.split_name.toUpperCase()}SPLIT${row.bank_code}${row.account_number}`.slice(0, 48),
      };
      splits().set(row.split_name, saved);
      return saved;
    });
    return json(
      envelope("sandbox", "POST", path, payload, { status: true, message: "Split Settings saved successfully", data, simulated: true }, true),
    );
  }
  const result = await novacCall("POST", path, secretKey, payload);
  return json(envelope("novac", "POST", path, payload, result.json, result.ok, result.status));
}

async function listSplits(body: Record<string, unknown>): Promise<Response> {
  const path = "/api/v1/split-payment";
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    return json(
      envelope("sandbox", "GET", path, null, { status: true, data: [...splits().values()], simulated: true }, true),
    );
  }
  const result = await novacCall("GET", path, secretKey);
  return json(envelope("novac", "GET", path, null, result.json, result.ok, result.status));
}

async function virtualAccount(body: Record<string, unknown>): Promise<Response> {
  const accountType = asString(body.accountType, "reserved");
  const reference = asString(body.reference);
  const payload = {
    reference,
    amount: accountType === "reserved" ? 0 : asNumber(body.amount),
    accountType,
    accountName: asString(body.accountName),
    bankCode: asString(body.bankCode, "000036"),
    firstName: asString(body.firstName),
    lastName: asString(body.lastName),
    customerEmail: asString(body.customerEmail),
    expiryInMinutes: accountType === "checkout" ? asNumber(body.expiryInMinutes) || 30 : undefined,
  };
  if (reference.length < 10 || !payload.accountName) {
    return json(envelope("sandbox", "POST", "/api/v1/virtual-account", payload, null, false, 400, "Account name and reference are required"), 400);
  }
  const path = "/api/v1/virtual-account";
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    const response = {
      status: true,
      message: "Virtual account generated",
      data: {
        accountNumber: `90${String(Date.now()).slice(-8)}`,
        accountName: payload.accountName,
        bankCode: payload.bankCode,
        bankName: "Test NOVAC VA",
        accountType,
        accountStatus: "active",
        expiryInMinutes: payload.expiryInMinutes ?? 0,
        reference,
        requestedAmount: payload.amount,
        expectedAmount: payload.amount,
        simulated: true,
      },
    };
    return json(envelope("sandbox", "POST", path, payload, response, true));
  }
  const result = await novacCall("POST", path, secretKey, payload);
  return json(envelope("novac", "POST", path, payload, result.json, result.ok, result.status));
}

async function banks(body: Record<string, unknown>): Promise<Response> {
  const country = asString(body.country, "NG").toUpperCase();
  const path = `/api/v1/banks/${encodeURIComponent(country)}`;
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    return json(
      envelope("sandbox", "GET", path, { country }, {
        status: true,
        data: [
          { code: "000013", name: "Harbor Bank" },
          { code: "000014", name: "Creek MFB" },
          { code: "000036", name: "Optimus Bank" },
        ],
        simulated: true,
      }, true),
    );
  }
  const result = await novacCall("GET", path, secretKey);
  return json(envelope("novac", "GET", path, { country }, result.json, result.ok, result.status));
}

async function verifyAccount(body: Record<string, unknown>): Promise<Response> {
  const payload = {
    account_number: asString(body.account_number),
    bank_code: asString(body.bank_code),
    currency: "NGN",
  };
  const path = "/api/v1/banks/account/verify";
  if (payload.account_number.length < 10 || !payload.bank_code) {
    return json(envelope("sandbox", "POST", path, payload, null, false, 400, "Account number and bank code are required"), 400);
  }
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    const response = {
      success: true,
      message: "Account name retrieved",
      data: "PLAYGRND SANDBOX ACCOUNT",
      simulated: true,
    };
    return json(envelope("sandbox", "POST", path, payload, response, true));
  }
  const result = await novacCall("POST", path, secretKey, payload);
  return json(envelope("novac", "POST", path, payload, result.json, result.ok, result.status));
}

async function payout(body: Record<string, unknown>): Promise<Response> {
  const reference = asString(body.reference);
  const payload = {
    currency: "NGN",
    amount: asNumber(body.amount),
    bankCode: asString(body.bankCode),
    bankName: asString(body.bankName),
    accountNumber: asString(body.accountNumber),
    accountName: asString(body.accountName),
    narration: asString(body.narration, "Playgrnd stall payout"),
    reference,
  };
  const path = "/api/v1/transfers";
  if (reference.length < 10 || !(payload.amount > 0) || payload.accountNumber.length < 10) {
    return json(envelope("sandbox", "POST", path, payload, null, false, 400, "Amount, account, and a reference of at least 10 characters are required"), 400);
  }
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    const response = {
      success: true,
      message: "Transfer successfully logged and Processing",
      data: { ...payload, fee: 0, domain: "test", status: "pending", simulated: true },
    };
    return json(envelope("sandbox", "POST", path, payload, response, true));
  }
  const result = await novacCall("POST", path, secretKey, payload);
  return json(envelope("novac", "POST", path, payload, result.json, result.ok, result.status));
}

async function balance(body: Record<string, unknown>): Promise<Response> {
  const path = "/api/v1/balance/NGN";
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    return json(
      envelope("sandbox", "GET", path, null, {
        status: true,
        data: { currency: "NGN", available: 250000, simulated: true },
        message: "Sandbox balance is fictional",
      }, true),
    );
  }
  const result = await novacCall("GET", path, secretKey);
  return json(envelope("novac", "GET", path, null, result.json, result.ok, result.status));
}

async function refund(body: Record<string, unknown>, partial: boolean): Promise<Response> {
  const reference = asString(body.reference);
  const path = partial ? "/api/v1/partial-refund" : "/api/v1/refund";
  const payload: Record<string, unknown> = {
    reference,
    customer_note: asString(body.customer_note, "Playgrnd sandbox refund"),
    merchant_note: asString(body.merchant_note, "Stall market test"),
  };
  if (partial) payload.amount = asNumber(body.amount);
  if (!reference || (partial && !(asNumber(body.amount) > 0))) {
    return json(envelope("sandbox", "POST", path, payload, null, false, 400, "Refund reference and amount are required"), 400);
  }
  const { secretKey } = keys();
  if (wantsSandbox(body, secretKey)) {
    const txn = txns().get(reference);
    if (txn && !partial) txn.status = "reversed";
    const response = {
      refundReference: `RF${reference}`.slice(0, 40),
      amount: String(partial ? payload.amount : txn?.amount ?? 0),
      currency: "NGN",
      status: "successful",
      transactionReference: reference,
      simulated: true,
    };
    return json(envelope("sandbox", "POST", path, payload, response, true));
  }
  const result = await novacCall("POST", path, secretKey, payload);
  return json(envelope("novac", "POST", path, payload, result.json, result.ok, result.status));
}

async function paymentLink(body: Record<string, unknown>, request: Request): Promise<Response> {
  const paymentLinkReference = asString(body.paymentLinkReference);
  const amount = asNumber(body.amount);
  const referenceHint = asString(body.reference);
  const path = "/api/v1/paymentlink/initiate";
  const payload = {
    paymentLinkReference,
    amount,
    currency: "NGN",
    metaData: JSON.stringify({ source: "playgrnd" }),
    redirectUrl: `${originOf(request)}/callback`,
    allowedPaymentOptions: railsOf(body.rails),
    checkoutCustomerData: customerOf(body),
    checkoutCustomizationData: {
      logoUrl: "",
      paymentDescription: "Playgrnd payment link",
      checkoutModalTitle: "Playgrnd",
    },
  };
  if (!paymentLinkReference || !(amount > 0)) {
    return json(envelope("sandbox", "POST", path, payload, null, false, 400, "Payment link reference and amount are required"), 400);
  }
  const { publicKey } = keys();
  if (wantsSandbox(body, publicKey)) {
    const reference = referenceHint.length >= 16 ? referenceHint : `PGLINK${Date.now()}`.slice(0, 24);
    txns().set(reference, { reference, amount, status: "pending", currency: "NGN", email: payload.checkoutCustomerData.email });
    return json(
      envelope("sandbox", "POST", path, payload, {
        status: true,
        message: "Transaction initialized successfully",
        data: {
          transactionReference: reference,
          amount,
          paymentRedirectUrl: `${originOf(request)}/sandbox-pay?reference=${encodeURIComponent(reference)}`,
          simulated: true,
        },
      }, true),
    );
  }
  const result = await novacCall("POST", path, publicKey, payload);
  return json(envelope("novac", "POST", path, payload, result.json, result.ok, result.status));
}

async function recurring(body: Record<string, unknown>, request: Request): Promise<Response> {
  const paymentLinkReference = asString(body.paymentLinkReference);
  const amount = asNumber(body.amount);
  const path = "/api/v1/recurring/initiate";
  const payload = {
    paymentLinkReference,
    amount,
    metaData: JSON.stringify({ source: "playgrnd" }),
    allowedPaymentOptions: "CARD",
    redirectUrl: `${originOf(request)}/callback`,
    checkoutCustomerData: customerOf(body),
    checkoutCustomizationData: {
      logoUrl: "",
      paymentDescription: "Playgrnd recurring",
      checkoutModalTitle: "Playgrnd",
    },
  };
  if (!paymentLinkReference || !(amount > 0)) {
    return json(envelope("sandbox", "POST", path, payload, null, false, 400, "A dashboard payment-link reference and amount are required"), 400);
  }
  const { publicKey } = keys();
  if (wantsSandbox(body, publicKey)) {
    const reference = `NVSUB${Date.now()}`;
    return json(
      envelope("sandbox", "POST", path, payload, {
        status: true,
        message: "Transaction Initialized successfully",
        data: {
          transactionReference: reference,
          amount,
          collectionPaymentOptions: "CARD",
          paymentRedirectUrl: `${originOf(request)}/sandbox-pay?reference=${encodeURIComponent(reference)}`,
          simulated: true,
          note: "Frequency is set on the Novac dashboard link, not in this request.",
        },
      }, true),
    );
  }
  const result = await novacCall("POST", path, publicKey, payload);
  return json(envelope("novac", "POST", path, payload, result.json, result.ok, result.status));
}

function sandboxOutcome(body: Record<string, unknown>): Response {
  const reference = asString(body.reference);
  const status = asString(body.status, "successful");
  const channel = asString(body.channel, "card");
  const txn = txns().get(reference);
  if (!txn) {
    return json(envelope("sandbox", "POST", "/sandbox-outcome", body, null, false, 404, "Unknown sandbox reference"), 404);
  }
  txn.status = status;
  txn.channel = channel;
  const hook = {
    notify: "transaction",
    notifyType: status,
    data: {
      transactionReference: reference,
      amount: txn.amount,
      chargedAmount: txn.amount,
      currency: "NGN",
      status,
      channel,
      customer: { email: txn.email ?? "", name: "Playgrnd buyer" },
    },
  };
  hooks().unshift({ receivedAt: new Date().toISOString(), body: hook, simulated: true });
  return json(envelope("sandbox", "POST", "/sandbox-outcome", body, hook, true));
}
