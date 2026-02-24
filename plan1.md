
Plan

Roadmap de Mejora Interna (UI + Backend)
Resumen

Objetivo: limpieza profunda y modularización sin agregar funcionalidades nuevas, manteniendo Tauri + Rust y React + TS.
Enfoque principal: reducir archivos monolíticos, separar responsabilidades, estandarizar estilo y fortalecer estructura.
Resultado esperado: código más legible, mantenible, predecible y con abstracciones de “alto nivel”.
Cambios importantes en APIs/Interfaces

Se mantienen los mismos comandos Tauri y su firma pública (sin cambios funcionales).
Las interfaces TypeScript y estructuras Rust se reorganizan por dominio, pero preservan los campos actuales.
Cualquier cambio en nombres internos se encapsula en capas de compatibilidad para no romper llamadas existentes.
Fase 0 — Baseline y Estándares

Crear tsconfig.json con strict habilitado y opciones alineadas a Vite + React.
Añadir ESLint + Prettier con reglas para React Hooks y TypeScript.
Configurar rustfmt y clippy para estilo consistente.
Añadir scripts en package.json:
lint, format, typecheck, lint:rust, format:rust.
Estandarizar encoding a UTF‑8 para evitar mojibake.
Fase 1 — Modularización UI (React + TS)

App root:
Dividir App.tsx en AppShell, AppState y AppRoutes.
Extraer manejo de sesión persistida a un hook dedicado en src/store/.
Views grandes:
InstancesView.tsx:
Separar en subcomponentes: InstancesHeader, InstanceList, InstanceDetails, InstanceActions.
Mover lógica pesada a hooks específicos (useInstanceSelection, useInstanceActions).
CatalogView.tsx + useCatalogState.tsx + components.tsx:
Separar en módulos: catalog/api, catalog/hooks, catalog/components, catalog/modals.
Partir useCatalogState en hooks enfocados: búsqueda, selección, instalación, modales.
SkinsView.tsx, DashboardView.tsx, SettingsView.tsx:
Extraer secciones en componentes presentacionales reutilizables.
Capa API UI:
En tauri.ts, crear un wrapper invokeTyped con manejo uniforme de errores.
Agrupar llamadas por dominio en services/tauri/*.
Diseño y estilo:
Consolidar clases repetidas con clsx/cva.
Crear componentes UI base (Button, Card, Modal, Badge) para uniformidad.
Fase 2 — Modularización Backend (Rust / Tauri)

Separación de comandos:
Crear src-tauri/src/commands/ con módulos por dominio.
lib.rs quedará casi solo para run() + invoke_handler.
Estado compartido:
Reemplazar static Mutex por tauri::State<AppState> con caches encapsuladas.
Errores de alto nivel:
Introducir AppError (con thiserror) y alias AppResult<T>.
Centralizar conversiones Result<T, String> a un formato consistente.
Módulos grandes:
modrinth.rs:
Separar en client, install, export, datapacks, models.
models.rs:
Dividir por dominio (auth_models, instance_models, content_models, etc.).
IO y concurrencia:
Asegurar que operaciones de disco en async usen tokio::fs cuando sea relevante.
Fase 3 — Limpieza y Normalización

Revisar imports innecesarios y reordenarlos.
Normalizar nombres y comentarios.
Consolidar utilidades repetidas en utils.
Reducir el tamaño de archivos monolíticos a < 300–400 líneas cuando sea razonable.
Pruebas y validación

UI:
npm run typecheck
npm run lint
npm run build
Backend:
cargo fmt --check
cargo clippy -- -D warnings
cargo check
Smoke:
Ejecutar npm run tauri:dev y validar arranque, login, catálogo, instancias.
Supuestos y decisiones

Se mantiene Rust en backend (sin migración de lenguaje).
Prioridad: modularización antes que optimizaciones de performance profundas.
Tooling local (lint/format) sin CI por ahora.
No se agregan features; los cambios son de estructura interna, calidad y estándar.
