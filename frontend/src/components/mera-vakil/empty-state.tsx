"use client";

export function EmptyState() {
  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="saarthi-welcome" aria-label="Saarthi">
        <div className="saarthi-welcome-mark">
          <span className="saarthi-welcome-glow" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/app-icon-192.png"
            alt=""
            width={192}
            height={192}
            draggable={false}
            className="saarthi-welcome-icon"
          />
        </div>
        <h1 className="saarthi-welcome-title">Saarthi</h1>
      </div>
    </div>
  );
}
