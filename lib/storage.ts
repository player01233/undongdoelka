// Design Ref: §6.2 — 일정·기록·초기값은 브라우저 안의 작은 저장 공간(localStorage)에 하나의 묶음으로 저장한다.
// Design Ref: §10.3 — 저장 공간은 화면이 뜬 뒤(클라이언트 쪽)에서만 읽는다. 서버에서 그려질 때는 읽지 않는다.
// 이 파일은 저장과 불러오기만 맡고, 값의 범위 검사나 백업 파일 처리는 다른 작업 몫이다.
import type { AppData } from "@/types";

// 저장 공간에 데이터를 넣어 두는 이름표
export const STORAGE_KEY = "undongdoelka:data";

// 불러오기 결과 상태
// - ok: 저장된 데이터를 읽었다
// - empty: 아직 저장된 데이터가 없다 (첫 사용)
// - corrupt: 저장된 값이 깨졌거나 이 앱의 형식이 아니다 (원본은 지우지 않고 그대로 둔다)
// - unavailable: 브라우저 저장 공간을 쓸 수 없다 (서버에서 실행 중이거나 시크릿 모드·차단)
export type LoadStatus = "ok" | "empty" | "corrupt" | "unavailable";

export interface LoadResult {
  status: LoadStatus;
  data: AppData; // ok가 아니면 빈 데이터를 돌려준다
}

// 저장 결과: 실패하면 화면에서 "저장이 되지 않아요"라고 알릴 수 있게 이유를 함께 돌려준다.
export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "failed" };

/** 아무것도 저장되지 않은 처음 상태의 데이터를 만든다. */
export function createEmptyAppData(): AppData {
  return {
    version: 1,
    classes: [],
    overrides: [],
    defaults: null,
    records: [],
    judgements: [],
    lastExportedAt: null,
  };
}

// 브라우저 저장 공간을 돌려준다. 쓸 수 없으면 null.
// (시크릿 모드나 차단 설정에서는 접근하는 것만으로 오류가 나므로 try로 감싼다.)
function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

// 읽어 온 값이 이 앱의 저장 형식인지 큰 틀만 확인한다. (값의 범위 검사는 백업 가져오기 작업 몫)
function looksLikeAppData(value: unknown): value is AppData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as Record<string, unknown>;
  const isDefaultsValid =
    data.defaults === null ||
    (typeof data.defaults === "object" && data.defaults !== null);
  const isExportedAtValid =
    data.lastExportedAt === null || typeof data.lastExportedAt === "string";

  return (
    data.version === 1 &&
    Array.isArray(data.classes) &&
    Array.isArray(data.overrides) &&
    Array.isArray(data.records) &&
    Array.isArray(data.judgements) &&
    isDefaultsValid &&
    isExportedAtValid
  );
}

/**
 * 브라우저에 저장된 데이터를 불러온다.
 * 저장된 값이 깨져 있으면 status가 "corrupt"이고 원본은 지우지 않는다.
 * (호출하는 쪽은 "corrupt"일 때 빈 데이터를 그대로 저장해 원본을 덮어쓰지 않도록 주의한다.)
 */
export function loadAppData(): LoadResult {
  const storage = getStorage();
  if (storage === null) {
    return { status: "unavailable", data: createEmptyAppData() };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: "unavailable", data: createEmptyAppData() };
  }

  if (raw === null) {
    return { status: "empty", data: createEmptyAppData() };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (looksLikeAppData(parsed)) {
      return { status: "ok", data: parsed };
    }
  } catch {
    // JSON이 깨진 경우: 아래의 corrupt로 처리한다.
  }

  return { status: "corrupt", data: createEmptyAppData() };
}

/**
 * 데이터를 브라우저에 저장한다.
 * 저장 공간을 쓸 수 없거나 용량이 모자라 실패하면 이유를 돌려준다.
 */
export function saveAppData(data: AppData): SaveResult {
  const storage = getStorage();
  if (storage === null) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
