// Design Ref: §4.4, §5.1, §8 — 내보내기·가져오기 규칙. 화면과 무관한 순수 함수라서 숫자·글자 예시만으로 확인할 수 있다.
// 가져오기 파일은 값의 형식과 범위를 모두 확인한 뒤에만 앱 데이터로 바꾼다. 확인을 통과한 값만 새로 만들어 돌려주므로
// 파일에 끼어 있는 알 수 없는 항목은 버려진다.
import { toMinutes, weekdayOfDate } from "@/lib/time";
import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  parseClassInput,
  validateDayRows,
} from "@/lib/validate";
import type { AppData, ClassItem, DayOverride, Durations, Judgement, WorkoutRecord } from "@/types";

// 파일 안에 적는 앱 이름 표시. 다른 앱의 파일을 거르는 데 쓴다.
export const BACKUP_APP_NAME = "undongdoelka";

// 마지막 내보내기로부터 이만큼 지나면 백업 안내를 보여 준다. (PRD 5②)
export const BACKUP_REMINDER_DAYS = 7;

// 가져올 파일의 최대 크기(바이트). 화면에서는 읽기 전에 이 크기를 먼저 확인한다.
export const MAX_BACKUP_FILE_BYTES = 5_000_000;

// 이보다 큰 파일은 백업 파일로 보지 않는다. (실수로 큰 파일을 고른 경우를 막는다.)
const MAX_BACKUP_FILE_CHARS = MAX_BACKUP_FILE_BYTES;

// 내보내기 파일의 모양
export interface BackupFile {
  app: typeof BACKUP_APP_NAME;
  version: 1;
  exportedAt: string; // 내보낸 시각(ISO 글자)
  data: AppData;
}

export type BackupParseResult =
  | { ok: true; data: AppData; exportedAt: string }
  | { ok: false; message: string };

/** 내보낼 파일 내용을 만든다. 파일 안 데이터의 마지막 내보낸 시각도 지금으로 맞춘다. */
export function createBackup(data: AppData, exportedAt: string): BackupFile {
  return {
    app: BACKUP_APP_NAME,
    version: 1,
    exportedAt,
    data: { ...data, lastExportedAt: exportedAt },
  };
}

/** 내보내는 파일 이름: undongdoelka-backup-YYYYMMDD.json (로컬 날짜 기준) */
export function backupFileName(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `undongdoelka-backup-${date.getFullYear()}${month}${day}.json`;
}

// ---- 값 확인 도우미 (맞으면 값을, 틀리면 null을 돌려준다) ----

type Obj = Record<string, unknown>;

function asObject(value: unknown): Obj | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Obj) : null;
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

// 시각 두 개가 "HH:MM" 형식이고 종료가 시작보다 늦은지 본다.
function isValidTimeRange(start: unknown, end: unknown): start is string {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }
  const s = toMinutes(start);
  const e = toMinutes(end);
  return s !== null && e !== null && e > s;
}

function readDurations(value: unknown): Durations | null {
  const raw = asObject(value);
  if (raw === null) {
    return null;
  }
  const { travelTo, changing, shower, travelBack } = raw;
  if (
    isIntInRange(travelTo, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES) &&
    isIntInRange(changing, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES) &&
    isIntInRange(shower, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES) &&
    isIntInRange(travelBack, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES)
  ) {
    return { travelTo, changing, shower, travelBack };
  }
  return null;
}

function readClass(value: unknown): ClassItem | null {
  const raw = asObject(value);
  if (raw === null || !isNonEmptyString(raw.id) || typeof raw.repeatWeekly !== "boolean") {
    return null;
  }
  if (!isValidTimeRange(raw.start, raw.end)) {
    return null;
  }
  const start = raw.start as string;
  const end = raw.end as string;

  if (raw.repeatWeekly) {
    return isIntInRange(raw.weekday, 0, 6)
      ? { id: raw.id, start, end, repeatWeekly: true, weekday: raw.weekday as ClassItem["weekday"] }
      : null;
  }
  return typeof raw.date === "string" && weekdayOfDate(raw.date) !== null
    ? { id: raw.id, start, end, repeatWeekly: false, date: raw.date }
    : null;
}

