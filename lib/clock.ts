// Design Ref: §10.3 — 현재 시각은 화면이 뜬 뒤(클라이언트 쪽)에서만 읽는다.
// 렌더 중에 시계를 직접 읽지 않으려고, "분" 단위 현재 시각을 외부 값(useSyncExternalStore용)으로 다룬다.

/** 현재 시각이 바뀔 때(15초마다 확인) 알림을 받는다. 돌려주는 함수를 부르면 알림을 끊는다. */
export function subscribeClock(listener: () => void): () => void {
  const timer = setInterval(listener, 15000);
  return () => clearInterval(timer);
}

/** 지금까지 지난 분(에포크 분). 같은 분 안에서는 같은 값이라 불필요한 다시 그리기가 없다. */
export function getClockSnapshot(): number {
  return Math.floor(Date.now() / 60000);
}

/** 서버에서 그려질 때는 시각을 알 수 없으므로 "아직 모름(null)"을 돌려준다. */
export function getServerClockSnapshot(): null {
  return null;
}

/** 로컬 날짜를 "YYYY-MM-DD"로 만든다. (toISOString은 하루가 밀릴 수 있어 쓰지 않는다.) */
export function toDateText(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
