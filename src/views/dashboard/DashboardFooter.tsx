import { IconJava } from "../../icons";
import type { SystemJava } from "../../types";

export function DashboardFooter({ systemJava }: { systemJava: SystemJava | null }) {
  return (
    <div className="absolute bottom-8 left-12 text-xs text-gray-400 flex items-center gap-2">
      <IconJava />{" "}
      {systemJava?.valid ? `Java sistema: ${systemJava.version}` : "Java: auto (portable)"}
    </div>
  );
}
