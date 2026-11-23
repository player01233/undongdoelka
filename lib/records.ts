// Design Ref: §3.4, §5.2 — 기록 정렬과 "가장 최근 1건만 수정·삭제" 규칙. 화면·저장과 무관한 순수 함수다.
import type { WorkoutRecord } from "@/types";

/**
 * 기록을 "최근" 순서로 늘어놓는다. 날짜가 늦은 순이고, 날짜가 같으면 저장 시각이 늦은 순이다.
 * (평균 대상, 수정·삭제할 1건, 목록 순서가 모두 이 기준을 따른다.) 원본 배열은 바꾸지 않는다.
 */
export function sortRecentFirst<T extends { date: string; createdAt: string }>(records: T[]): T[] {
  return [...records].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** 가장 최근 기록 1건. 기록이 없으면 undefined. */
export function getLatestRecord(records: WorkoutRecord[]): WorkoutRecord | undefined {
  return sortRecentFirst(records)[0];
}

// 최근 1건을 고칠 때 바꿀 수 있는 값. 날짜·저장 당시 판정·저장 시각은 그대로 둔다.
export interface RecordEdit {
  durations: WorkoutRecord["durations"];
  returnedOnTime: boolean;
  special: boolean;
}

export type RecordChange =
  | { ok: true; records: WorkoutRecord[] }
  | { ok: false }; // 가장 최근 기록이 아니거나 이미 없는 기록이라 바꾸지 않았다

/** 가장 최근 1건만 수정한다. 다른 기록의 번호가 들어오면 아무것도 바꾸지 않는다. */
export function editLatestRecord(
  records: WorkoutRecord[],
  id: string,
  edit: RecordEdit,
): RecordChange {
  if (getLatestRecord(records)?.id !== id) {
    return { ok: false };
  }
  return {
    ok: true,
    records: records.map((record) => (record.id === id ? { ...record, ...edit } : record)),
  };
}

/** 가장 최근 1건만 삭제한다. 다른 기록의 번호가 들어오면 아무것도 바꾸지 않는다. */
export function deleteLatestRecord(records: WorkoutRecord[], id: string): RecordChange {
  if (getLatestRecord(records)?.id !== id) {
    return { ok: false };
  }
  return { ok: true, records: records.filter((record) => record.id !== id) };
}
