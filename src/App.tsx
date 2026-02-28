import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface ProxyEndpoint {
  id: string;
  local_port: number;
  destination_url: string;
  created_at: string;
}

interface RequestLog {
  id: string;
  endpoint_id: string;
  timestamp: string;
  method: string;
  path: string;
  request_headers: Record<string, string>;
  request_body: string | null;
  query_params: Record<string, string>;
  response_status: number;
  response_headers: Record<string, string>;
  response_body: string | null;
  duration_ms: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button className="copy-btn" onClick={handleCopy} title="Copy">
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function CodeBlock({ content, label }: { content: string; label?: string }) {
  return (
    <div className="code-block">
      {label && <span className="code-label">{label}</span>}
      <div className="code-header">
        <CopyButton text={content} />
      </div>
      <pre>{content}</pre>
    </div>
  );
}

function App() {
  const [endpoints, setEndpoints] = useState<ProxyEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchEndpoints = useCallback(async () => {
    const eps = await invoke<ProxyEndpoint[]>("get_endpoints");
    setEndpoints(eps);
  }, []);

  const fetchLogs = useCallback(async (endpointId: string) => {
    const logList = await invoke<RequestLog[]>("get_logs", { endpointId });
    setLogs(logList);
  }, []);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  useEffect(() => {
    if (selectedEndpoint) {
      fetchLogs(selectedEndpoint);
      const interval = setInterval(() => fetchLogs(selectedEndpoint), 1000);
      return () => clearInterval(interval);
    }
  }, [selectedEndpoint, fetchLogs]);

  const handleCreateProxy = async () => {
    if (!destinationUrl.trim()) return;
    setLoading(true);
    try {
      const endpoint = await invoke<ProxyEndpoint>("create_proxy", {
        destinationUrl: destinationUrl.trim(),
      });
      setEndpoints((prev) => [...prev, endpoint]);
      setSelectedEndpoint(endpoint.id);
      setDestinationUrl("");
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDeleteEndpoint = async (id: string) => {
    await invoke("delete_endpoint", { endpointId: id });
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
    if (selectedEndpoint === id) {
      setSelectedEndpoint(null);
      setSelectedLog(null);
      setLogs([]);
    }
  };

  const handleClearLogs = async () => {
    if (!selectedEndpoint) return;
    await invoke("clear_logs", { endpointId: selectedEndpoint });
    setLogs([]);
    setSelectedLog(null);
  };

  const copyUrl = async (port: number) => {
    await navigator.clipboard.writeText(`http://localhost:${port}`);
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: "#61affe",
      POST: "#49cc90",
      PUT: "#fca130",
      DELETE: "#f93e3e",
      PATCH: "#50e3c2",
      HEAD: "#9012fe",
    };
    return colors[method] || "#999";
  };

  const getStatusColor = (status: number) => {
    if (status < 300) return "#49cc90";
    if (status < 400) return "#fca130";
    return "#f93e3e";
  };

  const formatJson = (str: string | null) => {
    if (!str) return null;
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">Transit</span>
          </div>
        </div>
        <div className="create-proxy">
          <input
            type="text"
            placeholder="https://api.example.com"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateProxy()}
          />
          <button onClick={handleCreateProxy} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <div className="sidebar-section-label">Proxies</div>
        <nav className="endpoints-list">
          {endpoints.length === 0 ? (
            <div className="empty-sidebar">No proxies yet</div>
          ) : (
            endpoints.map((ep) => (
              <div
                key={ep.id}
                className={`endpoint-item ${selectedEndpoint === ep.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedEndpoint(ep.id);
                  setSelectedLog(null);
                }}
              >
                <div className="endpoint-status" />
                <div className="endpoint-info">
                  <span className="port">localhost:{ep.local_port}</span>
                  <span className="dest">{ep.destination_url}</span>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEndpoint(ep.id);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </nav>
      </aside>

      <main className="main-content">
        {currentEndpoint ? (
          <>
            <header className="content-header">
              <div className="endpoint-display">
                <div className="url-badge">
                  <span className="url-text">http://localhost:{currentEndpoint.local_port}</span>
                  <button className="url-copy" onClick={() => copyUrl(currentEndpoint.local_port)} title="Copy URL">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
                <span className="arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
                <div className="dest-badge">{currentEndpoint.destination_url}</div>
              </div>
              <button className="clear-btn" onClick={handleClearLogs}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Clear
              </button>
            </header>
            <div className="content-body">
              <div className="logs-panel">
                <div className="panel-header">
                  <span>Requests</span>
                  <span className="request-count">{logs.length}</span>
                </div>
                <div className="logs-list">
                  {logs.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <p>Waiting for requests...</p>
                      <span className="empty-hint">Send requests to your proxy URL</span>
                    </div>
                  ) : (
                    [...logs].reverse().map((log) => (
                      <div
                        key={log.id}
                        className={`log-item ${selectedLog?.id === log.id ? "active" : ""}`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <span className="method-badge" style={{ background: getMethodColor(log.method) + "20", color: getMethodColor(log.method) }}>
                          {log.method}
                        </span>
                        <span className="path">{log.path}</span>
                        <span className="status-badge" style={{ background: getStatusColor(log.response_status) + "20", color: getStatusColor(log.response_status) }}>
                          {log.response_status}
                        </span>
                        <span className="duration">{log.duration_ms}ms</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedLog ? (
                <div className="detail-panel">
                  <div className="detail-tabs">
                    <div className="tab-group">
                      <span className="tab active">Details</span>
                    </div>
                    <span className="detail-time">{new Date(selectedLog.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <div className="detail-content">
                    <div className="detail-section">
                      <div className="section-header">
                        <span>Request</span>
                        <span className="method-pill" style={{ background: getMethodColor(selectedLog.method) }}>
                          {selectedLog.method}
                        </span>
                      </div>
                      <div className="section-body">
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="info-label">Path</span>
                            <span className="info-value mono">{selectedLog.path}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Duration</span>
                            <span className="info-value">{selectedLog.duration_ms}ms</span>
                          </div>
                        </div>

                        {Object.keys(selectedLog.query_params).length > 0 && (
                          <CodeBlock
                            label="Query Params"
                            content={JSON.stringify(selectedLog.query_params, null, 2)}
                          />
                        )}

                        <CodeBlock
                          label="Headers"
                          content={JSON.stringify(selectedLog.request_headers, null, 2)}
                        />

                        {selectedLog.request_body && (
                          <CodeBlock
                            label="Body"
                            content={formatJson(selectedLog.request_body) || ""}
                          />
                        )}
                      </div>
                    </div>

                    <div className="detail-section">
                      <div className="section-header">
                        <span>Response</span>
                        <span className="status-pill" style={{ background: getStatusColor(selectedLog.response_status) }}>
                          {selectedLog.response_status}
                        </span>
                      </div>
                      <div className="section-body">
                        <CodeBlock
                          label="Headers"
                          content={JSON.stringify(selectedLog.response_headers, null, 2)}
                        />

                        {selectedLog.response_body && (
                          <CodeBlock
                            label="Body"
                            content={formatJson(selectedLog.response_body) || ""}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="detail-placeholder">
                  <div className="placeholder-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <p>Select a request to view details</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="welcome">
            <div className="welcome-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <h2>Create a proxy</h2>
            <p>Enter a destination URL in the sidebar to get started</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
