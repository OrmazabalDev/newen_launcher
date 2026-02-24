import React from "react";
import { Sidebar } from "../components/Sidebar";
import { JavaModal } from "../components/JavaModal";
import { GlobalProgress } from "../components/GlobalProgress";
import { ConfirmModal } from "../components/ConfirmModal";
import { UpdateModal } from "../components/UpdateModal";
import { toast as toastClass } from "../components/toastStyles";
import { LoginView } from "../views/LoginView";
import type { AppStateValue } from "./AppState";

export function AppShell({ app, children }: { app: AppStateValue; children: React.ReactNode }) {
  const {
    userProfile,
    authMode,
    offlineUsername,
    setAuthMode,
    setOfflineUsername,
    loginOffline,
    loginMicrosoft,
    authError,
    setAuthError,
    updateInfo,
    updateBusy,
    updateError,
    handleUpdateNow,
    handleUpdateLater,
    currentView,
    navigate,
    logout,
    isProcessing,
    gamePid,
    globalStatus,
    progress,
    progressActive,
    toast,
    confirmState,
    resolveConfirm,
    showJavaPrompt,
    retryJavaDownload,
    closeJavaPrompt,
  } = app;

  const updateModal = (
    <UpdateModal
      open={Boolean(updateInfo)}
      version={updateInfo?.version ?? ""}
      notes={updateInfo?.body ?? ""}
      date={updateInfo?.date ?? ""}
      isDownloading={updateBusy}
      error={updateError}
      onUpdate={handleUpdateNow}
      onLater={handleUpdateLater}
    />
  );

  if (!userProfile) {
    return (
      <>
        <LoginView
          authMode={authMode}
          setAuthMode={setAuthMode}
          offlineUsername={offlineUsername}
          setOfflineUsername={setOfflineUsername}
          onLoginOffline={loginOffline}
          onLoginMicrosoft={loginMicrosoft}
          authError={authError}
          setAuthError={setAuthError}
        />
        {updateModal}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex font-body overflow-hidden">
      <Sidebar
        currentView={currentView}
        onNavigate={navigate}
        userProfile={userProfile}
        onLogout={logout}
        isProcessing={isProcessing}
        isGameRunning={Boolean(gamePid)}
      />

      <div className="flex-1 relative flex flex-col bg-gray-950 overflow-hidden">
        <GlobalProgress
          isProcessing={isProcessing}
          status={globalStatus}
          progress={progress}
          isActive={progressActive}
        />
        {toast && (
          <div
            className={toastClass({ tone: toast.kind, position: "topRight" })}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        )}

        {children}

        <JavaModal
          open={showJavaPrompt}
          onRetryDownload={retryJavaDownload}
          onClose={closeJavaPrompt}
        />
        <ConfirmModal
          open={Boolean(confirmState)}
          title={confirmState?.title || "Confirmar"}
          message={confirmState?.message || ""}
          confirmLabel={confirmState?.confirmLabel}
          cancelLabel={confirmState?.cancelLabel}
          danger={confirmState?.danger}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
        {updateModal}
      </div>
    </div>
  );
}
