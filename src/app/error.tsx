"use client";

import { useEffect } from "react";
import { BigButton, Card, PageShell } from "@/components";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * 런타임 오류 화면.
 *
 * 오류가 났을 때에도 하단 고정 고지(안전 규칙 §3-2)와 응급 안내 경로가 남아 있어야 하므로
 * PageShell로 감쌉니다. 오류 원문은 화면에 그대로 노출하지 않습니다(내부 정보 노출 방지).
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // 데모 중 콘솔에서 원인을 확인할 수 있게만 남깁니다. 외부로 전송하지 않습니다.
    console.error(error);
  }, [error]);

  return (
    <PageShell
      eyebrow="오류"
      title="화면을 여는 중 문제가 생겼습니다"
      description="잠시 후 다시 시도해 주세요. 급하신 상황이라면 아래에서 응급 안내를 바로 여실 수 있습니다."
    >
      <Card tone="warn">
        <p className="text-base leading-relaxed text-ink">
          이 오류는 이 기기 안에서만 발생한 것이며, 저장된 훈련 기록에는 영향을 주지 않습니다.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <BigButton onClick={reset} size="lg" block>
            다시 시도하기
          </BigButton>
          <BigButton href="/emergency" size="lg" variant="danger" block>
            응급 안내 열기
          </BigButton>
          <BigButton href="/" size="lg" variant="secondary" block>
            홈으로 돌아가기
          </BigButton>
        </div>
      </Card>
    </PageShell>
  );
}
