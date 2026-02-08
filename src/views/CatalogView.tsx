import React from "react";
import {
  CatalogCurseforgeModal,
  CatalogDetailPanel,
  CatalogHeader,
  CatalogModpackModal,
  CatalogModrinthModal,
  CatalogProjectTabs,
  CatalogResultsGrid,
  CatalogToolbar,
} from "./catalog/components/index";
import type { CatalogViewProps } from "./catalog/types";
import { useCatalogState } from "./catalog/useCatalogState";

export function CatalogView({
  instances,
  selectedInstanceId,
  onSelectInstance,
  onGoInstances,
  onGoPlay,
  onRefreshInstances,
  onConfirm,
  progressLabel,
  initialProjectType = "mod",
  lockedProjectType,
  title,
  subtitle,
  lockSource,
  hiddenProjectTypes = [],
}: CatalogViewProps) {
  const {
    query,
    setQuery,
    results,
    curseResults,
    selectedProject,
    modpackDetails,
    galleryIndex,
    showFullDescription,
    selectedCurse,
    versions,
    selectedVersionId,
    status,
    loading,
    toast,
    modModalRef,
    modCloseRef,
    curseModalRef,
    curseCloseRef,
    modpackModalRef,
    modpackCloseRef,
    source,
    page,
    pageSize,
    index,
    totalHits,
    projectType,
    categories,
    showCategories,
    modpackLoader,
    headerTitle,
    headerSubtitle,
    searchPlaceholder,
    showProjectTabs,
    showSourceToggle,
    requiresInstance,
    eligibleInstances,
    selectedInstance,
    loader,
    projectTypeLabel,
    selectedVersion,
    availableLoaders,
    loaderLabel,
    versionLabel,
    loaderChip,
    versionChip,
    noEligibleInstances,
    gateTitle,
    gateMessage,
    installedProjectIds,
    disabledProjectIds,
    showDetailPanel,
    isModpackModalOpen,
    isModModalOpen,
    isCurseModalOpen,
    gallery,
    galleryCount,
    activeImage,
    modpackPreview,
    showDescriptionToggle,
    progressText,
    isProjectInstalled,
    isProjectDisabled,
    isVersionInstalled,
    installButtonContent,
    showCurseforgeBanner,
    modpackButtonContent,
    installDisabled,
    installDisabledReason,
    modpackInstallDisabledReason,
    showCatalogSkeleton,
    showEmptyState,
    emptyTitle,
    emptyMessage,
    instanceInfo,
    toggleCategory,
    clearCategories,
    handleSearch,
    handleSelectProjectType,
    handleSelectSource,
    handleToggleCategories,
    handleModpackLoader,
    handleIndexChange,
    handlePageSizeChange,
    handleClearFilters,
    handleShowPopular,
    handlePrevPage,
    handleNextPage,
    handleGalleryPrev,
    handleGalleryNext,
    handleGallerySelect,
    handleShowFullDescription,
    handleHideFullDescription,
    closeProjectModal,
    closeCurseModal,
    handleSelectProject,
    handleInstall,
    handleToastAction,
    setSelectedCurse,
    setSelectedVersionId,
  } = useCatalogState({
    instances,
    selectedInstanceId,
    onSelectInstance,
    onGoInstances,
    onGoPlay,
    onRefreshInstances,
    onConfirm,
    progressLabel,
    initialProjectType,
    lockedProjectType,
    title,
    subtitle,
    lockSource,
  });

  if (noEligibleInstances) {
    return (
      <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col items-center justify-center p-8 overflow-hidden animate-fadeIn text-center">
        <div className="max-w-lg bg-gray-900/70 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-3">{headerTitle}</h2>
          <div className="text-lg font-bold text-white mb-2">{gateTitle}</div>
          <p className="text-gray-300 text-sm">{gateMessage}</p>
          {onGoInstances && (
            <button
              onClick={onGoInstances}
              type="button"
              className="mt-5 px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white font-bold"
            >
              Ir a instancias
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-hidden animate-fadeIn">
        <CatalogHeader
          headerTitle={headerTitle}
          headerSubtitle={headerSubtitle}
          requiresInstance={requiresInstance}
          eligibleInstances={eligibleInstances}
          selectedInstance={selectedInstance}
          onSelectInstance={onSelectInstance}
        />

        <CatalogProjectTabs
          showProjectTabs={source === "modrinth" && showProjectTabs}
          projectType={projectType}
          hiddenProjectTypes={hiddenProjectTypes}
          onSelectProjectType={handleSelectProjectType}
        />

        <CatalogToolbar
          showSourceToggle={showSourceToggle}
          source={source}
          onSelectSource={handleSelectSource}
          projectType={projectType}
          showCategories={showCategories}
          categoriesCount={categories.length}
          onToggleCategories={handleToggleCategories}
          modpackLoader={modpackLoader}
          onSelectModpackLoader={handleModpackLoader}
          index={index}
          onChangeIndex={handleIndexChange}
          pageSize={pageSize}
          onChangePageSize={handlePageSizeChange}
          instanceInfo={instanceInfo}
          searchPlaceholder={searchPlaceholder}
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          loading={loading}
          isSourceLocked={source !== "modrinth"}
        />

      {showCurseforgeBanner && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <span className="uppercase tracking-widest font-bold text-amber-200">CurseForge</span>
          <span>Solo búsqueda. Agrega CURSEFORGE_API_KEY para habilitar instalación.</span>
        </div>
      )}

      {status && (
        <div className="text-sm text-gray-200 bg-gray-900/70 border border-gray-800 rounded-xl px-4 py-2 mb-4">
          {status}
        </div>
      )}

      <div className={`flex-1 grid grid-cols-1 gap-4 overflow-hidden ${showDetailPanel ? "lg:grid-cols-[1.2fr_1fr]" : ""}`}>
        <CatalogResultsGrid
          source={source}
          projectType={projectType}
          showCategories={source === "modrinth" && projectType === "mod" && showCategories}
          categories={categories}
          onToggleCategory={toggleCategory}
          onClearCategories={clearCategories}
          showCatalogSkeleton={showCatalogSkeleton}
          showEmptyState={showEmptyState}
          emptyTitle={emptyTitle}
          emptyMessage={emptyMessage}
          onClearFilters={handleClearFilters}
          onShowPopular={handleShowPopular}
          results={results}
          curseResults={curseResults}
          selectedProjectId={selectedProject?.project_id || null}
          selectedCurseId={selectedCurse?.id || null}
          onSelectProject={handleSelectProject}
          onSelectCurse={(hit) => setSelectedCurse(hit)}
          installedProjectIds={installedProjectIds}
          disabledProjectIds={disabledProjectIds}
          loaderChip={loaderChip}
          versionChip={versionChip}
          totalHits={totalHits}
          page={page}
          pageSize={pageSize}
          loading={loading}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
        <CatalogDetailPanel
          show={showDetailPanel}
          source={source}
          projectType={projectType}
          projectTypeLabel={projectTypeLabel}
          versionLabel={versionLabel}
          loader={loader}
          loaderLabel={loaderLabel}
          selectedProject={selectedProject}
          selectedCurse={selectedCurse}
          versions={versions}
          selectedVersion={selectedVersion}
          selectedVersionId={selectedVersionId}
          onSelectVersionId={setSelectedVersionId}
          onInstall={handleInstall}
          installDisabled={installDisabled}
          installButtonContent={installButtonContent}
          installDisabledReason={installDisabledReason}
          isProjectInstalled={isProjectInstalled}
          isProjectDisabled={isProjectDisabled}
          isVersionInstalled={isVersionInstalled}
        />
      </div>
    </div>

      {toast && (
        <div
          className={`fixed right-6 bottom-6 z-[60] rounded-xl border px-4 py-3 text-sm shadow-lg flex items-center gap-3 ${
            toast.kind === "success"
              ? "bg-emerald-900/80 border-emerald-700 text-emerald-100"
              : toast.kind === "error"
                ? "bg-red-900/80 border-red-700 text-red-100"
                : "bg-gray-900/80 border-gray-700 text-gray-100"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex-1">{toast.message}</div>
          {toast.actionLabel && toast.action && (
            <button
              type="button"
              onClick={handleToastAction}
              className="px-3 py-1 rounded-full border border-white/20 text-xs font-semibold hover:bg-white/10"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}

      <CatalogModrinthModal
        open={isModModalOpen}
        selectedProject={selectedProject}
        projectType={projectType}
        projectTypeLabel={projectTypeLabel}
        versionLabel={versionLabel}
        loader={loader}
        loaderLabel={loaderLabel}
        selectedVersion={selectedVersion}
        availableLoaders={availableLoaders}
        versions={versions}
        selectedVersionId={selectedVersionId}
        onSelectVersionId={setSelectedVersionId}
        onInstall={handleInstall}
        installDisabled={installDisabled}
        installButtonContent={installButtonContent}
        isProjectInstalled={isProjectInstalled}
        isProjectDisabled={isProjectDisabled}
        isVersionInstalled={isVersionInstalled}
        onClose={closeProjectModal}
        modalRef={modModalRef}
        closeRef={modCloseRef}
      />

      <CatalogCurseforgeModal
        open={isCurseModalOpen}
        selectedCurse={selectedCurse}
        showCurseforgeBanner={showCurseforgeBanner}
        onClose={closeCurseModal}
        modalRef={curseModalRef}
        closeRef={curseCloseRef}
      />

      <CatalogModpackModal
        open={isModpackModalOpen}
        selectedProject={selectedProject}
        projectTypeLabel={projectTypeLabel}
        versionLabel={versionLabel}
        activeImage={activeImage}
        gallery={gallery}
        galleryCount={galleryCount}
        galleryIndex={galleryIndex}
        onPrevImage={handleGalleryPrev}
        onNextImage={handleGalleryNext}
        onSelectImage={handleGallerySelect}
        modpackDetails={modpackDetails}
        showFullDescription={showFullDescription}
        modpackPreview={modpackPreview}
        showDescriptionToggle={showDescriptionToggle}
        onShowFullDescription={handleShowFullDescription}
        onHideFullDescription={handleHideFullDescription}
        versions={versions}
        selectedVersion={selectedVersion}
        selectedVersionId={selectedVersionId}
        onSelectVersionId={setSelectedVersionId}
        loaderLabel={loaderLabel}
        onInstall={handleInstall}
        modpackButtonContent={modpackButtonContent}
        modpackInstallDisabledReason={modpackInstallDisabledReason}
        loading={loading}
        progressText={progressText}
        onClose={closeProjectModal}
        modalRef={modpackModalRef}
        closeRef={modpackCloseRef}
      />
    </>
  );
}
