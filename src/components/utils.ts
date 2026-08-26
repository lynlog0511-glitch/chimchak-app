/**
 * 클래스명 결합 헬퍼.
 * 외부 패키지(clsx 등)를 추가하지 않기 위한 최소 구현입니다.
 *
 * @example cx("p-4", isOpen && "bg-paper") // "p-4 bg-paper"
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
