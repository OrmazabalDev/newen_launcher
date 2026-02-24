export function SkinsHeader({ offline }: { offline: boolean }) {
  return (
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-white">Skins</h2>
      <p className="text-gray-300 text-sm">
        {offline
          ? "Carga una skin local o desde URL. Se aplicará al jugar en modo offline."
          : "Vista de skin y cape oficial asociada a tu cuenta Microsoft."}
      </p>
    </div>
  );
}
