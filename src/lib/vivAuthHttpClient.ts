/**
 * Direct HTTP(S) to vivapi-auth from Next.js server routes.
 * Node's global `fetch` (undici) may honor HTTP_PROXY and return cached responses
 * without hitting localhost — use this for auth login/refresh from API routes.
 */
import http from "node:http";
import https from "node:https";

let warnedProxyEnvOnce = false;

export function warnIfGlobalFetchProxyEnvOnce(context: string): void {
  const hp = process.env.HTTP_PROXY || process.env.http_proxy;
  const hps = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!hp && !hps) return;
  if (warnedProxyEnvOnce) return;
  warnedProxyEnvOnce = true;
  console.warn(
    `[${context}] HTTP_PROXY/HTTPS_PROXY is set — undici fetch() can bypass real localhost. ` +
      `This path uses node:http instead. NO_PROXY=${process.env.NO_PROXY || process.env.no_proxy || "(unset)"}`,
  );
}

export function vivAuthHttpJson(params: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}): Promise<{ statusCode: number; rawBody: string; contentType: string | null }> {
  return new Promise((resolve, reject) => {
    const u = new URL(params.url);
    const isHttps = u.protocol === "https:";
    const lib = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const port = u.port ? Number(u.port) : defaultPort;
    const path = `${u.pathname || "/"}${u.search || ""}`;
    const payloadBytes = Buffer.byteLength(params.body, "utf8");
    const headersOut: Record<string, string> = {
      ...params.headers,
      "content-length": String(payloadBytes),
    };

    const req = lib.request(
      {
        hostname: u.hostname,
        port,
        path,
        method: params.method,
        headers: headersOut,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (ch) => {
          chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(ch));
        });
        res.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          resolve({
            statusCode: res.statusCode ?? 0,
            rawBody,
            contentType: (res.headers["content-type"] as string) ?? null,
          });
        });
      },
    );
    req.on("error", reject);
    req.write(params.body, "utf8");
    req.end();
  });
}
