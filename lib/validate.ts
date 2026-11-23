// Design Ref: §7 — 입력값 검사. 화면과 무관한 순수 함수라서 숫자 예시만으로 맞는지 확인할 수 있다.
// 이동·환복·샤워·오는 이동 시간(분) 검사와 수업 일정 검사를 담았다. 나머지 검사는 해당 작업에서 이 파일에 추가한다.
import { toMinutes, weekdayOfDate } from "@/lib/time";
import type { ClassItem, Weekday } from "@/types";

// PRD 5② — 이동·환복·샤워·오는 이동은 0~120분의 정수만 받는다. (0분은 "생략한 날"이라 허용)
export const MIN_DURATION_MINUTES = 0;
export const MAX_DURATION_MINUTES = 120;

export type MinutesParseResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

/**
 * 입력 칸의 글자를 분 단위 정수로 바꾼다.
 * 규칙에 맞지 않으면 화면에 보여 줄 안내 문구를 함께 돌려준다.
 */
export function parseDurationMinutes(text: string): MinutesParseResult {
  const trimmed = text.trim();

  if (trimmed === "") {
    return { ok: false, message: "숫자를 입력해 주세요." };
  }

  // 숫자 모양(부호·소수점 허용)만 통과시키고, 글자가 섞인 값은 여기서 거른다.
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, message: "숫자만 입력해 주세요." };
  }

  const value = Number(trimmed);

  if (!Number.isInteger(value)) {
    return { ok: false, message: "소수점 없이 정수로 입력해 주세요." };
  }
  if (value < MIN_DURATION_MINUTES) {
    return { ok: false, message: `${MIN_DURATION_MINUTES}분 이상으로 입력해 주세요.` };
  }
  if (value > MAX_DURATION_MINUTES) {
    return { ok: false, message: `${MAX_DURATION_MINUTES}분 이하로 입력해 주세요.` };
  }

  return { ok: true, value };
}

// ---- 수업 일정 검사 (Design §3.3, §7) ----

// 수업 입력 칸에서 넘어오는 값
export interface ClassInput {
  weekday: Weekday; // 매주 반복일 때 쓰는 요일
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  repeatWeekly: boolean;
  date: string; // 반복하지 않을 때 쓰는 날짜 "YYYY-MM-DD"
}

export interface ClassInputErrors {
  date?: string;
  start?: string;
  end?: string;
  overlap?: string; // 다른 수업과 겹칠 때(저장 버튼 근처에 보여 준다)
}

export type ClassParseResult =
  | { ok: true; value: Omit<ClassItem, "id"> }
  | { ok: false; errors: ClassInputErrors };

// 수업이 열리는 요일을 돌려준다. (매주 반복이면 지정한 요일, 한 번만이면 그 날짜의 요일)
function classWeekday(item: Pick<ClassItem, "repeatWeekly" | "weekday" | "date">): Weekday | null {
  if (item.repeatWeekly) {
    return item.weekday ?? null;
  }
  return item.date !== undefined ? weekdayOfDate(item.date) : null;
}

// 두 수업이 같은 날에 열릴 수 있는가
function canShareDay(
  a: Pick<ClassItem, "repeatWeekly" | "weekday" | "date">,
  b: Pick<ClassItem, "repeatWeekly" | "weekday" | "date">,
): boolean {
  // 한 번만 열리는 수업끼리는 날짜가 같아야 같은 날이다.
  if (!a.repeatWeekly && !b.repeatWeekly) {
    return a.date !== undefined && a.date === b.date;
  }
  // 하나라도 매주 반복이면 요일이 같을 때 같은 날에 만난다.
  const weekdayA = classWeekday(a);
  return weekdayA !== null && weekdayA === classWeekday(b);
}

/**
 * 수업 입력을 검사해 저장할 수업(id 제외)으로 바꾼다.
 * existing은 이미 저장된 수업들이고, 수정 중이면 editingId로 자기 자신을 겹침 검사에서 뺀다.
 * 규칙: 종료는 시작보다 늦어야 하고(23:59까지), 같은 날 수업과 시간이 겹치면 저장할 수 없다.
 */
