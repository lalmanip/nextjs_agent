import { NextRequest } from "next/server";
import { proxyCouponToUserApi } from "@/lib/couponApiProxy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return proxyCouponToUserApi("redeem", body);
  } catch (e) {
    return Response.json(
      { status: "failed", message: e instanceof Error ? e.message : "Invalid request" },
      { status: 400 },
    );
  }
}
