// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use log::LevelFilter;
use std::{fs::File, io::Write};
use tauri::Manager;
use tauri_plugin_log::{fern::colors::ColoredLevelConfig, LogTarget};
use window_vibrancy::{
    apply_acrylic, apply_blur, apply_mica, apply_tabbed, apply_vibrancy, NSVisualEffectMaterial,
};

#[tauri::command]
fn write_to_file(file_path: String, content: String) {
    let mut file = File::create(file_path).expect("create failed");
    file.write_all(content.as_bytes()).expect("write failed");
}

#[tauri::command]
fn read_file(file_path: String) -> String {
    let content = std::fs::read_to_string(file_path).expect("read failed");
    content
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
                .with_colors(ColoredLevelConfig::default())
                .level(LevelFilter::Trace)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let window = app.get_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            // #[cfg(target_os = "windows")]
            // apply_tabbed(&window, Some(false))
            //     .expect("Unsupported platform! 'apply_blur' is only supported on Windows");

            #[cfg(target_os = "windows")]
            apply_acrylic(&window, Some((255, 255, 255, 254)))
                .expect("Unsupported platform! 'apply_blur' is only supported on Windows");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
