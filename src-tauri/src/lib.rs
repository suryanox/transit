use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::thread;
use uuid::Uuid;

mod proxy;

#[derive(Clone, Serialize, Deserialize)]
pub struct ProxyEndpoint {
    pub id: String,
    pub local_port: u16,
    pub destination_url: String,
    pub created_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct RequestLog {
    pub id: String,
    pub endpoint_id: String,
    pub timestamp: String,
    pub method: String,
    pub path: String,
    pub request_headers: HashMap<String, String>,
    pub request_body: Option<String>,
    pub query_params: HashMap<String, String>,
    pub response_status: u16,
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
    pub duration_ms: u64,
}

pub struct AppState {
    pub endpoints: RwLock<HashMap<String, ProxyEndpoint>>,
    pub logs: RwLock<HashMap<String, Vec<RequestLog>>>,
    pub servers: RwLock<HashMap<String, actix_web::dev::ServerHandle>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            endpoints: RwLock::new(HashMap::new()),
            logs: RwLock::new(HashMap::new()),
            servers: RwLock::new(HashMap::new()),
        }
    }
}

type SharedState = Arc<AppState>;

use std::fmt::Write as FmtWrite;
use std::sync::OnceLock;

static APP_STATE: OnceLock<SharedState> = OnceLock::new();

fn get_state() -> SharedState {
    APP_STATE.get_or_init(|| Arc::new(AppState::new())).clone()
}

#[tauri::command]
fn create_proxy(destination_url: String) -> Result<ProxyEndpoint, String> {
    let port = portpicker::pick_unused_port().ok_or("No available ports")?;
    let id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();

    let endpoint = ProxyEndpoint {
        id: id.clone(),
        local_port: port,
        destination_url: destination_url.clone(),
        created_at,
    };

    let state = get_state();
    state.endpoints.write().insert(id.clone(), endpoint.clone());
    state.logs.write().insert(id.clone(), Vec::new());

    let endpoint_clone = endpoint.clone();
    let state_clone = state.clone();

    thread::spawn(move || {
        let rt = actix_rt::Runtime::new().unwrap();
        rt.block_on(async {
            proxy::start_proxy_server(endpoint_clone, state_clone).await;
        });
    });

    Ok(endpoint)
}

#[tauri::command]
fn get_endpoints() -> Vec<ProxyEndpoint> {
    let state = get_state();
    let endpoints = state.endpoints.read().values().cloned().collect();
    endpoints
}

#[tauri::command]
fn get_logs(endpoint_id: String) -> Vec<RequestLog> {
    let state = get_state();
    let logs = state
        .logs
        .read()
        .get(&endpoint_id)
        .cloned()
        .unwrap_or_default();
    logs
}

#[tauri::command]
fn get_log_detail(endpoint_id: String, log_id: String) -> Option<RequestLog> {
    let state = get_state();
    let log = state
        .logs
        .read()
        .get(&endpoint_id)
        .and_then(|logs| logs.iter().find(|l| l.id == log_id).cloned());
    log
}

#[tauri::command]
fn delete_endpoint(endpoint_id: String) -> Result<(), String> {
    let state = get_state();

    if let Some(handle) = state.servers.write().remove(&endpoint_id) {
        std::thread::spawn(move || {
            let rt = actix_rt::Runtime::new().unwrap();
            rt.block_on(async {
                handle.stop(false).await;
            });
        })
        .join()
        .map_err(|_| "Failed to stop server")?;
    }

    state.endpoints.write().remove(&endpoint_id);
    state.logs.write().remove(&endpoint_id);

    Ok(())
}

#[tauri::command]
fn clear_logs(endpoint_id: String) -> Result<(), String> {
    let state = get_state();
    if let Some(logs) = state.logs.write().get_mut(&endpoint_id) {
        logs.clear();
    }
    Ok(())
}

fn pdf_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
        .replace('\n', " ")
        .replace('\r', " ")
}

fn pdf_lines(value: &str, width: usize) -> Vec<String> {
    if value.is_empty() {
        return vec![String::new()];
    }

    let mut lines = Vec::new();
    for source_line in value.lines() {
        let mut current = String::new();
        for word in source_line.split_whitespace() {
            if current.len() + word.len() + usize::from(!current.is_empty()) > width {
                if !current.is_empty() {
                    lines.push(current);
                    current = String::new();
                }

                if word.len() > width {
                    let mut remaining = word;
                    while remaining.len() > width {
                        let (chunk, rest) = remaining.split_at(width);
                        lines.push(chunk.to_string());
                        remaining = rest;
                    }
                    current.push_str(remaining);
                } else {
                    current.push_str(word);
                }
            } else {
                if !current.is_empty() {
                    current.push(' ');
                }
                current.push_str(word);
            }
        }
        lines.push(current);
    }
    lines
}

fn add_pdf_text(content: &mut String, x: i32, y: &mut i32, text: &str, size: i32, bold: bool) {
    let font = if bold { "/F2" } else { "/F1" };
    for line in pdf_lines(text, 104) {
        let _ = writeln!(
            content,
            "BT {} {} Tf {} {} Td ({}) Tj ET",
            font,
            size,
            x,
            *y,
            pdf_escape(&line)
        );
        *y -= if size >= 15 { 24 } else { 15 };
    }
}

