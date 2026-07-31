export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div
      className={`${className} relative grid place-items-center overflow-hidden rounded-[30%] bg-[oklch(0.24_0.012_250)] shadow-lg`}
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "conic-gradient(from 210deg, var(--ember), oklch(0.85 0.13 85), var(--signal), var(--ember))",
        }}
      />
      <div className="absolute inset-[14%] rounded-[26%] bg-[oklch(0.17_0.01_250)]" />
      <svg viewBox="0 0 24 24" fill="none" className="relative h-1/2 w-1/2 text-white" aria-hidden>
        <path
          d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <path
          d="M9.6 9.4 7.2 12l2.4 2.6M14.4 9.4 16.8 12l-2.4 2.6"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
