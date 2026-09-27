//! Native HTTP capability for the configured global service. Cookies stay in
//! the WebView's persistent, HttpOnly cookie store; never in JavaScript storage.
use std::collections::HashMap;
use std::time::Duration;
use tauri::{webview::Cookie, WebviewWindow};

fn service_origin() -> Result<tauri::Url, String> {
    let raw = option_env!("FOUC_SERVICE_ORIGIN").unwrap_or("");
    let url = tauri::Url::parse(raw).map_err(|_| "Global Fouc service is not configured")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    if (url.scheme() != "https" && !(url.scheme() == "http" && local))
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Invalid global Fouc service origin".into());
    }
    Ok(url)
}

#[tauri::command]
pub fn get_fouc_service_origin() -> Result<String, String> {
    Ok(service_origin()?.origin().ascii_serialization())
}

#[derive(serde::Serialize)]
pub struct ServiceResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

#[tauri::command]
pub async fn fouc_service_request(
    window: WebviewWindow,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<Vec<u8>>,
) -> Result<ServiceResponse, String> {
    // An external SSO page must never acquire this capability.
    let page = window
        .url()
        .map_err(|_| "Cannot inspect requesting window")?;
    let trusted_page = matches!(
        page.origin().ascii_serialization().as_str(),
        "http://tauri.localhost" | "https://tauri.localhost"
    ) || (page.scheme() == "tauri"
        && page.host_str() == Some("localhost")
        && page.port().is_none())
        || (cfg!(debug_assertions)
            && page.origin().ascii_serialization() == "http://localhost:3000");
    if window.label() != "main" || !trusted_page {
        return Err("Global service requests require the Fouc main window".into());
    }
    let origin = service_origin()?;
    let target = tauri::Url::parse(&url).map_err(|_| "Invalid service URL")?;
    if target.origin() != origin.origin()
        || !target.path().starts_with("/api/")
        || !target.username().is_empty()
        || target.password().is_some()
        || target.fragment().is_some()
    {
        return Err("Request is outside the configured Fouc service".into());
    }
    if !matches!(
        method.as_str(),
        "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE"
    ) {
        return Err("Unsupported service method".into());
    }
    // Windows cookie APIs must run off the WebView UI thread.
    tauri::async_runtime::spawn_blocking(move || {
        let cookies = window
            .cookies_for_url(target.clone())
            .map_err(|_| "Cannot read service cookies")?;
        let cookie_header = cookies
            .iter()
            .map(|c| format!("{}={}", c.name(), c.value()))
            .collect::<Vec<_>>()
            .join("; ");
        let client = reqwest::blocking::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|_| "Cannot create service transport")?;
        let verb =
            reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid service method")?;
        // Native requests have a fixed, trusted service Origin. JavaScript cannot
        // supply Origin, Cookie, Authorization or a sidecar device token.
        let mut request = client
            .request(verb, target.as_str())
            .header("origin", origin.origin().ascii_serialization())
            .header("cache-control", "no-store");
        if !cookie_header.is_empty() {
            request = request.header("cookie", cookie_header);
        }
        for (name, value) in headers {
            if matches!(
                name.to_ascii_lowercase().as_str(),
                "content-type" | "accept"
            ) {
                request = request.header(name, value);
            }
        }
        if let Some(body) = body {
            request = request.body(body);
        }
        let response = request
            .send()
            .map_err(|_| "Cannot connect to the Fouc service")?;
        for value in response.headers().get_all(reqwest::header::SET_COOKIE) {
            let raw = value.to_str().map_err(|_| "Invalid service cookie")?;
            let mut cookie = Cookie::parse(raw.to_owned())
                .map_err(|_| "Invalid service cookie")?
                .into_owned();
            let host = target.host_str().ok_or("Missing service host")?;
            if let Some(domain) = cookie.domain() {
                let domain = domain.trim_start_matches('.');
                if host != domain && !host.ends_with(&format!(".{domain}")) {
                    return Err("Cookie domain is outside the service".into());
                }
            } else {
                cookie.set_domain(host.to_owned());
            }
            if cookie.path().is_none() {
                cookie.set_path("/");
            }
            if cookie.max_age().is_some_and(|age| age.whole_seconds() <= 0) {
                window
                    .delete_cookie(cookie)
                    .map_err(|_| "Cannot remove service cookie")?;
            } else {
                window
                    .set_cookie(cookie)
                    .map_err(|_| "Cannot persist service cookie")?;
            }
        }
        let status = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .filter(|(name, _)| matches!(name.as_str(), "content-type" | "retry-after"))
            .filter_map(|(name, value)| {
                value
                    .to_str()
                    .ok()
                    .map(|value| (name.to_string(), value.to_owned()))
            })
            .collect();
        let body = response
            .bytes()
            .map_err(|_| "Cannot read service response")?
            .to_vec();
        Ok(ServiceResponse {
            status,
            headers,
            body,
        })
    })
    .await
    .map_err(|_| "Service transport failed".to_owned())?
}
