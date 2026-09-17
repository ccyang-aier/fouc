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

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// 控制台子进程不弹黑窗（GUI 子系统进程 spawn 控制台程序时 Windows 会新建控制台）
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

use std::sync::Arc;

use rand::RngCore;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

pub type SharedBackendState = Arc<BackendState>;

pub struct BackendState {
    inner: Mutex<BackendInner>,
}

struct BackendInner {
    port: u16,
    token: String,
    internal_token: String,
    child: Option<Child>,
    restart_count: u32,
    last_start: Option<Instant>,
    /// 健康监视线程只启动一次（每次 spawn 都另起 watcher 会随重启累积、双重拉起）
    watcher_running: bool,
}

const BACKEND_READY_EVENT: &str = "backend://ready";
const BACKEND_DOWN_EVENT: &str = "backend://down";

fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn pick_free_port() -> Option<u16> {
    // 3000 = 前端 dev 端口、8710 = 后端 dev 端口：打包实例必须避开——
    // 开发者同时跑着 dev server 时会互相抢端口，健康检查打到 dev server
    // 返回 404，导致壳误杀健康后端、陷入重启循环
    loop {
        let listener = TcpListener::bind("127.0.0.1:0").ok()?;
        let port = listener.local_addr().ok()?.port();
        drop(listener);
        if port != 3000 && port != 8710 {
            return Some(port);
        }
    }
}

impl BackendState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(BackendInner {
                port: 0,
                token: String::new(),
                internal_token: String::new(),
                child: None,
                restart_count: 0,
                last_start: None,
                watcher_running: false,
            }),
        }
    }
}

