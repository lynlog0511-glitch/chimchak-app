"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Card, cx } from "@/components";
import {
  FONT_SCALE_OPTIONS,
  getSettings,
  setSetting,
  type FontScale,
} from "@/lib/settings";

export interface FirstVisitHintProps {
  /** 카드에 붙는 클래스 — 홈이 위아래 간격을 잡습니다(숨었을 때는 그 간격도 생기지 않습니다). */
  className?: string;
}

/**
 * 첫 방문에만 보이는 조용한 안내 카드 — 모달·투어 대신 히어로 CTA 바로 아래 한 줄.
 * v3 §1-2(액센트 바 금지)를 지켜 paper-2 면 하나로만 구분합니다.
 *
 * 서버 컴포넌트인 page.tsx의 첫 렌더와 수화 결과를 맞추기 위해,
 * 마운트 전에는 항상 `null`을 반환하고 `useEffect`에서만 localStorage를 확인합니다.
 *
 * 홈(`app/page.tsx`)의 CTA 두 개 아래·「하던 훈련」 위에 한 번만 마운트합니다.
 * 한동안 어디에도 붙어 있지 않아 「마이크 없이 버튼만으로 4분」이라는 약속이 홈에서
 * 한 글자도 보이지 않았습니다(평가 초보 mi41 — 죽은 코드).
 *
 * 2026-08-25: 「바로 시작하기」를 뺐습니다. 시작하는 문은 바로 위 히어로 CTA 하나로 좁히고,
 * 이 카드에는 그 버튼이 못 하는 말 둘만 남깁니다 — 마이크 없이도 된다는 사실과 글자 크기를
 * 어디서 키우는지. (페르소나 검증 — 교육생 med · UI/UX low · 현직 high)
 *
 * 2026-08-26: 글자 크기 안내에 **손잡이**를 붙였습니다(「설정 열기」). 새 목적지가 아니라
 * 오른쪽 위 설정 버튼을 대신 누르는 버튼이었습니다.
 *
 * ── 2026-08-27: 손잡이 대신 **3버튼 한 탭** ──────────────────
 * 현직 요양보호사 페르소나가 세 라운드 연속으로 낸 항목입니다(3차 high · 5차 P2 · 7차 P2).
 * 기각된 두 가지는 그대로 기각입니다 — **모달**(첫 화면이 사람을 멈춰 세우는 자리는 이 앱에서
 * ⚑CF 하나뿐입니다)과 **기본값 변경**(설정.ts:62는 「표준」이고, 브라우저·OS 글꼴 설정 위에
 * 곱해지는 백분율이라 기본값을 올리면 이미 크게 써 오신 분에게 두 번 곱해집니다).
 * 남은 것은 「지금 이 자리에서 한 번에 되는가」였고, 손잡이는 그 답이 절반이었습니다 —
 * 팝오버가 열리면 세 절(글자 크기·음성 빠르기·온라인 모드)이 한꺼번에 서고, 처음 오신 분은
 * 그중 첫 절을 스스로 찾아야 합니다. 그래서 **고르는 세 칸을 카드 안으로** 올립니다.
 *
 * 손잡이는 함께 걷었습니다 — 3버튼이 서면 같은 카드에서 같은 일을 하는 문이 둘이 되고,
 * 그 상태는 이 카드가 처음부터 피하려던 것(「어느 쪽을 누르라는 거지」)과 같은 모양입니다.
 * 나중에 다시 바꿀 자리는 문장이 그대로 가리킵니다(오른쪽 위 「설정」).
 * 저장 경로는 설정 팝오버와 **같은 함수**입니다(`setSetting("fontScale", …)`) — 고르는 즉시
 * 루트 font-size가 바뀌고 저장됩니다. 새 저장 키도, 새 팝오버도 만들지 않습니다.
 */
