"use client";

// Design Ref: §3.5, §4.4 — 설정 화면의 백업: 내보내기(파일 저장)와 가져오기(파일 선택 → 형식 확인 → 덮어쓰기 확인).
// Design Ref: §8 — 파일은 이 기기에서만 읽고 쓴다. 서버로 보내지 않는다. 가져오기는 형식과 값의 범위를 확인한 뒤에만 반영한다.
import { useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { backupFileName, createBackup, MAX_BACKUP_FILE_BYTES, parseBackup } from "@/lib/backup";
import {
  getAppDataSnapshot,
  getServerAppDataSnapshot,
  loadAppData,
  saveAppData,
  subscribeAppData,
} from "@/lib/storage";
import type { AppData } from "@/types";

// 저장된 ISO 시각을 "2026-11-24 14:30" 모양으로 보여 준다. (내 컴퓨터의 시간대 기준)
function formatDateTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 가져오기를 확인하는 중인 파일 내용
interface PendingImport {
  fileName: string;
  data: AppData;
  exportedAt: string;
}

export default function BackupPanel() {
  const stored = useSyncExternalStore(subscribeAppData, getAppDataSnapshot, getServerAppDataSnapshot);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (stored === null) {
    return <p className="mt-4 text-sm text-foreground/60">불러오는 중...</p>;
  }

  const status = stored.status;
  const unavailable = status === "unavailable";
  const corrupt = status === "corrupt";
  const lastExported =
    stored.data.lastExportedAt === null ? null : formatDateTime(stored.data.lastExportedAt);

  // 내보내기: 파일을 만들어 내려받고, 성공하면 마지막 내보낸 시각을 기록한다.
  function handleExport() {
    setResult(null);
    const latest = loadAppData();
    if (latest.status !== "ok" && latest.status !== "empty") {
      setResult({ type: "error", text: "저장된 데이터를 읽을 수 없어서 내보낼 수 없어요." });
      return;
    }

    const now = new Date();
    const backup = createBackup(latest.data, now.toISOString());
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName(now);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    const saved = saveAppData({ ...latest.data, lastExportedAt: backup.exportedAt });
    setResult({
      type: saved.ok ? "success" : "error",
      text: saved.ok
        ? `${link.download} 파일로 저장했어요. 파일은 비공개로 보관해 주세요.`
        : "파일은 저장했지만 마지막 내보낸 날짜를 기록하지 못했어요.",
    });
  }

  // 가져오기 1단계: 파일을 읽고 형식을 확인한다. 통과하면 덮어쓰기 확인 상자를 띄운다.
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일을 다시 골라도 반응하도록 비운다.
    setPending(null);
    setResult(null);
    if (file === undefined) {
      return;
    }

    // 너무 큰 파일은 읽기 전에 거른다. (실수로 아주 큰 파일을 골라 화면이 멈추는 것을 막는다.)
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setResult({ type: "error", text: "이 파일은 운동될까 백업이 아니에요. (파일이 너무 커요)" });
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setResult({ type: "error", text: "파일을 읽지 못했어요." });
      return;
    }

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setResult({ type: "error", text: parsed.message });
      return;
    }
    setPending({ fileName: file.name, data: parsed.data, exportedAt: parsed.exportedAt });
  }

  // 가져오기 2단계: 확인을 눌렀을 때만 저장 공간을 파일 내용으로 바꾼다.
  function handleConfirmImport() {
    if (pending === null) {
      return;
    }
    const saved = saveAppData(pending.data);
    setPending(null);
    setResult(
      saved.ok
        ? { type: "success", text: "백업 파일의 일정과 기록을 가져왔어요." }
        : { type: "error", text: "저장이 되지 않았어요. 기존 데이터는 그대로예요." },
    );
  }

  const counts = pending === null
    ? null
    : `수업 ${pending.data.classes.length}개 · 그날만 수정 ${pending.data.overrides.length}일 · 기록 ${pending.data.records.length}건`;

  return (
    <div className="mt-3">
      <p className="text-sm text-foreground/70">
        브라우저 데이터가 사라지면 일정과 기록도 함께 사라져요. 가장 최근에 내보낸 파일로 가져오기를 하면 복구할 수 있어요.
        내보낸 파일에는 수업 일정이 들어 있으니 비공개로 보관하고, 인터넷에 올리지 마세요.
      </p>

      {unavailable && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/40 p-3 text-sm text-red-600 dark:text-red-400">
          브라우저 저장 공간을 쓸 수 없어서 내보내기와 가져오기를 할 수 없어요.
        </p>
      )}
      {corrupt && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/40 p-3 text-sm text-red-600 dark:text-red-400">
          저장된 데이터를 읽을 수 없어요. 내보내기는 막아 두었고, 백업 파일이 있다면 가져오기로 복구할 수 있어요.
        </p>
      )}

      <p className="mt-4 text-sm">
        마지막으로 내보낸 날짜: <strong>{lastExported ?? "아직 없어요"}</strong>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={unavailable || corrupt}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          내보내기 (파일 저장)
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={unavailable}
          className="rounded-lg border border-foreground/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          가져오기 (파일 선택)
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          aria-label="백업 파일 선택"
          className="hidden"
        />
      </div>

      {pending !== null && (
        <div role="alertdialog" aria-label="가져오기 확인" className="mt-4 rounded-lg border border-foreground/30 p-4 text-sm">
          <p className="font-medium">기존 데이터를 덮어씁니다. 계속할까요?</p>
          <p className="mt-1 text-foreground/70">
            {pending.fileName} · {counts}
            {formatDateTime(pending.exportedAt) !== null && ` · 내보낸 시각 ${formatDateTime(pending.exportedAt)}`}
          </p>
          {corrupt && (
            <p className="mt-1 text-xs text-foreground/60">지금 저장된 데이터는 읽을 수 없는 상태라 이 파일로 교체돼요.</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleConfirmImport}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              덮어쓰기
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg border border-foreground/20 px-3 py-1.5 text-sm"
            >
              취소
            </button>
          </div>
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