fn render_pdf(endpoint: &ProxyEndpoint, logs: &[RequestLog]) -> Vec<u8> {
    const PAGE_WIDTH: i32 = 612;
    const PAGE_HEIGHT: i32 = 792;
    const TOP: i32 = 750;
    const BOTTOM: i32 = 48;

    let mut pages: Vec<String> = Vec::new();
    let mut content = String::new();
    let mut y = TOP;

    let finish_page = |pages: &mut Vec<String>, content: &mut String| {
        if !content.is_empty() {
            pages.push(std::mem::take(content));
        }
    };

    let ensure_space = |pages: &mut Vec<String>, content: &mut String, y: &mut i32, needed: i32| {
        if *y - needed < BOTTOM {
            finish_page(pages, content);
            *y = TOP;
        }
    };

    add_pdf_text(
        &mut content,
        48,
        &mut y,
        "Transit Proxy Log Export",
        18,
        true,
    );
    y -= 4;
    add_pdf_text(
        &mut content,
        48,
        &mut y,
        &format!("Proxy: http://localhost:{}", endpoint.local_port),
        10,
        false,
    );
    add_pdf_text(
        &mut content,
        48,
        &mut y,
        &format!("Destination: {}", endpoint.destination_url),
        10,
        false,
    );
    add_pdf_text(
        &mut content,
        48,
        &mut y,
        &format!("Requests exported: {}", logs.len()),
        10,
        false,
    );
    y -= 8;

    for (index, log) in logs.iter().enumerate() {
        ensure_space(&mut pages, &mut content, &mut y, 90);
        add_pdf_text(
            &mut content,
            48,
            &mut y,
            &format!("Request {} — {} {}", index + 1, log.method, log.path),
            14,
            true,
        );
        add_pdf_text(
            &mut content,
            48,
            &mut y,
            &format!(
                "{}  |  Status: {}  |  Duration: {} ms",
                log.timestamp, log.response_status, log.duration_ms
            ),
            9,
            false,
        );

        let sections = [
            ("Query parameters", format_map(&log.query_params)),
            ("Request headers", format_map(&log.request_headers)),
            (
                "Request body",
                log.request_body
                    .clone()
                    .unwrap_or_else(|| "(empty)".to_string()),
            ),
            ("Response headers", format_map(&log.response_headers)),
            (
                "Response body",
                log.response_body
                    .clone()
                    .unwrap_or_else(|| "(empty)".to_string()),
            ),
        ];

        for (label, value) in sections {
            ensure_space(&mut pages, &mut content, &mut y, 45);
            add_pdf_text(&mut content, 60, &mut y, label, 10, true);
            for line in pdf_lines(&value, 96) {
                ensure_space(&mut pages, &mut content, &mut y, 15);
                add_pdf_text(&mut content, 72, &mut y, &line, 8, false);
            }
            y -= 3;
        }
        y -= 8;
    }
    finish_page(&mut pages, &mut content);

    let page_count = pages.len().max(1);
    let font_regular = 3;
    let font_bold = 4;
    let first_page = font_bold + 1;
    let page_objects = first_page..first_page + page_count;
    let content_objects_start = first_page + page_count;
    let object_count = content_objects_start + page_count - 1;

    let mut pdf = String::from("%PDF-1.4\n");
    let mut offsets: Vec<usize> = vec![0];
    let add_object = |number: usize, body: String, pdf: &mut String, offsets: &mut Vec<usize>| {
        offsets.push(pdf.len());
        let _ = write!(pdf, "{} 0 obj\n{}\nendobj\n", number, body);
    };

    add_object(
        1,
        format!("<< /Type /Catalog /Pages 2 0 R >>"),
        &mut pdf,
        &mut offsets,
    );
    let kids = page_objects
        .clone()
        .map(|n| format!("{} 0 R", n))
        .collect::<Vec<_>>()
        .join(" ");
    add_object(
        2,
        format!("<< /Type /Pages /Kids [{}] /Count {} >>", kids, page_count),
        &mut pdf,
        &mut offsets,
    );
    add_object(
        font_regular,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        &mut pdf,
        &mut offsets,
    );
    add_object(
        font_bold,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".to_string(),
        &mut pdf,
        &mut offsets,
    );

    for (page_index, page_number) in page_objects.enumerate() {
        let content_number = content_objects_start + page_index;
        add_object(
            page_number,
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Resources << /Font << /F1 {} 0 R /F2 {} 0 R >> >> /Contents {} 0 R >>",
                PAGE_WIDTH, PAGE_HEIGHT, font_regular, font_bold, content_number
            ),
            &mut pdf,
            &mut offsets,
        );
        let stream = pages.get(page_index).cloned().unwrap_or_default();
        add_object(
            content_number,
            format!(
                "<< /Length {} >>\nstream\n{}endstream",
                stream.len(),
                stream
            ),
            &mut pdf,
            &mut offsets,
        );
    }

    let xref_offset = pdf.len();
    let _ = writeln!(pdf, "xref\n0 {}", object_count + 1);
    pdf.push_str("0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        let _ = writeln!(pdf, "{:010} 00000 n ", offset);
    }
    let _ = write!(
        pdf,
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF",
        object_count + 1,
        xref_offset
    );
    pdf.into_bytes()
}

fn format_map(values: &HashMap<String, String>) -> String {
    if values.is_empty() {
        return "(empty)".to_string();
    }
    let mut entries = values.iter().collect::<Vec<_>>();
    entries.sort_by(|a, b| a.0.cmp(b.0));
    entries
        .into_iter()
        .map(|(key, value)| format!("{}: {}", key, value))
        .collect::<Vec<_>>()
        .join("\n")
}

#[tauri::command]
fn export_logs_pdf(endpoint_id: String) -> Result<Vec<u8>, String> {
    let state = get_state();
    let endpoint = state
        .endpoints
        .read()
        .get(&endpoint_id)
        .cloned()
        .ok_or("Proxy not found")?;
    let logs = state
        .logs
        .read()
        .get(&endpoint_id)
        .cloned()
        .unwrap_or_default();
    Ok(render_pdf(&endpoint, &logs))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            create_proxy,
            get_endpoints,
            get_logs,
            get_log_detail,
            delete_endpoint,
            clear_logs,
            export_logs_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
