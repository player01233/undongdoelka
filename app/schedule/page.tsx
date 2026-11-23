// Design Ref: §3.3 — 일정: 기본 일정 입력·보기, 특정 날짜만 수정
// 이번 작업은 화면 틀만 만든다. 수업 입력과 날짜별 수정은 이후 작업에서 채운다.
export default function SchedulePage() {
  return (
    <section>
      <h1 className="text-lg font-semibold">일정</h1>
      <p className="mt-2 text-sm text-foreground/70">
        수업 일정을 입력하고, 일정이 바뀐 날은 그날만 고칠 수 있습니다.
      </p>
      <p className="mt-6 rounded-lg border border-foreground/15 p-4 text-sm text-foreground/70">
        준비 중입니다. 수업 일정 입력은 다음 작업에서 만들어집니다.
      </p>
    </section>
  );
}
