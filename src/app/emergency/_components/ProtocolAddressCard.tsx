import { cx } from "@/components/utils";

export interface ProtocolAddressCardProps {
  address: string;
  className?: string;
}

/**
 * "주소를 말하세요. 화면에 있습니다" 단계에서 화면에 띄우는 주소 카드 (시안 6d · 가이드 §4.8).
 *
 * 이 단계에서 사용자가 할 일은 **화면을 보고 그대로 읽어 말하는 것**뿐입니다.
 * 그래서 주소를 설명문이 아니라 큰 글자로 직접 띄웁니다.
 *
 * 형태: 보더·그림자 없이 회색 면(`paper-2`) 한 장 · 라운드 14px · 좌정렬.
 * 머리말 「방문지 주소 · 훈련용 더미」 12px가 이 주소가 실제 방문지가 아님을 같은 줄에서 밝히고,
 * 그 아래 주소만 21px/800으로 큽니다 — 읽어야 할 글자 하나만 커 보이게 하는 것이 이 카드의 전부입니다.
 */
export function ProtocolAddressCard({ address, className }: ProtocolAddressCardProps) {
  return (
    <div className={cx("rounded-[14px] bg-paper-2 px-4 py-[14px]", className)}>
      <p className="text-[0.7813rem] leading-[1.45] text-ink-muted">방문지 주소 · 훈련용 더미</p>
      <p className="mt-[3px] text-[1.3125rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink">
        {address}
      </p>
    </div>
  );
}

export default ProtocolAddressCard;