export function FirstVisitHint({ className }: FirstVisitHintProps) {
  const fontLabelId = useId();
  const [visible, setVisible] = useState(false);
  /** 지금 고른 글자 크기 — 서버 렌더에서는 읽을 수 없으므로 기본값으로 시작합니다. */
  const [fontScale, setFontScale] = useState<FontScale>("standard");
  /** 고른 결과를 낭독으로 전하는 한 줄 — 화면에는 이미 눌린 칸이 보입니다. */
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const visited = window.localStorage.getItem(STORAGE_KEY);
      if (!visited) {
        setVisible(true);
      }
    } catch {
      // localStorage 접근 불가 환경(프라이빗 모드 등) — 안내 없이 조용히 넘어갑니다.
    }
    setFontScale(getSettings().fontScale);
  }, []);

  /**
   * 글자 크기를 그 자리에서 바꿉니다 — **설정 팝오버와 같은 경로**입니다.
   *
   * `setSetting`이 저장·적용·구독자 통지를 한 번에 하므로, 누르는 즉시 화면 전체가 비례해
   * 커집니다(토큰이 남김없이 rem입니다). 헤더의 설정 팝오버를 열어 두신 상태라면 그쪽 칸도
   * 같은 순간에 따라옵니다(`subscribeSettings`).
   */
  const chooseFontScale = (value: FontScale) => {
    setFontScale(setSetting("fontScale", value).fontScale);
    /* 조사를 붙이지 않습니다 — 세 낱말(표준·크게·아주 크게)의 받침이 갈려 「표준로」·「크게으로」
       중 하나가 반드시 틀립니다. 문장을 끊는 편이 규칙을 만드는 것보다 쌉니다. */
    const label = FONT_SCALE_OPTIONS.find((option) => option.value === value)?.label ?? "";
    setNotice(`글자 크기 ${label}. 화면에 바로 반영했습니다.`);
  };

  const handleClose = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 저장에 실패해도 화면은 이미 닫혔습니다 — 다음 방문에 한 번 더 보일 뿐입니다.
    }
  };

  if (!visible) {
    return null;
  }

  return (
    /* 여백은 부모가 잡습니다 — 이 카드는 있다가 없어지는 카드라, 자기 margin을 들고 있으면
       사라진 날에도 그 자리에 간격이 남거나(또는 겹쳐서) 첫 화면 리듬이 방문마다 달라집니다.
       패딩도 같은 홈의 회색 카드들(「하던 훈련」·안전 설계 카드)과 한 단으로 맞췄습니다 —
       Card 기본값 p-5(20px)만 혼자 커서 카드 세 장이 서로 다른 폭의 여백을 갖고 있었습니다.
       좌우는 **rem 한 값**입니다(px-4 = 1rem). 2026-08-26에 세 장 모두 px-[15px]에서 옮겼습니다 —
       px로 굳어 있으면 「아주 크게」(125%)에서 rem 카드만 20px로 자라고 이 카드는 15px에 멈춰,
       세로로 쌓인 카드들의 글자 왼쪽 끝이 어긋납니다(페르소나 디자이너 med). */
    <Card tone="paper-2" padded={false} className={cx("px-4 py-[14px]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* 「마이크 없이 버튼만으로」는 각주가 아니라 이 앱을 처음 여는 사람을 붙잡아 두는
              약속입니다 — 가이드 §7-8의 가독 하한을 넘겨 chim-body(16px)로 둡니다.
              시작하는 자리를 여기서 또 권하지 않습니다: 바로 위 히어로 CTA가 같은 곳으로 가는
              문이라, 3cm 간격으로 같은 목적지가 두 번 서 있으면 처음 오신 분이 「어느 쪽을
              누르라는 거지」에서 멈춥니다(페르소나 교육생 med). 이 카드는 히어로가 못 하는 말
              둘만 맡습니다 — 마이크가 없어도 된다는 사실과, 글자를 키울 수 있다는 사실. */}
          <p className="chim-body text-ink-soft">
            마이크 없이 버튼만으로 4분이면 끝나요.
          </p>
        </div>

        {/* 아이콘 단독 금지(브리프 §4) — × 하나는 무엇이 닫히는지 말하지 못하고, 중고령 사용자에게는
            누를 것으로도 읽히지 않습니다. 글자로 적되 48px 타깃은 그대로 둡니다. */}
        <button
          type="button"
          onClick={handleClose}
          className="flex min-h-[48px] shrink-0 items-center justify-center rounded-chip px-3 text-[0.8438rem] leading-[1.45] font-semibold text-ink-muted transition-colors duration-150 ease-soft hover:bg-paper hover:text-ink"
        >
          닫기
        </button>
      </div>

      {/* 글자 크기 — **여기서 바로 고릅니다**(현직 high, 3라운드 연속 요청).
          한동안 사실 문장 한 줄이었고, 6차에 그 문장의 손잡이(「설정 열기」)를 붙였습니다.
          그런데 그 문이 여는 팝오버에는 절이 셋이라, 처음 오신 분은 그중 첫 절을 스스로 찾아야
          했습니다. 이 카드가 붙잡아 두어야 하는 분에게는 그 한 걸음이 마지막 걸음입니다.
          그래서 고르는 세 칸을 이 자리로 올립니다 — 저장 경로는 팝오버와 같은 함수입니다.

          「닫기」와 같은 줄에 두지 않고 **카드 전폭**으로 내리는 이유는 폭입니다. 세 칸이 왼쪽
          칸 안에 있으면 375px에서 각 74px이라 「아주 크게」가 두 줄로 접힙니다. 전폭이면 96px로
          한 줄에 섭니다(「아주 크게」는 chim-label 15px에서 약 76px). */}
      <p id={fontLabelId} className="mt-2 chim-body text-ink-soft">
        글자가 작으시면 지금 바꾸실 수 있어요.
      </p>
      <div role="group" aria-labelledby={fontLabelId} className="mt-1.5 flex gap-2">
        {FONT_SCALE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => chooseFontScale(option.value)}
            aria-pressed={fontScale === option.value}
            /* 설정 팝오버의 칸과 **같은 문법**입니다(`SettingsMenu`의 `OptionButton`) —
               고른 칸은 틸 채움, 나머지는 흰 면. 이 카드가 회색 면 위에 있어 비활성 칸만
               `bg-paper`로 갈라 둡니다(팝오버는 흰 면 위라 `bg-paper-2`를 씁니다).
               `flex-1`이라 폭은 저절로 48px을 넘습니다. */
            className={cx(
              "chim-label min-h-[48px] flex-1 rounded-card px-2",
              "transition-colors duration-150 ease-soft",
              fontScale === option.value
                ? "bg-brand-700 font-bold text-paper active:bg-brand-800"
                : "bg-paper text-ink active:bg-neutral-line",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {/* 리전은 늘 그려 둡니다 — 눌린 칸은 눈으로 보이지만, 낭독으로도 결과가 닿아야 합니다. */}
      <p role="status" className="sr-only">
        {notice}
      </p>
      <p className="mt-1.5 chim-caption text-ink-muted">
        나중에 바꾸실 때는 화면 오른쪽 위 「설정」에 같은 칸이 있어요.
      </p>
      {/* 먼저 읽고 싶은 분을 위한 문 하나 — 시작하는 자리는 이 카드 위 히어로 CTA입니다. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4">
        <Link
          href="/guide"
          prefetch={false}
          className="chim-core-sm inline-flex min-h-[48px] items-center gap-1 font-semibold text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-soft hover:text-brand-800"
        >
          처음 오신 분께
          <span aria-hidden>›</span>
        </Link>
      </div>
    </Card>
  );
}

const STORAGE_KEY = "chimchak.visited.v1";

export default FirstVisitHint;
