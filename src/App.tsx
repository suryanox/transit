import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Paper,
  List,
  ListItemButton,
  Chip,
  Stack,
  Tooltip,
  useTheme,
  alpha,
} from "@mui/material";
import {
  Add as AddIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  ArrowForward as ArrowIcon,
  Description as DocIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
} from "@mui/icons-material";

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
    <Tooltip title={copied ? "Copied!" : "Copy"}>
      <IconButton size="small" onClick={handleCopy} sx={{ color: "text.secondary" }}>
        {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

function CodeBlock({ content, label }: { content: string; label?: string }) {
  const theme = useTheme();

  return (
    <Box>
      {label && (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            mb: 0.5,
            display: "block",
          }}
        >
          {label}
        </Typography>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
        <CopyButton text={content} />
      </Box>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: alpha(theme.palette.background.default, 0.5),
          fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
          fontSize: "11px",
          lineHeight: 1.7,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "text.secondary",
        }}
      >
        <pre style={{ margin: 0 }}>{content}</pre>
      </Paper>
    </Box>
  );
}

const methodColors: Record<string, string> = {
  GET: "#61affe",
  POST: "#49cc90",
  PUT: "#fca130",
  DELETE: "#f93e3e",
  PATCH: "#50e3c2",
  HEAD: "#9012fe",
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

function App() {
  const theme = useTheme();
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

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Box
        sx={{
          width: { xs: 220, sm: 260 },
          bgcolor: "background.paper",
          borderRight: 1,
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TimelineIcon sx={{ color: "primary.main", fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600} letterSpacing="-0.02em">
              Transit
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder="https://api.example.com"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProxy()}
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "12px",
                  bgcolor: alpha(theme.palette.background.default, 0.5),
                },
              }}
            />
            <IconButton
              color="primary"
              onClick={handleCreateProxy}
              disabled={loading}
              sx={{
                bgcolor: "primary.main",
                color: "white",
                "&:hover": { bgcolor: "primary.dark" },
                "&:disabled": { bgcolor: alpha(theme.palette.primary.main, 0.3) },
              }}
            >
              <AddIcon />
            </IconButton>
          </Stack>
        </Box>

        <Typography
          variant="caption"
          sx={{
            px: 2,
            pt: 1.5,
            pb: 1,
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
            fontSize: "10px",
          }}
        >
          Proxies
        </Typography>

        <Box sx={{ flex: 1, overflow: "auto", px: 1 }}>
          {endpoints.length === 0 ? (
            <Typography
              sx={{ p: 3, textAlign: "center", color: "text.secondary", fontSize: "12px" }}
            >
              No proxies yet
            </Typography>
          ) : (
            <List disablePadding>
              {endpoints.map((ep) => (
                <ListItemButton
                  key={ep.id}
                  selected={selectedEndpoint === ep.id}
                  onClick={() => {
                    setSelectedEndpoint(ep.id);
                    setSelectedLog(null);
                  }}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    py: 1,
                    px: 1.5,
                    "&.Mui-selected": {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "success.main",
                      boxShadow: `0 0 8px ${theme.palette.success.main}`,
                      mr: 1.5,
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      localhost:{ep.local_port}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "11px",
                        color: "text.secondary",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ep.destination_url}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEndpoint(ep.id);
                    }}
                    sx={{
                      opacity: 0,
                      color: "text.secondary",
                      ".MuiListItemButton-root:hover &": { opacity: 1 },
                      "&:hover": { color: "error.main", bgcolor: alpha(theme.palette.error.main, 0.1) },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {currentEndpoint ? (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: { xs: 1, sm: 1.5 },
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: "wrap" }}>
                <Paper
                  variant="outlined"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1.5,
                    py: 0.75,
                    bgcolor: alpha(theme.palette.background.default, 0.5),
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "12px",
                      color: "primary.main",
                    }}
                  >
                    http://localhost:{currentEndpoint.local_port}
                  </Typography>
                  <Tooltip title="Copy URL">
                    <IconButton
                      size="small"
                      onClick={() => copyUrl(currentEndpoint.local_port)}
                      sx={{ p: 0.25 }}
                    >
                      <CopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Paper>
                <ArrowIcon sx={{ color: "text.secondary", fontSize: 16 }} />
                <Paper
                  variant="outlined"
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    bgcolor: alpha(theme.palette.background.default, 0.5),
                    maxWidth: { xs: 150, sm: 300 },
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "12px",
                      color: "text.secondary",
                    }}
                  >
                    {currentEndpoint.destination_url}
                  </Typography>
                </Paper>
              </Stack>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={handleClearLogs}
                sx={{ color: "text.secondary", borderColor: "divider" }}
              >
                Clear
              </Button>
            </Box>

            <Box sx={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: { xs: "column", md: "row" } }}>
              <Box
                sx={{
                  width: { xs: "100%", md: 340 },
                  minHeight: { xs: 200, md: "auto" },
                  borderRight: { md: 1 },
                  borderBottom: { xs: 1, md: 0 },
                  borderColor: "divider",
                  display: "flex",
                  flexDirection: "column",
                  flexShrink: 0,
                  bgcolor: "background.paper",
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Requests
                  </Typography>
                  <Chip
                    label={logs.length}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "11px",
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
                  {logs.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                      <InfoIcon sx={{ fontSize: 32, color: "text.secondary", opacity: 0.4, mb: 2 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Waiting for requests...
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Send requests to your proxy URL
                      </Typography>
                    </Box>
                  ) : (
                    <List disablePadding>
                      {[...logs].reverse().map((log) => (
                        <ListItemButton
                          key={log.id}
                          selected={selectedLog?.id === log.id}
                          onClick={() => setSelectedLog(log)}
                          sx={{
                            borderRadius: 1,
                            mb: 0.5,
                            py: 1,
                            px: 1.5,
                            "&.Mui-selected": {
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                            },
                          }}
                        >
                          <Chip
                            label={log.method}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "10px",
                              fontWeight: 600,
                              fontFamily: '"JetBrains Mono", monospace',
                              bgcolor: alpha(methodColors[log.method] || "#999", 0.2),
                              color: methodColors[log.method] || "#999",
                              mr: 1,
                            }}
                          />
                          <Typography
                            sx={{
                              flex: 1,
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: "11px",
                              color: "text.secondary",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              mr: 1,
                            }}
                          >
                            {log.path}
                          </Typography>
                          <Chip
                            label={log.response_status}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "10px",
                              fontWeight: 600,
                              fontFamily: '"JetBrains Mono", monospace',
                              bgcolor: alpha(getStatusColor(log.response_status), 0.2),
                              color: getStatusColor(log.response_status),
                              mr: 1,
                            }}
                          />
                          <Typography
                            sx={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: "10px",
                              color: "text.secondary",
                              flexShrink: 0,
                            }}
                          >
                            {log.duration_ms}ms
                          </Typography>
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </Box>
              </Box>

              {selectedLog ? (
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 2.5,
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: "divider",
                      bgcolor: "background.paper",
                    }}
                  >
                    <Chip
                      label="Details"
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.background.default, 0.5),
                        fontWeight: 500,
                      }}
                    />
                    <Typography
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "11px",
                        color: "text.secondary",
                      }}
                    >
                      {new Date(selectedLog.timestamp).toLocaleTimeString()}
                    </Typography>
                  </Box>

                  <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
                    <Stack spacing={2.5}>
                      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                        <Box
                          sx={{
                            px: 2,
                            py: 1.5,
                            bgcolor: alpha(theme.palette.background.default, 0.5),
                            borderBottom: 1,
                            borderColor: "divider",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography variant="body2" fontWeight={500}>
                            Request
                          </Typography>
                          <Chip
                            label={selectedLog.method}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: "10px",
                              fontWeight: 600,
                              fontFamily: '"JetBrains Mono", monospace',
                              bgcolor: methodColors[selectedLog.method] || "#999",
                              color: "white",
                            }}
                          />
                        </Box>
                        <Box sx={{ p: 2 }}>
                          <Stack spacing={2}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  variant="caption"
                                  sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}
                                >
                                  Path
                                </Typography>
                                <Typography
                                  sx={{
                                    fontFamily: '"JetBrains Mono", monospace',
                                    fontSize: "12px",
                                    wordBreak: "break-all",
                                  }}
                                >
                                  {selectedLog.path}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}
                                >
                                  Duration
                                </Typography>
                                <Typography sx={{ fontSize: "13px" }}>{selectedLog.duration_ms}ms</Typography>
                              </Box>
                            </Stack>

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
                              <CodeBlock label="Body" content={formatJson(selectedLog.request_body) || ""} />
                            )}
                          </Stack>
                        </Box>
                      </Paper>

                      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                        <Box
                          sx={{
                            px: 2,
                            py: 1.5,
                            bgcolor: alpha(theme.palette.background.default, 0.5),
                            borderBottom: 1,
                            borderColor: "divider",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography variant="body2" fontWeight={500}>
                            Response
                          </Typography>
                          <Chip
                            label={selectedLog.response_status}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: "10px",
                              fontWeight: 600,
                              fontFamily: '"JetBrains Mono", monospace',
                              bgcolor: getStatusColor(selectedLog.response_status),
                              color: "white",
                            }}
                          />
                        </Box>
                        <Box sx={{ p: 2 }}>
                          <Stack spacing={2}>
                            <CodeBlock
                              label="Headers"
                              content={JSON.stringify(selectedLog.response_headers, null, 2)}
                            />

                            {selectedLog.response_body && (
                              <CodeBlock label="Body" content={formatJson(selectedLog.response_body) || ""} />
                            )}
                          </Stack>
                        </Box>
                      </Paper>
                    </Stack>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "text.secondary",
                  }}
                >
                  <DocIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1.5 }} />
                  <Typography variant="body2">Select a request to view details</Typography>
                </Box>
              )}
            </Box>
          </>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
            }}
          >
            <TimelineIcon sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
            <Typography variant="h6" fontWeight={500} color="text.secondary">
              Create a proxy
            </Typography>
            <Typography variant="body2">Enter a destination URL in the sidebar to get started</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default App;
