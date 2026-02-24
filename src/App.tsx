import React from "react";
import { AppState } from "./app/AppState";
import { AppShell } from "./app/AppShell";
import { AppRoutes } from "./app/AppRoutes";

export default function App() {
  return (
    <AppState>
      {(app) => (
        <AppShell app={app}>
          <AppRoutes app={app} />
        </AppShell>
      )}
    </AppState>
  );
}
