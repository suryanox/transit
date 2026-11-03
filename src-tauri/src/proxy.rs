use actix_web::{App, HttpRequest, HttpResponse, HttpServer, web};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use reqwest::Client;
use std::collections::HashMap;
use std::io;
use std::net::TcpListener;
use std::sync::Arc;
use std::time::Instant;
use tauri::AppHandle;
use tauri::Emitter;
use url::Url;
use uuid::Uuid;

use crate::{AppState, ProxyEndpoint, RequestLog};

struct ProxyState {
    client: Client,
    endpoint: ProxyEndpoint,
    app_state: Arc<AppState>,
    app_handle: Option<AppHandle>,
}

fn body_for_log(body: &[u8]) -> String {
    match std::str::from_utf8(body) {
        Ok(text) => text.to_string(),
        Err(_) => format!("base64:{}", BASE64.encode(body)),
    }
}

fn target_url(base: &Url, request: &HttpRequest) -> Result<Url, url::ParseError> {
    let base_path = base.path().trim_end_matches('/');
    let request_path = request.uri().path().trim_start_matches('/');
    let joined_path = if base_path.is_empty() {
        format!("/{request_path}")
    } else if request_path.is_empty() {
        base_path.to_string()
    } else {
        format!("{base_path}/{request_path}")
    };

    let mut target = base.clone();
    target.set_path(&joined_path);
    target.set_query(request.uri().query());
    Ok(target)
}

async fn proxy_handler(
    req: HttpRequest,
    body: web::Bytes,
    state: web::Data<ProxyState>,
) -> HttpResponse {
    let start = Instant::now();
    let method_name = req.method().to_string();
    let path = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let mut request_headers: HashMap<String, String> = HashMap::new();
    for (key, value) in req.headers() {
        if let Ok(v) = value.to_str() {
            request_headers.insert(key.to_string(), v.to_string());
        }
    }

    let query_params: HashMap<String, String> = req
        .uri()
        .query()
        .map(|query| {
            url::form_urlencoded::parse(query.as_bytes())
                .map(|(key, value)| (key.into_owned(), value.into_owned()))
                .collect()
        })
        .unwrap_or_default();

    let request_body = (!body.is_empty()).then(|| body_for_log(&body));
    let base = match Url::parse(&state.endpoint.destination_url) {
        Ok(url) => url,
        Err(_) => return HttpResponse::BadGateway().body("Invalid proxy destination"),
    };
    let target_url = match target_url(&base, &req) {
        Ok(url) => url,
        Err(_) => return HttpResponse::BadGateway().body("Invalid proxy destination"),
    };

    let request_method = reqwest::Method::from_bytes(req.method().as_str().as_bytes())
        .unwrap_or(reqwest::Method::GET);
    let mut req_builder = state.client.request(request_method, target_url);

    for (key, value) in &request_headers {
        if key.to_lowercase() != "host" && key.to_lowercase() != "connection" {
            req_builder = req_builder.header(key.as_str(), value.as_str());
        }
    }

    if request_body.is_some() {
        req_builder = req_builder.body(body.clone());
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
            let body = resp.bytes().await.ok().map(|bytes| bytes.to_vec());
            (status, headers, body)
        }
        Err(e) => {
            let mut headers = HashMap::new();
            headers.insert("x-proxy-error".to_string(), e.to_string());
            (
                502,
                headers,
                Some(format!("Proxy Error: {}", e).into_bytes()),
            )
        }
    };

    let duration_ms = start.elapsed().as_millis() as u64;

    let log = RequestLog {
        id: Uuid::new_v4().to_string(),
        endpoint_id: state.endpoint.id.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        method: method_name,
        path: path.to_string(),
        request_headers,
        request_body,
        query_params,
        response_status,
        response_headers: response_headers.clone(),
        response_body: response_body.as_deref().map(body_for_log),
        duration_ms,
    };

    if let Some(logs) = state.app_state.logs.write().get_mut(&state.endpoint.id) {
        logs.push(log.clone());
    }
    if let Some(app_handle) = &state.app_handle {
        let _ = app_handle.emit("request-log", &log);
    }

    let mut http_response = HttpResponse::build(
        actix_web::http::StatusCode::from_u16(response_status)
            .unwrap_or(actix_web::http::StatusCode::OK),
    );

    for (key, value) in &response_headers {
        let lower = key.to_lowercase();
        if lower != "transfer-encoding" && lower != "content-length" && lower != "content-encoding"
        {
            http_response.insert_header((key.as_str(), value.as_str()));
        }
    }

    match response_body {
        Some(body) => http_response.body(body),
        None => http_response.finish(),
    }
}

