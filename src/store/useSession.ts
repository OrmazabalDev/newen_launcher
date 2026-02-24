import { useCallback, useMemo } from "react";
import { loadSession, saveSession } from "./sessionStore";

export function usePersistedSession() {
  const persisted = useMemo(() => loadSession(), []);
  const persist = useCallback((partial: Parameters<typeof saveSession>[0]) => {
    saveSession(partial);
  }, []);

  return { persisted, persist };
}
