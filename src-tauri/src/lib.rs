// Fouc Rust 薄壳 —— 唯一逻辑职责：TS 后端进程看护。
//
// 启动协议：
//   1. 选取空闲端口、生成随机 token
//   2. 以 userData 为 FOUC_DATA_DIR spawn 后端（开发：bun 源码；生产：sidecar 二进制）
//   3. 轮询 /health，就绪后通知前端；进程退出按 1s/5s/30s 退避重启
//   4. 应用退出前 POST /shutdown 优雅关停

use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use std::sync::Arc;

use rand::RngCore;
use tauri::{AppHandle, Emitter, Manager, State};

pub type SharedBackendState = Arc<BackendState>;

pub struct BackendState {
    inner: Mutex<BackendInner>,
}

struct BackendInner {
    port: u16,
    token: String,
    child: Option<Child>,
    restart_count: u32,
    last_start: Option<Instant>,
}

const BACKEND_READY_EVENT: &str = "backend://ready";
const BACKEND_DOWN_EVENT: &str = "backend://down";

fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn pick_free_port() -> Option<u16> {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
}

impl BackendState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(BackendInner {
                port: 0,
                token: String::new(),
                child: None,
                restart_count: 0,
                last_start: None,
            }),
        }
    }
}

/// 解析后端启动命令：开发模式跑 `bun run backend/src/index.ts`，
/// 生产模式使用随包分发的 sidecar 二进制 fouc-backend。
fn backend_command(_app: &AppHandle, port: u16, token: &str, data_dir: &str) -> Option<Command> {
    let mut cmd = if cfg!(debug_assertions) {
        // 开发模式：编译期仓库根（tauri dev 的 cwd 是 src-tauri，不可靠）
        let repo_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent()?.to_path_buf();
        let mut c = Command::new("bun");
        c.arg("run").arg(repo_root.join("backend/src/index.ts"));
        c
    } else {
        Command::new(current_exe_dir()?.join(sidecar_name()))
    };
    cmd.env("FOUC_BACKEND_PORT", port.to_string())
        .env("FOUC_BACKEND_TOKEN", token)
        .env("FOUC_DATA_DIR", data_dir)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null());
    Some(cmd)
}

fn current_exe_dir() -> Option<std::path::PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
}

fn sidecar_name() -> &'static str {
    if cfg!(windows) {
        "fouc-backend.exe"
    } else {
        "fouc-backend"
    }
}

fn spawn_backend(app: &AppHandle, state: SharedBackendState) {
    let data_dir = app
        .path()
        .app_data_dir()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(dirs_fallback);

    let mut inner = state.inner.lock().unwrap();
    if inner.port == 0 {
        inner.port = pick_free_port().unwrap_or(8710);
    }
    if inner.token.is_empty() {
        inner.token = generate_token();
    }

    match backend_command(app, inner.port, &inner.token, &data_dir) {
        Some(mut cmd) => match cmd.spawn() {
            Ok(child) => {
                inner.child = Some(child);
                inner.last_start = Some(Instant::now());
                let port = inner.port;
                drop(inner);
                log_info(&format!("backend spawned on port {port}"));
                spawn_health_watch(app.clone(), state, port);
            }
            Err(error) => {
                let message = format!("failed to spawn backend: {error}");
                log_warn(&message);
                let _ = app.emit(BACKEND_DOWN_EVENT, message);
            }
        },
        None => {
            log_warn("failed to resolve backend command");
        }
    }
}

fn dirs_fallback() -> String {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(|home| format!("{home}.fouc"))
        .unwrap_or_else(|_| ".fouc".to_string())
}

/// 健康监视：就绪事件 + 崩溃退避重启（1s/5s/30s 封顶）
fn spawn_health_watch(app: AppHandle, state: SharedBackendState, port: u16) {
    std::thread::spawn(move || {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("http client");
        let health_url = format!("http://127.0.0.1:{port}/health");
        let mut ready_announced = false;

        loop {
            std::thread::sleep(Duration::from_millis(500));

            let healthy = client
                .get(&health_url)
                .send()
                .map(|r| r.status().is_success())
                .unwrap_or(false);
            if healthy {
                if !ready_announced {
                    ready_announced = true;
                    let _ = app.emit(BACKEND_READY_EVENT, port);
                    if let Ok(mut inner) = state.inner.lock() {
                        inner.restart_count = 0;
                    }
                }
                continue;
            }

            if ready_announced {
                ready_announced = false;
                let _ = app.emit(BACKEND_DOWN_EVENT, "backend lost — restarting");
            }

            // 进程还活着但健康检查不过：启动窗口（60s）内继续等待
            let running = state
                .inner
                .lock()
                .map(|mut inner| {
                    inner
                        .child
                        .as_mut()
                        .map(|c| c.try_wait().map(|s| s.is_none()).unwrap_or(false))
                        .unwrap_or(false)
                })
                .unwrap_or(false);
            let in_startup_window = state
                .inner
                .lock()
                .map(|inner| {
                    inner
                        .last_start
                        .map(|t| t.elapsed() < Duration::from_secs(60))
                        .unwrap_or(false)
                })
                .unwrap_or(false);
            if running && in_startup_window {
                continue;
            }

            // 进程死亡或超窗：退避重启
            let backoff = {
                let mut inner = state.inner.lock().unwrap();
                inner.child = None;
                let delay = match inner.restart_count {
                    0 => 1,
                    1 | 2 => 5,
                    _ => 30,
                };
                inner.restart_count += 1;
                delay
            };
            log_warn(&format!("backend down — restarting in {backoff}s"));
            std::thread::sleep(Duration::from_secs(backoff));
            spawn_backend(&app, state.clone());
        }
    });
}

fn log_info(message: &str) {
    println!("[fouc-shell] {message}");
}

fn log_warn(message: &str) {
    eprintln!("[fouc-shell] {message}");
}

/// 前端取后端连接信息（仅 WebView 内可调用）
#[tauri::command]
fn get_backend_endpoint(state: State<'_, SharedBackendState>) -> Result<serde_json::Value, String> {
    let inner = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "baseUrl": format!("http://127.0.0.1:{}", inner.port),
        "token": inner.token,
    }))
}

/// 优雅关停：先 POST /shutdown 再兜底 kill
fn shutdown_backend(state: &BackendState) {
    if let Ok(mut inner) = state.inner.lock() {
        let port = inner.port;
        let token = inner.token.clone();
        if let Some(mut child) = inner.child.take() {
            if port > 0 {
                if let Ok(client) = reqwest::blocking::Client::builder()
                    .timeout(Duration::from_secs(3))
                    .build()
                {
                    let url = format!("http://127.0.0.1:{port}/shutdown");
                    let _ = client.post(&url).header("authorization", format!("Bearer {token}")).send();
                }
            }
            std::thread::sleep(Duration::from_millis(300));
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub fn run() {
    let state: SharedBackendState = Arc::new(BackendState::new());

    tauri::Builder::default()
        .manage(state.clone())
        .invoke_handler(tauri::generate_handler![get_backend_endpoint])
        .setup(move |app| {
            let handle = app.handle().clone();
            spawn_backend(&handle, state.clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<SharedBackendState>() {
                    shutdown_backend(&state);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Fouc");
}
