import { Box, Typography } from "@mui/material";
import {
  Description as DocIcon,
  Timeline as TimelineIcon,
} from "@mui/icons-material";

export function NoProxySelected() {
  return (
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
  );
}

export function NoRequestSelected() {
  return (
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
  );
}
