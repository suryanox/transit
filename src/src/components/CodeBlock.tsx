import { Box, Typography, Paper, useTheme, alpha } from "@mui/material";
import { CopyButton } from "./CopyButton";

interface CodeBlockProps {
  content: string;
  label?: string;
}

export function CodeBlock({ content, label }: CodeBlockProps) {
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
