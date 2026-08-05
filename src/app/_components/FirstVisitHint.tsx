"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components";
import { IconArrowRight, IconX } from "@/components/icons";

/**
 * 첫 방문에만 보이는 조용한 안내 카드 — 모달·투어 대신 히어로 CTA 바로 아래 한 줄.
 * v3 §1-2(액센트 바 금지)를 지켜 paper-2 면 하나로만 구분합니다.
 *
 * 서버 컴포넌트인 page.tsx의 첫 렌더와 수화 결과를 맞추기 위해,
 * 마운트 전에는 항상 `null`을 반환하고 `useEffect`에서만 localStorage를 확인합니다.
 */
export function FirstVisitHint() {
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
    <Card tone="quiet" className="mt-6 md:mt-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="chim-meta text-ink-soft">
            처음이시라면 훈련 모드의 「현관 앞, 집에 가야 해요」부터 시작해 보세요. 마이크 없이
            버튼만으로 4분이면 끝납니다.
          </p>
          <Link
            href="/train/chk-a01"
            className="chim-core-sm mt-2 inline-flex min-h-[48px] items-center gap-1.5 font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
          >
            바로 시작하기
            <IconArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label="닫기"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-chip text-ink-muted transition-colors duration-150 ease-soft hover:bg-white hover:text-ink"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

const STORAGE_KEY = "chimchak.visited.v1";

export default FirstVisitHint;