/// 解析后端启动命令：开发模式跑 `bun run backend/src/index.ts`，
/// 生产模式使用随包分发的 sidecar 二进制 fouc-backend。
fn backend_command(_app: &AppHandle, port: u16, token: &str, internal_token: &str, data_dir: &str) -> Option<Command> {
    let mut cmd = if cfg!(debug_assertions) {
        // 开发模式：编译期仓库根（tauri dev 的 cwd 是 src-tauri，不可靠）
        let repo_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent()?.to_path_buf();
        let mut c = Command::new("bun");
        c.arg("run").arg(repo_root.join("backend/src/index.ts"));
        c
    } else {
        Command::new(current_exe_dir()?.join(sidecar_name()))
    };

    // 后端 stdout/stderr 落盘 userData/logs/backend.log（排查问题；无文件则丢弃）
    cmd.env("FOUC_BACKEND_PORT", port.to_string())
        .env("FOUC_BACKEND_TOKEN", token)
        .env("FOUC_INTERNAL_TOKEN", internal_token)
        .env("FOUC_DATA_DIR", data_dir)
        .stdout(backend_log_stdio(data_dir))
        .stderr(backend_log_stdio(data_dir))
        .stdin(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    Some(cmd)
}

fn backend_log_stdio(data_dir: &str) -> Stdio {
    std::fs::create_dir_all(std::path::Path::new(data_dir).join("logs"))
        .ok()
        .and_then(|_| {
            std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(std::path::Path::new(data_dir).join("logs").join("backend.log"))
                .ok()
        })
        .map(Stdio::from)
        .unwrap_or(Stdio::null())
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
    if inner.internal_token.is_empty() {
        inner.internal_token = generate_token();
    }

    match backend_command(app, inner.port, &inner.token, &inner.internal_token, &data_dir) {
        Some(mut cmd) => match cmd.spawn() {
            Ok(child) => {
                inner.child = Some(child);
                inner.last_start = Some(Instant::now());
                let port = inner.port;
                let start_watcher = !inner.watcher_running;
                inner.watcher_running = true;
                drop(inner);
                log_info(&format!("backend spawned on port {port}"));
                if start_watcher {
                    spawn_health_watch(app.clone(), state, port);
                }
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
///
/// 判死纪律：单次超时不算（Agent 启动期的子进程孵化会短暂阻塞事件循环），
/// 连续 5 次失败才判死；判死后先 kill 旧子进程再退避重启——旧进程可能只是
/// 阻塞未退，留着会占住端口，让重启的新后端陷入 EADDRINUSE 幽灵循环。
fn spawn_health_watch(app: AppHandle, state: SharedBackendState, port: u16) {
    std::thread::spawn(move || {
        // 回环健康检查绝不走代理：系统代理（如 Clash）会拦截/丢弃 127.0.0.1
        // 请求，导致健康后端被误判死亡、陷入杀重启循环
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("http client");
        let health_url = format!("http://127.0.0.1:{port}/health");
        let mut ready_announced = false;
        let mut failures: u32 = 0;

        loop {
            std::thread::sleep(Duration::from_millis(500));

            let healthy = client
                .get(&health_url)
                .send()
                .map(|r| r.status().is_success())
                .unwrap_or(false);
            if healthy {
                failures = 0;
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
            failures += 1;
            if failures < 5 {
                continue;
            }
            failures = 0;

            // 判死：清掉旧子进程（可能仍在运行并占住端口），再退避重启
            let backoff = {
                let mut inner = state.inner.lock().unwrap();
                if let Some(mut child) = inner.child.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CookieHandoff {
    name: String,
    value: String,
    domain: String,
    path: String,
    secure: bool,
    http_only: bool,
    expires_at: Option<i64>,
}

/// 打开 DTS 官方 SSO 受管窗口。窗口 label 不匹配任何 capability，远程页面无 IPC 权限。
#[tauri::command]
fn open_dts_auth(
    app: AppHandle,
    state: State<'_, SharedBackendState>,
    interaction_id: String,
    url: String,
) -> Result<(), String> {
    let parsed = url.parse().map_err(|_| "invalid DTS login URL".to_string())?;
    if !is_allowed_dts_url(&parsed) {
        return Err("DTS login URL is outside the allowed domain".into());
    }
    let label = format!("dts-auth-{}", interaction_id.replace('-', ""));
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }
    let profile_dir = app.path().app_data_dir().map_err(|error| error.to_string())?
        .join("auth-profiles").join("dts");
    std::fs::create_dir_all(&profile_dir).map_err(|error| error.to_string())?;
    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
        .title("登录 DTS")
        .inner_size(1040.0, 760.0)
        .min_inner_size(760.0, 560.0)
        .center()
        .resizable(true)
        .devtools(false)
        .data_directory(profile_dir)
        .on_navigation(is_allowed_dts_url)
        .build()
        .map_err(|error| error.to_string())?;

    let (port, internal_token) = {
        let inner = state.inner.lock().map_err(|error| error.to_string())?;
        (inner.port, inner.internal_token.clone())
    };
    let poll_app = app.clone();
    let poll_label = label.clone();
    std::thread::spawn(move || poll_dts_auth(poll_app, poll_label, interaction_id, port, internal_token));
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

/// 断开 DTS 时撤销专用浏览器 Profile，确保下一次连接必须重新建立官方 SSO 会话。
#[tauri::command]
fn clear_dts_auth_profile(app: AppHandle) -> Result<(), String> {
    for (label, window) in app.webview_windows() {
        if label.starts_with("dts-auth-") {
            let _ = window.close();
        }
    }
    let profile_dir = app.path().app_data_dir().map_err(|error| error.to_string())?
        .join("auth-profiles").join("dts");
    if !profile_dir.exists() {
        return Ok(());
    }
    for attempt in 0..5 {
        match std::fs::remove_dir_all(&profile_dir) {
            Ok(()) => return Ok(()),
            Err(error) if attempt == 4 => return Err(format!("failed to clear DTS auth profile: {error}")),
            Err(_) => std::thread::sleep(Duration::from_millis(120)),
        }
    }
    Ok(())
}

fn is_allowed_dts_url(url: &tauri::Url) -> bool {
    url.scheme() == "https"
        && url.host_str().is_some_and(|host| host == "xfusion.com" || host.ends_with(".xfusion.com"))
}

fn poll_dts_auth(app: AppHandle, label: String, interaction_id: String, port: u16, internal_token: String) {
    let client = match reqwest::blocking::Client::builder().no_proxy().timeout(Duration::from_secs(20)).build() {
        Ok(value) => value,
        Err(_) => return,
    };
    let cookie_url: tauri::Url = match "https://clouddragon.xfusion.com/dts/DTSPortal/workspace".parse() {
        Ok(value) => value,
        Err(_) => return,
    };
    let endpoint = format!("http://127.0.0.1:{port}/internal/connectors/dts/auth-handoff");
    let cancel_endpoint = format!("http://127.0.0.1:{port}/internal/connectors/dts/auth-cancel");
    for _ in 0..300 {
        std::thread::sleep(Duration::from_secs(2));
        let Some(window) = app.get_webview_window(&label) else {
            let _ = client.post(&cancel_endpoint).header("x-fouc-internal-token", &internal_token)
                .json(&serde_json::json!({ "interactionId": interaction_id })).send();
            let _ = app.emit("connector://auth-cancelled", serde_json::json!({ "providerId": "dts" }));
            return;
        };
        let Ok(cookies) = window.cookies_for_url(cookie_url.clone()) else { continue };
        if !cookies.iter().any(|cookie| cookie.name() == "heds-siamSessionhedss" || cookie.name() == "hwsso_uniportal") { continue; }
        let handoff: Vec<CookieHandoff> = cookies.into_iter().filter_map(|cookie| {
            let domain = cookie.domain()?.to_string();
            if domain != "xfusion.com" && !domain.ends_with(".xfusion.com") { return None; }
            Some(CookieHandoff {
                name: cookie.name().to_string(), value: cookie.value().to_string(), domain,
                path: cookie.path().unwrap_or("/").to_string(), secure: cookie.secure().unwrap_or(false),
                http_only: cookie.http_only().unwrap_or(false),
                expires_at: cookie.expires_datetime().map(|time| time.unix_timestamp() * 1000),
            })
        }).collect();
        let response = client.post(&endpoint).header("x-fouc-internal-token", &internal_token)
            .json(&serde_json::json!({ "interactionId": interaction_id, "cookies": handoff })).send();
        let connected = response.ok().and_then(|item| item.json::<serde_json::Value>().ok())
            .and_then(|body| body.get("ok").and_then(|value| value.as_bool())).unwrap_or(false);
        if connected {
            let _ = window.close();
            let _ = app.emit("connector://auth-completed", serde_json::json!({ "providerId": "dts", "instanceId": "dts-personal" }));
            return;
        }
    }
    if let Some(window) = app.get_webview_window(&label) { let _ = window.close(); }
    let _ = client.post(&cancel_endpoint).header("x-fouc-internal-token", &internal_token)
        .json(&serde_json::json!({ "interactionId": interaction_id })).send();
    let _ = app.emit("connector://auth-failed", serde_json::json!({ "providerId": "dts", "code": "timeout" }));
}

/// 优雅关停：先 POST /shutdown 再兜底 kill
fn shutdown_backend(state: &BackendState) {
    if let Ok(mut inner) = state.inner.lock() {
        let port = inner.port;
        let token = inner.token.clone();
        if let Some(mut child) = inner.child.take() {
            if port > 0 {
                if let Ok(client) = reqwest::blocking::Client::builder()
                    .no_proxy()
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
        .invoke_handler(tauri::generate_handler![get_backend_endpoint, open_dts_auth, clear_dts_auth_profile])
        .setup(move |app| {
            let handle = app.handle().clone();
            spawn_backend(&handle, state.clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(state) = window.try_state::<SharedBackendState>() {
                    shutdown_backend(&state);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Fouc");
}
