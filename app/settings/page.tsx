// Design Ref: §3.5 — 설정: 이동·환복·샤워 초기값 입력, 내보내기·가져오기
import BackupPanel from "@/components/BackupPanel";
import DefaultsForm from "@/components/DefaultsForm";

export default function SettingsPage() {
  return (
    <section>
      <h1 className="text-lg font-semibold">설정</h1>
      <p className="mt-2 text-sm text-foreground/70">
        이동·환복·샤워 시간의 초기값을 입력하고, 일정과 기록을 파일로 백업합니다.
      </p>

      <h2 className="mt-8 text-base font-semibold">이동·환복·샤워 초기값</h2>
      <p className="mt-2 text-sm text-foreground/70">
        처음 사용할 때 한 번 입력해 두세요. 운동 기록이 생기면 실제 기록의 평균을 쓰고,
        초기값은 기록이 아직 없을 때만 쓰입니다. 환복이나 샤워를 생략하는 편이면 0분을 넣어도 됩니다.
      </p>
      <DefaultsForm />

      <h2 className="mt-10 text-base font-semibold">백업</h2>
      <BackupPanel />
    </section>
  );
}
