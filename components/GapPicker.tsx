// Design Ref: §3.2 — 오늘의 공강 목록(시작~종료, 길이)을 라디오 버튼으로 고르고, 고른 공강의 최대 운동 시간을 보여 준다.
import { MAX_WORKOUT_DISPLAY_MINUTES, type MaxWorkoutResult } from "@/lib/estimate";
import { formatGap, type Gap } from "@/lib/schedule";

interface GapPickerProps {
  gaps: Gap[];
  selectedEnd: number; // 고른 공강의 종료 시각(분). 공강마다 종료 시각이 달라 구분 표시로 쓴다.
  onSelect: (gap: Gap) => void;
  maxWorkout: MaxWorkoutResult | null; // 초기값이 없어 계산할 수 없으면 null
}

export default function GapPicker({ gaps, selectedEnd, onSelect, maxWorkout }: GapPickerProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">공강 선택</legend>
      <ul className="mt-2 space-y-1">
        {gaps.map((gap) => (
          <li key={gap.endMinutes}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="gap"
                checked={gap.endMinutes === selectedEnd}
                onChange={() => onSelect(gap)}
              />
              <span>
                {formatGap(gap)} ({gap.length}분)
                {gap.startedNow && (
                  <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs">지금부터</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {maxWorkout !== null && (
        <p className="mt-3 text-sm">
          {maxWorkout.possible ? (
            <>
              선택한 공강: 최대 <strong>{maxWorkout.minutes}분</strong>
              {maxWorkout.minutes === MAX_WORKOUT_DISPLAY_MINUTES ? " 이상" : ""}까지 가능
            </>
          ) : (
            "이 공강에는 운동할 시간이 없어요"
          )}
        </p>
      )}
    </fieldset>
  );
}
