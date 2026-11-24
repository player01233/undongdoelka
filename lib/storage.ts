// Design Ref: §6.2 — 일정·기록·초기값은 브라우저 안의 작은 저장 공간(localStorage)에 하나의 묶음으로 저장한다.
// Design Ref: §10.3 — 저장 공간은 화면이 뜬 뒤(클라이언트 쪽)에서만 읽는다. 서버에서 그려질 때는 읽지 않는다.
// 이 파일은 저장과 불러오기를 맡는다. 불러올 때는 lib/backup.ts의 값 확인(readAppData)을 함께 쓴다.
import { readAppData } from "@/lib/backup";
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

// 저장 공간을 쓸 수 없다는 표시. (저장된 값이 없는 null과 구분하려고 따로 둔다.)
const UNAVAILABLE = Symbol("unavailable");
type RawValue = string | null | typeof UNAVAILABLE;

// 저장 공간에 들어 있는 원본 글자를 읽는다.
function readRaw(): RawValue {
  const storage = getStorage();
  if (storage === null) {
    return UNAVAILABLE;
  }

  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return UNAVAILABLE;
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

// 원본 글자를 불러오기 결과로 바꾼다.
function toLoadResult(raw: RawValue): LoadResult {
  if (raw === UNAVAILABLE) {
    return { status: "unavailable", data: createEmptyAppData() };
  }
  if (raw === null) {
    return { status: "empty", data: createEmptyAppData() };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    // 겉모양(버전·큰 틀)을 보고, 안쪽 항목의 형식과 값의 범위까지 확인해야 "ok"로 쓴다.
    // 값이 바뀌었거나 옛 형식이면 "corrupt"가 되고, 원본은 지우지 않는다.
    if (looksLikeAppData(parsed)) {
      const read = readAppData(parsed, false);
      if (read.ok) {
        return { status: "ok", data: read.data };
      }
    }
  } catch {
    // JSON이 깨진 경우: 아래의 corrupt로 처리한다.
  }

  return { status: "corrupt", data: createEmptyAppData() };
}

/**
 * 브라우저에 저장된 데이터를 불러온다.
 * 저장된 값이 깨져 있으면 status가 "corrupt"이고 원본은 지우지 않는다.
 * (호출하는 쪽은 "corrupt"일 때 빈 데이터를 그대로 저장해 원본을 덮어쓰지 않도록 주의한다.)
 */
export function loadAppData(): LoadResult {
  return toLoadResult(readRaw());
}

// 저장이 일어났을 때 화면에 알려 주기 위한 구독자 목록
const listeners = new Set<() => void>();

/**
 * 데이터를 브라우저에 저장한다.
 * 저장 공간을 쓸 수 없거나 용량이 모자라 실패하면 이유를 돌려준다.
 * 저장에 성공하면 이 데이터를 보고 있는 화면들이 새 값으로 다시 그려지도록 알린다.
 */
export function saveAppData(data: AppData): SaveResult {
  const storage = getStorage();
  if (storage === null) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    return { ok: false, reason: "failed" };
  }

  listeners.forEach((listener) => listener());
  return { ok: true };
}

// ---- 화면이 저장 공간의 변화를 따라가게 하는 도우미 (React의 useSyncExternalStore용) ----

/**
 * 저장 값이 바뀔 때(이 화면에서 저장하거나 다른 탭에서 바뀔 때) 알림을 받는다.
 * 돌려주는 함수를 부르면 알림을 끊는다.
 */
export function subscribeAppData(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

// 같은 원본이면 같은 결과 객체를 돌려주기 위한 보관 값 (React가 불필요하게 다시 그리지 않도록)
let snapshotRaw: RawValue | undefined;
let snapshotResult: LoadResult | null = null;

/** 지금 저장된 데이터를 돌려준다. 저장된 값이 그대로면 항상 같은 객체를 돌려준다. */
export function getAppDataSnapshot(): LoadResult {
  const raw = readRaw();
  if (snapshotResult === null || raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotResult = toLoadResult(raw);
  }
  return snapshotResult;
}

/** 서버에서 그려질 때는 저장 공간을 읽을 수 없으므로 "아직 모름(null)"을 돌려준다. */
export function getServerAppDataSnapshot(): null {
  return null;
}
