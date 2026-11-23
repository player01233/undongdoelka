// Design Ref: §5.1 — 수업·판정·기록을 구분하는 내부 번호(화면에 보이지 않는다)를 만든다.
export function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
