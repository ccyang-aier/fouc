fn main() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap();
    println!(
        "cargo:rerun-if-changed={}",
        root.join(".env.local").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        root.join("scripts/read-service-origin.mjs").display()
    );
    println!("cargo:rerun-if-env-changed=NEXT_PUBLIC_FOUC_API_URL");
    let output = std::process::Command::new("node")
        .arg(root.join("scripts/read-service-origin.mjs"))
        .output()
        .expect("Node is required to read Fouc deployment configuration");
    assert!(
        output.status.success(),
        "Cannot read Fouc deployment configuration"
    );
    let origin = String::from_utf8(output.stdout).expect("Service origin must be UTF-8");
    println!("cargo:rustc-env=FOUC_SERVICE_ORIGIN={}", origin.trim());
    tauri_build::build()
}