function readOverride(value: unknown): DayOverride | null {
  const raw = asObject(value);
  if (raw === null || typeof raw.date !== "string" || weekdayOfDate(raw.date) === null) {
    return null;
  }
  if (!Array.isArray(raw.classes)) {
    return null;
  }
  const classes: DayOverride["classes"] = [];
  for (const item of raw.classes) {
    const row = asObject(item);
    if (row === null || !isNonEmptyString(row.id) || !isValidTimeRange(row.start, row.end)) {
      return null;
    }
    classes.push({ id: row.id, start: row.start as string, end: row.end as string });
  }
  return { date: raw.date, classes };
}

function readRecord(value: unknown): WorkoutRecord | null {
  const raw = asObject(value);
  if (raw === null || !isNonEmptyString(raw.id) || !isNonEmptyString(raw.createdAt)) {
    return null;
  }
  const durations = readDurations(raw.durations);
  if (
    durations === null ||
    typeof raw.date !== "string" ||
    weekdayOfDate(raw.date) === null ||
    typeof raw.returnedOnTime !== "boolean" ||
    typeof raw.special !== "boolean" ||
    (raw.verdict !== "ok" && raw.verdict !== "no" && raw.verdict !== "none")
  ) {
    return null;
  }
  return {
    id: raw.id,
    date: raw.date,
    durations,
    returnedOnTime: raw.returnedOnTime,
    verdict: raw.verdict,
    special: raw.special,
    createdAt: raw.createdAt,
  };
}

function readJudgement(value: unknown): Judgement | null {
  const raw = asObject(value);
  if (
    raw === null ||
    !isNonEmptyString(raw.id) ||
    typeof raw.date !== "string" ||
    weekdayOfDate(raw.date) === null ||
    typeof raw.used !== "boolean" ||
    (raw.verdict !== "ok" && raw.verdict !== "no")
  ) {
    return null;
  }
  return { id: raw.id, date: raw.date, verdict: raw.verdict, used: raw.used };
}

// 목록 전체를 읽는다. 하나라도 틀리면 null.
function readList<T>(value: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const result: T[] = [];
  for (const item of value) {
    const parsed = read(item);
    if (parsed === null) {
      return null;
    }
    result.push(parsed);
  }
  return result;
}

const NOT_BACKUP_MESSAGE = "이 파일은 운동될까 백업이 아니에요.";

function invalid(section: string): BackupParseResult {
  return { ok: false, message: `백업 파일의 ${section} 값이 올바르지 않아요. 기존 데이터는 그대로 두었어요.` };
}

/**
 * 가져올 파일의 글자를 확인해 앱 데이터로 바꾼다. (앱 이름 → 버전 → 값의 형식·범위 순서)
 * 실패하면 화면에 보여 줄 안내 문구를 돌려주고, 호출하는 쪽은 기존 데이터를 건드리지 않는다.
 * 성공하면 파일에 적힌 내보낸 시각을 마지막 내보내기 시각으로 삼는다.
 */
export function parseBackup(text: string): BackupParseResult {
  if (text.length > MAX_BACKUP_FILE_CHARS) {
    return { ok: false, message: NOT_BACKUP_MESSAGE };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: NOT_BACKUP_MESSAGE };
  }

  const file = asObject(parsed);
  if (file === null || file.app !== BACKUP_APP_NAME) {
    return { ok: false, message: NOT_BACKUP_MESSAGE };
  }
  if (file.version !== 1) {
    return { ok: false, message: "이 백업 파일은 이 앱에서 읽을 수 없는 버전이에요." };
  }
  if (typeof file.exportedAt !== "string" || Number.isNaN(Date.parse(file.exportedAt))) {
    return invalid("내보낸 시각");
  }

  // 가져오기는 엄격하게(번호 중복·수업 겹침까지) 확인한다.
  const read = readAppData(file.data, true);
  if (!read.ok) {
    return invalid(read.section);
  }

  return {
    ok: true,
    exportedAt: file.exportedAt,
    data: { ...read.data, lastExportedAt: file.exportedAt },
  };
}

// 같은 번호가 두 번 나오면 true
function hasDuplicateIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size !== items.length;
}

