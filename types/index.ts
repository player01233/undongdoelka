// Design Ref: §5.1 — 앱 전체에서 쓰는 데이터 모양을 모아 두는 파일이다.
// 작업마다 필요한 타입만 여기에 추가한다. (이번 작업에서는 시간 계산에 필요한 것만 둔다.)

// 이동·환복·샤워 시간 묶음 (모든 값은 분 단위 정수)
export interface Durations {
  travelTo: number; // 가는 이동
  changing: number; // 환복
  shower: number; // 샤워
  travelBack: number; // 오는 이동 (운동 장소 → 다음 수업 강의실)
}
