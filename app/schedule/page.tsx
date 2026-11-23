// Design Ref: §3.3 — 일정: 기본 일정 입력·보기, 특정 날짜만 수정
import ClassForm from "@/components/ClassForm";
import DayOverrideEditor from "@/components/DayOverrideEditor";

export default function SchedulePage() {
  return (
    <section>
      <h1 className="text-lg font-semibold">일정</h1>
      <p className="mt-2 text-sm text-foreground/70">
        수업 일정을 입력하고, 일정이 바뀐 날은 그날만 고칠 수 있습니다.
      </p>
      <ClassForm />

      <h2 id="day-override" className="mt-12 scroll-mt-4 text-base font-semibold">
        특정 날짜만 수정
      </h2>
      <DayOverrideEditor />
    </section>
  );
}
