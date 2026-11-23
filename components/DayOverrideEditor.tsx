"use client";

// Design Ref: §3.3, §4.3 — 특정 날짜만 수정: 날짜를 고르면 그날 수업 목록(그날만 수정한 목록 또는 기본 일정 복사)을 불러와
// 추가·삭제·시간 변경하고, "그 날짜"에만 저장한다. 다른 주 같은 요일은 날짜가 달라 자동으로 기본 일정이 적용된다.
// Design Ref: §7 — 종료가 시작보다 늦어야 하고, 같은 날 수업이 겹치면 저장하지 않는다.
import { useState, useSyncExternalStore } from "react";
import { getClockSnapshot, getServerClockSnapshot, subscribeClock, toDateText } from "@/lib/clock";
import { createId } from "@/lib/id";
import { getDayRows, type DayRow } from "@/lib/schedule";
import {
  getAppDataSnapshot,
  getServerAppDataSnapshot,
  loadAppData,
  saveAppData,
  subscribeAppData,
} from "@/lib/storage";
import { weekdayOfDate } from "@/lib/time";
import { validateDayRows, type DayRowsErrors } from "@/lib/validate";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;
const TIME_INPUT_CLASS = "rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm";
const ERROR_CLASS = "mt-1 text-xs text-red-600 dark:text-red-400";

function weekdayLabel(date: string): string {
  const weekday = weekdayOfDate(date);
  return weekday === null ? "" : `(${WEEKDAY_NAMES[weekday]})`;
}

