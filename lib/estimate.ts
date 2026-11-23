// Design Ref: §5.2 — "된다/안 된다" 판정에 쓰는 시간 계산 규칙.
// 화면·저장과 무관한 순수 함수이며, 같은 입력이면 항상 같은 결과가 나온다.
// 쓸 값 고르기(최근 5회 평균·초기값)도 여기에 있다. 입력 범위 검사는 validate.ts 몫이다.
import type { Durations } from "@/types";

// 다음 수업 시작 10분 전까지 복귀해야 "된다"로 본다.
export const RETURN_MARGIN_MINUTES = 10;

// 판정 결과: 필요한 시간, 남는 시간, 가능 여부를 함께 돌려줘서 화면에서 계산 근거를 보여 줄 수 있게 한다.
export interface FeasibilityResult {
  requiredMinutes: number; // 필요한 시간
  remainingMinutes: number; // 남는 시간 (부족하면 음수)
  possible: boolean; // true면 "된다"
}

/**
 * 필요한 시간 = 가는 이동 + 환복 + 운동 + 샤워 + 오는 이동
 */
export function calcRequiredMinutes(
  durations: Durations,
  workoutMinutes: number,
): number {
  return (
    durations.travelTo +
    durations.changing +
    workoutMinutes +
    durations.shower +
    durations.travelBack
  );
}

/**
 * 남는 시간 = 공강 길이 − 필요한 시간 (모자라면 음수)
 */
export function calcRemainingMinutes(
  gapMinutes: number,
  requiredMinutes: number,
): number {
  return gapMinutes - requiredMinutes;
}

/**
 * 공강에 운동이 가능한지 판정한다. 남는 시간이 10분 이상이면 "된다".
 */
export function judgeWorkout(
  gapMinutes: number,
  workoutMinutes: number,
  durations: Durations,
): FeasibilityResult {
  const requiredMinutes = calcRequiredMinutes(durations, workoutMinutes);
  const remainingMinutes = calcRemainingMinutes(gapMinutes, requiredMinutes);

  return {
    requiredMinutes,
    remainingMinutes,
    possible: remainingMinutes >= RETURN_MARGIN_MINUTES,
  };
}

// 공강을 고르면 보여 주는 "최대 운동 시간"의 표시 상한(분). 운동 시간 입력 상한과 같다.
export const MAX_WORKOUT_DISPLAY_MINUTES = 300;

// 최대 운동 시간 결과: 운동할 시간이 있는지, 있으면 몇 분까지인지
export type MaxWorkoutResult =
  | { possible: true; minutes: number } // minutes는 1~300 (300보다 크면 300으로 줄여 표시)
  | { possible: false };

/**
 * 최대 운동 시간 = 공강 길이 − (가는 이동 + 환복 + 샤워 + 오는 이동) − 10분
 * 계산값이 1분보다 작으면 운동할 시간이 없고, 300분보다 크면 300분까지만 표시한다.
 */
export function calcMaxWorkoutMinutes(
  gapMinutes: number,
  durations: Durations,
): MaxWorkoutResult {
  const fixed =
    durations.travelTo + durations.changing + durations.shower + durations.travelBack;
  const raw = gapMinutes - fixed - RETURN_MARGIN_MINUTES;

  if (raw < 1) {
    return { possible: false };
  }
  return { possible: true, minutes: Math.min(raw, MAX_WORKOUT_DISPLAY_MINUTES) };
}

// ---- 쓸 값 고르기: 최근 5회 기록 평균 / 초기값 (Design §5.2, PRD 5②) ----

// 평균에 쓰는 최근 기록 수
export const RECENT_RECORD_COUNT = 5;

// 어떤 근거로 값을 골랐는가: 기록 평균(몇 건) 또는 초기값
export type DurationsSource = { kind: "records"; count: number } | { kind: "defaults" };

export interface SelectedDurations {
  durations: Durations | null; // 기록도 초기값도 없으면 null
  source: DurationsSource;
}

// 기록에서 평균 계산에 필요한 부분만 (WorkoutRecord의 일부)
export interface RecordForAverage {
  date: string;
  createdAt: string;
  special: boolean;
  durations: Durations;
}

const DURATION_KEYS = ["travelTo", "changing", "shower", "travelBack"] as const;

/**
 * 판정에 쓸 이동·환복·샤워·오는 이동 값을 정한다.
 * - "최근"은 날짜가 늦은 순, 날짜가 같으면 저장 시각이 늦은 순이다. 그중 최근 5건을 본다.
 * - "특이 상황" 기록은 평균에서 빼고, 항목마다 0분(생략한 날) 값도 그 항목 평균에서 뺀다. 평균의 소수점은 올림한다.
 *   어떤 항목이 모두 0분이면 그 항목은 0분이다. (초기값을 쓰지 않는다.)
 * - 평균에 쓸 기록이 하나도 없을 때(기록이 없거나 모두 특이 상황)만 초기값을 쓴다.
 */
export function selectDurations(
  records: RecordForAverage[],
  defaults: Durations | null,
): SelectedDurations {
  const recent = [...records]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_RECORD_COUNT)
    .filter((record) => !record.special);

  if (recent.length === 0) {
    return { durations: defaults, source: { kind: "defaults" } };
  }

  const averaged = { travelTo: 0, changing: 0, shower: 0, travelBack: 0 };
  for (const key of DURATION_KEYS) {
    const values = recent.map((record) => record.durations[key]).filter((value) => value > 0);
    averaged[key] =
      values.length === 0 ? 0 : Math.ceil(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  return { durations: averaged, source: { kind: "records", count: recent.length } };
}
