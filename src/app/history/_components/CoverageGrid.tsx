import type { ComponentType } from "react";
import type { ScenarioType, SessionRecord } from "@/types";
import { Badge, Card, cx } from "@/components";
import {
  IconAlert,
  IconHeartHand,
  IconLock,
  IconSiren,
  IconUsers,
  type IconProps,
} from "@/components/icons";
import { TYPE_LABELS } from "./format";

/**
 * 시나리오 id → 유형 표. 시나리오 데이터 전체를 브라우저로 내려보내지 않기 위해
 * 서버 컴포넌트(page.tsx)에서 필요한 만큼만 만들어 넘겨받습니다. 키는 대문자 id 입니다.
 */
export type ScenarioTypeMap = Record<string, ScenarioType>;

export interface CoverageGridProps {
  records: SessionRecord[];
  typeByScenarioId: ScenarioTypeMap;
  /** 지금 훈련할 수 있는 유형 목록 */
  activeTypes: ScenarioType[];
}

const ORDER: ScenarioType[] = ["BPSD", "EMERGENCY", "CONFLICT", "RISK"];

/** 유형 아이콘 — 이모지 대신 공용 스트로크 아이콘을 씁니다(라벨은 항상 옆에 있습니다). */
const ICONS: Record<ScenarioType, ComponentType<IconProps>> = {
  BPSD: IconHeartHand,
  EMERGENCY: IconSiren,
  CONFLICT: IconUsers,
  RISK: IconAlert,
};

/**
 * 유형 커버리지 4칸.
 * 어떤 유형을 얼마나 연습했는지 완료 횟수만 보여 주고, 점수·등급은 표시하지 않습니다.
 */
export function CoverageGrid({ records, typeByScenarioId, activeTypes }: CoverageGridProps) {
  const counts: Record<ScenarioType, number> = {
    BPSD: 0,
    EMERGENCY: 0,
    CONFLICT: 0,
    RISK: 0,
  };
  for (const record of records) {
    const type = typeByScenarioId[record.scenarioId.trim().toUpperCase()];
    if (type) counts[type] += 1;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ORDER.map((type) => {
        const available = activeTypes.includes(type);
        const done = counts[type];
        const Icon = ICONS[type];
        return (
          <li key={type}>
            {/* 네 칸이 모두 색 배경이 되지 않도록, 연습한 유형은 잉크 색과 라벨로만 구분합니다. */}
            <Card className="h-full">
              <div className="flex items-center gap-2">
                <Icon
                  className={cx(
                    "h-5 w-5 shrink-0",
                    done > 0 ? "text-ok-ink" : "text-ink-muted",
                  )}
                />
                <p className="text-base font-extrabold text-ink">{TYPE_LABELS[type]}</p>
              </div>

              <p className="mt-3 text-base font-bold text-ink">
                {done > 0 ? (
                  <span className="text-ok-ink">
                    완료 <span className="chim-num">{done}</span>회
                  </span>
                ) : available ? (
                  <span className="text-ink-soft">아직 연습하지 않으셨습니다</span>
                ) : (
                  <span className="text-ink-soft">준비 중인 유형입니다</span>
                )}
              </p>

              <div className="mt-3">
                {available ? (
                  <Badge tone={done > 0 ? "ok" : "neutral"} variant="outline">
                    {done > 0 ? "훈련 이력 있음" : "훈련 가능"}
                  </Badge>
                ) : (
                  <Badge tone="neutral" variant="outline">
                    <IconLock className="h-4 w-4" />
                    베타 편성 예정
                  </Badge>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export default CoverageGrid;
