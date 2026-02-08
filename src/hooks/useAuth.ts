import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthMode, MinecraftProfile } from "../types";

export interface AuthApi {
  loginOffline: (username: string) => Promise<string>;
  restoreMsSession: () => Promise<string>;
  logoutSession: () => Promise<void>;
  refreshMsProfile: () => Promise<string>;
}

export interface UseAuthOptions {
  api: AuthApi;
  persistedProfile: MinecraftProfile | null;
  onAuthError: (message: string) => void;
  onPresence: (state: string) => void | Promise<void>;
  onPersist: (profile: MinecraftProfile | null) => void;
}

export interface UseAuthResult {
  userProfile: MinecraftProfile | null;
  authMode: AuthMode;
  offlineUsername: string;
  authError: string;
  setAuthMode: (mode: AuthMode) => void;
  setOfflineUsername: (value: string) => void;
  setAuthError: (value: string) => void;
  loginOffline: () => Promise<void>;
  loginMicrosoft: (profile: MinecraftProfile) => void;
  logout: () => Promise<void>;
  refreshOnlineProfile: () => Promise<void>;
}

/**
 * Centraliza el flujo de autenticacion y la restauracion de sesion.
 */
export function useAuth(options: UseAuthOptions): UseAuthResult {
  const { api, persistedProfile, onAuthError, onPresence, onPersist } = options;

  const [userProfile, setUserProfile] = useState<MinecraftProfile | null>(persistedProfile);
  const [authMode, setAuthMode] = useState<AuthMode>("offline");
  const [offlineUsername, setOfflineUsername] = useState("");
  const [authError, setAuthError] = useState("");

  const safePresence = useCallback(
    (state: string) => {
      void onPresence(state);
    },
    [onPresence]
  );

  useEffect(() => {
    if (!userProfile) return;
    safePresence("Gestionando instancias");
  }, [safePresence, userProfile]);

  useEffect(() => {
    if (!persistedProfile) return;
    (async () => {
      try {
        if (persistedProfile.is_offline) {
          const res = await api.loginOffline(persistedProfile.name);
          const parsed = JSON.parse(res) as MinecraftProfile;
          setUserProfile(parsed);
          setAuthMode("offline");
        } else {
          const res = await api.restoreMsSession();
          const parsed = JSON.parse(res) as MinecraftProfile;
          setUserProfile(parsed);
          setAuthMode("microsoft");
        }
      } catch (err: any) {
        setUserProfile(null);
        setAuthError("No se pudo restaurar sesion: " + String(err));
        onAuthError("No se pudo restaurar sesion: " + String(err));
      }
    })();
  }, [api, onAuthError, persistedProfile]);

  useEffect(() => {
    onPersist(userProfile);
  }, [onPersist, userProfile]);

  const loginOffline = useCallback(async () => {
    if (!offlineUsername.trim()) return;
    try {
      setAuthError("");
      const res = await api.loginOffline(offlineUsername.trim());
      const parsed = JSON.parse(res) as MinecraftProfile;
      setUserProfile(parsed);
      setAuthMode("offline");
    } catch (err: any) {
      setAuthError(String(err));
    }
  }, [api, offlineUsername]);

  const loginMicrosoft = useCallback((profile: MinecraftProfile) => {
    setUserProfile(profile);
    setAuthMode("microsoft");
  }, []);

  const logout = useCallback(async () => {
    if (!userProfile) return;
    if (!userProfile.is_offline) {
      try {
        await api.logoutSession();
      } catch (err) {
        console.error(err);
      }
    }
    setUserProfile(null);
    setAuthError("");
  }, [api, userProfile]);

  const refreshOnlineProfile = useCallback(async () => {
    if (!userProfile || userProfile.is_offline) return;
    try {
      const res = await api.refreshMsProfile();
      const parsed = JSON.parse(res) as MinecraftProfile;
      setUserProfile(parsed);
    } catch (err) {
      console.error(err);
    }
  }, [api, userProfile]);

  return {
    userProfile,
    authMode,
    offlineUsername,
    authError,
    setAuthMode,
    setOfflineUsername,
    setAuthError,
    loginOffline,
    loginMicrosoft,
    logout,
    refreshOnlineProfile,
  };
}
