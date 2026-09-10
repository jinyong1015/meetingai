import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%)",
        }}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20 sm:px-10">
        <p className="animate-rise font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-7xl">
          AI 회의노트
        </p>

        <h1
          className="animate-rise mt-6 max-w-2xl text-2xl font-medium leading-snug tracking-tight text-[var(--foreground)] sm:text-3xl"
          style={{ animationDelay: "80ms" }}
        >
          회의에 집중하세요.
          <br />
          <span className="text-[var(--muted)]">기록은 여기서 이어집니다.</span>
        </h1>

        <p
          className="animate-rise mt-5 max-w-lg text-base leading-relaxed text-[var(--muted)]"
          style={{ animationDelay: "140ms" }}
        >
          녹음 중에도 메모를 자유롭게 남기고, 시점·중요 표시·AI 반영 여부를 함께
          저장합니다.
        </p>

        <div
          className="animate-rise mt-10 flex flex-wrap items-center gap-4"
          style={{ animationDelay: "200ms" }}
        >
          <Link href="/meetings/new" className="btn btn-primary px-6 py-3">
            새 회의 시작
          </Link>
          <span className="text-sm text-[var(--muted)]">
            데이터는 이 브라우저에만 저장됩니다
          </span>
        </div>
      </main>
    </div>
  );
}
