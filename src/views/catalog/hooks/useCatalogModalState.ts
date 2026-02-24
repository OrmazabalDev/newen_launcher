import type { CurseForgeMod, ModrinthProject, ModrinthProjectHit } from "../../../types";
import { useCatalogGallery } from "./useCatalogGallery";
import type { ProjectType, SourceType } from "../constants";

type CatalogModalStateArgs = {
  projectType: ProjectType;
  source: SourceType;
  selectedProject: ModrinthProjectHit | null;
  selectedCurse: CurseForgeMod | null;
  modpackDetails: ModrinthProject | null;
};

export function useCatalogModalState({
  projectType,
  source,
  selectedProject,
  selectedCurse,
  modpackDetails,
}: CatalogModalStateArgs) {
  const isModpackModalOpen = projectType === "modpack" && !!selectedProject;
  const isModModalOpen = projectType !== "modpack" && source === "modrinth" && !!selectedProject;
  const isCurseModalOpen = projectType === "mod" && source === "curseforge" && !!selectedCurse;

  const gallery = modpackDetails?.gallery ?? [];
  const galleryCount = gallery.length;
  const {
    galleryIndex,
    showFullDescription,
    handleGalleryPrev,
    handleGalleryNext,
    handleGallerySelect,
    handleShowFullDescription,
    handleHideFullDescription,
  } = useCatalogGallery({ isOpen: isModpackModalOpen, galleryCount });
  const activeImage = galleryCount > 0 ? (gallery[galleryIndex % galleryCount] ?? null) : null;

  return {
    isModpackModalOpen,
    isModModalOpen,
    isCurseModalOpen,
    galleryIndex,
    showFullDescription,
    galleryCount,
    activeImage,
    handleGalleryPrev,
    handleGalleryNext,
    handleGallerySelect,
    handleShowFullDescription,
    handleHideFullDescription,
  };
}
