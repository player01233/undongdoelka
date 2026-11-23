// Design Ref: §3.5 — 설정: 이동·환복·샤워 초기값 입력, 내보내기·가져오기
// 이번 작업은 화면 틀만 만든다. 초기값 입력과 백업은 이후 작업에서 채운다.
export default function SettingsPage() {
  return (
    <section>
      <h1 className="text-lg font-semibold">설정</h1>
      <p className="mt-2 text-sm text-foreground/70">
        이동·환복·샤워 시간의 초기값을 입력하고, 일정과 기록을 파일로 백업합니다.
      </p>
      <p className="mt-6 rounded-lg border border-foreground/15 p-4 text-sm text-foreground/70">
        준비 중입니다. 초기값 입력과 백업은 다음 작업에서 만들어집니다.
      </p>
    </section>
  );
}
