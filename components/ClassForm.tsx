"use client";

// Design Ref: §3.3 — 일정 화면: 요일·시작·종료·매주 반복을 입력해 기본 일정으로 저장하고, 목록에서 수정·삭제한다.
// Design Ref: §7 — 종료가 시작보다 늦어야 하고, 같은 날 수업이 겹치면 저장하지 않는다.
// 기본 일정(매주·한 번만)만 다룬다. "특정 날짜만 수정"은 DayOverrideEditor가 맡는다.
import { useState, useSyncExternalStore, type FormEvent } from "react";
import {
  getAppDataSnapshot,
  getServerAppDataSnapshot,
  loadAppData,
  saveAppData,
  subscribeAppData,
} from "@/lib/storage";
import { createId } from "@/lib/id";
import { parseClassInput, type ClassInputErrors } from "@/lib/validate";
import type { ClassItem, Weekday } from "@/types";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;
// 화면에는 월요일부터 일요일 순서로 보여 준다.
const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

// 오늘 날짜를 "YYYY-MM-DD"로 만든다. (로컬 시간 기준, toISOString은 하루가 밀릴 수 있어 쓰지 않는다.)
function todayText(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

interface FormState {
  weekday: Weekday;
  start: string;
  end: string;
  repeatWeekly: boolean;
  date: string;
}

const EMPTY_FORM: FormState = { weekday: 1, start: "", end: "", repeatWeekly: true, date: "" };

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm";
const ERROR_CLASS = "mt-1 text-xs text-red-600 dark:text-red-400";

export default function ClassForm() {
  const stored = useSyncExternalStore(
    subscribeAppData,
    getAppDataSnapshot,
    getServerAppDataSnapshot,
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null); // 삭제 확인을 기다리는 수업
  const [errors, setErrors] = useState<ClassInputErrors>({});
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const status = stored === null ? "loading" : stored.status;
  const classes: ClassItem[] = stored?.data.classes ?? [];
  const canSave = status === "ok" || status === "empty";
  const blocked =
    status === "unavailable"
      ? "브라우저 저장 공간을 쓸 수 없어서 저장이 되지 않아요. 시크릿 모드이거나 저장이 차단되어 있는지 확인해 주세요."
      : status === "corrupt"
        ? "저장된 데이터를 읽을 수 없어요. 기존 데이터를 지키려고 저장을 막아 두었어요."
        : null;

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setResult(null);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
  }

  // 저장 직전에 다시 읽어서 최신 수업 목록 기준으로 검사하고, 일정 외의 데이터는 그대로 둔다.
  // 읽을 수 없거나 깨진 상태에서는 원본을 덮어쓰지 않도록 저장하지 않는다.
  function writeClasses(change: (latest: ClassItem[]) => ClassItem[]): boolean {
    const latest = loadAppData();
    if (latest.status !== "ok" && latest.status !== "empty") {
      setResult({ type: "error", text: "저장이 되지 않았어요. 저장 공간을 확인해 주세요." });
      return false;
    }
    const saved = saveAppData({ ...latest.data, classes: change(latest.data.classes) });
    if (!saved.ok) {
      setResult({
        type: "error",
        text: "저장이 되지 않았어요. 브라우저 저장 공간이 가득 찼거나 막혀 있을 수 있어요.",
      });
      return false;
    }
    return true;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const latest = loadAppData();
    if (latest.status !== "ok" && latest.status !== "empty") {
      setResult({ type: "error", text: "저장이 되지 않았어요. 저장 공간을 확인해 주세요." });
      return;
    }

    const parsed = parseClassInput(form, latest.data.classes, editingId);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setResult(null);
      return;
    }

    const wasEditing = editingId !== null;
    const ok = writeClasses((list) =>
      wasEditing
        ? list.map((item) => (item.id === editingId ? { ...parsed.value, id: item.id } : item))
        : [...list, { ...parsed.value, id: createId() }],
    );
    if (ok) {
      resetForm();
      setResult({ type: "success", text: wasEditing ? "수정했어요." : "추가했어요." });
    }
  }

  function startEdit(item: ClassItem) {
    setEditingId(item.id);
    setForm({
      weekday: item.weekday ?? 1,
      start: item.start,
      end: item.end,
      repeatWeekly: item.repeatWeekly,
      date: item.date ?? "",
    });
    setErrors({});
    setResult(null);
  }

  // 삭제는 두 단계로 한다: [삭제]를 누르면 그 줄에서 "삭제할까요?"를 묻고, [삭제 확인]을 눌러야 지운다.
  // (브라우저 기본 확인 창은 환경에 따라 뜨지 않고 취소로 처리되는 경우가 있어 화면 안에서 묻는다.)
  function handleDelete(item: ClassItem) {
    setConfirmingId(null);
    if (writeClasses((list) => list.filter((other) => other.id !== item.id))) {
      if (editingId === item.id) {
        resetForm();
      }
      setResult({ type: "success", text: "삭제했어요." });
    }
  }

  const weekly = WEEKDAY_ORDER.flatMap((day) =>
    classes
      .filter((item) => item.repeatWeekly && item.weekday === day)
      .sort((a, b) => a.start.localeCompare(b.start)),
  );
  const once = classes
    .filter((item) => !item.repeatWeekly)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.start.localeCompare(b.start));

  return (
    <div>
      {blocked !== null && (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-600 dark:text-red-400">
          {blocked}
        </p>
      )}

      <h2 className="mt-6 text-base font-semibold">기본 일정 (매주)</h2>
      {status === "loading" ? (
        <p className="mt-2 text-sm text-foreground/60">불러오는 중...</p>
      ) : weekly.length === 0 ? (
        <p className="mt-2 text-sm text-foreground/60">아직 입력한 매주 수업이 없어요.</p>
      ) : (
        <ul className="mt-2 divide-y divide-foreground/10 rounded-lg border border-foreground/15">
          {weekly.map((item) => (
            <ClassRow key={item.id} item={item} confirming={confirmingId === item.id} onAsk={setConfirmingId} onEdit={startEdit} onDelete={handleDelete} />
          ))}
        </ul>
      )}

      {once.length > 0 && (
        <>
          <h2 className="mt-6 text-base font-semibold">한 번만 있는 수업</h2>
          <ul className="mt-2 divide-y divide-foreground/10 rounded-lg border border-foreground/15">
            {once.map((item) => (
              <ClassRow key={item.id} item={item} confirming={confirmingId === item.id} onAsk={setConfirmingId} onEdit={startEdit} onDelete={handleDelete} />
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 text-base font-semibold">{editingId !== null ? "수업 수정" : "수업 추가"}</h2>
      <form onSubmit={handleSubmit} noValidate className="mt-3">
        <div className="grid gap-4 sm:grid-cols-3">
          {form.repeatWeekly ? (
            <div>
              <label htmlFor="class-weekday" className="block text-sm font-medium">요일</label>
              <select
                id="class-weekday"
                value={form.weekday}
                onChange={(event) => update({ weekday: Number(event.target.value) as Weekday })}
                className={INPUT_CLASS}
              >
                {WEEKDAY_ORDER.map((day) => (
                  <option key={day} value={day}>{WEEKDAY_NAMES[day]}요일</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="class-date" className="block text-sm font-medium">날짜</label>
              <input
                id="class-date"
                type="date"
                value={form.date}
                onChange={(event) => update({ date: event.target.value })}
                aria-invalid={errors.date !== undefined}
                className={INPUT_CLASS}
              />
              {errors.date !== undefined && <p className={ERROR_CLASS}>{errors.date}</p>}
            </div>
          )}

          <div>
            <label htmlFor="class-start" className="block text-sm font-medium">시작</label>
            <input
              id="class-start"
              type="time"
              value={form.start}
              onChange={(event) => update({ start: event.target.value })}
              aria-invalid={errors.start !== undefined}
              className={INPUT_CLASS}
            />
            {errors.start !== undefined && <p className={ERROR_CLASS}>{errors.start}</p>}
          </div>

          <div>
            <label htmlFor="class-end" className="block text-sm font-medium">종료</label>
            <input
              id="class-end"
              type="time"
              value={form.end}
              onChange={(event) => update({ end: event.target.value })}
              aria-invalid={errors.end !== undefined}
              className={INPUT_CLASS}
            />
            {errors.end !== undefined && <p className={ERROR_CLASS}>{errors.end}</p>}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.repeatWeekly}
            onChange={(event) =>
              update({ repeatWeekly: event.target.checked, date: form.date || todayText() })
            }
          />
          매주 반복 (끄면 날짜를 골라 그날 한 번만 있는 수업으로 저장돼요)
        </label>

        {errors.overlap !== undefined && (
          <p role="alert" className={`${ERROR_CLASS} mt-3 text-sm`}>{errors.overlap}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editingId !== null ? "수정 저장" : "추가"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setResult(null);
              }}
              className="rounded-lg border border-foreground/20 px-4 py-2 text-sm"
            >
              취소
            </button>
          )}
          <p
            aria-live="polite"
            className={result?.type === "error" ? "text-sm text-red-600 dark:text-red-400" : "text-sm text-foreground/70"}
          >
            {result?.text}
          </p>
        </div>
      </form>
    </div>
  );
}

// 목록과 확인 창에 쓰는 한 줄 설명. 예: "월 09:00~10:30", "2026-11-25(수) 13:00~14:00"
function describe(item: ClassItem): string {
  if (item.repeatWeekly) {
    return `${WEEKDAY_NAMES[item.weekday ?? 0]} ${item.start}~${item.end}`;
  }
  return `${item.date} ${item.start}~${item.end} (한 번만)`;
}

function ClassRow({
  item,
  confirming,
  onAsk,
  onEdit,
  onDelete,
}: {
  item: ClassItem;
  confirming: boolean;
  onAsk: (id: string | null) => void;
  onEdit: (item: ClassItem) => void;
  onDelete: (item: ClassItem) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span>
        {describe(item).replace(" (한 번만)", "")}
        {!item.repeatWeekly && (
          <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs">한 번만</span>
        )}
      </span>
      {confirming ? (
        <span className="flex items-center gap-2">
          <span className="text-xs">삭제할까요?</span>
          <button type="button" onClick={() => onDelete(item)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">
            삭제 확인
          </button>
          <button type="button" onClick={() => onAsk(null)} className="rounded border border-foreground/20 px-2 py-1 text-xs">
            취소
          </button>
        </span>
      ) : (
        <span className="flex gap-2">
          <button type="button" onClick={() => onEdit(item)} className="rounded border border-foreground/20 px-2 py-1 text-xs">
            수정
          </button>
          <button type="button" onClick={() => onAsk(item.id)} className="rounded border border-foreground/20 px-2 py-1 text-xs">
            삭제
          </button>
        </span>
      )}
    </li>
  );
}
