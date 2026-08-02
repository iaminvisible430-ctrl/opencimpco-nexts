import { createFileRoute } from "@tanstack/react-router";

/**
 * CORS proxy for generated apps.
 *
 * Previews run inside a sandboxed iframe with an opaque origin, so any app the
 * agent builds that talks to a third-party API is blocked by CORS. Apps call
 * `ocFetch(url, init)` (injected into the preview runtime) which routes through
 * this endpoint instead.
 *
 * Safety: https/http only, no private/loopback/metadata hosts, no cookies
 * forwarded, response size capped.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-api-key,accept",
  "access-control-max-age": "86400",
};

const BLOCKED_HOST =
  /^(localhost$|127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.internal$|.*\.local$)/i;

const MAX_BYTES = 4_000_000;

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

async function handle(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return bad("Missing ?url= parameter");

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return bad("Invalid target URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return bad("Only http(s) targets are allowed");
  }
  if (BLOCKED_HOST.test(parsed.hostname)) return bad("Target host is not allowed", 403);

  const headers = new Headers();
  for (const name of ["content-type", "authorization", "x-api-key", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("user-agent", "OpencimpcoCode-Proxy/1.0");

  const method = request.method.toUpperCase();
  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") body = await request.arrayBuffer();

  try {
    const upstream = await fetch(parsed.toString(), {
      method,
      headers,
      body,
      redirect: "follow",
    });
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return bad("Upstream response too large", 413);
    const out = new Headers(CORS);
    const type = upstream.headers.get("content-type");
    if (type) out.set("content-type", type);
    out.set("cache-control", "no-store");
    return new Response(buf, { status: upstream.status, headers: out });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Upstream request failed", 502);
  }
}

export const Route = createFileRoute("/api/public/proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
      PUT: async ({ request }) => handle(request),
      PATCH: async ({ request }) => handle(request),
      DELETE: async ({ request }) => handle(request),
    },
  },
});
