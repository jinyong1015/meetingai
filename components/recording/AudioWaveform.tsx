"use client";

type AudioWaveformProps = {
  levels: number[];
  /** Live sampling — bars react to voice. */
  active: boolean;
  className?: string;
};

export function AudioWaveform({
  levels,
  active,
  className = "",
}: AudioWaveformProps) {
  return (
    <div
      className={`flex h-10 items-center gap-[3px] ${className}`}
      role="img"
      aria-label={
        active
          ? "마이크 입력이 감지되고 있습니다"
          : "마이크 입력 대기 중"
      }
    >
      {levels.map((level, index) => {
        const height = active
          ? `${Math.round(12 + level * 88)}%`
          : "18%";
        return (
          <span
            key={index}
            className="w-[3px] rounded-full transition-[height,opacity,background-color] duration-75 ease-out sm:w-1"
            style={{
              height,
              opacity: active ? 0.45 + level * 0.55 : 0.35,
              backgroundColor: active
                ? "var(--danger)"
                : "var(--muted)",
            }}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
