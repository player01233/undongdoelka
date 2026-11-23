// Design Ref: §10.1 — 시각("HH:MM")을 분 단위 숫자로 바꾸는 도우미.
// 화면·저장과 무관한 순수 함수라서 숫자 예시만으로 맞는지 확인할 수 있다.
// Design Ref: §10.3 — 모든 시간 값은 분 단위 정수로 다룬다. 시각은 24:00 없이 23:59까지만 받는다.

import type { Weekday } from "@/types";

// 00:00 ~ 23:59 형식만 허용한다.
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * "HH:MM" 형식의 시각을 자정부터 지난 분으로 바꾼다.
 * 형식이 맞지 않으면 null을 돌려준다. (예: "09:00" → 540, "24:00" → null)
 */
export function toMinutes(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  if (match === null) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

/**
 * "YYYY-MM-DD" 날짜의 요일을 돌려준다. (0 = 일요일)
 * 없는 날짜(예: 2026-02-30)이거나 형식이 틀리면 null.
 * 브라우저 시간대 때문에 하루가 밀리지 않도록 로컬 날짜로 계산한다. (toISOString 사용 금지)
 */
export function weekdayOfDate(date: string): Weekday | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  // 2월 30일처럼 다음 달로 넘어가 버리는 날짜는 걸러낸다.
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed.getDay() as Weekday;
}
