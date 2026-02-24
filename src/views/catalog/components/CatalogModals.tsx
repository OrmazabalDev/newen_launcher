import React from "react";
import { CatalogCurseforgeModal } from "./modals/CatalogCurseforgeModal";
import { CatalogModpackModal } from "./modals/CatalogModpackModal";
import { CatalogModrinthModal } from "./modals/CatalogModrinthModal";

type CatalogModrinthModalProps = React.ComponentProps<typeof CatalogModrinthModal>;
type CatalogCurseforgeModalProps = React.ComponentProps<typeof CatalogCurseforgeModal>;
type CatalogModpackModalProps = React.ComponentProps<typeof CatalogModpackModal>;

type CatalogModalsProps = {
  modrinth: CatalogModrinthModalProps;
  curseforge: CatalogCurseforgeModalProps;
  modpack: CatalogModpackModalProps;
};

export function CatalogModals({ modrinth, curseforge, modpack }: CatalogModalsProps) {
  return (
    <>
      <CatalogModrinthModal {...modrinth} />
      <CatalogCurseforgeModal {...curseforge} />
      <CatalogModpackModal {...modpack} />
    </>
  );
}
