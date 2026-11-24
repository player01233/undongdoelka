// Design Ref: §3.2 — 홈: 오늘의 공강 선택 → 운동 시간 입력 → 판정 확인
import BackupReminder from "@/components/BackupReminder";
import JudgementPanel from "@/components/JudgementPanel";

export default function HomePage() {
  return (
    <section>
      <h1 className="text-lg font-semibold">홈</h1>
      <p className="mt-2 text-sm text-foreground/70">
        오늘의 공강을 고르고 운동 시간을 넣으면, 운동이 가능한지 알려 줍니다.
      </p>
      <BackupReminder />
      <JudgementPanel />
    </section>
  );
}
