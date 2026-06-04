import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import {
  getServerDomainTokenCached,
  refreshServerDomainTokenCached,
} from "@/lib/serverTokenCache";
import { NextResponse } from "next/server";

const API_HEADERS = {
  "Content-Type": "application/json",
  "X-API-KEY": API_KEY,
};

type CouponPath = "validate" | "release" | "redeem";

export async function proxyCouponToUserApi(path: CouponPath, body: unknown) {
  const endpoint = `${API_BASE_URL_USER}/coupons/${path}`;
  const token = await getServerDomainTokenCached();
  const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };

  const doCall = async (h: Record<string, string>) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    const text = await response.text().catch(() => "");
    return { response, text };
  };

  let { response, text } = await doCall(headers);

  const expired =
    response.status === 401 ||
    /token\s*expired/i.test(text) ||
    /jwt\s*expired/i.test(text);

  if (expired) {
    const fresh = await refreshServerDomainTokenCached();
    ({ response, text } = await doCall({
      ...headers,
      Authorization: `Bearer ${fresh}`,
    }));
  }

  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }

  return NextResponse.json(parsed, { status: response.status });
}
