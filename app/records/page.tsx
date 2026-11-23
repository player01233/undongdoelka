// Design Ref: §3.4 — 기록: 운동 후 기록 입력, 기록 목록, 주당 횟수·제시간 복귀 비율
// 이번 작업은 기록 입력과 저장까지만 만든다. 목록·요약·수정·삭제는 이후 작업에서 채운다.
import RecordForm from "@/components/RecordForm";

export default function RecordsPage() {
  return (
    <section>
      <h1 className="text-lg font-semibold">기록</h1>
      <p className="mt-2 text-sm text-foreground/70">
        운동 후 실제로 걸린 시간을 기록하면, 다음 판정에 반영됩니다.
      </p>

      <h2 className="mt-6 text-base font-semibold">기록 입력</h2>
      <RecordForm />

      <p className="mt-8 rounded-lg border border-foreground/15 p-4 text-sm text-foreground/70">
        준비 중입니다. 기록 목록과 요약은 다음 작업에서 만들어집니다.
      </p>
    </section>
  );
}
