import { Box, Typography, Paper, useTheme, alpha } from "@mui/material";
import { CopyButton } from "./CopyButton";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  content: string;
  label?: string;
  language?: 'json' | 'xml' | 'html' | 'javascript';
}

export function CodeBlock({ content, label, language }: CodeBlockProps) {
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
            borderRadius: 1,
            overflow: "hidden",
            border: `1px solid ${theme.palette.divider}`,
        }}
      >
          <SyntaxHighlighter
              language={language}
              style={dracula}
              customStyle={{
                  margin: 0,
                  padding: theme.spacing(2),
                  fontSize: "12px",
                  lineHeight: 1.7,
                  background: alpha(theme.palette.background.default, 0.5),
                  fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
              }}
              codeTagProps={{
                  style: {
                      fontFamily: 'inherit',
                  }
              }}
          >
              {content}
          </SyntaxHighlighter>
      </Paper>
    </Box>
  );
}
