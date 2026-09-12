/**
 * Vignan's logo for white headers — no black background plate.
 * Matches official lockup: crest + red VIGNAN'S + blue UGC bar.
 */
export function VignanHeaderLogo({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex flex-col gap-1.5 bg-transparent ${className}`}
      aria-label="Vignan's (Deemed to be University) — Estd. u/s 3 of UGC Act 1956"
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Shield crest */}
        <svg
          viewBox="0 0 72 84"
          className="h-11 w-[2.4rem] shrink-0 sm:h-[3.35rem] sm:w-12"
          aria-hidden
        >
          <path
            d="M36 3.5 L67 18 V47 C67 63 52 74.5 36 81 C20 74.5 5 63 5 47 V18 Z"
            fill="#e8eaf6"
            stroke="#b0b8e0"
            strokeWidth="4"
          />
          <circle cx="36" cy="41" r="19" fill="#c5cae9" />
          {/* five-spoke star / wheel */}
          <path
            d="M36 20 L41 39 L61 39 L45 50 L51 69 L36 58 L21 69 L27 50 L11 39 L31 39 Z"
            fill="#0d47a1"
          />
          <circle cx="36" cy="41" r="8" fill="#ffffff" />
          <path
            d="M36 34.5 L38.1 40.2 L44.2 40.4 L39.3 44 L41 49.8 L36 46.4 L31 49.8 L32.7 44 L27.8 40.4 L33.9 40.2 Z"
            fill="#1565c0"
          />
        </svg>

        <p className="font-display text-[1.45rem] leading-none font-extrabold tracking-wide text-[#e30613] sm:text-[1.85rem] md:text-[2rem]">
          VIGNAN&apos;S
        </p>
      </div>

      {/* Blue UGC bar — white text for contrast on blue */}
      <div className="rounded-[2px] bg-[#1e88e5] px-2 py-[5px] sm:px-2.5">
        <p className="text-center text-[0.52rem] leading-none font-semibold tracking-wide whitespace-nowrap text-white sm:text-[0.6rem]">
          (Deemed to be University) — Estd. u/s 3 of UGC Act 1956
        </p>
      </div>
    </div>
  )
}
