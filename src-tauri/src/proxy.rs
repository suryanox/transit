use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer};
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

use crate::{AppState, ProxyEndpoint, RequestLog};

struct ProxyState {
    client: Client,
    endpoint: ProxyEndpoint,
    app_state: Arc<AppState>,
}

async fn proxy_handler(
    req: HttpRequest,
    body: web::Bytes,
    state: web::Data<ProxyState>,
) -> HttpResponse {
    let start = Instant::now();
    let method = req.method().to_string();
    let path = req.uri().path_and_query().map(|pq| pq.as_str()).unwrap_or("/");
    
    let mut request_headers: HashMap<String, String> = HashMap::new();
    for (key, value) in req.headers() {
        if let Ok(v) = value.to_str() {
            request_headers.insert(key.to_string(), v.to_string());
        }
    }

    let mut query_params: HashMap<String, String> = HashMap::new();
    if let Some(query) = req.uri().query() {
        for pair in query.split('&') {
            let mut parts = pair.splitn(2, '=');
            if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
                query_params.insert(key.to_string(), value.to_string());
            }
        }
    }

    let request_body = if body.is_empty() {
        None
    } else {
        String::from_utf8(body.to_vec()).ok()
    };

    let base = state.endpoint.destination_url.trim_end_matches('/');
    let target_url = if path == "/" {
        base.to_string()
    } else {
        format!("{}{}", base, path)
    };

    let mut req_builder = match req.method().as_str() {
        "GET" => state.client.get(&target_url),
        "POST" => state.client.post(&target_url),
        "PUT" => state.client.put(&target_url),
        "DELETE" => state.client.delete(&target_url),
        "PATCH" => state.client.patch(&target_url),
        "HEAD" => state.client.head(&target_url),
        _ => state.client.get(&target_url),
    };

    for (key, value) in &request_headers {
        if key.to_lowercase() != "host" && key.to_lowercase() != "connection" {
            req_builder = req_builder.header(key.as_str(), value.as_str());
        }
    }

    if let Some(ref body_str) = request_body {
        req_builder = req_builder.body(body_str.clone());
    }

    let (response_status, response_headers, response_body) = match req_builder.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let mut headers: HashMap<String, String> = HashMap::new();
            for (key, value) in resp.headers() {
                if let Ok(v) = value.to_str() {
                    headers.insert(key.to_string(), v.to_string());
                }
            }
            let body = resp.text().await.ok();
            (status, headers, body)
        }
        Err(e) => {
            let mut headers = HashMap::new();
            headers.insert("x-proxy-error".to_string(), e.to_string());
            (502, headers, Some(format!("Proxy Error: {}", e)))
        }
    };

    let duration_ms = start.elapsed().as_millis() as u64;

    let log = RequestLog {
        id: Uuid::new_v4().to_string(),
        endpoint_id: state.endpoint.id.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        method,
        path: path.to_string(),
        request_headers,
        request_body,
        query_params,
        response_status,
        response_headers: response_headers.clone(),
        response_body: response_body.clone(),
        duration_ms,
    };

    if let Some(logs) = state.app_state.logs.write().get_mut(&state.endpoint.id) {
        logs.push(log);
    }

    let mut http_response = HttpResponse::build(
        actix_web::http::StatusCode::from_u16(response_status).unwrap_or(actix_web::http::StatusCode::OK)
    );

    for (key, value) in &response_headers {
        let lower = key.to_lowercase();
        if lower != "transfer-encoding"
            && lower != "content-length" 
            && lower != "content-encoding" 
        {
            http_response.insert_header((key.as_str(), value.as_str()));
        }
    }

    match response_body {
        Some(body) => http_response.body(body),
        None => http_response.finish(),
    }
}

pub async fn start_proxy_server(endpoint: ProxyEndpoint, app_state: Arc<AppState>) {
    let port = endpoint.port();
    let endpoint_id = endpoint.id.clone();
    
    let proxy_state = web::Data::new(ProxyState {
        client: Client::builder()
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap(),
        endpoint,
        app_state: app_state.clone(),
    });

    let server = HttpServer::new(move || {
        App::new()
            .app_data(proxy_state.clone())
            .default_service(web::route().to(proxy_handler))
    })
    .bind(format!("127.0.0.1:{}", port))
    .unwrap()
    .disable_signals()
    .run();

    let handle = server.handle();
    app_state.servers.write().insert(endpoint_id, handle);

    let _ = server.await;
}

impl ProxyEndpoint {
    pub fn port(&self) -> u16 {
        self.local_port
    }
}
