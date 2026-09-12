import { AcademicIllustration, IconCap } from './icons'

export function BrandingPanel() {
  return (
    <aside className="brand-panel" aria-label="AGENT 58 branding">
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <IconCap className="h-12 w-12 text-white" />
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          AGENT 58
        </h1>
        <p className="mt-1 font-display text-base font-bold text-white/90 sm:text-lg">
          Faculty Workload System
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
          Smarter Workload Management for a Better Academic Future
        </p>
        <div className="pill-row justify-center md:justify-start">
          <span className="pill">Intelligent</span>
          <span className="pill">Secure</span>
          <span className="pill">Role-Based</span>
        </div>
      </div>

      <AcademicIllustration className="brand-illustration mt-auto hidden w-full max-w-[380px] self-center pt-6 opacity-90 md:block" />
    </aside>
  )
}
