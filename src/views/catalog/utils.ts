export const formatLoaderLabel = (value?: string) => {
  if (!value) return "Cualquiera";
  const v = value.toLowerCase();
  if (v === "neoforge") return "NeoForge";
  if (v === "forge") return "Forge";
  if (v === "fabric") return "Fabric";
  if (v === "quilt" || v === "quilt-loader") return "Quilt";
  if (v === "snapshot") return "Snapshot";
  if (v === "vanilla") return "Vanilla";
  return value;
};

export function extractGameVersion(versionId: string): string {
  if (versionId.includes("-forge-")) {
    return versionId.split("-forge-")[0] || versionId;
  }
  if (versionId.includes("-neoforge-")) {
    return versionId.split("-neoforge-")[0] || versionId;
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
  return versionId.split("-")[0] || versionId;
}
