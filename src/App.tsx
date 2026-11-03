import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Box } from "@mui/material";
import { ProxyEndpoint, RequestLog } from "./types";
import { buildLogsHtml } from "./utils/exportHtml";
import {
  Sidebar,
  RequestList,
  RequestDetails,
  ProxyHeader,
  NoProxySelected,
  NoRequestSelected,
} from "./components";

function App() {
  const [endpoints, setEndpoints] = useState<ProxyEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);
  const [logs, setLogs] = useState<RequestLog[]>([]);

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
    }
  }, [selectedEndpoint, fetchLogs]);

  useEffect(() => {
    if (!selectedEndpoint) return;

    let active = true;
    let unlisten: (() => void) | undefined;

    listen<RequestLog>("request-log", (event) => {
      const log = event.payload;
      if (!active || log.endpoint_id !== selectedEndpoint) return;

      setLogs((previous) =>
        previous.some((existing) => existing.id === log.id)
          ? previous.map((existing) => (existing.id === log.id ? log : existing))
          : [...previous, log],
      );
      setSelectedLog((previous) => (previous?.id === log.id ? log : previous));
    }).then((cleanup) => {
      if (active) unlisten = cleanup;
      else cleanup();
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [selectedEndpoint]);

  const handleCreateProxy = async (destinationUrl: string) => {
    const endpoint = await invoke<ProxyEndpoint>("create_proxy", { destinationUrl });
    setEndpoints((prev) => [...prev, endpoint]);
    setSelectedEndpoint(endpoint.id);
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

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint);

  const handleExportHtml = () => {
    if (!currentEndpoint) return;

    const html = buildLogsHtml(currentEndpoint, logs);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transit-proxy-${currentEndpoint.local_port}-logs.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectEndpoint = (id: string) => {
    setSelectedEndpoint(id);
    setSelectedLog(null);
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        endpoints={endpoints}
        selectedEndpoint={selectedEndpoint}
        onSelectEndpoint={handleSelectEndpoint}
        onCreateProxy={handleCreateProxy}
        onDeleteEndpoint={handleDeleteEndpoint}
      />

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {currentEndpoint ? (
          <>
            <ProxyHeader
              endpoint={currentEndpoint}
              onClearLogs={handleClearLogs}
              onExportHtml={handleExportHtml}
            />

            <Box sx={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: { xs: "column", md: "row" } }}>
              <RequestList
                logs={logs}
                selectedLogId={selectedLog?.id ?? null}
                onSelectLog={setSelectedLog}
              />

              {selectedLog ? (
                <RequestDetails log={selectedLog} />
              ) : (
                <NoRequestSelected />
              )}
            </Box>
          </>
        ) : (
          <NoProxySelected />
        )}
      </Box>
    </Box>
  );
}

export default App;
