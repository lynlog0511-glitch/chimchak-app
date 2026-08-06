/**
 * 회귀 검사 러너 설정 — `npm test`.
 *
 * 대상은 순수 함수(엔진·데이터·저장소)뿐이라 브라우저 환경(jsdom)을 쓰지 않는다.
 * localStorage가 필요한 저장소 테스트는 파일 안에서 최소 스텁을 직접 심는다.
 * (의존성을 늘리지 않는 쪽이 오프라인 시연 준비에 유리하다.)
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 앱과 같은 경로 별칭(@/*)을 써야 테스트가 실제 import 경로를 그대로 검증한다.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
