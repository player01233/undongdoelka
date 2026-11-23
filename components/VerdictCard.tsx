// Design Ref: §3.2 — 판정 결과("된다/안 된다")와 계산 근거 숫자, 운동 후 기록하기 버튼.
import Link from "next/link";
import { RETURN_MARGIN_MINUTES } from "@/lib/estimate";
import type { Durations } from "@/types";

// 확인하기를 눌렀을 때 만들어지는 결과 한 건
export interface VerdictResult {
  judgementId: string; // 기록 화면에 넘기는 판정 번호
  possible: boolean;
  gapMinutes: number;
  workoutMinutes: number;
  durations: Durations;
  requiredMinutes: number;
  remainingMinutes: number;
  startedNow: boolean; // 지금부터 남은 시간으로 계산했는가
}

export default function VerdictCard({ result }: { result: VerdictResult }) {
  const { durations } = result;

  return (
    <div aria-live="polite" className="mt-6 rounded-lg border border-foreground/20 p-4 text-sm">
      <p className="text-base font-semibold">
        결과: {result.possible ? "✅ 된다" : "❌ 안 된다"}
      </p>
      <dl className="mt-3 space-y-1">
        <div className="flex gap-2">
          <dt className="w-24 text-foreground/60">공강</dt>
          <dd>{result.gapMinutes}분</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 text-foreground/60">필요한 시간</dt>
          <dd>
            {result.requiredMinutes}분
            <span className="block text-xs text-foreground/60">
              가는 이동 {durations.travelTo} + 환복 {durations.changing} + 운동 {result.workoutMinutes} + 샤워{" "}
              {durations.shower} + 오는 이동 {durations.travelBack}
            </span>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 text-foreground/60">남는 시간</dt>
          <dd>
            {result.remainingMinutes}분
            <span className="block text-xs text-foreground/60">
              {RETURN_MARGIN_MINUTES}분 이상이면 &quot;된다&quot; (다음 수업 {RETURN_MARGIN_MINUTES}분 전 복귀)
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-foreground/60">아직 기록이 없어 초기값으로 계산했어요.</p>
      {result.startedNow && (
        <p className="mt-1 text-xs text-foreground/60">지금부터 남은 시간으로 계산했어요.</p>
      )}

      <Link
        href={`/records?judgement=${encodeURIComponent(result.judgementId)}`}
        className="mt-4 inline-block rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium"
      >
        운동 끝나고 기록하기
      </Link>
    </div>
  );
}
