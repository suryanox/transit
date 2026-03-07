import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { ContentCopy as CopyIcon, Check as CheckIcon } from "@mui/icons-material";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
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
