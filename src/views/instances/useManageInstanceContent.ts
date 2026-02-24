import { useCallback, useEffect, useMemo, useState } from "react";
import type { InstanceContentItem, InstanceLogEntry } from "../../types";
import * as tauri from "../../services/tauri";
import type { ManageTab } from "./types";

type StatusMessage = {
  message: string;
  kind: "success" | "info" | "error";
};

type UseManageInstanceContentArgs = {
  instanceId: string;
  tab: ManageTab;
  onStatus: (status: StatusMessage | null) => void;
};

export function useManageInstanceContent({
  instanceId,
  tab,
  onStatus,
}: UseManageInstanceContentArgs) {
  const [items, setItems] = useState<InstanceContentItem[]>([]);
  const [logs, setLogs] = useState<InstanceLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [contentQuery, setContentQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "name" | "size">("recent");
  const [filterSource, setFilterSource] = useState<"all" | "modrinth" | "local">("all");
  const [counts, setCounts] = useState({
    mods: 0,
    resourcepacks: 0,
    shaderpacks: 0,
    logs: 0,
  });

  const loadContent = useCallback(async () => {
    setLoading(true);
    onStatus(null);
    try {
      if (tab === "logs") {
        const list = await tauri.listInstanceReports(instanceId);
        setLogs(list);
      } else {
        const list = await tauri.listInstanceContent(instanceId, tab);
        setItems(list);
      }
    } catch (e) {
      onStatus({ message: String(e), kind: "error" });
    } finally {
      setLoading(false);
    }
  }, [instanceId, onStatus, tab]);

  const loadCounts = useCallback(async () => {
    try {
      const [mods, resourcepacks, shaderpacks, reports] = await Promise.all([
        tauri.listInstanceContent(instanceId, "mods"),
        tauri.listInstanceContent(instanceId, "resourcepacks"),
        tauri.listInstanceContent(instanceId, "shaderpacks"),
        tauri.listInstanceReports(instanceId),
      ]);
      setCounts({
        mods: mods.length,
        resourcepacks: resourcepacks.length,
        shaderpacks: shaderpacks.length,
        logs: reports.length,
      });
    } catch {
      // ignore count errors
    }
  }, [instanceId]);

  useEffect(() => {
    loadContent();
    loadCounts();
  }, [loadContent, loadCounts]);

  useEffect(() => {
    setContentQuery("");
    setFilterSource("all");
    setSortMode("recent");
  }, [tab, instanceId]);

  const filteredItems = useMemo(() => {
    let list = items.slice();
    const q = contentQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }
    if (filterSource === "modrinth") {
      list = list.filter((item) => item.source === "modrinth");
    }
    if (filterSource === "local") {
      list = list.filter((item) => !item.source);
    }
    if (sortMode === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "size") {
      list.sort((a, b) => b.size - a.size);
    }
    return list;
  }, [items, contentQuery, filterSource, sortMode]);

  return {
    items,
    logs,
    loading,
    counts,
    contentQuery,
    setContentQuery,
    sortMode,
    setSortMode,
    filterSource,
    setFilterSource,
    filteredItems,
    reloadContent: loadContent,
  };
}
