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

use std::sync::OnceLock;

static APP_STATE: OnceLock<SharedState> = OnceLock::new();

fn get_state() -> SharedState {
    APP_STATE
        .get_or_init(|| Arc::new(AppState::new()))
        .clone()
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
    state
        .endpoints
        .write()
        .insert(id.clone(), endpoint.clone());
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
            clear_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
