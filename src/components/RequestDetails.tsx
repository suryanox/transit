import { Box, Typography, Paper, Chip, Stack, useTheme, alpha } from "@mui/material";
import { RequestLog } from "../types";
import { methodColors, getStatusColor, formatJson } from "../utils";
import { CodeBlock } from "./CodeBlock";

interface RequestDetailsProps {
    log: RequestLog;
}

export function RequestDetails({ log }: RequestDetailsProps) {
    const theme = useTheme();

    return (
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
                    {new Date(log.timestamp).toLocaleTimeString()}
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
                                label={log.method}
                                size="small"
                                sx={{
                                    height: 22,
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    fontFamily: '"JetBrains Mono", monospace',
                                    bgcolor: methodColors[log.method] || "#999",
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
                                            sx={{
                                                color: "text.secondary",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                                display: "block",
                                                mb: 0.5,
                                            }}
                                        >
                                            Path
                                        </Typography>
                                        <Box
                                            sx={{
                                                px: 1.2,
                                                py: 0.7,
                                                borderRadius: 1,
                                                bgcolor: alpha(theme.palette.background.default, 0.6),
                                                border: `1px solid ${theme.palette.divider}`,
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontFamily: '"JetBrains Mono", monospace',
                                                    fontSize: "12px",
                                                    wordBreak: "break-all",
                                                }}
                                            >
                                                {log.path}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ minWidth: 100 }}>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: "text.secondary",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                                display: "block",
                                                mb: 0.5,
                                            }}
                                        >
                                            Duration
                                        </Typography>
                                        <Box
                                            sx={{
                                                px: 1.2,
                                                py: 0.7,
                                                borderRadius: 1,
                                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                                textAlign: "center",
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontFamily: '"JetBrains Mono", monospace',
                                                    fontSize: "12px",
                                                }}
                                            >
                                                {log.duration_ms} ms
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Stack>
                                {Object.keys(log.query_params).length > 0 && (
                                    <CodeBlock
                                        label="Query Params"
                                        content={JSON.stringify(log.query_params, null, 2)}
                                        language="json"
                                    />
                                )}
                                <CodeBlock
                                    label="Headers"
                                    content={JSON.stringify(log.request_headers, null, 2)}
                                    language="json"
                                />
                                {log.request_body && (
                                    <CodeBlock label="Body" content={formatJson(log.request_body) || ""} language="json" />
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
                                label={log.response_status}
                                size="small"
                                sx={{
                                    height: 22,
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    fontFamily: '"JetBrains Mono", monospace',
                                    bgcolor: getStatusColor(log.response_status),
                                    color: "white",
                                }}
                            />
                        </Box>
                        <Box sx={{ p: 2 }}>
                            <Stack spacing={2}>
                                <CodeBlock
                                    label="Headers"
                                    content={JSON.stringify(log.response_headers, null, 2)}
                                    language="json"
                                />

                                {log.response_body && (
                                    <CodeBlock label="Body" content={formatJson(log.response_body) || ""} language="json" />
                                )}
                            </Stack>
                        </Box>
                    </Paper>
                </Stack>
            </Box>
        </Box>
    );
}
