export type AgentWallet = {
  balance: number;
  availableToBook: number;
  dueAmount: number;
};

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (val != null && val !== "") {
      const n = Number(val);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

/** Normalize wallet fields from vivapi-user b2b wallet response. */
export function parseAgentWallet(data: unknown): AgentWallet | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const payload =
    root.response && typeof root.response === "object"
      ? (root.response as Record<string, unknown>)
      : root;

  const balance = pickNumber(payload, ["balance", "Balance", "walletBalance", "WalletBalance"]);
  const availableToBook = pickNumber(payload, [
    "availableToBook",
    "AvailableToBook",
    "available_to_book",
    "Available_To_Book",
  ]);
  const dueAmount = pickNumber(payload, ["dueAmount", "DueAmount", "due_amount", "Due_Amount"]);

  if (balance == null && availableToBook == null && dueAmount == null) return null;

  return {
    balance: balance ?? 0,
    availableToBook: availableToBook ?? 0,
    dueAmount: dueAmount ?? 0,
  };
}

export function formatWalletAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function fetchAgentWallet(userId: number | string): Promise<AgentWallet | null> {
  const res = await fetch(`/api/user/wallet/${encodeURIComponent(String(userId))}`, {
    method: "GET",
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error("[fetchAgentWallet] Invalid JSON:", text.slice(0, 200));
    return null;
  }
  if (!res.ok) {
    console.error("[fetchAgentWallet] HTTP", res.status, data);
    return null;
  }
  return parseAgentWallet(data);
}

export type WalletLedgerEntry = {
  id: number;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  dueAmountAfter: number;
  creditLimitAfter: number;
  idempotencyKey: string | null;
  appReference: string | null;
  description: string | null;
  createdDatetime: string;
};

export type WalletRequestResponse = {
  status?: string;
  message?: string;
  response?: {
    id: number;
    status: string;
    amount: number;
    requestType?: string;
  };
};

function makeIdempotencyKey(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Date.now()).slice(-6);
  return `${prefix}-${date}-${seq}`;
}

async function postWalletAction(
  userId: number | string,
  path: string,
  body: Record<string, unknown>,
): Promise<WalletRequestResponse> {
  const res = await fetch(`/api/user/wallet/${encodeURIComponent(String(userId))}/${path}`, {
    method: path === "credit-limit" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }
  return data as WalletRequestResponse;
}

export async function submitTopupRequest(
  userId: number | string,
  performedByUserId: number | string,
  amount: number,
  description: string,
) {
  return postWalletAction(userId, "topup", {
    amount,
    idempotencyKey: makeIdempotencyKey("topup"),
    appReference: null,
    description,
    performedByUserId: Number(performedByUserId),
  });
}

export async function submitSettlementRequest(
  userId: number | string,
  performedByUserId: number | string,
  amount: number,
  description: string,
) {
  return postWalletAction(userId, "settle", {
    amount,
    idempotencyKey: makeIdempotencyKey("settle"),
    description,
    performedByUserId: Number(performedByUserId),
  });
}

export async function submitCreditLimitRequest(
  userId: number | string,
  performedByUserId: number | string,
  creditLimit: number,
  description: string,
) {
  return postWalletAction(userId, "credit-limit", {
    creditLimit,
    description,
    performedByUserId: Number(performedByUserId),
  });
}

export async function fetchWalletLedger(userId: number | string): Promise<WalletLedgerEntry[]> {
  const res = await fetch(`/api/user/wallet/${encodeURIComponent(String(userId))}/ledger`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Failed to load ledger (${res.status})`);
  }
  const rows = (data as { response?: unknown })?.response;
  if (!Array.isArray(rows)) return [];
  return rows.map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    transactionType: String(row.transactionType ?? ""),
    amount: Number(row.amount ?? 0),
    balanceAfter: Number(row.balanceAfter ?? 0),
    dueAmountAfter: Number(row.dueAmountAfter ?? 0),
    creditLimitAfter: Number(row.creditLimitAfter ?? 0),
    idempotencyKey: row.idempotencyKey != null ? String(row.idempotencyKey) : null,
    appReference: row.appReference != null ? String(row.appReference) : null,
    description: row.description != null ? String(row.description) : null,
    createdDatetime: String(row.createdDatetime ?? ""),
  }));
}

export function formatWalletDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
