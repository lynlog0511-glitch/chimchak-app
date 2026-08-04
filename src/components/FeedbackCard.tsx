import type { ReactNode } from "react";
import { getRubricItem } from "@/data/rubric";
import type { FeedbackTrace } from "@/engine/session";
import { SourceChip } from "./SourceChip";
import { cx } from "./utils";

export interface FeedbackCardProps {
  /** true면 🟢 충족, false면 ⚪ 코칭 (점수·등급은 어떤 경우에도 표시하지 않습니다) */
  ok: boolean;
  message: string;
  docId?: string;
  /** 근거 문서 제목 직접 지정 (데이터 주입 전 화면용) */
  docTitle?: string;
  /** 분기 유형명 등 보조 라벨 */
  label?: string;
  /** ⚑CF(치명적 실패) 표시 — 붉은 톤으로 전환합니다 */
  critical?: boolean;
  /**
   * 판정 근거 — 있으면 「이 판정이 나온 이유」 접이식이 붙습니다(기본 접힘).
   * 없으면 카드는 예전과 똑같이 동작합니다.
   */
  trace?: FeedbackTrace;
  className?: string;
  children?: ReactNode;
}

/** 판정 경로 한 줄 라벨 — 무엇이 이 판정을 내렸는지 학습자에게 그대로 밝힙니다. */
function pathLabel(trace: FeedbackTrace): string {
  switch (trace.source) {
    case "rule":
      return "규칙 사전 단독 판정 (결정론 · 생성 없음)";
    case "criticalPattern":
    case "pattern":
      return trace.matchedPattern
        ? `분기 판정 신호 일치: 「${trace.matchedPattern}」`
        : "분기 판정 신호 일치";
    case "button":
      return "보기 버튼 선택";
    case "default":
    default:
      return "미분류 — 기본 응답 처리";
  }
}

/** 경로별 한 줄 보충 설명 */
function pathNote(trace: FeedbackTrace): string {
  switch (trace.source) {
    case "rule":
      return "말씀 속 표현이 규칙 사전에 등재된 금지 표현과 그대로 맞았습니다. 이 판정에는 생성이 쓰이지 않습니다.";
    case "criticalPattern":
      return "안전 직결 분기의 판정 신호를 먼저 검사해 걸렀습니다.";
    case "pattern":
      return "시나리오 데이터에 적힌 분기 신호와 맞아, 그 분기의 고정 문구를 그대로 보여 드립니다.";
    case "button":
      return "고르신 보기에 시나리오 데이터가 미리 정해 둔 판정을 그대로 따랐습니다.";
    case "default":
    default:
      return "어느 판정 신호에도 걸리지 않아 기본 응답으로 처리했습니다. 조금 더 구체적으로 말씀해 보시면 판정이 달라집니다.";
  }
}

/**
 * 턴별 피드백 카드.
 * 표시는 🟢 충족 / ⚪ 코칭 2단계 + 코칭 1문장 + 근거 출처 칩까지입니다.
 * `trace`를 넘기면 「이 판정이 나온 이유」 접이식이 함께 붙습니다(점수·등급·앵커 숫자는 표시하지 않습니다).
 *
 * @example <FeedbackCard ok message="감정을 먼저 인정하셨습니다." docId="DOC-GUIDE-001" />
 * @example <FeedbackCard ok={false} message="…" trace={{ source: "pattern", matchedPattern: "집에 가야", itemIds: ["RE-02"] }} />
 */
