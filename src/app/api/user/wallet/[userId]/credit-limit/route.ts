import { NextRequest, NextResponse } from "next/server";
import { callUserWalletUpstream } from "@/lib/walletUpstream";

export async function PUT(
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
      "PUT",
      userId,
      "/credit-limit",
      body,
      "B2B WALLET CREDIT LIMIT",
    );
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error("[wallet/credit-limit] PUT failed:", error);
    return NextResponse.json({ error: "Failed to submit credit limit request" }, { status: 500 });
  }
}
