// Design Ref: §5.2 — 그날의 수업 고르기와 공강 계산. 화면·저장과 무관한 순수 함수라서 숫자 예시만으로 확인할 수 있다.
// Design Ref: §10.3 — 시각은 분 단위 숫자로 바꿔 계산하고, 날짜는 "YYYY-MM-DD" 글자로 다룬다.
import { toMinutes, toTimeText, weekdayOfDate } from "@/lib/time";
import type { ClassItem, DayOverride } from "@/types";

// 하루 안의 수업 시간대 (시작·종료만 필요하다)
export interface TimeSlot {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

// 공강 하나. 시작·종료는 분 단위(자정부터 지난 분)로 들고 있다.
export interface Gap {
  startMinutes: number;
  endMinutes: number;
  length: number; // 공강 길이(분) = 종료 − 시작
  startedNow: boolean; // 지금이 이 공강 안이라 시작을 "지금"으로 바꿨는가
}

/**
 * 그날의 수업 목록을 시작 시각 순으로 돌려준다.
 * 그날만 수정한 목록이 있으면 그것을 쓰고, 없으면 기본 일정 중
 * (매주 반복이면서 같은 요일) 또는 (반복 아님이면서 같은 날짜)인 수업을 쓴다.
 */
export function getClassesOnDate(
  classes: ClassItem[],
  overrides: DayOverride[],
  date: string,
): TimeSlot[] {
  const weekday = weekdayOfDate(date);
  if (weekday === null) {
    return [];
  }

  const override = overrides.find((item) => item.date === date);
  const slots: TimeSlot[] =
    override !== undefined
      ? override.classes.map(({ start, end }) => ({ start, end }))
      : classes
          .filter((item) =>
            item.repeatWeekly ? item.weekday === weekday : item.date === date,
          )
          .map(({ start, end }) => ({ start, end }));

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * 같은 날 수업들 사이의 빈 시간(공강)을 시간 순으로 돌려준다.
 * 앞 수업 종료 ~ 다음 수업 시작 사이가 1분 이상 비어 있어야 공강이다.
 * (바로 이어지는 수업은 공강이 아니다. 하루의 첫 수업 앞과 마지막 수업 뒤는 공강으로 보지 않는다.)
 */
export function calcGaps(slots: TimeSlot[]): Gap[] {
  const ranges = slots
    .map((slot) => ({ start: toMinutes(slot.start), end: toMinutes(slot.end) }))
    .filter(
      (range): range is { start: number; end: number } =>
        range.start !== null && range.end !== null,
    )
    .sort((a, b) => a.start - b.start);

  const gaps: Gap[] = [];
  let latestEnd: number | null = null;

  for (const range of ranges) {
    // 지금까지의 수업이 끝난 시각보다 늦게 시작하면 그 사이가 공강이다.
    if (latestEnd !== null && range.start > latestEnd) {
      gaps.push({
        startMinutes: latestEnd,
        endMinutes: range.start,
        length: range.start - latestEnd,
        startedNow: false,
      });
    }
    latestEnd = latestEnd === null ? range.end : Math.max(latestEnd, range.end);
  }

  return gaps;
}

/**
 * 지금이 공강 안이면 공강 시작을 "지금"으로 보고 남은 길이로 바꾼다.
 * - 지금이 공강 시작 전이면 그대로 돌려준다.
 * - 지금이 공강 종료 이후면 이미 지난 공강이라 null을 돌려준다.
 * 호출하는 쪽은 오늘의 공강에만 이 함수를 쓴다. (분 단위 버림: 11:00:40 → 11:00)
 */
export function applyNow(gap: Gap, nowMinutes: number): Gap | null {
  if (nowMinutes >= gap.endMinutes) {
    return null;
  }
  if (nowMinutes <= gap.startMinutes) {
    return gap;
  }
  return {
    startMinutes: nowMinutes,
    endMinutes: gap.endMinutes,
    length: gap.endMinutes - nowMinutes,
    startedNow: true,
  };
}

/** 공강을 "10:30~13:00" 글자로 만든다. */
export function formatGap(gap: Gap): string {
  return `${toTimeText(gap.startMinutes)}~${toTimeText(gap.endMinutes)}`;
}

// 그날만 수정 화면에서 고치는 수업 한 줄 (번호로 구분한다)
export interface DayRow {
  id: string;
  start: string;
  end: string;
}

/**
 * 그날만 수정 화면에 보여 줄 그날의 수업 목록을 돌려준다.
 * 이미 그날만 수정한 목록이 있으면 그것(hasOverride = true), 없으면 기본 일정을 복사한 것이다.
 * 날짜가 올바르지 않으면 빈 목록을 돌려준다.
 */
export function getDayRows(
  classes: ClassItem[],
  overrides: DayOverride[],
  date: string,
): { rows: DayRow[]; hasOverride: boolean } {
  const weekday = weekdayOfDate(date);
  if (weekday === null) {
    return { rows: [], hasOverride: false };
  }

  const override = overrides.find((item) => item.date === date);
  const source =
    override !== undefined
      ? override.classes
      : classes.filter((item) =>
          item.repeatWeekly ? item.weekday === weekday : item.date === date,
        );

  const rows = source
    .map(({ id, start, end }) => ({ id, start, end }))
    .sort((a, b) => a.start.localeCompare(b.start));
  return { rows, hasOverride: override !== undefined };
}
