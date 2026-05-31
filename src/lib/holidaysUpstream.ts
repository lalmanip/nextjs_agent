import { NextResponse } from "next/server";
import { API_BASE_URL_HOLIDAY } from "@/lib/config";

export async function proxyHolidays(
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const url = `${API_BASE_URL_HOLIDAY}/api/v1/holidays${path}`;

  try {
    const upstream = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Holiday service unreachable";
    return NextResponse.json(
      {
        error: `Holiday service unreachable at ${API_BASE_URL_HOLIDAY}: ${message}`,
      },
      { status: 502 },
    );
  }
}
