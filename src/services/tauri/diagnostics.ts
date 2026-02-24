import { invokeTyped } from "./core";

export function generateDiagnosticReport(): Promise<string> {
  return invokeTyped("generate_diagnostic_report");
}

export function uploadDiagnosticReport(
  reportPath: string,
  instanceId?: string
): Promise<string> {
  return invokeTyped("upload_diagnostic_report", { reportPath, instanceId });
}

export function repairInstance(instanceId: string): Promise<string> {
  return invokeTyped("repair_instance", { instanceId });
}
