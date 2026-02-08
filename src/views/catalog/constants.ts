import { defaultSchema } from "rehype-sanitize";

export const PROJECT_TYPES = [
  { id: "mod", label: "Mods" },
  { id: "resourcepack", label: "Resource Packs" },
  { id: "datapack", label: "Data Packs" },
  { id: "shader", label: "Shaders" },
  { id: "modpack", label: "Modpacks" },
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number]["id"];
export type SourceType = "modrinth" | "curseforge";

export const CONTENT_KIND_BY_TYPE: Record<ProjectType, "mods" | "resourcepacks" | "shaderpacks" | null> = {
  mod: "mods",
  resourcepack: "resourcepacks",
  shader: "shaderpacks",
  datapack: null,
  modpack: null,
};

export const MODPACK_LOADERS = [
  { id: "any", label: "Todos" },
  { id: "forge", label: "Forge" },
  { id: "neoforge", label: "NeoForge" },
  { id: "fabric", label: "Fabric" },
] as const;

export type ModpackLoaderFilter = (typeof MODPACK_LOADERS)[number]["id"];

export const CATEGORY_OPTIONS = [
  { id: "adventure", label: "Adventure" },
  { id: "cursed", label: "Cursed" },
  { id: "decoration", label: "Decoration" },
  { id: "economy", label: "Economy" },
  { id: "equipment", label: "Equipment" },
  { id: "food", label: "Food" },
  { id: "game-mechanics", label: "Game Mechanics" },
  { id: "library", label: "Library" },
  { id: "magic", label: "Magic" },
  { id: "management", label: "Management" },
  { id: "minigame", label: "Minigame" },
  { id: "mobs", label: "Mobs" },
  { id: "optimization", label: "Optimization" },
  { id: "social", label: "Social" },
  { id: "storage", label: "Storage" },
  { id: "technology", label: "Technology" },
  { id: "transportation", label: "Transportation" },
  { id: "utility", label: "Utility" },
  { id: "worldgen", label: "World Generation" },
] as const;

export const MODRINTH_SANITIZE_SCHEMA: any = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "img",
    "iframe",
    "center",
    "font",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [...((defaultSchema.attributes || {}).a || []), "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
    font: ["size", "color", "face"],
    span: [...((defaultSchema.attributes || {}).span || [])],
    p: [...((defaultSchema.attributes || {}).p || [])],
    center: [],
  },
};
