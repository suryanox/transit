import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
} from "@mui/material";
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
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmation, setConfirmation] = useState<
    { type: "delete"; endpointId: string } | { type: "clear" } | null
  >(null);

  const fetchEndpoints = useCallback(async () => {
    try {
      const eps = await invoke<ProxyEndpoint[]>("get_endpoints");
      setEndpoints(eps);
    } catch (reason) {
      setError(`Could not load proxies: ${String(reason)}`);
    }
  }, []);

  const fetchLogs = useCallback(async (endpointId: string) => {
    try {
      const logList = await invoke<RequestLog[]>("get_logs", { endpointId });
      setLogs(logList);
    } catch (reason) {
      setError(`Could not load request logs: ${String(reason)}`);
    }
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
    try {
      const endpoint = await invoke<ProxyEndpoint>("create_proxy", { destinationUrl });
      setEndpoints((prev) => [...prev, endpoint].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      setSelectedEndpoint(endpoint.id);
    } catch (reason) {
      setError(`Could not create proxy: ${String(reason)}`);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    const endpoint = endpoints.find((item) => item.id === id);
    if (!endpoint) return;
    setConfirmation({ type: "delete", endpointId: id });
  };

  const deleteEndpoint = async (id: string) => {
    try {
      await invoke("delete_endpoint", { endpointId: id });
      setEndpoints((prev) => prev.filter((e) => e.id !== id));
      if (selectedEndpoint === id) {
        setSelectedEndpoint(null);
        setSelectedLog(null);
        setLogs([]);
      }
    } catch (reason) {
      setError(`Could not delete proxy: ${String(reason)}`);
    }
  };

  const handleClearLogs = async () => {
    if (!selectedEndpoint) return;
    setConfirmation({ type: "clear" });
  };

  const clearLogs = async () => {
    if (!selectedEndpoint) return;
    setClearing(true);
    try {
      await invoke("clear_logs", { endpointId: selectedEndpoint });
      setLogs([]);
      setSelectedLog(null);
    } catch (reason) {
      setError(`Could not clear logs: ${String(reason)}`);
    } finally {
      setClearing(false);
    }
  };

  const confirmAction = async () => {
    const action = confirmation;
    setConfirmation(null);
    if (!action) return;
    if (action.type === "delete") await deleteEndpoint(action.endpointId);
    else await clearLogs();
  };

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint);

  const handleExportHtml = async () => {
    if (!currentEndpoint) return;

    const html = buildLogsHtml(currentEndpoint, logs);
    try {
      const path = await save({
        title: "Export Transit logs",
        defaultPath: `transit-proxy-${currentEndpoint.local_port}-logs.html`,
        filters: [{ name: "HTML file", extensions: ["html"] }],
      });
      if (!path) return;
      await invoke("write_export_file", { path, contents: html });
    } catch (reason) {
      setError(`Could not export logs: ${String(reason)}`);
    }
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
              clearing={clearing}
            />

            <Box sx={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: { xs: "column", md: "row" } }}>
              <RequestList
                logs={logs}
                selectedLogId={selectedLog?.id ?? null}
                onSelectLog={setSelectedLog}
              />

              {selectedLog ? (
                <RequestDetails log={selectedLog} localPort={currentEndpoint.local_port} />
              ) : (
                <NoRequestSelected />
              )}
            </Box>
          </>
        ) : (
          <NoProxySelected />
        )}
      </Box>
      <Snackbar open={Boolean(error)} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
      <Dialog open={Boolean(confirmation)} onClose={() => setConfirmation(null)}>
        <DialogTitle>
          {confirmation?.type === "delete" ? "Delete proxy?" : "Clear request logs?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmation?.type === "delete"
              ? "This will stop the proxy and permanently remove its captured requests."
              : "This will permanently remove all captured requests for the selected proxy."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmation(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmAction}>
            {confirmation?.type === "delete" ? "Delete" : "Clear"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
