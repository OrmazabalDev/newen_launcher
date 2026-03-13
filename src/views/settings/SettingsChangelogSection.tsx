import { SectionCard } from "../../components/ui/SectionCard";

const CHANGES = [
  "Refactor completo: modulos mas claros en UI y backend.",
  "Catalogo mas rapido con cache, precarga y lazy-load de imagenes.",
  "Instalador NSIS mejorado y assets personalizados.",
  "Mejoras internas de rendimiento y estabilidad.",
];

export function SettingsChangelogSection() {
  return (
    <SectionCard
      title="Novedades 1.1 (Atacama)"
      description="Resumen corto de mejoras internas para esta version."
    >
      <ul className="space-y-2 text-sm text-gray-200">
        {CHANGES.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-brand-accent">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs text-gray-500">
        Early Access: sin firma digital aun. Feedback en Discord oficial.
      </div>
    </SectionCard>
  );
}
