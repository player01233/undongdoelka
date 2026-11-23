"use client";

// Design Ref: §3.4 — 기록 목록 영역: 가장 최근 1건만 수정·삭제할 수 있다.
// 수정할 때 "특이 상황"을 켜고 끌 수 있고, 저장 당시 판정과 날짜는 그대로 둔다. 삭제는 1건씩 반복할 수 있다.
// 15분 이상 차이 확인은 수정 중인 기록을 뺀 평균과 비교한다. (확인 창은 화면 안의 상자로 만든다.)
// 이번 작업은 가장 최근 1건만 보여 준다. 전체 목록과 요약은 13번 작업에서 채운다.
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { selectDurations } from "@/lib/estimate";
import { deleteLatestRecord, editLatestRecord, getLatestRecord } from "@/lib/records";
import {
  getAppDataSnapshot,
  getServerAppDataSnapshot,
  loadAppData,
  saveAppData,
  subscribeAppData,
} from "@/lib/storage";
import {
  findUnusualDurations,
  parseDurationMinutes,
  UNUSUAL_DIFF_MINUTES,
  type UnusualDuration,
} from "@/lib/validate";
import type { Durations, WorkoutRecord } from "@/types";

const FIELDS = [
  { key: "travelTo", label: "가는 이동" },
  { key: "changing", label: "환복" },
  { key: "shower", label: "샤워" },
  { key: "travelBack", label: "오는 이동" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type FieldTexts = Record<FieldKey, string>;

const VERDICT_LABEL = { ok: "된다", no: "안 된다", none: "판정 안 함" } as const;
const FIELD_LABEL: Record<FieldKey, string> = {
  travelTo: "가는 이동",
  changing: "환복",
  shower: "샤워",
  travelBack: "오는 이동",
};

function toTexts(durations: Durations): FieldTexts {
  return {
    travelTo: String(durations.travelTo),
    changing: String(durations.changing),
    shower: String(durations.shower),
    travelBack: String(durations.travelBack),
  };
}

// 수정 중인 상태: 어느 기록을 고치는지와 입력 내용
interface EditState {
  id: string;
  texts: FieldTexts;
  returned: boolean;
  special: boolean;
}

export default function RecordList() {
  const stored = useSyncExternalStore(subscribeAppData, getAppDataSnapshot, getServerAppDataSnapshot);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [pending, setPending] = useState<{ durations: Durations; unusual: UnusualDuration[] } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (stored === null) {
    return <p className="mt-4 text-sm text-foreground/60">불러오는 중...</p>;
  }

  const canSave = stored.status === "ok" || stored.status === "empty";
  const latest: WorkoutRecord | undefined = getLatestRecord(stored.data.records);
  // 수정 상자는 지금 가장 최근 기록을 고치고 있을 때만 보여 준다.
  const editing = latest !== undefined && edit !== null && edit.id === latest.id ? edit : null;

  function startEdit(record: WorkoutRecord) {
    setEdit({
      id: record.id,
      texts: toTexts(record.durations),
      returned: record.returnedOnTime,
      special: record.special,
    });
    setErrors({});
    setPending(null);
    setResult(null);
    setConfirmingDelete(false);
  }

  function cancelEdit() {
    setEdit(null);
    setErrors({});
    setPending(null);
  }

  // 수정 내용을 저장한다. 저장 직전에 다시 읽어서, 지금도 가장 최근 기록인지 확인한다.
  function commit(id: string, durations: Durations, returnedOnTime: boolean, special: boolean) {
    setPending(null);
    const current = loadAppData();
    if (current.status !== "ok" && current.status !== "empty") {
      setResult({ type: "error", text: "저장이 되지 않았어요. 저장 공간을 확인해 주세요." });
      return;
    }
    const changed = editLatestRecord(current.data.records, id, { durations, returnedOnTime, special });
    if (!changed.ok) {
      setResult({ type: "error", text: "가장 최근 기록만 고칠 수 있어요." });
      setEdit(null);
      return;
    }
    const saved = saveAppData({ ...current.data, records: changed.records });
    if (saved.ok) {
      setEdit(null);
      setErrors({});
      setResult({ type: "success", text: "수정했어요." });
    } else {
      setResult({ type: "error", text: "저장이 되지 않았어요. 브라우저 저장 공간이 가득 찼거나 막혀 있을 수 있어요." });
    }
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing === null) {
      return;
    }

    const nextErrors: Partial<Record<FieldKey, string>> = {};
    const parsed: Partial<Durations> = {};
    for (const field of FIELDS) {
      const check = parseDurationMinutes(editing.texts[field.key]);
      if (check.ok) {
        parsed[field.key] = check.value;
      } else {
        nextErrors[field.key] = check.message;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const durations = parsed as Durations;
    const current = loadAppData();
    if (current.status !== "ok" && current.status !== "empty") {
      setResult({ type: "error", text: "저장이 되지 않았어요. 저장 공간을 확인해 주세요." });
      return;
    }

    // 평소 값은 지금 고치는 기록을 뺀 평균(없으면 초기값)과 비교한다.
    const others = current.data.records.filter((record) => record.id !== editing.id);
    const usual = selectDurations(others, current.data.defaults).durations;
    const unusual = usual === null ? [] : findUnusualDurations(durations, usual);
    if (unusual.length > 0) {
      setPending({ durations, unusual });
      return;
    }
    commit(editing.id, durations, editing.returned, editing.special);
  }

  function handleDelete(id: string) {
    setConfirmingDelete(false);
    const current = loadAppData();
    if (current.status !== "ok" && current.status !== "empty") {
      setResult({ type: "error", text: "저장이 되지 않았어요. 저장 공간을 확인해 주세요." });
      return;
    }
    const changed = deleteLatestRecord(current.data.records, id);
    if (!changed.ok) {
      setResult({ type: "error", text: "가장 최근 기록만 지울 수 있어요." });
      return;
    }
    const saved = saveAppData({ ...current.data, records: changed.records });
    if (saved.ok) {
      setEdit(null);
      setResult({ type: "success", text: "삭제했어요." });
    } else {
      setResult({ type: "error", text: "저장이 되지 않았어요. 브라우저 저장 공간이 가득 찼거나 막혀 있을 수 있어요." });
    }
  }

  return (
    <div className="mt-4">
      {latest === undefined ? (
        <p className="text-sm text-foreground/60">아직 저장한 기록이 없어요.</p>
      ) : (
        <div className="rounded-lg border border-foreground/20 p-4 text-sm">
          <p className="text-xs text-foreground/60">가장 최근 기록</p>
          <p className="mt-1 font-medium">
            {latest.date}{" "}
            {latest.special && (
              <span className="ml-1 rounded bg-foreground/10 px-1.5 py-0.5 text-xs font-normal">특이 상황</span>
            )}
          </p>
          <p className="mt-1">
            가는 이동 {latest.durations.travelTo} · 환복 {latest.durations.changing} · 샤워 {latest.durations.shower} · 오는 이동{" "}
            {latest.durations.travelBack} (분)
          </p>
          <p className="mt-1 text-foreground/70">
            복귀 {latest.returnedOnTime ? "예" : "아니오"} · 당시 판정 {VERDICT_LABEL[latest.verdict]}
          </p>

          {editing === null && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => startEdit(latest)}
                className="rounded border border-foreground/20 px-3 py-1 text-xs"
              >
                수정
              </button>
              {confirmingDelete ? (
                <>
                  <span className="text-xs">삭제할까요?</span>
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={() => handleDelete(latest.id)}
                    className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:opacity-40"
                  >
                    삭제 확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded border border-foreground/20 px-3 py-1 text-xs"
                  >
                    취소
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(true);
                    setResult(null);
                  }}
                  className="rounded border border-foreground/20 px-3 py-1 text-xs"
                >
                  삭제
                </button>
              )}
            </div>
          )}

          {editing !== null && (
            <form onSubmit={handleEditSubmit} noValidate className="mt-4 border-t border-foreground/15 pt-4">
              <p className="text-sm font-medium">가장 최근 기록 수정</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {FIELDS.map((field) => (
                  <div key={field.key}>
                    <label htmlFor={`edit-${field.key}`} className="block text-xs font-medium">
                      {field.label} (분)
                    </label>
                    <input
                      id={`edit-${field.key}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={editing.texts[field.key]}
                      onChange={(event) => {
                        setEdit({ ...editing, texts: { ...editing.texts, [field.key]: event.target.value } });
                        setErrors((prev) => ({ ...prev, [field.key]: undefined }));
                        setPending(null);
                      }}
                      aria-invalid={errors[field.key] !== undefined}
                      className="mt-1 w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
                    />
                    {errors[field.key] !== undefined && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[field.key]}</p>
                    )}
                  </div>
                ))}
              </div>

              <fieldset className="mt-3">
                <legend className="text-xs font-medium">제시간(수업 10분 전) 복귀</legend>
                <div className="mt-1 flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="edit-returned"
                      checked={editing.returned}
                      onChange={() => setEdit({ ...editing, returned: true })}
                    />
                    예
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="edit-returned"
                      checked={!editing.returned}
                      onChange={() => setEdit({ ...editing, returned: false })}
                    />
                    아니오
                  </label>
                </div>
              </fieldset>

              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.special}
                  onChange={(event) => setEdit({ ...editing, special: event.target.checked })}
                />
                특이 상황 (평균에서 제외)
              </label>

              {pending !== null && (
                <div role="alertdialog" aria-label="평소와 다른 값 확인" className="mt-4 rounded-lg border border-foreground/30 p-3 text-sm">
                  <ul className="space-y-1">
                    {pending.unusual.map((item) => (
                      <li key={item.key}>
                        {FIELD_LABEL[item.key]} {item.input}분은 평소({item.usual}분)와 {UNUSUAL_DIFF_MINUTES}분 이상 차이 나요. 맞나요?
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPending(null)}
                      className="rounded-lg border border-foreground/20 px-3 py-1.5 text-sm"
                    >
                      다시 입력
                    </button>
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={() => commit(editing.id, pending.durations, editing.returned, editing.special)}
                      className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
                    >
                      맞아요, 그대로 저장
                    </button>
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={() => commit(editing.id, pending.durations, editing.returned, true)}
                      className="rounded-lg border border-foreground/20 px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      특이 상황이라 평균에서 제외하고 저장
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={!canSave}
                  className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
                >
                  수정 저장
                </button>
                <button type="button" onClick={cancelEdit} className="rounded-lg border border-foreground/20 px-4 py-2 text-sm">
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <p
        aria-live="polite"
        className={
          result?.type === "error"
            ? "mt-3 text-sm text-red-600 dark:text-red-400"
            : "mt-3 text-sm text-foreground/70"
        }
      >
        {result?.text}
      </p>
    </div>
  );
}
