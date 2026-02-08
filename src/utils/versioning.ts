/**
 * Determina el tipo de versión según su identificador.
 * Si el id es del tipo "1.20" o "1.20.1" se considera release;
 * cualquier otro patrón se trata como snapshot.
 */
export function inferVersionType(id: string): "release" | "snapshot" {
  return id.match(/^\d+\.\d+(\.\d+)?$/) ? "release" : "snapshot";
}

/**
 * Extrae la versión base de un identificador que puede incluir loaders
 * (Forge, NeoForge o Fabric). Esto es útil para descargar Java o aplicar
 * paquetes de optimización en la versión correcta.
 */
export function extractBaseVersion(versionId: string): string {
  if (versionId.includes("-forge-")) {
    return versionId.split("-forge-")[0];
  }
  if (versionId.includes("-neoforge-")) {
    return versionId.split("-neoforge-")[0];
  }
  if (versionId.startsWith("neoforge-")) {
    const token = versionId.split("-")[1] || "";
    const parts = token.split(".");
    const minor = Number(parts[0] || 0);
    const patch = Number(parts[1] || 0);
    if (minor > 0) {
      return patch > 0 ? `1.${minor}.${patch}` : `1.${minor}`;
    }
  }
  if (versionId.startsWith("fabric-loader-")) {
    const parts = versionId.split("-");
    return parts[parts.length - 1] || versionId;
  }
  return versionId;
}
