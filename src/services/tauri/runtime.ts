import type { RuntimeMetrics } from "../../types";
import { invokeTyped } from "./core";

export function getRuntimeMetrics(pid: number): Promise<RuntimeMetrics> {
  return invokeTyped("get_runtime_metrics", { pid });
}
