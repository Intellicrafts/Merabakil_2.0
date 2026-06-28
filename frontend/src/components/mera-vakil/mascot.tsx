export function Mascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="mascot-body" x1="40" y1="40" x2="160" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CBD5E1" />
          <stop offset="0.5" stopColor="#94A3B8" />
          <stop offset="1" stopColor="#64748B" />
        </linearGradient>
        <linearGradient id="mascot-face" x1="70" y1="80" x2="130" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>
      {/* Antenna */}
      <line x1="100" y1="35" x2="100" y2="55" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="28" r="8" fill="#64748B" />
      {/* Head */}
      <rect x="55" y="55" width="90" height="85" rx="28" fill="url(#mascot-body)" />
      <rect x="68" y="72" width="64" height="52" rx="18" fill="url(#mascot-face)" />
      {/* Eyes */}
      <circle cx="88" cy="95" r="8" fill="#1E293B" />
      <circle cx="112" cy="95" r="8" fill="#1E293B" />
      <circle cx="90" cy="93" r="3" fill="white" />
      <circle cx="114" cy="93" r="3" fill="white" />
      {/* Smile */}
      <path
        d="M 85 112 Q 100 122 115 112"
        stroke="#334155"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Body */}
      <rect x="65" y="145" width="70" height="55" rx="20" fill="url(#mascot-body)" opacity="0.9" />
      {/* Arms */}
      <rect x="38" y="150" width="22" height="12" rx="6" fill="#94A3B8" transform="rotate(-20 49 156)" />
      <rect x="140" y="150" width="22" height="12" rx="6" fill="#64748B" transform="rotate(20 151 156)" />
      {/* Chest light */}
      <circle cx="100" cy="172" r="10" fill="#F8FAFC" opacity="0.8" />
      <circle cx="100" cy="172" r="5" fill="#64748B" />
    </svg>
  );
}
