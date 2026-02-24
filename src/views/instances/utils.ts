export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDate(ts: number) {
  if (!ts) return "Sin fecha";
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function extractBaseVersion(versionId: string): string {
  if (versionId.includes("-forge-")) {
    return versionId.split("-forge-")[0] ?? versionId;
  }
  if (versionId.includes("-neoforge-")) {
    return versionId.split("-neoforge-")[0] ?? versionId;
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
