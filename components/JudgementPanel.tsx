"use client";

// Design Ref: §3.2, §4.1 — 홈: 오늘의 공강 선택 → 운동 시간 입력 → "된다/안 된다" 판정과 계산 근거.
// Design Ref: §10.3 — 저장 공간과 현재 시각은 화면이 뜬 뒤(클라이언트 쪽)에서만 읽는다.
// 이동·환복·샤워·오는 이동 값은 최근 5회 기록 평균을 쓰고, 평균에 쓸 기록이 없을 때만 설정의 초기값을 쓴다.
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import GapPicker from "@/components/GapPicker";
import VerdictCard, { type VerdictResult } from "@/components/VerdictCard";
import { calcMaxWorkoutMinutes, judgeWorkout, selectDurations } from "@/lib/estimate";
import { getClockSnapshot, getServerClockSnapshot, subscribeClock, toDateText } from "@/lib/clock";
import { createId } from "@/lib/id";
import { addJudgement } from "@/lib/judgement";
import { applyNow, calcGaps, getClassesOnDate, type Gap } from "@/lib/schedule";
import {
  getAppDataSnapshot,
  getServerAppDataSnapshot,
  loadAppData,
  saveAppData,
  subscribeAppData,
} from "@/lib/storage";
import { parseWorkoutMinutes } from "@/lib/validate";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export default function JudgementPanel() {
  const stored = useSyncExternalStore(subscribeAppData, getAppDataSnapshot, getServerAppDataSnapshot);
  const minute = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);

  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);
  const [workoutText, setWorkoutText] = useState("");
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<VerdictResult | null>(null);

  // 서버에서 그려질 때와 저장 데이터를 읽기 전에는 아직 모름
  if (stored === null || minute === null) {
    return <p className="mt-6 text-sm text-foreground/60">불러오는 중...</p>;
  }

  const now = new Date(minute * 60000);
  const today = toDateText(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const { data } = stored;
  const hasSchedule = data.classes.length > 0 || data.overrides.length > 0;
  const allGaps = calcGaps(getClassesOnDate(data.classes, data.overrides, today));
  // 이미 끝난 공강은 빼고, 지금이 공강 안이면 지금부터 남은 시간으로 바꾼다.
  const gaps = allGaps.flatMap((gap) => {
    const adjusted = applyNow(gap, nowMinutes);
    return adjusted === null ? [] : [adjusted];
  });
  const selectedGap: Gap | undefined = gaps.find((gap) => gap.endMinutes === selectedEnd) ?? gaps[0];
  // 이동·환복·샤워·오는 이동 값: 기록이 있으면 최근 5회 평균, 평균에 쓸 기록이 없을 때만 초기값
  const { durations, source } = selectDurations(data.records, data.defaults);
  const maxWorkout =
    selectedGap !== undefined && durations !== null
      ? calcMaxWorkoutMinutes(selectedGap.length, durations)
      : null;

  function clearResult() {
    setResult(null);
    setSaveError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedGap === undefined || durations === null) {
      return;
    }

    const parsed = parseWorkoutMinutes(workoutText);
    if (!parsed.ok) {
      setWorkoutError(parsed.message);
      setResult(null);
      return;
    }
    setWorkoutError(null);

    const judged = judgeWorkout(selectedGap.length, parsed.value, durations);

    // 확인할 때마다 판정에 번호를 붙여 저장한다. 읽을 수 없거나 깨진 저장 공간은 덮어쓰지 않는다.
    const latest = loadAppData();
    if (latest.status !== "ok" && latest.status !== "empty") {
      setResult(null);
      setSaveError("저장이 되지 않아 판정을 기록과 연결할 수 없어요. 저장 공간을 확인해 주세요.");
      return;
    }
    const judgementId = createId();
    const saved = saveAppData({
      ...latest.data,
      judgements: addJudgement(
        latest.data.judgements,
        { id: judgementId, date: today, verdict: judged.possible ? "ok" : "no", used: false },
        today,
      ),
    });
    if (!saved.ok) {
      setResult(null);
      setSaveError("저장이 되지 않아 판정을 기록과 연결할 수 없어요. 브라우저 저장 공간을 확인해 주세요.");
      return;
    }

    setSaveError(null);
    setResult({
      judgementId,
      possible: judged.possible,
      gapMinutes: selectedGap.length,
      workoutMinutes: parsed.value,
      durations,
      requiredMinutes: judged.requiredMinutes,
      remainingMinutes: judged.remainingMinutes,
      startedNow: selectedGap.startedNow,
      source,
    });
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          오늘 {now.getMonth() + 1}월 {now.getDate()}일 ({WEEKDAY_NAMES[now.getDay()]})
        </p>
        <Link href="/schedule#day-override" className="rounded-lg border border-foreground/20 px-3 py-1.5 text-xs">
          오늘 일정 바꾸기
        </Link>
      </div>

      {!hasSchedule ? (
        <p className="mt-4 rounded-lg border border-foreground/15 p-4 text-sm">
          일정 화면에서 수업을 먼저 입력하세요.{" "}
          <Link href="/schedule" className="underline">일정 화면으로</Link>
        </p>
      ) : durations === null ? (
        <p className="mt-4 rounded-lg border border-foreground/15 p-4 text-sm">
          설정에서 이동·환복·샤워 초기값을 먼저 입력하세요.{" "}
          <Link href="/settings" className="underline">설정 화면으로</Link>
        </p>
      ) : gaps.length === 0 ? (
        <p className="mt-4 rounded-lg border border-foreground/15 p-4 text-sm">
          {allGaps.length === 0 ? "오늘은 공강이 없어요." : "오늘은 남은 공강이 없어요."}
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <GapPicker
            gaps={gaps}
            selectedEnd={selectedGap?.endMinutes ?? 0}
            onSelect={(gap) => {
              setSelectedEnd(gap.endMinutes);
              clearResult();
            }}
            maxWorkout={maxWorkout}
          />

          <div className="mt-5">
            <label htmlFor="workout-minutes" className="block text-sm font-medium">
              운동 시간 (분)
            </label>
            <input
              id="workout-minutes"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={workoutText}
              onChange={(event) => {
                setWorkoutText(event.target.value);
                setWorkoutError(null);
                clearResult();
              }}
              aria-invalid={workoutError !== null}
              className="mt-1 w-40 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
            />
            {workoutError !== null && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{workoutError}</p>
            )}
          </div>

          <button
            type="submit"
            className="mt-4 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            확인하기
          </button>
          {saveError !== null && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}
        </form>
      )}

      {result !== null && <VerdictCard result={result} />}
    </div>
  );
}
