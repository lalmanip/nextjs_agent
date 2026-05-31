import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const body = await request.json().catch(() => ({}));
    const resultToken = body?.ResultToken || body?.resultToken;

    if (!authHeader || !resultToken) {
      return NextResponse.json({ error: "Missing authorization or ResultToken" }, { status: 400 });
    }

    const url = `${API_BASE_URL_USER}/flight-booking/hold-fee`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
        Authorization: authHeader,
      },
      body: JSON.stringify({ ResultToken: resultToken }),
    });

    const text = await resp.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return NextResponse.json(data ?? {}, { status: resp.status });
  } catch (e) {
    console.error("[hold-fee] Error:", e);
    return NextResponse.json({ error: "Failed to fetch hold fee" }, { status: 500 });
  }
}