export function parseClassInput(
  input: ClassInput,
  existing: ClassItem[],
  editingId: string | null,
): ClassParseResult {
  const errors: ClassInputErrors = {};

  const start = toMinutes(input.start);
  const end = toMinutes(input.end);

  if (start === null) {
    errors.start = "시작 시각을 입력해 주세요.";
  }
  if (end === null) {
    errors.end = "종료 시각을 입력해 주세요.";
  }
  if (start !== null && end !== null && end <= start) {
    errors.end = "종료는 시작보다 늦어야 해요.";
  }
  if (!input.repeatWeekly && weekdayOfDate(input.date) === null) {
    errors.date = "날짜를 올바르게 선택해 주세요.";
  }

  if (errors.start || errors.end || errors.date) {
    return { ok: false, errors };
  }

  const value: Omit<ClassItem, "id"> = input.repeatWeekly
    ? { start: input.start, end: input.end, repeatWeekly: true, weekday: input.weekday }
    : { start: input.start, end: input.end, repeatWeekly: false, date: input.date };

  // 같은 날 다른 수업과 시간이 겹치는지 본다. 맞닿기만 하는 경우(10:30 끝, 10:30 시작)는 겹침이 아니다.
  const overlapped = existing.some((other) => {
    if (other.id === editingId || !canShareDay(value, other)) {
      return false;
    }
    const otherStart = toMinutes(other.start);
    const otherEnd = toMinutes(other.end);
    return (
      otherStart !== null &&
      otherEnd !== null &&
      start !== null &&
      end !== null &&
      start < otherEnd &&
      otherStart < end
    );
  });
  if (overlapped) {
    return { ok: false, errors: { overlap: "다른 수업과 시간이 겹쳐요." } };
  }

  return { ok: true, value };
}

// ---- 운동 시간 검사 ----

// PRD 5② — 운동 시간은 1~300분의 정수만 받는다.
export const MIN_WORKOUT_MINUTES = 1;
export const MAX_WORKOUT_MINUTES = 300;

/** 운동 시간 입력 칸의 글자를 분 단위 정수로 바꾼다. 규칙에 맞지 않으면 안내 문구를 돌려준다. */
export function parseWorkoutMinutes(text: string): MinutesParseResult {
  const trimmed = text.trim();

  if (trimmed === "") {
    return { ok: false, message: "운동 시간을 입력해 주세요." };
  }
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, message: "숫자만 입력해 주세요." };
  }

  const value = Number(trimmed);

  if (!Number.isInteger(value)) {
    return { ok: false, message: "소수점 없이 정수로 입력해 주세요." };
  }
  if (value < MIN_WORKOUT_MINUTES) {
    return { ok: false, message: `${MIN_WORKOUT_MINUTES}분 이상으로 입력해 주세요.` };
  }
  if (value > MAX_WORKOUT_MINUTES) {
    return { ok: false, message: `${MAX_WORKOUT_MINUTES}분 이하로 입력해 주세요.` };
  }

  return { ok: true, value };
}

// ---- 그날만 수정한 수업 목록 검사 (Design §3.3, §7) ----

export interface DayRowsErrors {
  rows: (string | undefined)[]; // 줄마다 시각 오류 문구 (오류가 없으면 undefined)
  overlap?: string; // 줄끼리 시간이 겹칠 때
}

/**
 * 그날의 수업 목록 전체를 검사한다. 각 줄은 시각 형식이 맞고 종료가 시작보다 늦어야 하며,
 * 줄끼리 시간이 겹치면 저장할 수 없다. (맞닿기만 하는 경우는 겹침이 아니다.) 빈 목록은 허용한다.
 */
export function validateDayRows(rows: { start: string; end: string }[]): DayRowsErrors | null {
  const rowErrors: (string | undefined)[] = rows.map((row) => {
    const start = toMinutes(row.start);
    const end = toMinutes(row.end);
    if (start === null || end === null) {
      return "시작과 종료 시각을 입력해 주세요.";
    }
    if (end <= start) {
      return "종료는 시작보다 늦어야 해요.";
    }
    return undefined;
  });

  if (rowErrors.some((message) => message !== undefined)) {
    return { rows: rowErrors };
  }

  const ranges = rows.map((row) => ({
    start: toMinutes(row.start) as number,
    end: toMinutes(row.end) as number,
  }));
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      if (ranges[i].start < ranges[j].end && ranges[j].start < ranges[i].end) {
        return { rows: rowErrors, overlap: "다른 수업과 시간이 겹쳐요." };
      }
    }
  }
  return null;
}
