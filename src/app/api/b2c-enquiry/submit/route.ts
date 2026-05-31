import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import { validateEmail, validateName, validatePhone } from "@/utils/validation";

const PURPOSE_VALUES = [
  "customer service",
  "business with us",
  "holidays packages",
] as const;

function normalizePurpose(raw: unknown): (typeof PURPOSE_VALUES)[number] | null {
  const p = String(raw ?? "").trim().toLowerCase();
  if (PURPOSE_VALUES.includes(p as (typeof PURPOSE_VALUES)[number])) {
    return p as (typeof PURPOSE_VALUES)[number];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const phoneRaw = String(body?.phone ?? "").trim();
    const place = String(body?.place ?? "").trim();
    const purpose = normalizePurpose(body?.purpose);
    const message = String(body?.message ?? "").trim();

    const errors: { field: string; message: string }[] = [];
    const nameErr = validateName(name, "Name");
    if (nameErr) errors.push({ field: "name", message: nameErr });
    const emailErr = validateEmail(email);
    if (emailErr) errors.push({ field: "email", message: emailErr });
    const phoneErr = validatePhone(phoneRaw);
    if (phoneErr) errors.push({ field: "phone", message: phoneErr });
    if (!place) errors.push({ field: "place", message: "Place / city is required" });
    if (!purpose) {
      errors.push({
        field: "purpose",
        message:
          'Purpose must be "customer service", "business with us", or "holidays packages"',
      });
    }
    if (!message) errors.push({ field: "message", message: "Message is required" });
    if (message.length > 2000) {
      errors.push({ field: "message", message: "Message must be 2000 characters or less" });
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const phoneDigits = phoneRaw.replace(/[\s\-()]/g, "");
    const phoneNum = Number(phoneDigits);
    if (!Number.isFinite(phoneNum)) {
      return NextResponse.json(
        { error: "Validation failed", errors: [{ field: "phone", message: "Invalid phone number" }] },
        { status: 400 },
      );
    }

    const payload = {
      name,
      email,
      phone: phoneNum,
      place,
      purpose,
      message,
    };

    const url = `${API_BASE_URL_USER}/b2c-enquiry/submit`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      console.error("[b2c-enquiry/submit] Backend error:", response.status, data);
      return NextResponse.json(
        {
          error:
            (data as { message?: string })?.message ||
            (data as { error?: string })?.error ||
            "Failed to submit enquiry",
          details: data,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[b2c-enquiry/submit] Exception:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
