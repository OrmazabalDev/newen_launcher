import React from "react";
import type { MinecraftProfile, SkinInfo } from "../../types";
import { SectionCard } from "../../components/ui/SectionCard";

export function SkinsPreviewCard({
  offline,
  skin,
  userProfile,
  canvasRef,
}: {
  offline: boolean;
  skin: SkinInfo | null;
  userProfile: MinecraftProfile;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}) {
  return (
    <SectionCard title="Vista 3D" titleClassName="text-sm font-bold text-white mb-4">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl flex items-center justify-center p-4">
        <canvas ref={canvasRef} className="rounded-xl" />
      </div>
      {offline && skin && (
        <div className="mt-4 text-xs text-gray-400">
          Skin activa: <span className="text-gray-200">{skin.name}</span> · Modelo{" "}
          <span className="text-gray-200">{skin.model}</span>
        </div>
      )}
      {!offline && (
        <div className="mt-4 text-xs text-gray-400">
          Cuenta: <span className="text-gray-200">{userProfile.name}</span>
        </div>
      )}
    </SectionCard>
  );
}
