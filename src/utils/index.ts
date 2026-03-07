export const methodColors: Record<string, string> = {
  GET: "#61affe",
  POST: "#49cc90",
  PUT: "#fca130",
  DELETE: "#f93e3e",
  PATCH: "#50e3c2",
  HEAD: "#9012fe",
};

export const getStatusColor = (status: number): string => {
  if (status < 300) return "#49cc90";
  if (status < 400) return "#fca130";
  return "#f93e3e";
};

export const formatJson = (str: string | null): string | null => {
  if (!str) return null;
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
};
