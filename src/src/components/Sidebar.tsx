import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  List,
  ListItemButton,
  Stack,
  useTheme,
  alpha,
} from "@mui/material";
import {
  Add as AddIcon,
  Close as CloseIcon,
  Timeline as TimelineIcon,
} from "@mui/icons-material";
import { ProxyEndpoint } from "../types";

interface SidebarProps {
  endpoints: ProxyEndpoint[];
  selectedEndpoint: string | null;
  onSelectEndpoint: (id: string) => void;
  onCreateProxy: (url: string) => Promise<void>;
  onDeleteEndpoint: (id: string) => void;
}

export function Sidebar({
  endpoints,
  selectedEndpoint,
  onSelectEndpoint,
  onCreateProxy,
  onDeleteEndpoint,
}: SidebarProps) {
  const theme = useTheme();
  const [destinationUrl, setDestinationUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!destinationUrl.trim()) return;
    setLoading(true);
    try {
      await onCreateProxy(destinationUrl.trim());
      setDestinationUrl("");
    } finally {
      setLoading(false);
    }
  };

  return (
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
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            sx={{
              "& .MuiOutlinedInput-root": {
                fontSize: "12px",
                bgcolor: alpha(theme.palette.background.default, 0.5),
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={handleCreate}
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
                onClick={() => onSelectEndpoint(ep.id)}
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
                    onDeleteEndpoint(ep.id);
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
  );
}
