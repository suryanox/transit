import {
  Box,
  Typography,
  List,
  ListItemButton,
  Chip,
  useTheme,
  alpha,
} from "@mui/material";
import { Info as InfoIcon } from "@mui/icons-material";
import { RequestLog } from "../types";
import { methodColors, getStatusColor } from "../utils";

interface RequestListProps {
  logs: RequestLog[];
  selectedLogId: string | null;
  onSelectLog: (log: RequestLog) => void;
}

export function RequestList({ logs, selectedLogId, onSelectLog }: RequestListProps) {
  const theme = useTheme();

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
