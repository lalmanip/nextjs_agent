import { NextRequest, NextResponse } from "next/server";
import { callUserWalletUpstream } from "@/lib/walletUpstream";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } },
) {
  try {
    const userId = String(params.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    const body = await request.json();
    const result = await callUserWalletUpstream(
      "POST",
      userId,
      "/debit",
      body,
      "B2B WALLET DEBIT",
    );
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error("[wallet/debit] POST failed:", error);
    return NextResponse.json({ error: "Failed to debit wallet" }, { status: 500 });
  }
}
