<p align="center">
  <img src="public/newen_icono.png" alt="Newen Launcher" width="120" />
</p>

<h1 align="center">Newen Launcher</h1>
<p align="center"><strong>Juega Minecraft sin enredos.</strong></p>
<p align="center">
  Launcher moderno para Minecraft enfocado en orden, confianza y rendimiento,
  desarrollado en Chile y pensado para la comunidad hispanohablante.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-Early%20Access-f59e0b?style=for-the-badge" alt="Estado Early Access" />
  <img src="https://img.shields.io/badge/platform-Windows-2563eb?style=for-the-badge" alt="Plataforma Windows" />
  <img src="https://img.shields.io/badge/stack-Rust%20%2B%20React%20%2B%20Tauri-111827?style=for-the-badge" alt="Stack Rust React Tauri" />
  <img src="https://img.shields.io/badge/license-MIT-16a34a?style=for-the-badge" alt="Licencia MIT" />
  <img src="https://img.shields.io/badge/version-1.1.0-eab308?style=for-the-badge" alt="Version 1.1.0" />
  <img src="https://img.shields.io/badge/language-Espa%C3%B1ol-d946ef?style=for-the-badge" alt="Idioma Espanol" />
</p>

<p align="center">
  <img src="public/fondo.png" alt="Identidad visual de Newen Launcher" />
</p>

<p align="center">
  <a href="https://github.com/OrmazabalDev/newen_launcher/releases">Descargar</a>
  |
  <a href="https://github.com/OrmazabalDev/newen_launcher">GitHub</a>
  |
  <a href="docs/product-positioning.md">Base de producto</a>
</p>

Early Access: estamos mejorando rapido, puliendo la experiencia y ajustando el producto para que el launcher sea mas claro, confiable y simple de usar.

## Por que Newen

Los launchers mas conocidos ya cubren instancias, loaders y modpacks. Newen no intenta ganar por cantidad de funciones, sino por experiencia:

- **Claridad:** interfaz en espanol y mensajes mas entendibles para jugadores que no quieren pelear con configuraciones tecnicas.
- **Confianza:** foco en transparencia sobre el estado del proyecto, lo que instala, lo que guarda y lo que aun falta.
- **Rendimiento:** experiencia ligera y ordenada para PCs normales, sin sobrecargar el flujo principal.
- **Menos friccion:** herramientas para crear, reparar y jugar instancias con menos pasos.

## Funciones clave

- Gestion de instancias con creacion, organizacion, apertura y eliminacion.
- Soporte para **Vanilla**, **Fabric**, **Forge** y **NeoForge**.
- Catalogo integrado con **Modrinth** para mods, modpacks, shaders, resource packs y datapacks.
- Busqueda de contenido en **CurseForge**.
- Login con **Microsoft** y modo offline.
- Deteccion y manejo de **Java** para reducir errores de primer uso.
- Herramientas de **diagnostico**, generacion de reportes y reparacion rapida.
- Opciones de rendimiento con ajustes simples de RAM y FPS.
- Gestion de skins y utilidades para contenido por instancia.

## Estado del proyecto

Newen Launcher ya es utilizable y tiene una base funcional real, pero sigue en etapa temprana.

- Estado actual: **Early Access**
- Version del repo: **1.1.0**
- Plataforma principal: **Windows**
- Idioma principal: **Espanol**

Hoy estamos enfocados en:

- pulido de onboarding
- estabilidad general
- mensajes de error mas claros
- mejor experiencia de instalacion y reparacion

## Descarga

Puedes descargar la version mas reciente desde [Releases](https://github.com/OrmazabalDev/newen_launcher/releases).

- Archivo recomendado: `Newen Launcher_1.1.x_x64-setup.exe`
- Alternativa: `Newen Launcher_1.1.x_x64_en-US.msi`
- Plataforma: Windows
- Estado: Early Access

Importante: el instalador de Windows aun no cuenta con firma digital. Windows puede mostrar una advertencia al abrirlo. La forma correcta de compensar eso no es ocultarlo, sino documentarlo mejor y mejorar la transparencia de cada release.

## Transparencia y seguridad

Newen Launcher busca ser claro sobre lo que instala y como evoluciona.

- Sin telemetria publicitaria declarada en el proyecto.
- Sin trackers de marketing declarados en el proyecto.
- Cambios visibles dentro del repo y documentacion del producto en [docs/product-positioning.md](docs/product-positioning.md).
- Changelog corto disponible hoy dentro del launcher.
- Version visible del proyecto y releases publicas en GitHub.
- Soporte de diagnostico con reportes para revisar errores comunes.

Pendientes importantes para reforzar confianza en releases:

- hashes SHA-256 por version
- enlaces de verificacion por build
- politica de privacidad corta y humana
- notas de release mas detalladas
- capturas reales del launcher en este README

## Vista previa

El repo ya incluye identidad visual del proyecto, pero todavia faltan capturas versionadas del launcher dentro de este repositorio. La siguiente mejora de documentacion deberia agregar como minimo:

- pantalla principal
- gestion de instancias
- catalogo
- configuracion o diagnostico

## Roadmap

### Hecho

- [x] Gestion de instancias
- [x] Soporte Vanilla, Forge, NeoForge y Fabric
- [x] Catalogo Modrinth integrado
- [x] Busqueda de contenido en CurseForge
- [x] Skins y utilidades de perfil
- [x] Diagnostico con reportes
- [x] Reparacion rapida de instancias

### En progreso

- [ ] Pulido de onboarding
- [ ] Mejora de estabilidad general
- [ ] Mejoras de instalacion y reparacion
- [ ] Mensajes de error mas claros
- [ ] Mas superficie de transparencia en el producto

### Proximamente

- [ ] Mejor experiencia de primer uso
- [ ] Mejor documentacion de releases
- [ ] Hashes y verificacion por descarga
- [ ] Capturas reales del launcher en README y landing
- [ ] Mas mejoras visuales y de rendimiento

## Soporte y comunidad

- Sitio del proyecto: [ormazabaldev.github.io/newen-web](https://ormazabaldev.github.io/newen-web/)
- Codigo fuente: [github.com/OrmazabalDev/newen_launcher](https://github.com/OrmazabalDev/newen_launcher)
- Releases: [github.com/OrmazabalDev/newen_launcher/releases](https://github.com/OrmazabalDev/newen_launcher/releases)
- Reporte de bugs: [Issues](https://github.com/OrmazabalDev/newen_launcher/issues)

Si mas adelante se publica un enlace oficial de comunidad, conviene agregarlo aqui junto con reglas claras de soporte y changelog por release.

## Stack tecnico

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** Tailwind CSS
- **Desktop runtime:** Tauri 2
- **Backend local:** Rust
- **Contenido:** integraciones con Modrinth, CurseForge y servicios oficiales de Minecraft/Microsoft

## Documento base de producto

La base de posicionamiento, mision, vision, publico objetivo, diferenciales y roadmap vive en [docs/product-positioning.md](docs/product-positioning.md).

## Licencia

Este proyecto esta bajo la licencia [MIT](LICENSE).

Minecraft es una marca registrada de Mojang Studios y Microsoft. Newen Launcher no esta afiliado ni respaldado por Mojang ni por Microsoft.
