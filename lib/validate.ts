// Design Ref: §7 — 입력값 검사. 화면과 무관한 순수 함수라서 숫자 예시만으로 맞는지 확인할 수 있다.
// 이번에는 이동·환복·샤워·오는 이동 시간(분) 검사만 만든다. 나머지 검사는 해당 작업에서 이 파일에 추가한다.

// PRD 5② — 이동·환복·샤워·오는 이동은 0~120분의 정수만 받는다. (0분은 "생략한 날"이라 허용)
export const MIN_DURATION_MINUTES = 0;
export const MAX_DURATION_MINUTES = 120;

export type MinutesParseResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

/**
 * 입력 칸의 글자를 분 단위 정수로 바꾼다.
 * 규칙에 맞지 않으면 화면에 보여 줄 안내 문구를 함께 돌려준다.
 */
export function parseDurationMinutes(text: string): MinutesParseResult {
  const trimmed = text.trim();

  if (trimmed === "") {
    return { ok: false, message: "숫자를 입력해 주세요." };
  }

  // 숫자 모양(부호·소수점 허용)만 통과시키고, 글자가 섞인 값은 여기서 거른다.
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, message: "숫자만 입력해 주세요." };
  }

  const value = Number(trimmed);

  if (!Number.isInteger(value)) {
    return { ok: false, message: "소수점 없이 정수로 입력해 주세요." };
  }
  if (value < MIN_DURATION_MINUTES) {
    return { ok: false, message: `${MIN_DURATION_MINUTES}분 이상으로 입력해 주세요.` };
  }
  if (value > MAX_DURATION_MINUTES) {
    return { ok: false, message: `${MAX_DURATION_MINUTES}분 이하로 입력해 주세요.` };
  }

  return { ok: true, value };
}
