import { useMemo, useState } from "react";
import type { InstanceSummary } from "../../types";

export function useInstanceSelection(instances: InstanceSummary[]) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instances.filter((inst) => {
      if (!q) return true;
      return (
        inst.name.toLowerCase().includes(q) ||
        inst.version.toLowerCase().includes(q) ||
        inst.loader.toLowerCase().includes(q)
      );
    });
  }, [instances, query]);

  return { query, setQuery, filtered };
}
