import React from "react";
import { CatalogAlerts } from "./CatalogAlerts";
import {
  CatalogDetailPanel,
  CatalogHeader,
  CatalogProjectTabs,
  CatalogResultsGrid,
  CatalogToolbar,
} from "../components";

type CatalogMainLayoutProps = {
  header: React.ComponentProps<typeof CatalogHeader>;
  tabs: React.ComponentProps<typeof CatalogProjectTabs>;
  toolbar: React.ComponentProps<typeof CatalogToolbar>;
  results: React.ComponentProps<typeof CatalogResultsGrid>;
  detail: React.ComponentProps<typeof CatalogDetailPanel>;
  showDetailPanel: boolean;
  showCurseforgeBanner: boolean;
  status: string;
};

export function CatalogMainLayout({
  header,
  tabs,
  toolbar,
  results,
  detail,
  showDetailPanel,
  showCurseforgeBanner,
  status,
}: CatalogMainLayoutProps) {
  return (
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-hidden animate-fadeIn">
      <CatalogHeader {...header} />

      <CatalogProjectTabs {...tabs} />

      <CatalogToolbar {...toolbar} />

      <CatalogAlerts showCurseforgeBanner={showCurseforgeBanner} status={status} />

      <div
        className={`flex-1 grid grid-cols-1 gap-4 overflow-hidden ${
          showDetailPanel ? "lg:grid-cols-[1.2fr_1fr]" : ""
        }`}
      >
        <CatalogResultsGrid {...results} />
        <CatalogDetailPanel {...detail} />
      </div>
    </div>
  );
}
