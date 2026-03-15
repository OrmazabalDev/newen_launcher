import { useCallback, useEffect, useState } from "react";
import type { AuthMode, AuthProfileV2, MinecraftProfile } from "../types";

export interface AuthApi {
  loginOfflineV2: (username: string) => Promise<AuthProfileV2>;
  restoreMsSessionV2: () => Promise<AuthProfileV2>;
  logoutSession: () => Promise<void>;
  refreshMsProfileV2: () => Promise<AuthProfileV2>;
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

  const toMinecraftProfile = useCallback(
    (profile: AuthProfileV2): MinecraftProfile => ({
      id: profile.id,
      name: profile.name,
      is_offline: profile.is_offline,
      skin_url: profile.skin_url,
      cape_urls: profile.cape_urls,
    }),
    []
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
          const profile = await api.loginOfflineV2(persistedProfile.name);
          setUserProfile(toMinecraftProfile(profile));
          setAuthMode("offline");
        } else {
          const profile = await api.restoreMsSessionV2();
          setUserProfile(toMinecraftProfile(profile));
          setAuthMode("microsoft");
        }
      } catch (err) {
        setUserProfile(null);
        setAuthError("No se pudo restaurar sesion: " + String(err));
        onAuthError("No se pudo restaurar sesion: " + String(err));
      }
    })();
  }, [api, onAuthError, persistedProfile, toMinecraftProfile]);

  useEffect(() => {
    onPersist(userProfile);
  }, [onPersist, userProfile]);

  const loginOffline = useCallback(async () => {
    if (!offlineUsername.trim()) return;
    try {
      setAuthError("");
      const profile = await api.loginOfflineV2(offlineUsername.trim());
      setUserProfile(toMinecraftProfile(profile));
      setAuthMode("offline");
    } catch (err) {
      setAuthError(String(err));
    }
  }, [api, offlineUsername, toMinecraftProfile]);

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
      const profile = await api.refreshMsProfileV2();
      setUserProfile(toMinecraftProfile(profile));
    } catch (err) {
      console.error(err);
    }
  }, [api, toMinecraftProfile, userProfile]);

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
