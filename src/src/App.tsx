import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Box } from "@mui/material";
import { ProxyEndpoint, RequestLog } from "./types";
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
      const interval = setInterval(() => fetchLogs(selectedEndpoint), 1000);
      return () => clearInterval(interval);
    }
  }, [selectedEndpoint, fetchLogs]);

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

  const handleSelectEndpoint = (id: string) => {
    setSelectedEndpoint(id);
    setSelectedLog(null);
  };

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint);

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
            <ProxyHeader endpoint={currentEndpoint} onClearLogs={handleClearLogs} />

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
