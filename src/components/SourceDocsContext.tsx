"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SourceDoc } from "@/types";

/**
 * 근거 문서(화이트리스트) 목록을 트리 아래로 내려 주는 컨텍스트.
 *
 * 왜 컨텍스트인가:
 * - `SourceChip`은 docId만 받지만 화면에는 문서 제목을 보여야 합니다.
 * - 컴포넌트 안에 자체 매핑 상수를 두면 데이터(`src/data/docs.ts`)와 진실이 두 벌이 됩니다.
 *   그래서 매핑은 데이터 쪽에서 한 번만 주입하고, 컴포넌트는 조회만 합니다.
 * - 서버에서 내려준 값을 그대로 props로 전달하므로 하이드레이션 불일치가 없습니다.
 *
 * 기본값은 `PageShell`이 넣어 줍니다(`sourceDocsDefault.ts`).
 * 조회에 실패하면 `SourceChip`이 docId(또는 title prop)로 안전하게 대체 표기합니다.
 */
const SourceDocsContext = createContext<readonly SourceDoc[]>([]);

export interface SourceDocsProviderProps {
  docs?: readonly SourceDoc[];
  children: ReactNode;
}

export function SourceDocsProvider({ docs, children }: SourceDocsProviderProps) {
  const value = useMemo<readonly SourceDoc[]>(() => docs ?? [], [docs]);
  return <SourceDocsContext.Provider value={value}>{children}</SourceDocsContext.Provider>;
}

/** 등록된 근거 문서 전체 목록 */
export function useSourceDocs(): readonly SourceDoc[] {
  return useContext(SourceDocsContext);
}

/** docId로 근거 문서 1건 조회 — 없으면 undefined */
export function useSourceDoc(docId: string | undefined): SourceDoc | undefined {
  const docs = useSourceDocs();
  if (!docId) return undefined;
  return docs.find((d) => d.id === docId);
}

export default SourceDocsProvider;
