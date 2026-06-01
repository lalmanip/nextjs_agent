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
