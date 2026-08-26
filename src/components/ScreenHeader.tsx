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
   * 우측 액션 — 「닫기」처럼 조용한 텍스트 버튼만 둡니다.
   *
   * 설정 버튼은 이 자리를 **다투지 않습니다** — 액션을 넘겨도 설정은 그 왼쪽에 그대로 섭니다
   * (아래 컴포넌트 주석 참고). 오른쪽 자리를 통째로 비우려면 `action={null}`을 명시하세요 —
   * 인쇄되는 확인서처럼 조작이 나가면 안 되는 자리입니다.
   */
  action?: ReactNode;
  /**
   * 설정 버튼을 함께 세울지 (기본 `true`).
   *
   * `false`로 끄기 전에 한 번 더 생각하세요 — 이 값이 꺼진 화면에서는 글자를 키우려면
   * 화면을 나갔다 와야 합니다. `action={null}`을 준 화면에서는 이 값과 무관하게 서지 않습니다.
   */
  settings?: boolean;
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
 * ## 오른쪽 위에는 언제나 「설정」이 섭니다
 *
 * 글자가 작다고 느끼시는 순간은 대개 **지금 읽고 계신 화면**인데, 예전에는 진입점이 홈 상단 바와
 * 훈련 세션 헤더 둘뿐이라 응급 안내를 보다 작다고 느낀 분은 화면을 나가 홈까지 갔다가 돌아와야
 * 했습니다(평가 UI/UX m6). 주 사용자가 중고령이라고 적어 둔 앱에서 그 길은 사실상 막힌 길입니다.
 *
 * 그래서 설정을 `action`의 **기본값**으로 두었는데, 기본값은 액션을 넘기는 순간 사라집니다 —
 * 「닫기」를 세운 화면이 전부 옵트아웃됐고, 하필 그 셋(`/guide`·`/legal`·`/for-orgs`)이 앱에서
 * 가장 긴 문서 화면에 탭바도 없는 화면이었습니다. 나가야만 글자를 키울 수 있는 그 길이,
 * 고쳤다고 적어 둔 뒤에 되살아나 있었습니다(3차 페르소나 UI/UX med).
 *
 * 지금은 **자리를 다투지 않습니다**: 설정은 `settings`라는 제 슬롯을 갖고 기본으로 서며,
 * `action`은 그 오른쪽에 나란히 붙습니다. 액션을 넘겼다는 이유로 설정이 없어지는 길은
 * 이제 없습니다. 오른쪽을 통째로 비워야 하는 자리(인쇄되는 확인서 등)만 `action={null}`입니다.
 * 낱말은 전 화면 「설정」 하나입니다(`SettingsMenu` 주석 — 팝오버 안에 음성 빠르기·온라인 모드·
 * 「처음 오신 분께」가 함께 있어 「글자 크기」는 담긴 것보다 좁은 이름이었습니다).
 *
 * @example <ScreenHeader title="성장 기록" subtitle="점수와 등급은 없습니다 — 해 본 것과 다시 볼 것만 남깁니다" />
 * @example 닫기와 나란히 <ScreenHeader title="약관·개인정보" action={<DocCloseButton ... />} />
 * @example 오른쪽을 비울 때 <ScreenHeader title="이수 확인서" action={null} />
 */
export function ScreenHeader({
  title,
  subtitle,
  action,
  settings = true,
  as: Heading = "h1",
  className,
  id,
}: ScreenHeaderProps) {
  /* `undefined`(안 넘김)와 `null`(비우겠다는 뜻)을 가릅니다 — 둘 다 ReactNode라 값으로는 같아 보입니다.
     `null`은 「오른쪽 자리에 아무것도 내지 않겠다」는 뜻이라 설정까지 함께 끕니다. */
  const emptyRight = action === null;
  const showSettings = settings && !emptyRight;
  const hasRight = showSettings || (!emptyRight && Boolean(action));

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
      {hasRight && (
        /* 설정과 액션은 **한 줄에 나란히** 섭니다 — 둘 다 48px 텍스트 버튼이라 붙여 두면
           경계가 사라져, 사이는 좌우 패딩(px-1·px-2)이 만드는 여백에 맡깁니다. */
        <div className="flex flex-none items-center">
          {showSettings && (
            /* 팝오버를 어디에 맞출지는 **설정 버튼 오른쪽에 다른 것이 있는가**로 갈립니다
               (`SettingsMenu`의 `align` 주석과 같은 규칙). 혼자 설 때는 버튼이 곧 화면 오른쪽
               끝이라 버튼에 맞추면 되고, 「닫기」가 옆에 붙는 순간 버튼은 안쪽으로 48px 들어와
               320px 팝오버가 375px 화면의 왼쪽 밖으로 밀려납니다. */
            <SettingsMenu align={action ? "screen" : "trigger"} />
          )}
          {!emptyRight && action}
        </div>
      )}
    </header>
  );
}

export default ScreenHeader;
