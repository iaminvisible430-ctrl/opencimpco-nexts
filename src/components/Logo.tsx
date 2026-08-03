export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div
      className={`${className} relative grid place-items-center overflow-hidden rounded-[30%] bg-[oklch(0.2_0.02_275)] shadow-lg`}
    >
      <div
        className="absolute inset-0 opacity-95"
        style={{
          background:
            "conic-gradient(from 200deg, var(--ember), oklch(0.82 0.16 300), var(--signal), oklch(0.84 0.15 150), var(--ember))",
        }}
      />
      <div className="absolute inset-[13%] rounded-[26%] bg-[oklch(0.16_0.014_275)]" />
      <svg viewBox="0 0 24 24" fill="none" className="relative h-1/2 w-1/2 text-white" aria-hidden>
        <path
          d="M4 18V9.2c0-.6.7-.9 1.1-.5L12 15l6.9-6.3c.4-.4 1.1-.1 1.1.5V18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="5" r="1.6" fill="currentColor" opacity="0.85" />
      </svg>
    </div>
  );
}
