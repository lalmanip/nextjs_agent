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
      "/settle/request",
      body,
      "B2B WALLET SETTLEMENT",
    );
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error("[wallet/settle] POST failed:", error);
    return NextResponse.json({ error: "Failed to submit settlement request" }, { status: 500 });
  }
}
