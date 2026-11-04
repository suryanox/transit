import { ProxyEndpoint, RequestLog } from "../types";

const SENSITIVE_KEY = /(authorization|proxy-authorization|cookie|set-cookie|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|token|secret|password|passwd|credential|session)/i;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function redactObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactObject(item),
      ]),
    );
  }
  return value;
}

function redactRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : value]),
  );
}

function redactBody(body: string): string {
  if (body.startsWith("base64:")) return "[Binary body omitted from export]";
  try {
    return JSON.stringify(redactObject(JSON.parse(body)), null, 2) ?? body;
  } catch {
    return body;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? "";
}

function renderDetails(label: string, value: unknown): string {
  return `<details class="detail"><summary><span>${escapeHtml(label)}</span><span class="chevron">⌄</span></summary><pre>${escapeHtml(formatValue(value))}</pre></details>`;
}

function statusClass(status: number): string {
  if (status >= 500) return "error";
  if (status >= 400) return "warning";
  if (status >= 300) return "redirect";
  return "success";
}

function renderRequest(log: RequestLog): string {
  const safeHeaders = redactRecord(log.request_headers);
  const safeResponseHeaders = redactRecord(log.response_headers);
  const safeQuery = redactRecord(log.query_params);
  const statusStyle = statusClass(log.response_status);

  return `<article class="request-card">
  <div class="request-summary">
    <div class="request-main"><span class="method">${escapeHtml(log.method)}</span><code class="path">${escapeHtml(log.path)}</code></div>
    <div class="request-meta"><span class="status ${statusStyle}">${escapeHtml(log.response_status)}</span><span class="duration">${escapeHtml(log.duration_ms)} ms</span><time>${escapeHtml(new Date(log.timestamp).toLocaleString())}</time></div>
  </div>
  <div class="request-details">
    ${renderDetails("Request headers", safeHeaders)}
    ${Object.keys(safeQuery).length ? renderDetails("Query parameters", safeQuery) : ""}
    ${log.request_body ? renderDetails("Request body", redactBody(log.request_body)) : ""}
    ${renderDetails("Response headers", safeResponseHeaders)}
    ${log.response_body ? renderDetails("Response body", redactBody(log.response_body)) : ""}
  </div>
</article>`;
}

export function buildLogsHtml(endpoint: ProxyEndpoint, logs: RequestLog[]): string {
  const totalDuration = logs.reduce((sum, log) => sum + log.duration_ms, 0);
  const errors = logs.filter((log) => log.response_status >= 400).length;
  const success = logs.filter((log) => log.response_status >= 200 && log.response_status < 300).length;
  const requests = [...logs].reverse().map(renderRequest).join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transit report · localhost:${escapeHtml(endpoint.local_port)}</title>
<style>
:root{color-scheme:dark;--bg:#0b0e14;--panel:#131821;--raised:#19202b;--border:#293242;--text:#edf2fa;--muted:#8995a8;--accent:#8ba8ff;--green:#67d69a;--yellow:#f1bd67;--red:#ff7e8b;--shadow:0 18px 48px rgba(0,0,0,.22)}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -20%,#1b2944 0,var(--bg) 42rem);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}.shell{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:48px 0 72px}.eyebrow{color:var(--accent);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}h1{margin:8px 0 10px;font-size:clamp(28px,5vw,44px);letter-spacing:-.045em;line-height:1.05}.subtitle{max-width:760px;margin:0;color:var(--muted);line-height:1.6}code,pre,.method,.status,.duration{font-family:"SF Mono","Cascadia Code","Roboto Mono",ui-monospace,monospace}code{color:#c3d1ff;overflow-wrap:anywhere}.endpoint{display:inline-flex;align-items:center;gap:8px;max-width:100%;margin-top:24px;padding:9px 12px;overflow:hidden;border:1px solid var(--border);border-radius:9px;background:rgba(19,24,33,.8);color:var(--muted);font-size:12px}.endpoint code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:32px 0 42px}.metric{padding:18px;border:1px solid var(--border);border-radius:12px;background:rgba(19,24,33,.82);box-shadow:var(--shadow)}.metric-label{color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.metric-value{margin-top:7px;font-size:25px;font-weight:700;letter-spacing:-.03em}.green{color:var(--green)}.red{color:var(--red)}.section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:14px}h2{margin:0;font-size:18px;letter-spacing:-.02em}.muted{color:var(--muted);font-size:12px}.request-card{margin:12px 0;overflow:hidden;border:1px solid var(--border);border-radius:12px;background:linear-gradient(135deg,rgba(25,32,43,.96),rgba(19,24,33,.96));box-shadow:0 8px 28px rgba(0,0,0,.12)}.request-summary{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 18px}.request-main,.request-meta{display:flex;align-items:center;gap:11px;min-width:0}.request-main{flex:1}.request-meta{flex-wrap:wrap;justify-content:flex-end;color:var(--muted);font-size:11px}.method{min-width:54px;padding:5px 7px;border-radius:6px;background:rgba(139,168,255,.15);color:var(--accent);font-size:10px;font-weight:800;text-align:center;letter-spacing:.04em}.path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.status{min-width:38px;padding:4px 6px;border-radius:5px;font-size:11px;font-weight:700;text-align:center}.status.success{background:rgba(103,214,154,.13);color:var(--green)}.status.redirect{background:rgba(241,189,103,.13);color:var(--yellow)}.status.warning,.status.error{background:rgba(255,126,139,.13);color:var(--red)}.duration{color:var(--muted)}time{white-space:nowrap}.request-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:0 18px 16px}.detail{min-width:0;border:1px solid var(--border);border-radius:8px;background:rgba(11,14,20,.38)}.detail[open]{grid-column:1/-1}.detail summary{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;user-select:none}.detail summary:hover{color:var(--text)}.chevron{color:var(--accent);font-size:16px;transition:transform .15s}.detail[open] .chevron{transform:rotate(180deg)}pre{margin:0;padding:12px;overflow:auto;border-top:1px solid var(--border);color:#cbd5e5;font-size:12px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.notice{margin:28px 0 0;padding:12px 14px;border:1px solid rgba(241,189,103,.28);border-radius:9px;background:rgba(241,189,103,.07);color:#d9c18e;font-size:12px;line-height:1.5}.empty{padding:44px 20px;border:1px dashed var(--border);border-radius:12px;color:var(--muted);text-align:center}@media(max-width:700px){.shell{width:min(100% - 20px,1120px);padding-top:28px}.metrics{grid-template-columns:repeat(2,1fr)}.request-summary{align-items:flex-start;flex-direction:column;gap:12px}.request-meta{justify-content:flex-start}.request-details{grid-template-columns:1fr}.detail[open]{grid-column:auto}}
</style></head><body><main class="shell">
<div class="eyebrow">Transit · traffic report</div><h1>Request activity</h1><p class="subtitle">A captured view of the requests that passed through this local proxy. Detail panels are collapsed so the report stays easy to scan.</p>
<div class="endpoint"><span>Proxy</span><code>http://localhost:${escapeHtml(endpoint.local_port)}</code><span>→</span><code>${escapeHtml(endpoint.destination_url)}</code></div>
<section class="metrics"><div class="metric"><div class="metric-label">Requests</div><div class="metric-value">${logs.length}</div></div><div class="metric"><div class="metric-label">Successful</div><div class="metric-value green">${success}</div></div><div class="metric"><div class="metric-label">Errors</div><div class="metric-value red">${errors}</div></div><div class="metric"><div class="metric-label">Total time</div><div class="metric-value">${totalDuration} ms</div></div></section>
<div class="section-heading"><h2>Captured requests</h2><span class="muted">${escapeHtml(new Date().toLocaleString())}</span></div>
${requests || '<div class="empty">No requests were captured for this proxy.</div>'}
<div class="notice">Sensitive headers and common secret fields are redacted in this export. Binary bodies are omitted. Request and response details are collapsed by default; click a section to inspect its sanitized contents.</div>
</main></body></html>`;
}
