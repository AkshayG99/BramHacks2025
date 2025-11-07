'use client'

interface LandingProps {
  onEnter: () => void
}

const featureHighlights = [
  {
    title: 'Live wildfire telemetry',
    description:
      'Satellite hot spots and open incident feeds update continuously so your intel is never stale.',
  },
  {
    title: 'Actionable briefings',
    description:
      'Curated recommendations and AI summaries translate raw data into decisions for field teams.',
  },
  {
    title: 'Precision targeting',
    description:
      'Jump to any coordinates, city, or asset and instantly evaluate risk across hundreds of kilometers.',
  },
]

export default function Landing({ onEnter }: LandingProps) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#04050a] via-[#0b1220] to-[#111827] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-16">
        <div className="absolute inset-0 opacity-30">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-rose-500/40 blur-[160px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-400/30 blur-[180px]" />
        </div>

        <header className="relative z-10 flex items-center justify-between pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
            BramFire Lab
          </p>
          <button
            onClick={onEnter}
            className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white md:inline-flex"
          >
            Enter Ops Center →
          </button>
        </header>

        <section className="relative z-10 grid flex-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col justify-center space-y-8">
            <div>
              <span className="mb-4 inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
                Wildfire intel
              </span>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                See risk corridors
                <span className="text-rose-300"> before</span> they ignite.
              </h1>
            </div>
            <p className="text-lg text-white/70 sm:text-xl">
              BramFire Lab unifies orbital data, weather windows, and AI briefings into a single
              command surface so you can prioritize suppression resources with confidence.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={onEnter}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-amber-400 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:-translate-y-0.5"
              >
                Enter live map
              </button>
              <button className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-white/70 transition hover:text-white">
                View demo briefing
              </button>
            </div>
            <div className="flex items-center gap-4 pt-4 text-white/50">
              <div className="text-3xl font-semibold text-white">27</div>
              <div className="text-sm leading-tight">
                Active large incidents
                <br />
                Monitored in real time
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="text-3xl font-semibold text-white">≈ 480k</div>
              <div className="text-sm leading-tight">
                Acres analyzed
                <br />
                Across North America
              </div>
            </div>
          </div>

          <div className="relative z-10 rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="grid gap-6 p-8">
              {featureHighlights.map((feature) => (
                <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/50">
                    {feature.title}
                  </p>
                  <p className="mt-3 text-base text-white/80">{feature.description}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-6 text-sm text-white/60">
              Powered by NASA EONET, OpenWeather, and real-time command telemetry.
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
