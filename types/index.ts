// Design Ref: §5.1 — 앱 전체에서 쓰는 데이터 모양을 모아 두는 파일이다.
// 작업마다 필요한 타입만 여기에 추가한다.
// 시각은 "HH:MM" 문자열, 날짜는 "YYYY-MM-DD" 문자열, 모든 시간 값은 분 단위이다.

// 이동·환복·샤워 시간 묶음 (모든 값은 분 단위 정수)
export interface Durations {
  travelTo: number; // 가는 이동
  changing: number; // 환복
  shower: number; // 샤워
  travelBack: number; // 오는 이동 (운동 장소 → 다음 수업 강의실)
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = 일요일

// 기본 일정의 수업 하나
export interface ClassItem {
  id: string;
  start: string; // "09:00"
  end: string; // "10:30"
  repeatWeekly: boolean; // true면 매주 반복
  weekday?: Weekday; // 매주 반복일 때 요일
  date?: string; // 반복하지 않을 때 그 날짜(한 번만 있는 수업)
}

// 그날만 수정한 일정 (그 날짜의 수업 목록 전체를 대신한다)
export interface DayOverride {
  date: string;
  classes: { id: string; start: string; end: string }[];
}

// 운동 후 기록 하나
export interface WorkoutRecord {
  id: string;
  date: string;
  durations: Durations;
  returnedOnTime: boolean; // 수업 10분 전까지 복귀했는가
  verdict: "ok" | "no" | "none"; // 저장 시점의 앱 판정 (된다/안 된다/판정 안 함)
  special: boolean; // "특이 상황" → 평균에서 제외
  createdAt: string; // 저장 시각
}

// 홈에서 "확인하기"를 누를 때마다 만들어지는 판정 하나 (id는 화면에 보이지 않는 내부 표시)
export interface Judgement {
  id: string;
  date: string; // 판정한 날짜
  verdict: "ok" | "no"; // 된다 / 안 된다
  used: boolean; // 이미 어떤 기록에 붙었는가
}

// 앱이 저장하는 전체 데이터 (브라우저 저장 공간에 하나의 묶음으로 저장)
export interface AppData {
  version: 1;
  classes: ClassItem[];
  overrides: DayOverride[];
  defaults: Durations | null; // 초기값 (첫 사용 때 입력)
  records: WorkoutRecord[];
  judgements: Judgement[]; // 판정 확인 때마다 쌓이는 판정 목록
  lastExportedAt: string | null; // 마지막 내보낸 시각
}
