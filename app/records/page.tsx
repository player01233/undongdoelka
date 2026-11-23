// Design Ref: §3.4 — 기록: 운동 후 기록 입력, 기록 목록, 주당 횟수·제시간 복귀 비율
// 이번 작업까지 기록 입력과 가장 최근 1건의 수정·삭제를 만들었다. 전체 목록·요약은 이후 작업에서 채운다.
import RecordForm from "@/components/RecordForm";
import RecordList from "@/components/RecordList";

export default function RecordsPage() {
  return (
    <section>
      <h1 className="text-lg font-semibold">기록</h1>
      <p className="mt-2 text-sm text-foreground/70">
        운동 후 실제로 걸린 시간을 기록하면, 다음 판정에 반영됩니다.
      </p>

      <h2 className="mt-6 text-base font-semibold">기록 입력</h2>
      <RecordForm />

      <h2 className="mt-10 text-base font-semibold">기록</h2>
      <RecordList />
    </section>
  );
}
