import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer, VERSION } from "./server";
import { activeSources } from "./sources";
import type { Env } from "./types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

function withCors(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// Token from `Authorization: Bearer`, `X-API-Key` (claude.ai connectors), or `?token=`.
export function requestToken(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return req.headers.get("X-API-Key") ?? new URL(req.url).searchParams.get("token") ?? "";
}

function authorized(req: Request, env: Env): boolean {
  if (!env.MCP_AUTH_TOKEN) return true;
  return timingSafeEqual(requestToken(req), env.MCP_AUTH_TOKEN);
}

async function handleMcp(req: Request, env: Env): Promise<Response> {
  // Stateless mode: a fresh server + transport per request. No Durable Objects needed.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = createServer(env);
  await server.connect(transport);
  return transport.handleRequest(req);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/mcp") {
      if (!authorized(req, env)) return withCors(Response.json({ error: "unauthorized" }, { status: 401 }));
      if (req.method === "GET") {
        // No server-initiated stream in stateless mode.
        return withCors(new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } }));
      }
      try {
        return withCors(await handleMcp(req, env));
      } catch (err) {
        console.error("mcp error", err);
        return withCors(
          Response.json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }, { status: 500 }),
        );
      }
    }

    // No OAuth here. Answer discovery probes with a clean JSON 404 (with CORS) so clients
    // fall back to header auth instead of failing on a plain-text 404.
    if (url.pathname.startsWith("/.well-known/")) {
      return withCors(Response.json({ error: "not_found", auth: "Use Authorization: Bearer or X-API-Key" }, { status: 404 }));
    }

    if (url.pathname === "/health") return Response.json({ ok: true, version: VERSION });

    if (url.pathname === "/") {
      return Response.json({
        name: "paper-search-mcp-server",
        version: VERSION,
        mcp_endpoint: `${url.origin}/mcp`,
        transport: "streamable-http (stateless, JSON responses)",
        auth: env.MCP_AUTH_TOKEN ? "token required (Authorization: Bearer or X-API-Key)" : "none",
        sources: activeSources(env).map((s) => ({ id: s.id, name: s.name })),
      });
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
