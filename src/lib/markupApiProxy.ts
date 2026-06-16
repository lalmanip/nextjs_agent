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

async function callUserApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ response: Response; text: string }> {
  const endpoint = `${API_BASE_URL_USER}${path.startsWith("/") ? path : `/${path}`}`;
  const token = await getServerDomainTokenCached();
  const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };

  const doCall = async (h: Record<string, string>) => {
    const response = await fetch(endpoint, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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

  return { response, text };
}

function jsonFromText(text: string, status: number) {
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }
  return NextResponse.json(parsed, { status });
}

export async function proxyMarkupGet(path: string) {
  const { response, text } = await callUserApi("GET", path);
  return jsonFromText(text, response.status);
}

export async function proxyMarkupPost(path: string, body: unknown) {
  const { response, text } = await callUserApi("POST", path, body);
  return jsonFromText(text, response.status);
}

export async function proxyMarkupPut(path: string, body: unknown) {
  const { response, text } = await callUserApi("PUT", path, body);
  return jsonFromText(text, response.status);
}

export async function proxyMarkupDelete(path: string) {
  const { response, text } = await callUserApi("DELETE", path);
  return jsonFromText(text, response.status);
}
