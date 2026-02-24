import React from "react";
import { CatalogView } from "../views/CatalogView";
import { DashboardView } from "../views/DashboardView";
import { InstancesView } from "../views/InstancesView";
import { ManagerView } from "../views/ManagerView";
import { SettingsView } from "../views/SettingsView";
import { SkinsView } from "../views/SkinsView";
import type { AppStateValue } from "./AppState";

export function AppRoutes({ app }: { app: AppStateValue }) {
  const {
    currentView,
    instances,
    selectedInstanceId,
    setSelectedInstanceId,
    isProcessing,
    globalStatus,
    playSelectedInstance,
    repairSelectedInstance,
    systemJava,
    gameSettings,
    gamePid,
    progress,
    mojangVersions,
    installedVersions,
    showSnapshots,
    setShowSnapshots,
    handleInstallVanilla,
    handleInstallForge,
    handleInstallNeoForge,
    handleInstallFabric,
    errorInstanceIds,
    createInstance,
    launchInstance,
    openInstanceFolder,
    deleteInstance,
    loadMojangVersions,
    askConfirm,
    instancesLoading,
    handleRefreshInstances,
    setGameSettings,
    uiScale,
    setUiScale,
    userProfile,
    refreshOnlineProfile,
    navigate,
  } = app;

  return (
    <>
      {currentView === "dashboard" && (
        <DashboardView
          instances={instances}
          selectedInstanceId={selectedInstanceId}
          onSelectInstance={setSelectedInstanceId}
          isProcessing={isProcessing}
          globalStatus={globalStatus}
          onPlay={playSelectedInstance}
          onGoInstances={() => navigate("instances")}
          onRepairInstance={repairSelectedInstance}
          systemJava={systemJava}
          settings={gameSettings}
          gamePid={gamePid}
          progress={progress}
        />
      )}

      {currentView === "manager" && (
        <ManagerView
          mojangVersions={mojangVersions}
          installedVersions={installedVersions}
          showSnapshots={showSnapshots}
          setShowSnapshots={setShowSnapshots}
          onInstallVanilla={handleInstallVanilla}
          onInstallForge={handleInstallForge}
          onInstallNeoForge={handleInstallNeoForge}
          onInstallFabric={handleInstallFabric}
        />
      )}

      {currentView === "instances" && (
        <InstancesView
          instances={instances}
          availableVersions={mojangVersions}
          selectedInstanceId={selectedInstanceId}
          errorInstanceIds={errorInstanceIds}
          onSelectInstance={setSelectedInstanceId}
          onCreateInstance={createInstance}
          onPlayInstance={(id) => {
            const inst = instances.find((i) => i.id === id);
            if (inst) {
              setSelectedInstanceId(inst.id);
              launchInstance(inst);
            }
          }}
          onOpenInstance={openInstanceFolder}
          onDeleteInstance={deleteInstance}
          onLoadVersions={loadMojangVersions}
          onConfirm={askConfirm}
          onRefreshInstances={handleRefreshInstances}
          isProcessing={isProcessing}
          isLoading={instancesLoading}
          globalStatus={globalStatus}
        />
      )}

      {currentView === "catalog" && (
        <CatalogView
          instances={instances}
          selectedInstanceId={selectedInstanceId}
          onSelectInstance={setSelectedInstanceId}
          onGoInstances={() => navigate("instances")}
          onRefreshInstances={handleRefreshInstances}
          onConfirm={askConfirm}
          progressLabel={globalStatus}
          hiddenProjectTypes={["modpack"]}
        />
      )}

      {currentView === "settings" && (
        <SettingsView
          settings={gameSettings}
          onChange={setGameSettings}
          uiScale={uiScale}
          onChangeUiScale={setUiScale}
        />
      )}

      {currentView === "skins" && userProfile && (
        <SkinsView userProfile={userProfile} onRefreshOnline={refreshOnlineProfile} />
      )}

      {currentView === "modpacks" && (
        <CatalogView
          instances={instances}
          selectedInstanceId={selectedInstanceId}
          onSelectInstance={setSelectedInstanceId}
          onRefreshInstances={handleRefreshInstances}
          onGoInstances={() => navigate("instances")}
          onGoPlay={() => navigate("dashboard")}
          onConfirm={askConfirm}
          progressLabel={globalStatus}
          lockedProjectType="modpack"
          title="Modpacks"
          subtitle="Instala modpacks completos y crea una instancia lista para jugar."
          lockSource="modrinth"
        />
      )}
    </>
  );
}
