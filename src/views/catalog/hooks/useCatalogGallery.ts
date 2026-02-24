import { useCallback, useEffect, useState } from "react";

type CatalogGalleryArgs = {
  isOpen: boolean;
  galleryCount: number;
};

export function useCatalogGallery({ isOpen, galleryCount }: CatalogGalleryArgs) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setGalleryIndex(0);
  }, [isOpen, galleryCount]);

  useEffect(() => {
    if (!isOpen) {
      setShowFullDescription(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || galleryCount <= 1) return;
    const id = window.setInterval(() => {
      setGalleryIndex((prev) => (prev + 1) % galleryCount);
    }, 4500);
    return () => window.clearInterval(id);
  }, [isOpen, galleryCount]);

  const handleGalleryPrev = useCallback(() => {
    if (galleryCount <= 0) return;
    setGalleryIndex((prev) => (prev - 1 + galleryCount) % galleryCount);
  }, [galleryCount]);

  const handleGalleryNext = useCallback(() => {
    if (galleryCount <= 0) return;
    setGalleryIndex((prev) => (prev + 1) % galleryCount);
  }, [galleryCount]);

  const handleGallerySelect = useCallback(
    (value: number) => {
      if (galleryCount <= 0) return;
      setGalleryIndex(value);
    },
    [galleryCount]
  );

  const handleShowFullDescription = useCallback(() => {
    setShowFullDescription(true);
  }, []);

  const handleHideFullDescription = useCallback(() => {
    setShowFullDescription(false);
  }, []);

  return {
    galleryIndex,
    showFullDescription,
    handleGalleryPrev,
    handleGalleryNext,
    handleGallerySelect,
    handleShowFullDescription,
    handleHideFullDescription,
  };
}
