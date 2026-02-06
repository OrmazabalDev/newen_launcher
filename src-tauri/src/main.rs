#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Corregido: Usamos el nombre real de la librería definido en Cargo.toml
    launcher_mc_tauri_lib::run();
}
