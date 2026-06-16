import { NextResponse } from "next/server";
import { callUserWalletUpstream } from "@/lib/walletUpstream";

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } },
) {
  try {
    const userId = String(params.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    const result = await callUserWalletUpstream(
      "GET",
      userId,
      "/ledger",
      undefined,
      "B2B WALLET LEDGER",
    );
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error("[wallet/ledger] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch ledger" }, { status: 500 });
  }
}
