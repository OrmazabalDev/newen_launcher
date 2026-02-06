const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const bundleDir = path.join(__dirname, "..", "src-tauri", "target", "release", "bundle", "msi");
const releaseDir = path.join(__dirname, "..", "src-tauri", "target", "release");
const targetName = "Newen Launcher.msi";
const signDisplayName = "Newen Launcher";

if (!fs.existsSync(bundleDir)) {
  console.error("MSI bundle folder not found:", bundleDir);
  process.exit(1);
}

const files = fs.readdirSync(bundleDir).filter((file) => file.toLowerCase().endsWith(".msi"));

if (files.length === 0) {
  console.error("No MSI files found in:", bundleDir);
  process.exit(1);
}

const latest = files
  .map((file) => ({
    file,
    mtime: fs.statSync(path.join(bundleDir, file)).mtimeMs,
  }))
  .sort((a, b) => b.mtime - a.mtime)[0].file;

const latestPath = path.join(bundleDir, latest);
const targetPath = path.join(bundleDir, targetName);

if (latestPath === targetPath) {
  console.log("MSI name already set:", targetName);
  process.exit(0);
}

if (fs.existsSync(targetPath)) {
  fs.unlinkSync(targetPath);
}

fs.renameSync(latestPath, targetPath);
console.log("MSI renamed to:", targetName);

const signFile = (filePath) => {
  const pfxPath = process.env.NEWEN_CERT_PFX;
  const pfxPassword = process.env.NEWEN_CERT_PASSWORD;
  if (!pfxPath || !pfxPassword) {
    console.log("Signing skipped: set NEWEN_CERT_PFX and NEWEN_CERT_PASSWORD to enable signing.");
    return false;
  }
  if (!fs.existsSync(pfxPath)) {
    console.log("Signing skipped: PFX not found:", pfxPath);
    return false;
  }
  const signtool = process.env.SIGNTOOL_PATH || "signtool";
  const timestampUrl = process.env.NEWEN_TIMESTAMP_URL || "http://timestamp.digicert.com";
  const args = [
    "sign",
    "/fd",
    "SHA256",
    "/f",
    pfxPath,
    "/p",
    pfxPassword,
    "/tr",
    timestampUrl,
    "/td",
    "SHA256",
    "/d",
    signDisplayName,
    filePath,
  ];
  try {
    execFileSync(signtool, args, { stdio: "inherit" });
    return true;
  } catch (err) {
    console.log("Signing failed:", err.message || err);
    return false;
  }
};

const exeFiles = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((file) => file.toLowerCase().endsWith(".exe"))
  : [];

if (exeFiles.length > 0) {
  const latestExe = exeFiles
    .map((file) => ({
      file,
      mtime: fs.statSync(path.join(releaseDir, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)[0].file;
  const exePath = path.join(releaseDir, latestExe);
  signFile(exePath);
}

signFile(targetPath);
