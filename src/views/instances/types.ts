import type { ConfirmOptions } from "../../hooks/useConfirm";
import type { LoaderType } from "../../types";

export type CreatePayload = {
  name: string;
  version: string;
  loader: LoaderType;
  thumbnail?: string;
  tags?: string[];
};

export type { ConfirmOptions };

export type ManageTab = "mods" | "resourcepacks" | "shaderpacks" | "logs";