/**
 * 앱 데이터 한 묶음의 모든 항목을 확인해 새로 만들어 돌려준다. (알 수 없는 항목은 버려진다.)
 * 틀린 부분이 있으면 어느 부분인지(일정·기록 등)를 돌려준다.
 * - strict가 false이면 형식과 값의 범위만 본다. 브라우저 저장 공간을 읽을 때 쓴다.
 *   (이미 쓰던 데이터를 괜히 "읽을 수 없음"으로 막지 않으려고 번호·겹침은 보지 않는다.)
 * - strict가 true이면 같은 번호의 중복, 같은 날 수업 시간 겹침도 거부한다. 가져오기 파일에 쓴다.
 */
export function readAppData(
  raw: unknown,
  strict: boolean,
): { ok: true; data: AppData } | { ok: false; section: string } {
  const data = asObject(raw);
  if (data === null) {
    return { ok: false, section: "데이터" };
  }

  const classes = readList(data.classes, readClass);
  if (classes === null) {
    return { ok: false, section: "일정" };
  }
  const overrides = readList(data.overrides, readOverride);
  if (overrides === null) {
    return { ok: false, section: "그날만 수정한 일정" };
  }
  const defaults = data.defaults === null ? null : readDurations(data.defaults);
  if (data.defaults !== null && defaults === null) {
    return { ok: false, section: "초기값" };
  }
  const records = readList(data.records, readRecord);
  if (records === null) {
    return { ok: false, section: "기록" };
  }
  const judgements = readList(data.judgements, readJudgement);
  if (judgements === null) {
    return { ok: false, section: "판정" };
  }
  // 가져오기 파일에 이 항목이 없어도 괜찮다. (어차피 파일에 적힌 내보낸 시각으로 바뀐다.)
  const lastExportedAt = data.lastExportedAt === undefined && strict ? null : data.lastExportedAt;
  if (lastExportedAt !== null && typeof lastExportedAt !== "string") {
    return { ok: false, section: "마지막 내보낸 시각" };
  }

  if (strict) {
    if (hasDuplicateIds(classes) || hasDuplicateIds(records) || hasDuplicateIds(judgements)) {
      return { ok: false, section: "번호(중복)" };
    }
    // 수업은 하나씩 더해 가며 같은 날 겹치는지 본다. (화면에서 입력할 때와 같은 규칙)
    for (let i = 0; i < classes.length; i += 1) {
      const item = classes[i];
      const checked = parseClassInput(
        {
          weekday: item.weekday ?? 1,
          start: item.start,
          end: item.end,
          repeatWeekly: item.repeatWeekly,
          date: item.date ?? "",
        },
        classes.slice(0, i),
        null,
      );
      if (!checked.ok) {
        return { ok: false, section: "일정(시간이 겹침)" };
      }
    }
    if (overrides.some((item) => validateDayRows(item.classes) !== null || hasDuplicateIds(item.classes))) {
      return { ok: false, section: "그날만 수정한 일정(번호 중복 또는 시간 겹침)" };
    }
  }

  return {
    ok: true,
    data: {
      version: 1,
      classes,
      overrides,
      defaults,
      records,
      judgements,
      lastExportedAt,
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 홈에 백업 안내를 보여 줄지 정한다. (PRD 5②)
 * - 내보낸 적이 있으면: 마지막 내보내기로부터 7일이 지났을 때
 * - 한 번도 내보낸 적이 없으면: 첫 기록을 저장한 날부터 7일이 지났을 때 (기록이 없으면 보여 주지 않는다)
 */
export function needsBackupReminder(
  data: Pick<AppData, "lastExportedAt" | "records">,
  nowMs: number,
): boolean {
  const exported = data.lastExportedAt === null ? Number.NaN : Date.parse(data.lastExportedAt);
  if (!Number.isNaN(exported)) {
    return nowMs - exported >= BACKUP_REMINDER_DAYS * DAY_MS;
  }

  const created = data.records
    .map((record) => Date.parse(record.createdAt))
    .filter((time) => !Number.isNaN(time));
  if (created.length === 0) {
    return false;
  }
  return nowMs - Math.min(...created) >= BACKUP_REMINDER_DAYS * DAY_MS;
}