export function FeedbackCard({
  ok,
  message,
  docId,
  docTitle,
  label,
  critical = false,
  trace,
  className,
  children,
}: FeedbackCardProps) {
  const mark = critical ? "🔴" : ok ? "🟢" : "⚪";
  const heading = critical ? "즉시 중단" : ok ? "충족" : "코칭";
  const box = critical
    ? "border-danger-line bg-danger-soft"
    : ok
      ? "border-ok-line bg-ok-soft"
      : "border-line bg-white";
  const headText = critical ? "text-danger-ink" : ok ? "text-ok-ink" : "text-ink-soft";

  /* 걸린 루브릭 항목 — 행동지표 문장만 가져옵니다. 점수·앵커는 내부 전용이라 읽지 않습니다. */
  const basis = (trace?.itemIds ?? []).flatMap((itemId) => {
    const item = getRubricItem(itemId);
    return item ? [{ itemId, indicator: item.indicator, docId: item.docId }] : [];
  });

  /* 루브릭 항목에 달린 근거 문서 중, 위 칩으로 이미 보여 드린 것은 뺍니다. */
  const extraDocIds = basis
    .map((entry) => entry.docId)
    .filter((id): id is string => typeof id === "string" && id !== docId)
    .filter((id, index, all) => all.indexOf(id) === index);

  return (
    <div className={cx("rounded-card border p-4 shadow-soft md:p-5", box, className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="text-lg leading-none">
          {mark}
        </span>
        <span className={cx("text-base font-extrabold", headText)}>{heading}</span>
        {label && (
          <span className="rounded-chip border border-line bg-white/70 px-2 py-0.5 text-sm font-semibold text-ink-muted">
            {label}
          </span>
        )}
      </div>

      <p className="mt-2 text-base leading-relaxed text-ink">{message}</p>

      {children}

      {docId && (
        <div className="mt-3">
          <SourceChip docId={docId} title={docTitle} />
        </div>
      )}

      {trace && (
        <details className="group mt-3 rounded-field border border-line bg-white/70">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-3 py-2 text-base font-bold text-ink-soft [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="text-sm text-ink-muted transition-transform duration-150 group-open:rotate-180"
            >
              ▾
            </span>
            이 판정이 나온 이유
          </summary>

          <div className="space-y-3 border-t border-line px-3 py-3">
            {/* ① 판정 경로 */}
            <div>
              <p className="text-sm font-bold text-ink-muted">판정 경로</p>
              <p className="mt-1 text-base leading-relaxed font-bold text-ink">
                {pathLabel(trace)}
              </p>
              {trace.ruleLabel && (
                <p className="mt-1 text-base leading-relaxed text-ink-soft">
                  규칙: {trace.ruleLabel}
                  {trace.ruleId ? ` (${trace.ruleId})` : ""}
                  {trace.matchedPattern ? ` · 걸린 표현 「${trace.matchedPattern}」` : ""}
                </p>
              )}
              <p className="mt-1 text-base leading-relaxed text-ink-soft">{pathNote(trace)}</p>
              {trace.advisoryLabels && trace.advisoryLabels.length > 0 && (
                <p className="mt-1 text-base leading-relaxed text-ink-soft">
                  규칙 사전 코칭도 함께 적용되었습니다 — {trace.advisoryLabels.join(" · ")}
                </p>
              )}
            </div>

            {/* ② 걸린 루브릭 항목의 행동지표 (점수·앵커 미표시) */}
            {basis.length > 0 && (
              <div>
                <p className="text-sm font-bold text-ink-muted">확인한 항목</p>
                <ul className="mt-1 space-y-2">
                  {basis.map((entry) => (
                    <li key={entry.itemId} className="flex flex-wrap items-start gap-2">
                      <span className="rounded-chip border border-line bg-paper-2 px-2 py-0.5 text-sm font-bold text-ink-muted">
                        {entry.itemId}
                      </span>
                      <span className="min-w-[12rem] flex-1 text-base leading-relaxed text-ink">
                        {entry.indicator}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ③ 근거 문서 칩 */}
            {extraDocIds.length > 0 && (
              <div>
                <p className="text-sm font-bold text-ink-muted">근거 문서</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {extraDocIds.map((id) => (
                    <SourceChip key={id} docId={id} />
                  ))}
                </div>
              </div>
            )}

            <p className="border-t border-line pt-2 text-sm leading-relaxed font-semibold text-ink-muted">
              이 판정은 이 기기 안에서 끝났습니다 · 외부로 나간 요청 0건
            </p>
          </div>
        </details>
      )}
    </div>
  );
}

export default FeedbackCard;
