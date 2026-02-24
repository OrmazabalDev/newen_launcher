export type ModrinthProjectType = "mod" | "modpack" | "resourcepack" | "datapack" | "shader";

export interface ModrinthSearchResult<T = unknown> {
  hits: T[];
  total_hits: number;
}

export type ModrinthSearchFn = (
  query: string,
  limit: number,
  offset: number,
  loader?: string,
  gameVersion?: string,
  index?: string,
  projectType?: ModrinthProjectType,
  categories?: string[]
) => Promise<ModrinthSearchResult>;

/**
 * Guarda informacion precargada en localStorage con una marca de tiempo.
 * Si el storage no esta disponible, el error se ignora de forma segura.
 */
export function savePrefetch(key: string, payload: Record<string, unknown>): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        ts: Date.now(),
        ...payload,
      })
    );
  } catch {
    // Sin storage disponible o cuota excedida: se omite sin bloquear el flujo.
  }
}

/**
 * Precarga resultados del catalogo para mejorar la primera experiencia del usuario.
 * Recibe la lista de loaders presentes y una funcion de busqueda (Modrinth).
 */
export async function prefetchCatalog(
  loaders: string[],
  search: ModrinthSearchFn,
  persist: (key: string, payload: Record<string, unknown>) => void = savePrefetch
): Promise<void> {
  const loaderSet = new Set(
    loaders.filter((loader) => loader === "forge" || loader === "neoforge" || loader === "fabric")
  );
  loaderSet.add("forge");
  loaderSet.add("neoforge");
  loaderSet.add("fabric");
  const uniqueLoaders = Array.from(loaderSet);

  const prefetchOne = async (
    key: string,
    projectType: ModrinthProjectType,
    loader = ""
  ): Promise<void> => {
    try {
      const result = await search("", 24, 0, loader, undefined, "downloads", projectType);
      persist(key, {
        hits: result.hits,
        total: result.total_hits || 0,
      });
    } catch {
      // Error de red o API: se omite la precarga.
    }
  };

  const tasks: Promise<void>[] = [
    prefetchOne("launcher_catalog_prefetch_modpacks_any_v1", "modpack"),
    prefetchOne("launcher_catalog_prefetch_resourcepacks_any_v1", "resourcepack"),
    prefetchOne("launcher_catalog_prefetch_datapacks_any_v1", "datapack"),
    prefetchOne("launcher_catalog_prefetch_shaders_any_v1", "shader"),
  ];

  for (const loader of uniqueLoaders) {
    tasks.push(prefetchOne(`launcher_catalog_prefetch_mods_${loader}_v1`, "mod", loader));
    tasks.push(prefetchOne(`launcher_catalog_prefetch_modpacks_${loader}_v1`, "modpack", loader));
  }

  await Promise.all(tasks);
}
