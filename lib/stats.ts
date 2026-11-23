// Design Ref: §5.2 — 기록 요약 규칙: 이번 주(월~일) 운동 횟수, 제시간 복귀 비율. 화면·저장과 무관한 순수 함수다.
// 날짜는 "YYYY-MM-DD" 글자로 다루고 로컬 날짜로 계산한다. (toISOString은 하루가 밀릴 수 있어 쓰지 않는다.)
import { toDateText } from "@/lib/clock";
import type { WorkoutRecord } from "@/types";

// 제시간 복귀 비율은 앱이 "된다"고 판정한 기록이 이만큼 쌓인 뒤부터 보여 준다. (PRD 성공 기준 ②)
export const MIN_OK_RECORDS_FOR_RATE = 10;

/**
 * 오늘이 속한 한 주의 월요일과 일요일 날짜를 돌려준다. (월~일을 한 주로 보고, 일요일은 그 주의 마지막 날이다.)
 * 날짜 형식이 틀리거나 없는 날짜이면 null.
 */
export function getWeekRange(today: string): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const base = new Date(year, month - 1, day);
  if (base.getFullYear() !== year || base.getMonth() !== month - 1 || base.getDate() !== day) {
    return null;
  }

  const sinceMonday = (base.getDay() + 6) % 7; // 월요일 0 … 일요일 6
  const start = new Date(year, month - 1, day - sinceMonday);
  const end = new Date(year, month - 1, day - sinceMonday + 6);
  return { start: toDateText(start), end: toDateText(end) };
}

/** 오늘이 속한 주(월~일)에 날짜가 있는 기록의 수. 특이 상황 기록도 운동을 한 것이므로 센다. */
export function countThisWeek(records: Pick<WorkoutRecord, "date">[], today: string): number {
  const week = getWeekRange(today);
  if (week === null) {
    return 0;
  }
  return records.filter((record) => record.date >= week.start && record.date <= week.end).length;
}

export interface ReturnRate {
  okCount: number; // 앱이 "된다"고 판정한 기록 수
  onTimeCount: number; // 그중 제시간에 복귀한 기록 수
  percent: number; // 제시간 복귀 비율(%, 반올림)
}

/**
 * 제시간 복귀 비율: 앱이 "된다"고 판정한 기록(특이 상황 포함) 중 제시간에 복귀한 비율.
 * 그런 기록이 10건 미만이면 아직 비율을 보여 주지 않으므로 null을 돌려준다.
 */
export function calcReturnRate(
  records: Pick<WorkoutRecord, "verdict" | "returnedOnTime">[],
): ReturnRate | null {
  const ok = records.filter((record) => record.verdict === "ok");
  if (ok.length < MIN_OK_RECORDS_FOR_RATE) {
    return null;
  }
  const onTimeCount = ok.filter((record) => record.returnedOnTime).length;
  return { okCount: ok.length, onTimeCount, percent: Math.round((onTimeCount / ok.length) * 100) };
}
