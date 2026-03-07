import {
  Box,
  Typography,
  IconButton,
  Button,
  Paper,
  Stack,
  Tooltip,
  useTheme,
  alpha,
} from "@mui/material";
import {
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  ArrowForward as ArrowIcon,
} from "@mui/icons-material";
import { ProxyEndpoint } from "../types";

interface ProxyHeaderProps {
  endpoint: ProxyEndpoint;
  onClearLogs: () => void;
}

export function ProxyHeader({ endpoint, onClearLogs }: ProxyHeaderProps) {
  const theme = useTheme();

  const copyUrl = async () => {
    await navigator.clipboard.writeText(`http://localhost:${endpoint.local_port}`);
  };

  return (
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
            http://localhost:{endpoint.local_port}
          </Typography>
          <Tooltip title="Copy URL">
            <IconButton size="small" onClick={copyUrl} sx={{ p: 0.25 }}>
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
            {endpoint.destination_url}
          </Typography>
        </Paper>
      </Stack>
      <Button
        variant="outlined"
        size="small"
        startIcon={<DeleteIcon />}
        onClick={onClearLogs}
        sx={{ color: "text.secondary", borderColor: "divider" }}
      >
        Clear
      </Button>
    </Box>
  );
}
