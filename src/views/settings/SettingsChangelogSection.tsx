import { SectionCard } from "../../components/ui/SectionCard";

const CHANGES = [
  "Mas claridad y confianza visible dentro del launcher.",
  "Auth V2 base con contratos mas robustos y menos parseos fragiles.",
  "Persistencia de instancias mas segura con mutaciones centralizadas.",
  "Creacion manual y modpacks usando una base comun en backend.",
  "Launch y recovery mas centralizados con mejor soporte de diagnostico.",
  "Thumbnails normalizados con null como convencion oficial.",
];

export function SettingsChangelogSection() {
  return (
    <SectionCard
      title="Newen Launcher v1.2.0"
      description="Claridad, confianza y base tecnica para una experiencia mas consistente."
    >
      <ul className="space-y-2 text-sm text-gray-200">
        {CHANGES.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-brand-accent">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs text-gray-500">
        Alpha / Early Access: build publica enfocada en claridad, confianza
        y estabilidad. Los reportes se generan localmente y hoy se comparten
        de forma manual.
      </div>
    </SectionCard>
  );
}
