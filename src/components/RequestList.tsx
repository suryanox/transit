import {
  Box,
  Typography,
  List,
  ListItemButton,
  Chip,
  TextField,
  MenuItem,
  useTheme,
  alpha,
} from "@mui/material";
import { Info as InfoIcon, Search as SearchIcon } from "@mui/icons-material";
import { useMemo, useState } from "react";
import { RequestLog } from "../types";
import { methodColors, getStatusColor } from "../utils";

interface RequestListProps {
  logs: RequestLog[];
  selectedLogId: string | null;
  onSelectLog: (log: RequestLog) => void;
}

export function RequestList({ logs, selectedLogId, onSelectLog }: RequestListProps) {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [slowOnly, setSlowOnly] = useState(false);

  const methods = useMemo(
    () => [...new Set(logs.map((log) => log.method))].sort(),
    [logs],
  );
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSearch = !query || `${log.method} ${log.path}`.toLowerCase().includes(query);
      const matchesMethod = method === "all" || log.method === method;
      const matchesStatus =
        status === "all" || `${Math.floor(log.response_status / 100)}xx` === status;
      const matchesSlow = !slowOnly || log.duration_ms >= 1000;
      return matchesSearch && matchesMethod && matchesStatus && matchesSlow;
    });
  }, [logs, method, search, slowOnly, status]);

  return (
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
          label={filteredLogs.length === logs.length ? logs.length : `${filteredLogs.length}/${logs.length}`}
          size="small"
          sx={{
            height: 20,
            fontSize: "11px",
            bgcolor: alpha(theme.palette.background.default, 0.5),
          }}
        />
      </Box>
      <Box sx={{ px: 1, pt: 1, display: "grid", gap: 0.75 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search path or method"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.75, color: "text.secondary", fontSize: 17 }} /> }}
          sx={{ "& .MuiInputBase-input": { fontSize: 12 } }}
        />
        <Box sx={{ display: "flex", gap: 0.75 }}>
          <TextField select size="small" value={method} onChange={(event) => setMethod(event.target.value)} sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 11, py: 0.8 } }}>
            <MenuItem value="all">All methods</MenuItem>
            {methods.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 11, py: 0.8 } }}>
            <MenuItem value="all">All status</MenuItem>
            <MenuItem value="2xx">2xx Success</MenuItem>
            <MenuItem value="3xx">3xx Redirect</MenuItem>
            <MenuItem value="4xx">4xx Client error</MenuItem>
            <MenuItem value="5xx">5xx Server error</MenuItem>
          </TextField>
        </Box>
        <Chip
          label="Slow requests (≥ 1s)"
          size="small"
          variant={slowOnly ? "filled" : "outlined"}
          color={slowOnly ? "warning" : "default"}
          onClick={() => setSlowOnly((value) => !value)}
          sx={{ justifySelf: "start", height: 24, fontSize: 11, mb: 0.25 }}
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
        ) : filteredLogs.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">No matching requests</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {[...filteredLogs].reverse().map((log) => (
              <ListItemButton
                key={log.id}
                selected={selectedLogId === log.id}
                onClick={() => onSelectLog(log)}
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
  );
}