export default function DayOverrideEditor() {
  const stored = useSyncExternalStore(subscribeAppData, getAppDataSnapshot, getServerAppDataSnapshot);
  const minute = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);

  const [pickedDate, setPickedDate] = useState<string | null>(null); // 고르기 전에는 오늘
  const [draft, setDraft] = useState<{ date: string; rows: DayRow[] } | null>(null);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [errors, setErrors] = useState<DayRowsErrors | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (stored === null || minute === null) {
    return <p className="mt-4 text-sm text-foreground/60">불러오는 중...</p>;
  }

  const status = stored.status;
  const canSave = status === "ok" || status === "empty";
  const { classes, overrides } = stored.data;

  const date = pickedDate ?? toDateText(new Date(minute * 60000));
  const dateValid = weekdayOfDate(date) !== null;
  const base = getDayRows(classes, overrides, date);
  // 고치는 중이면 고치던 목록, 아니면 저장된 목록(그날만 수정한 목록 또는 기본 일정)
  const rows = draft !== null && draft.date === date ? draft.rows : base.rows;
  const isDraft = draft !== null && draft.date === date;
  const sortedOverrides = [...overrides].sort((a, b) => a.date.localeCompare(b.date));

  function changeRows(next: DayRow[]) {
    setDraft({ date, rows: next });
    setErrors(null);
    setResult(null);
  }

  function pickDate(next: string) {
    setPickedDate(next);
    setDraft(null);
    setErrors(null);
    setAddError(null);
    setResult(null);
  }

  function handleAdd() {
    const added: DayRow = { id: createId(), start: newStart, end: newEnd };
    const problem = validateDayRows([...rows, added]);
    if (problem !== null) {
      const message = problem.overlap ?? problem.rows[problem.rows.length - 1] ?? "입력을 확인해 주세요.";
      setAddError(message);
      return;
    }
    setAddError(null);
    setNewStart("");
    setNewEnd("");
    changeRows([...rows, added]);
  }

  function handleSave() {
    const problem = validateDayRows(rows);
    if (problem !== null) {
      setErrors(problem);
      setResult(null);
      return;
    }
    // 저장 직전에 다시 읽어서, 다른 날짜의 수정과 일정·초기값은 그대로 두고 이 날짜만 바꾼다.
    const latest = loadAppData();
    if (latest.status !== "ok" && latest.status !== "empty") {
      setResult({ type: "error", text: "저장이 되지 않았어요. 저장 공간을 확인해 주세요." });
      return;
    }
    const saved = saveAppData({
      ...latest.data,
      overrides: [
        ...latest.data.overrides.filter((item) => item.date !== date),
        { date, classes: rows.map(({ id, start, end }) => ({ id, start, end })) },
      ],
    });
    if (saved.ok) {
      setDraft(null);
      setResult({ type: "success", text: `${date}만 저장했어요.` });
    } else {
      setResult({ type: "error", text: "저장이 되지 않았어요. 브라우저 저장 공간이 가득 찼거나 막혀 있을 수 있어요." });
    }
  }

  // 그날만 수정한 내용을 지우면 그 날짜도 기본 일정으로 돌아간다.
  function handleRevert() {
    const latest = loadAppData();
    if (latest.status !== "ok" && latest.status !== "empty") {
      setResult({ type: "error", text: "저장이 되지 않았어요. 저장 공간을 확인해 주세요." });
      return;
    }
    const saved = saveAppData({
      ...latest.data,
      overrides: latest.data.overrides.filter((item) => item.date !== date),
    });
    if (saved.ok) {
      setDraft(null);
      setErrors(null);
      setResult({ type: "success", text: `${date}을 기본 일정으로 되돌렸어요.` });
    } else {
      setResult({ type: "error", text: "저장이 되지 않았어요. 브라우저 저장 공간이 가득 찼거나 막혀 있을 수 있어요." });
    }
  }

  return (
    <div>
      <p className="mt-2 text-sm text-foreground/70">
        일정이 바뀐 날짜만 고칩니다. 수정은 그 날짜에만 적용되고, 다음 주 같은 요일에는 기본 일정이 다시 적용돼요.
        단, 이미 그날만 수정해 둔 날짜는 기본 일정을 나중에 바꿔도 따라가지 않아요.
      </p>

      <div className="mt-4">
        <label htmlFor="override-date" className="block text-sm font-medium">날짜</label>
        <input
          id="override-date"
          type="date"
          value={date}
          onChange={(event) => pickDate(event.target.value)}
          className={`${TIME_INPUT_CLASS} mt-1`}
        />
        {!dateValid && <p className={ERROR_CLASS}>날짜를 선택해 주세요.</p>}
      </div>

      {dateValid && (
        <>
          <p className="mt-4 text-sm font-medium">
            {date} {weekdayLabel(date)} 수업{" "}
            <span className="ml-1 rounded bg-foreground/10 px-1.5 py-0.5 text-xs font-normal">
              {base.hasOverride ? "그날만 수정됨" : "기본 일정"}
              {isDraft ? " · 아직 저장 전" : ""}
            </span>
          </p>

          {rows.length === 0 ? (
            <p className="mt-2 text-sm text-foreground/60">이 날은 수업이 없어요.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {rows.map((row, index) => {
                const rowError = errors?.rows[index];
                return (
                  <li key={row.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        aria-label={`${index + 1}번째 수업 시작`}
                        value={row.start}
                        onChange={(event) =>
                          changeRows(rows.map((item) => (item.id === row.id ? { ...item, start: event.target.value } : item)))
                        }
                        className={TIME_INPUT_CLASS}
                      />
                      <span className="text-sm">~</span>
                      <input
                        type="time"
                        aria-label={`${index + 1}번째 수업 종료`}
                        value={row.end}
                        onChange={(event) =>
                          changeRows(rows.map((item) => (item.id === row.id ? { ...item, end: event.target.value } : item)))
                        }
                        className={TIME_INPUT_CLASS}
                      />
                      <button
                        type="button"
                        onClick={() => changeRows(rows.filter((item) => item.id !== row.id))}
                        className="rounded border border-foreground/20 px-2 py-1 text-xs"
                      >
                        삭제
                      </button>
                    </div>
                    {rowError !== undefined && <p className={ERROR_CLASS}>{rowError}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {errors?.overlap !== undefined && (
            <p role="alert" className={`${ERROR_CLASS} text-sm`}>{errors.overlap}</p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="override-new-start" className="block text-xs">시작</label>
              <input id="override-new-start" type="time" value={newStart} onChange={(event) => { setNewStart(event.target.value); setAddError(null); }} className={TIME_INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="override-new-end" className="block text-xs">종료</label>
              <input id="override-new-end" type="time" value={newEnd} onChange={(event) => { setNewEnd(event.target.value); setAddError(null); }} className={TIME_INPUT_CLASS} />
            </div>
            <button type="button" onClick={handleAdd} className="rounded-lg border border-foreground/20 px-3 py-1.5 text-sm">
              수업 추가
            </button>
          </div>
          {addError !== null && <p className={ERROR_CLASS}>{addError}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
            >
              그날만 저장
            </button>
            <button
              type="button"
              onClick={handleRevert}
              disabled={!canSave || !base.hasOverride}
              className="rounded-lg border border-foreground/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              기본으로 되돌리기
            </button>
            <p aria-live="polite" className={result?.type === "error" ? "text-sm text-red-600 dark:text-red-400" : "text-sm text-foreground/70"}>
              {result?.text}
            </p>
          </div>
        </>
      )}

      <h3 className="mt-8 text-sm font-semibold">그날만 수정한 날짜</h3>
      {sortedOverrides.length === 0 ? (
        <p className="mt-2 text-sm text-foreground/60">아직 그날만 수정한 날짜가 없어요.</p>
      ) : (
        <ul className="mt-2 divide-y divide-foreground/10 rounded-lg border border-foreground/15">
          {sortedOverrides.map((item) => (
            <li key={item.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                {item.date} {weekdayLabel(item.date)} · 수업 {item.classes.length}개
              </span>
              <button type="button" onClick={() => pickDate(item.date)} className="rounded border border-foreground/20 px-2 py-1 text-xs">
                불러오기
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
