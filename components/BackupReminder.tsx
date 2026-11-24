"use client";

// Design Ref: §3.2 — 홈 맨 위의 7일 백업 안내 문구. 마지막 내보내기로부터 7일이 지나면(내보낸 적이 없으면 첫 기록을 저장한 날부터 7일) 설정 화면으로 안내한다.
// 푸시 알림이 아니라 화면 안의 문구이다.
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getClockSnapshot, getServerClockSnapshot, subscribeClock } from "@/lib/clock";
import { BACKUP_REMINDER_DAYS, needsBackupReminder } from "@/lib/backup";
import { getAppDataSnapshot, getServerAppDataSnapshot, subscribeAppData } from "@/lib/storage";

export default function BackupReminder() {
  const stored = useSyncExternalStore(subscribeAppData, getAppDataSnapshot, getServerAppDataSnapshot);
  const minute = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);

  if (stored === null || minute === null || (stored.status !== "ok" && stored.status !== "empty")) {
    return null;
  }
  if (!needsBackupReminder(stored.data, minute * 60000)) {
    return null;
  }

  const neverExported = stored.data.lastExportedAt === null;
  return (
    <p role="status" className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/50 px-4 py-3 text-sm">
      <span>
        ⚠ {neverExported ? `아직 백업한 적이 없고 첫 기록을 저장한 지 ${BACKUP_REMINDER_DAYS}일이 지났어요.` : `백업한 지 ${BACKUP_REMINDER_DAYS}일이 지났어요.`}
      </span>
      <Link href="/settings" className="underline">설정으로</Link>
    </p>
  );
}
