import type { ReactNode } from "react";
import { SettingsMenu } from "./SettingsMenu";
import { cx } from "./utils";

export interface ScreenHeaderProps {
  /** 화면 제목 — 22px w800. 화면당 하나뿐입니다. */
  title: string;
  /**
   * 부제 12.5px — 상태 점을 붙이려면 노드로 넘기세요.
   * @example subtitle={<span className="flex items-center gap-[4px] text-ok-ink"><StatusDot tone="ok" />기기에 저장됨</span>}
   */
  subtitle?: ReactNode;
  /**
   * 우측 액션 — 홈의 「설정」처럼 조용한 텍스트 버튼만 둡니다.
   *
   * **넘기지 않으면 「글자 크기」 설정 팝오버가 기본으로 섭니다**(아래 컴포넌트 주석 참고).
   * 비워 두려면 `action={null}`을 명시하세요 — 인쇄 화면처럼 조작이 나가면 안 되는 자리입니다.
   */
  action?: ReactNode;
  /** h1이 이미 있는 화면에서 위계를 낮출 때 */
  as?: "h1" | "h2";
  className?: string;
  id?: string;
}

/**
 * 목록 화면 상단 바 (v4 §0 · 시안 5b·5c).
 *
 * 전역 헤더가 사라진 자리를 각 화면이 이 조각으로 채웁니다 — 제목 22px w800 + 부제 12.5px.
 * **좌우 여백은 부모(`PageShell`의 `pad`)가 줍니다** — 여기서는 넣지 않습니다.
 *
 * ## 오른쪽 자리의 기본값은 「글자 크기」입니다
 *
 * `action`을 넘기지 않은 화면에는 설정 팝오버를 여는 텍스트 버튼이 기본으로 섭니다.
 * 글자가 작다고 느끼시는 순간은 대개 **지금 읽고 계신 화면**인데, 예전에는 진입점이 홈 상단 바와
 * 훈련 세션 헤더 둘뿐이라 응급 안내를 보다 작다고 느낀 분은 화면을 나가 홈까지 갔다가 돌아와야
 * 했습니다(평가 UI/UX m6). 주 사용자가 중고령이라고 적어 둔 앱에서 그 길은 사실상 막힌 길입니다.
 *
 * 기본값이므로 **옵트아웃**입니다 — 「닫기」를 세운 화면은 지금 넘기는 값을 그대로 지키고,
 * 아예 비워야 하는 자리(인쇄되는 확인서 등)는 `action={null}`로 끕니다.
 * 낱말은 세션 헤더와 같은 「글자 크기」 하나로 둡니다(홈 상단 바만 「설정」 — 거기서는 표시·음성·
 * 온라인 모드 셋을 다 여는 자리라 이름이 좁아지면 안 됩니다).
 *
 * @example <ScreenHeader title="성장 기록" subtitle="점수와 등급은 없습니다 — 해 본 것과 다시 볼 것만 남깁니다" />
 * @example 오른쪽을 비울 때 <ScreenHeader title="이수 확인서" action={null} />
 */
export function ScreenHeader({
  title,
  subtitle,
  action,
  as: Heading = "h1",
  className,
  id,
}: ScreenHeaderProps) {
  /* `undefined`(안 넘김)와 `null`(비우겠다는 뜻)을 가릅니다 — 둘 다 ReactNode라 값으로는 같아 보입니다. */
  const rightSlot = action === undefined ? <SettingsMenu label="글자 크기" /> : action;

  return (
    <header className={cx("flex items-start gap-3 pt-2", className)}>
      <div className="min-w-0 flex-1">
        <Heading
          id={id}
          className="text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink"
        >
          {title}
        </Heading>
        {subtitle && (
          <div className="mt-[3px] text-[0.7813rem] leading-[1.45] text-ink-muted">{subtitle}</div>
        )}
      </div>
      {rightSlot && <div className="flex-none">{rightSlot}</div>}
    </header>
  );
}

export default ScreenHeader;
