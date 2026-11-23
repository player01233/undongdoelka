// Design Ref: §5.2 — "된다/안 된다" 판정에 쓰는 시간 계산 규칙.
// 화면·저장과 무관한 순수 함수이며, 같은 입력이면 항상 같은 결과가 나온다.
// (평균·초기값 고르기, 입력 범위 검사 등은 PLAN의 다른 작업 몫이라 여기서는 만들지 않는다.)
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
