import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import {
  getServerDomainTokenCached,
  refreshServerDomainTokenCached,
} from "@/lib/serverTokenCache";

const ALLOWED_TYPES = new Set(["ADDRESS_PROOF", "PAN", "GST"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const userIdRaw = form.get("userId");
    const documentType = String(form.get("documentType") ?? "").trim().toUpperCase();
    const file = form.get("file");

    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ status: "failed", message: "userId is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(documentType)) {
      return NextResponse.json(
        { status: "failed", message: "documentType must be ADDRESS_PROOF, PAN, or GST" },
        { status: 400 },
      );
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ status: "failed", message: "file is required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { status: "failed", message: "File exceeds maximum size of 5 MB" },
        { status: 400 },
      );
    }

    const upstream = new FormData();
    upstream.append("userId", String(userId));
    upstream.append("documentType", documentType);
    upstream.append("file", file, file.name);

    const endpoint = `${API_BASE_URL_USER}/user/agent/documents/upload`;
    const token = await getServerDomainTokenCached();
    const headers = { "X-API-KEY": API_KEY, Authorization: `Bearer ${token}` };

    const doCall = async (h: Record<string, string>) =>
      fetch(endpoint, { method: "POST", headers: h, body: upstream });

    let response = await doCall(headers);
    let text = await response.text().catch(() => "");

    const expired =
      response.status === 401 ||
      /token\s*expired/i.test(text) ||
      /jwt\s*expired/i.test(text);

    if (expired) {
      const fresh = await refreshServerDomainTokenCached();
      response = await doCall({ ...headers, Authorization: `Bearer ${fresh}` });
      text = await response.text().catch(() => "");
    }

    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { status: "failed", message: text };
    }

    return NextResponse.json(parsed, { status: response.status });
  } catch (e) {
    return NextResponse.json(
      { status: "failed", message: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    );
  }
}
