import { ProxyEndpoint, RequestLog } from "../types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? "";
}

function renderBlock(label: string, value: unknown): string {
  return `<section><h3>${escapeHtml(label)}</h3><pre>${escapeHtml(formatValue(value))}</pre></section>`;
}

export function buildLogsHtml(endpoint: ProxyEndpoint, logs: RequestLog[]): string {
  const cards = [...logs]
    .reverse()
    .map(
      (log) => `
        <article class="request">
          <header>
            <div><strong>${escapeHtml(log.method)}</strong> <code>${escapeHtml(log.path)}</code></div>
            <div class="status status-${Math.floor(log.response_status / 100)}xx">${escapeHtml(log.response_status)} · ${escapeHtml(log.duration_ms)} ms</div>
          </header>
          <p class="timestamp">${escapeHtml(new Date(log.timestamp).toLocaleString())}</p>
          ${renderBlock("Request headers", log.request_headers)}
          ${log.query_params && Object.keys(log.query_params).length > 0 ? renderBlock("Query parameters", log.query_params) : ""}
          ${log.request_body ? renderBlock("Request body", log.request_body) : ""}
          ${renderBlock("Response headers", log.response_headers)}
          ${log.response_body ? renderBlock("Response body", log.response_body) : ""}
        </article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transit logs · localhost:${escapeHtml(endpoint.local_port)}</title>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { max-width: 1100px; margin: 0 auto; padding: 32px 20px; background: #101114; color: #e8e9ed; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta, .timestamp { color: #a9abb5; font-size: 13px; }
    .request { margin: 24px 0; padding: 20px; border: 1px solid #353741; border-radius: 10px; background: #181a20; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    code { color: #b9c8ff; overflow-wrap: anywhere; }
    .status { font-weight: 600; }
    .status-2xx { color: #62d394; } .status-3xx { color: #f2bd62; } .status-4xx, .status-5xx { color: #ff7d8d; }
    section { margin-top: 18px; } h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #a9abb5; letter-spacing: .06em; }
    pre { margin: 0; padding: 12px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: #101114; border-radius: 6px; font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Transit request logs</h1>
  <p class="meta">Proxy: <code>http://localhost:${escapeHtml(endpoint.local_port)}</code> → <code>${escapeHtml(endpoint.destination_url)}</code><br>${logs.length} request${logs.length === 1 ? "" : "s"} exported</p>
  ${cards || "<p class=\"meta\">No requests recorded.</p>"}
</body>
</html>`;
}
