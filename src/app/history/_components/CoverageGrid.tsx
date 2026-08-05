import type { ComponentType } from "react";
import type { ScenarioType, SessionRecord } from "@/types";
import { Card, cx } from "@/components";
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
 *
 * 형태(§1-4·§1-5·§7): 네 칸은 보더 없이 지면(#fafbfb) 위 흰 면으로만 구분하고,
 * 상태 표기는 필(배지)이 아니라 13px 캡션 한 줄로 둡니다 — 네 칸에 필이 네 개면 화면이 시끄럽습니다.
 * 크기 체계(§3): 유형 이름 15px · 상태 캡션 13px · 완료 횟수 숫자만 24px로 세웁니다.
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
            <Card padded={false} className="h-full p-4 md:p-5">
              <div className="flex items-center gap-2">
                <Icon
                  className={cx("h-5 w-5 shrink-0", done > 0 ? "text-ok" : "text-ink-muted")}
                />
                <p className="chim-label text-ink">{TYPE_LABELS[type]}</p>
              </div>

              <p className="mt-3">
                {done > 0 ? (
                  <span className="text-ok-ink">
                    <span className="chim-meta font-semibold">완료</span>{" "}
                    <span className="chim-num text-[1.5rem] font-extrabold">{done}</span>
                    <span className="chim-meta font-semibold">회</span>
                  </span>
                ) : available ? (
                  <span className="chim-meta text-ink-soft">아직 연습하지 않으셨습니다</span>
                ) : (
                  <span className="chim-meta text-ink-soft">준비 중인 유형입니다</span>
                )}
              </p>

              <p className="chim-caption mt-2 inline-flex items-center gap-1 font-semibold text-ink-muted">
                {available ? (
                  done > 0 ? (
                    "훈련 이력 있음"
                  ) : (
                    "훈련 가능"
                  )
                ) : (
                  <>
                    <IconLock className="h-4 w-4 shrink-0" />
                    베타 편성 예정
                  </>
                )}
              </p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export default CoverageGrid;
