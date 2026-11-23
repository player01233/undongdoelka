"use client";

// Design Ref: §3.4 — 기록 입력: 가는 이동·환복·샤워·오는 이동(분) 4칸 + 제시간(수업 10분 전) 복귀 예/아니오, 날짜는 오늘로 자동 입력.
// Design Ref: §4.2 — 범위 검사(정수, 0~120, 0분 허용) 후, 넘어온 판정 번호의 판정을 붙여 저장한다.
// 이번 작업은 입력과 저장까지만 만든다. 평소와 15분 이상 차이 확인(11번), 목록·수정·삭제(12·13번)는 이후 작업이다.
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { getClockSnapshot, getServerClockSnapshot, subscribeClock, toDateText } from "@/lib/clock";
import { createId } from "@/lib/id";
import { attachJudgement } from "@/lib/judgement";
import {
  getAppDataSnapshot,
  getServerAppDataSnapshot,
  loadAppData,
  saveAppData,
  subscribeAppData,
} from "@/lib/storage";
import { weekdayOfDate } from "@/lib/time";
import { parseDurationMinutes } from "@/lib/validate";
import type { Durations } from "@/types";

const FIELDS = [
  { key: "travelTo", label: "가는 이동" },
  { key: "changing", label: "환복" },
  { key: "shower", label: "샤워" },
  { key: "travelBack", label: "오는 이동" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type FieldTexts = Record<FieldKey, string>;

const EMPTY_TEXTS: FieldTexts = { travelTo: "", changing: "", shower: "", travelBack: "" };
const VERDICT_LABEL = { ok: "된다", no: "안 된다", none: "판정 안 함" } as const;

// 주소의 "?judgement=번호"를 읽는다. 화면이 뜬 뒤(클라이언트 쪽)에서만 읽고, 서버에서는 "아직 모름"이다.
function subscribeLocation(listener: () => void): () => void {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
function getSearchSnapshot(): string {
  return window.location.search;
}
function getServerSearchSnapshot(): null {
  return null;
}

export default function RecordForm() {
  const stored = useSyncExternalStore(subscribeAppData, getAppDataSnapshot, getServerAppDataSnapshot);
  const minute = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);
  const search = useSyncExternalStore(subscribeLocation, getSearchSnapshot, getServerSearchSnapshot);

  const [pickedDate, setPickedDate] = useState<string | null>(null); // 고르기 전에는 오늘
  const [texts, setTexts] = useState<FieldTexts>(EMPTY_TEXTS);
  const [returned, setReturned] = useState<boolean | null>(null); // 미선택으로 시작
  const [errors, setErrors] = useState<Partial<Record<FieldKey | "date" | "returned", string>>>({});
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (stored === null || minute === null || search === null) {
    return <p className="mt-6 text-sm text-foreground/60">불러오는 중...</p>;
  }

  const status = stored.status;
  const canSave = status === "ok" || status === "empty";
  const blocked =
    status === "unavailable"
      ? "브라우저 저장 공간을 쓸 수 없어서 저장이 되지 않아요. 시크릿 모드이거나 저장이 차단되어 있는지 확인해 주세요."
      : status === "corrupt"
        ? "저장된 데이터를 읽을 수 없어요. 기존 데이터를 지키려고 저장을 막아 두었어요."
        : null;

  const judgementId = new URLSearchParams(search).get("judgement");
  const date = pickedDate ?? toDateText(new Date(minute * 60000));
  // 지금 날짜로 저장하면 어떤 판정이 붙는지 미리 알려 준다.
  const preview = attachJudgement(stored.data.judgements, judgementId, date);

  function clearMessages() {
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: typeof errors = {};
    const parsed: Partial<Durations> = {};
    for (const field of FIELDS) {
      const check = parseDurationMinutes(texts[field.key]);
      if (check.ok) {
        parsed[field.key] = check.value;
      } else {
        nextErrors[field.key] = check.message;
      }
    }
    if (weekdayOfDate(date) === null) {
      nextErrors.date = "날짜를 선택해 주세요.";
    }
    if (returned === null) {
      nextErrors.returned = "복귀 여부를 선택해 주세요";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || returned === null) {
      setResult(null);
      return;
    }

    // 저장 직전에 다시 읽어서, 일정·초기값은 그대로 두고 기록과 판정만 바꾼다.
    // 읽을 수 없거나 깨진 상태에서는 원본을 덮어쓰지 않도록 저장하지 않는다.
    const latest = loadAppData();
    if (latest.status !== "ok" && latest.status !== "empty") {
      setResult({ type: "error", text: "저장이 되지 않았어요. 저장 공간을 확인해 주세요." });
      return;
    }

    const attached = attachJudgement(latest.data.judgements, judgementId, date);
    const saved = saveAppData({
      ...latest.data,
      records: [
        ...latest.data.records,
        {
          id: createId(),
          date,
          durations: parsed as Durations,
          returnedOnTime: returned,
          verdict: attached.verdict,
          special: false,
          createdAt: new Date().toISOString(),
        },
      ],
      judgements: attached.judgements,
    });

    if (saved.ok) {
      setTexts(EMPTY_TEXTS);
      setReturned(null);
      setErrors({});
      setResult({ type: "success", text: `저장했어요. (당시 판정: ${VERDICT_LABEL[attached.verdict]})` });
    } else {
      setResult({ type: "error", text: "저장이 되지 않았어요. 브라우저 저장 공간이 가득 찼거나 막혀 있을 수 있어요." });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4">
      {blocked !== null && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-600 dark:text-red-400">
          {blocked}
        </p>
      )}

      <div>
        <label htmlFor="record-date" className="block text-sm font-medium">날짜</label>
        <input
          id="record-date"
          type="date"
          value={date}
          onChange={(event) => {
            setPickedDate(event.target.value);
            setErrors((prev) => ({ ...prev, date: undefined }));
            clearMessages();
          }}
          className="mt-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
        />
        {errors.date !== undefined && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.date}</p>}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const inputId = `record-${field.key}`;
          const error = errors[field.key];
          return (
            <div key={field.key}>
              <label htmlFor={inputId} className="block text-sm font-medium">{field.label} (분)</label>
              <input
                id={inputId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={texts[field.key]}
                onChange={(event) => {
                  setTexts((prev) => ({ ...prev, [field.key]: event.target.value }));
                  setErrors((prev) => ({ ...prev, [field.key]: undefined }));
                  clearMessages();
                }}
                aria-invalid={error !== undefined}
                className="mt-1 w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
              />
              {error !== undefined && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
            </div>
          );
        })}
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">제시간(수업 10분 전) 복귀</legend>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="returned"
              checked={returned === true}
              onChange={() => {
                setReturned(true);
                setErrors((prev) => ({ ...prev, returned: undefined }));
                clearMessages();
              }}
            />
            예
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="returned"
              checked={returned === false}
              onChange={() => {
                setReturned(false);
                setErrors((prev) => ({ ...prev, returned: undefined }));
                clearMessages();
              }}
            />
            아니오
          </label>
        </div>
        {errors.returned !== undefined && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.returned}</p>
        )}
      </fieldset>

      {judgementId !== null && (
        <p className="mt-4 text-xs text-foreground/60">
          {preview.verdict === "none"
            ? "이 날짜에 연결할 수 있는 판정이 없어서 '판정 안 함'으로 저장돼요."
            : `홈에서 확인한 판정(${VERDICT_LABEL[preview.verdict]})이 이 기록에 함께 저장돼요.`}
        </p>
      )}

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
