// Design Ref: §5.1, §6 — 홈에서 "확인하기"를 누를 때마다 판정에 번호를 붙여 저장하고, 7일이 지난 판정은 지운다.
// 화면·저장과 무관한 순수 함수라서 숫자 예시만으로 확인할 수 있다.
import type { Judgement } from "@/types";

// 판정을 보관하는 기간(일). 이보다 오래된 판정은 지운다.
export const JUDGEMENT_KEEP_DAYS = 7;

// "YYYY-MM-DD"를 날짜 순서 비교용 일 수로 바꾼다. (시간대 영향 없이 UTC 기준으로 센다.)
function dayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    return null;
  }
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

/**
 * 새 판정을 목록에 더하고, 오늘 기준 7일이 지난 판정은 뺀다.
 * 날짜를 읽을 수 없는 판정은 그대로 둔다. (지워서 기록과의 연결이 끊기는 것을 피한다.)
 */
export function addJudgement(
  judgements: Judgement[],
  created: Judgement,
  today: string,
): Judgement[] {
  const todayNumber = dayNumber(today);
  const kept = judgements.filter((item) => {
    const itemNumber = dayNumber(item.date);
    return (
      todayNumber === null ||
      itemNumber === null ||
      todayNumber - itemNumber <= JUDGEMENT_KEEP_DAYS
    );
  });
  return [...kept, created];
}

/**
 * 기록에 붙일 판정을 고른다. (Design §4.2)
 * 판정 번호가 있고, 아직 어떤 기록에도 붙지 않았고(used가 false), 판정 날짜가 기록 날짜와 같을 때만 붙인다.
 * 그렇지 않으면 "판정 안 함"(none)이고 판정 목록은 그대로다.
 * 붙인 판정은 used를 true로 바꾼 새 목록을 함께 돌려준다. (같은 판정으로 두 번째 기록을 저장하면 "판정 안 함")
 */
export function attachJudgement(
  judgements: Judgement[],
  judgementId: string | null,
  recordDate: string,
): { verdict: "ok" | "no" | "none"; judgements: Judgement[] } {
  const target =
    judgementId === null ? undefined : judgements.find((item) => item.id === judgementId);

  if (target === undefined || target.used || target.date !== recordDate) {
    return { verdict: "none", judgements };
  }

  return {
    verdict: target.verdict,
    judgements: judgements.map((item) => (item.id === target.id ? { ...item, used: true } : item)),
  };
}
