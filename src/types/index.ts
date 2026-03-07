export interface ProxyEndpoint {
  id: string;
  local_port: number;
  destination_url: string;
  created_at: string;
}

export interface RequestLog {
  id: string;
  endpoint_id: string;
  timestamp: string;
  method: string;
  path: string;
  request_headers: Record<string, string>;
  request_body: string | null;
  query_params: Record<string, string>;
  response_status: number;
  response_headers: Record<string, string>;
  response_body: string | null;
  duration_ms: number;
}
