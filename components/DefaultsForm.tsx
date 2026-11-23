"use client";

// Design Ref: §3.5 — 설정 화면: 가는 이동·환복·샤워·오는 이동 초기값(분)을 입력하고 저장한다. (첫 사용 때 입력)
// Design Ref: §10.3 — 브라우저 저장 공간은 화면이 뜬 뒤(클라이언트 쪽)에서만 읽는다.
// 서버에서 먼저 그려질 때는 "아직 모름"이고, 브라우저에서 저장된 값을 읽은 뒤 채워진다.
import { useState, useSyncExternalStore, type FormEvent } from "react";
import {
  getAppDataSnapshot,
  getServerAppDataSnapshot,
  loadAppData,
  saveAppData,
  subscribeAppData,
  type LoadStatus,
} from "@/lib/storage";
import { parseDurationMinutes } from "@/lib/validate";
import type { Durations } from "@/types";

// 입력 칸 정보. 순서와 이름은 화면 그림(DESIGN 5.1 Durations)과 같다.
const FIELDS = [
  { key: "travelTo", label: "가는 이동", hint: "강의실에서 운동 장소까지" },
  { key: "changing", label: "환복", hint: "운동복으로 갈아입는 시간" },
  { key: "shower", label: "샤워", hint: "운동 후 샤워하는 시간" },
  { key: "travelBack", label: "오는 이동", hint: "운동 장소에서 다음 수업 강의실까지" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type FieldTexts = Record<FieldKey, string>;
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY_TEXTS: FieldTexts = {
  travelTo: "",
  changing: "",
  shower: "",
  travelBack: "",
};

// 저장해 둔 숫자를 입력 칸에 넣을 글자로 바꾼다.
function toTexts(durations: Durations): FieldTexts {
  return {
    travelTo: String(durations.travelTo),
    changing: String(durations.changing),
    shower: String(durations.shower),
    travelBack: String(durations.travelBack),
  };
}

// 저장 공간 상태별 안내 문구. (저장할 수 없는 상태일 때만 보여 준다.)
function blockedMessage(status: LoadStatus | "loading"): string | null {
  if (status === "unavailable") {
    return "브라우저 저장 공간을 쓸 수 없어서 저장이 되지 않아요. 시크릿 모드이거나 저장이 차단되어 있는지 확인해 주세요.";
  }
  if (status === "corrupt") {
    return "저장된 데이터를 읽을 수 없어요. 기존 데이터를 지키려고 저장을 막아 두었어요.";
  }
  return null;
}

export default function DefaultsForm() {
  // 저장된 데이터를 읽는다. 서버에서 그려질 때는 null(아직 모름)이다.
  const stored = useSyncExternalStore(
    subscribeAppData,
    getAppDataSnapshot,
    getServerAppDataSnapshot,
  );
  // 사용자가 입력 칸을 고치기 시작하면 그 내용을 쓰고, 그전에는 저장된 초기값을 보여 준다.
  const [draft, setDraft] = useState<FieldTexts | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const status: LoadStatus | "loading" = stored === null ? "loading" : stored.status;
  const savedDefaults = stored?.data.defaults ?? null;
  const texts: FieldTexts =
    draft ?? (savedDefaults !== null ? toTexts(savedDefaults) : EMPTY_TEXTS);

  const blocked = blockedMessage(status);
  const canSave = status === "ok" || status === "empty";

  function handleChange(key: FieldKey, value: string) {
    setDraft({ ...texts, [key]: value });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // 네 칸을 모두 검사한다. 하나라도 틀리면 저장하지 않고 칸 아래에 안내를 보여 준다.
    const nextErrors: FieldErrors = {};
    const parsed: Partial<Durations> = {};
    for (const field of FIELDS) {
      const check = parseDurationMinutes(texts[field.key]);
      if (check.ok) {
        parsed[field.key] = check.value;
      } else {
        nextErrors[field.key] = check.message;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    // 저장 직전에 다시 읽어서, 다른 데이터(일정·기록)는 그대로 두고 초기값만 바꾼다.
    // 읽을 수 없거나 깨진 상태에서는 원본을 덮어쓰지 않도록 저장하지 않는다.
    const latest = loadAppData();
    if (latest.status !== "ok" && latest.status !== "empty") {
      setResult({ type: "error", text: blockedMessage(latest.status) ?? "저장이 되지 않았어요." });
      return;
    }

    const saved = saveAppData({ ...latest.data, defaults: parsed as Durations });
    if (saved.ok) {
      setResult({ type: "success", text: "저장했어요." });
    } else {
      setResult({
        type: "error",
        text: "저장이 되지 않았어요. 브라우저 저장 공간이 가득 찼거나 막혀 있을 수 있어요.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4">
      {blocked !== null && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-600 dark:text-red-400">
          {blocked}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const inputId = `defaults-${field.key}`;
          const error = errors[field.key];

          return (
            <div key={field.key}>
              <label htmlFor={inputId} className="block text-sm font-medium">
                {field.label} (분)
              </label>
              <p className="mt-0.5 text-xs text-foreground/60">{field.hint}</p>
              <input
                id={inputId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={texts[field.key]}
                onChange={(event) => handleChange(field.key, event.target.value)}
                aria-invalid={error !== undefined}
                aria-describedby={error !== undefined ? `${inputId}-error` : undefined}
                className="mt-1 w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
              />
              {error !== undefined && (
                <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          저장
        </button>
        <p aria-live="polite" className={result?.type === "error" ? "text-sm text-red-600 dark:text-red-400" : "text-sm text-foreground/70"}>
          {result?.text}
        </p>
      </div>
    </form>
  );
}
