# Copilot Instructions for Launcher MC Tauri

## Project Overview
- Tauri desktop app for Minecraft launcher
- Frontend: Vite + React + TypeScript + Tailwind CSS
- Backend: Rust (Tauri)
- Secure storage: tauri-plugin-store or keyring
- IPC commands: launch_game, get_versions, authenticate

## Development Steps
1. Use TypeScript and strict typing in frontend
2. Use Tailwind CSS for UI
3. Implement IPC commands in Rust with Result pattern
4. Store tokens securely using OS keyring or plugin-store
5. Do not use localStorage for sensitive data

## Folder Structure
- src/ (React frontend)
- src-tauri/ (Rust backend)
- public/ (static files)
- .github/ (project instructions)

## Next Steps
- Implement IPC calls in React
- Expand Rust logic for real game launch, version fetch, and authentication
- Add UI components for login, version selection, and launch
