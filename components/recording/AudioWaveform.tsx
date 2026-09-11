"use client";

type AudioWaveformProps = {
  levels: number[];
  /** Live sampling — bars react to mic input. */
  active: boolean;
  /** True when speech-like energy is currently detected. */
  voiceActive?: boolean;
  className?: string;
};

export function AudioWaveform({
  levels,
  active,
  voiceActive = false,
  className = "",
}: AudioWaveformProps) {
  const reacting = active && voiceActive;

  return (
    <div
      className={`flex h-10 items-center gap-[3px] ${className}`}
      role="img"
      aria-label={
        reacting
          ? "음성이 감지되어 입력 레벨이 움직이고 있습니다"
          : active
            ? "마이크는 켜져 있으나 음성이 감지되지 않았습니다"
            : "마이크 입력 대기 중"
      }
    >
      {levels.map((level, index) => {
        const height = reacting
          ? `${Math.round(14 + level * 86)}%`
          : "16%";
        return (
          <span
            key={index}
            className="w-[3px] rounded-full transition-[height,opacity,background-color] duration-75 ease-out sm:w-1"
            style={{
              height,
              opacity: reacting ? 0.5 + level * 0.5 : 0.32,
              backgroundColor: reacting
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
