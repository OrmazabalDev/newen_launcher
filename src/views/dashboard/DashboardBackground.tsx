export function DashboardBackground() {
  return (
    <div className="absolute inset-0 z-0">
      <div className="absolute inset-0 bg-[#0f0f13]" />
      <img
        src="/hero-bg.svg"
        className="w-full h-full object-cover opacity-35"
        alt=""
        aria-hidden="true"
      />
      <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-brand-accent/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950" />
    </div>
  );
}
