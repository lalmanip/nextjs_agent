import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body?.email ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const requestType = String(body?.requestType ?? "").trim();
    const otp = String(body?.otp ?? body?.Otp ?? body?.OTP ?? "").trim();

    if (!email || !phone || !requestType || !otp) {
      return NextResponse.json(
        { error: "email, phone, requestType, and otp are required" },
        { status: 400 },
      );
    }

    const backendEndpoint = `${API_BASE_URL_USER}/user/VerifyOTP`;
    const requestBody = {
      email,
      phone,
      requestType,
      otp,
      Otp: otp,
      OTP: otp,
    };

    console.log("\n========== VERIFY OTP ==========");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Backend URL:", backendEndpoint);
    console.log("Body:", { email, phone: phone ? `…${phone.slice(-4)}` : "", requestType });

    const start = Date.now();
    const res = await fetch(backendEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify(requestBody),
    });
    const durationMs = Date.now() - start;
    const text = await res.text().catch(() => "");

    console.log("[verify-otp] Response:", {
      status: res.status,
      ok: res.ok,
      durationMs,
      bodyPreview: text.slice(0, 800),
    });

    const data = text ? JSON.parse(text) : null;
    return NextResponse.json(data ?? { error: `HTTP ${res.status}` }, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
