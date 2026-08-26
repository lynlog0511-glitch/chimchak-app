"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, cx } from "@/components";

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
 */
export function FirstVisitHint({ className }: FirstVisitHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const visited = window.localStorage.getItem(STORAGE_KEY);
      if (!visited) {
        setVisible(true);
      }
    } catch {
      // localStorage 접근 불가 환경(프라이빗 모드 등) — 안내 없이 조용히 넘어갑니다.
    }
  }, []);

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
       패딩도 같은 홈의 회색 카드들(「하던 훈련」·3계층 밴드 15/14px)과 한 단으로 맞췄습니다 —
       Card 기본값 p-5(20px)만 혼자 커서 카드 세 장이 서로 다른 폭의 여백을 갖고 있었습니다. */
    <Card tone="paper-2" padded={false} className={cx("px-[15px] py-[14px]", className)}>
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
          {/* 글자 크기 — 여는 곳까지 가리키는 **사실 문장**입니다. 여기에 버튼을 하나 더 세우지
              않는 이유는, 이 카드의 일이 「지금 누를 것」을 늘리는 게 아니라 화면에 이미 있는
              것을 알려 드리는 것이기 때문입니다(현직 high — 첫 화면 어디에도 글자를 키울 수
              있다는 말이 없었습니다). */}
          <p className="mt-1.5 chim-body text-ink-soft">
            글자가 작으시면 화면 오른쪽 위 「설정」에서 키우실 수 있어요.
          </p>
          {/* 남는 링크는 하나입니다 — 시작 대신 먼저 읽고 싶은 분을 위한 문. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4">
            <Link
              href="/guide"
              prefetch={false}
              className="chim-core-sm inline-flex min-h-[48px] items-center gap-1 font-semibold text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-soft hover:text-brand-800"
            >
              처음 오신 분께
              <span aria-hidden>›</span>
            </Link>
          </div>
        </div>

        {/* 아이콘 단독 금지(브리프 §4) — × 하나는 무엇이 닫히는지 말하지 못하고, 중고령 사용자에게는
            누를 것으로도 읽히지 않습니다. 글자로 적되 48px 타깃은 그대로 둡니다. */}
        <button
          type="button"
          onClick={handleClose}
          className="flex min-h-[48px] shrink-0 items-center justify-center rounded-chip px-3 text-[0.8438rem] leading-[1.45] font-semibold text-ink-muted transition-colors duration-150 ease-soft hover:bg-white hover:text-ink"
        >
          닫기
        </button>
      </div>
    </Card>
  );
}

const STORAGE_KEY = "chimchak.visited.v1";

export default FirstVisitHint;