pub async fn start_proxy_server(
    endpoint: ProxyEndpoint,
    app_state: Arc<AppState>,
    listener: TcpListener,
    app_handle: Option<AppHandle>,
) -> io::Result<()> {
    let endpoint_id = endpoint.id.clone();

    let proxy_state = web::Data::new(ProxyState {
        client: Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(io::Error::other)?,
        endpoint,
        app_state: app_state.clone(),
        app_handle,
    });

    let server = HttpServer::new(move || {
        App::new()
            .app_data(proxy_state.clone())
            .default_service(web::route().to(proxy_handler))
    })
    .listen(listener)?
    .disable_signals()
    .run();

    let handle = server.handle();
    app_state.servers.write().insert(endpoint_id, handle);

    server.await
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{App, HttpResponse, body::to_bytes, http::StatusCode, test as aw_test, web};
    use std::sync::Arc;

    fn endpoint(destination_url: String) -> ProxyEndpoint {
        ProxyEndpoint {
            id: "test-endpoint".to_string(),
            local_port: 0,
            destination_url,
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn logs_utf8_body_as_text() {
        assert_eq!(body_for_log(b"{\"ok\":true}"), "{\"ok\":true}");
    }

    #[test]
    fn logs_binary_body_as_base64() {
        assert_eq!(body_for_log(&[0, 1, 2, 255]), "base64:AAEC/w==");
    }

    #[test]
    fn joins_destination_path_and_replaces_query() {
        let base = Url::parse("https://example.com/api/").unwrap();
        let request =
            aw_test::TestRequest::with_uri("/users/42?name=hello%20world").to_http_request();

        assert_eq!(
            target_url(&base, &request).unwrap().as_str(),
            "https://example.com/api/users/42?name=hello%20world"
        );
    }

    #[test]
    fn joins_root_destination_without_duplicate_slashes() {
        let base = Url::parse("https://example.com").unwrap();
        let request = aw_test::TestRequest::with_uri("/?a=1").to_http_request();

        assert_eq!(
            target_url(&base, &request).unwrap().as_str(),
            "https://example.com/?a=1"
        );
    }

    #[actix_rt::test]
    #[ignore = "requires a loopback listener; run in CI or a normal developer environment"]
    async fn forwards_method_path_query_headers_and_binary_body() {
        let upstream_listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let upstream_port = upstream_listener.local_addr().unwrap().port();
        let upstream_server = HttpServer::new(|| {
            App::new().default_service(web::route().to(
                |req: HttpRequest, body: web::Bytes| async move {
                    let response_body = vec![0, 1, 2, 255];
                    HttpResponse::build(StatusCode::CREATED)
                        .insert_header(("x-seen-method", req.method().as_str()))
                        .insert_header(("x-seen-path", req.uri().path()))
                        .insert_header(("x-seen-query", req.uri().query().unwrap_or_default()))
                        .insert_header(("x-seen-body-length", body.len().to_string()))
                        .body(response_body)
                },
            ))
        })
        .listen(upstream_listener)
        .unwrap()
        .run();
        let upstream_handle = upstream_server.handle();
        actix_rt::spawn(upstream_server);

        let app_state = Arc::new(AppState::new());
        app_state
            .logs
            .write()
            .insert("test-endpoint".to_string(), Vec::new());
        let proxy_state = web::Data::new(ProxyState {
            client: Client::builder().build().unwrap(),
            endpoint: endpoint(format!("http://127.0.0.1:{upstream_port}/api")),
            app_state: app_state.clone(),
        });
        let app = aw_test::init_service(
            App::new()
                .app_data(proxy_state)
                .default_service(web::route().to(proxy_handler)),
        )
        .await;

        let request_body = vec![0, 255, 10, 20];
        let request = aw_test::TestRequest::put()
            .uri("/users/42?name=hello%20world")
            .insert_header(("x-request-id", "test-request"))
            .set_payload(request_body.clone())
            .to_request();
        let response = aw_test::call_service(&app, request).await;
        let status = response.status();
        let seen_method = response.headers().get("x-seen-method").unwrap().clone();
        let seen_path = response.headers().get("x-seen-path").unwrap().clone();
        let seen_query = response.headers().get("x-seen-query").unwrap().clone();
        let seen_body_length = response
            .headers()
            .get("x-seen-body-length")
            .unwrap()
            .clone();
        let response_body = to_bytes(response.into_body()).await.unwrap();

        assert_eq!(status, StatusCode::CREATED);
        assert_eq!(seen_method, "PUT");
        assert_eq!(seen_path, "/api/users/42");
        assert_eq!(seen_query, "name=hello%20world");
        assert_eq!(seen_body_length, "4");
        assert_eq!(response_body.as_ref(), &[0, 1, 2, 255]);

        {
            let logs = app_state.logs.read();
            let log = &logs["test-endpoint"][0];
            assert_eq!(log.method, "PUT");
            assert_eq!(log.path, "/users/42?name=hello%20world");
            assert_eq!(
                log.query_params.get("name"),
                Some(&"hello world".to_string())
            );
            assert_eq!(log.request_body.as_deref(), Some("base64:AP8KFA=="));
            assert_eq!(log.response_body.as_deref(), Some("base64:AAEC/w=="));
        }

        upstream_handle.stop(false).await;
    }

    #[actix_rt::test]
    async fn returns_bad_gateway_and_logs_upstream_errors() {
        let app_state = Arc::new(AppState::new());
        app_state
            .logs
            .write()
            .insert("test-endpoint".to_string(), Vec::new());
        let proxy_state = web::Data::new(ProxyState {
            client: Client::builder().build().unwrap(),
            endpoint: endpoint("http://127.0.0.1:1".to_string()),
            app_state: app_state.clone(),
        });
        let app = aw_test::init_service(
            App::new()
                .app_data(proxy_state)
                .default_service(web::route().to(proxy_handler)),
        )
        .await;

        let response = aw_test::call_service(
            &app,
            aw_test::TestRequest::get().uri("/health").to_request(),
        )
        .await;

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        assert_eq!(app_state.logs.read()["test-endpoint"].len(), 1);
        assert!(
            app_state.logs.read()["test-endpoint"][0]
                .response_headers
                .contains_key("x-proxy-error")
        );
    }
}
