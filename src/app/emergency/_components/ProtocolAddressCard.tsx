import { PROTOCOL_ADDRESS_NOTICE } from "@/data/protocols";

export interface ProtocolAddressCardProps {
  address: string;
  className?: string;
}

/**
 * "주소를 말하세요. 화면에 있습니다" 단계에서 화면에 띄우는 주소 카드.
 *
 * 이 단계에서 사용자가 할 일은 **화면을 보고 그대로 읽어 말하는 것**뿐입니다.
 * 그래서 주소를 설명문이 아니라 큰 글자로 직접 띄우고, 바로 아래에
 * 훈련용 더미 주소라는 고지를 붙여 실제 방문지 주소로 오해하지 않게 합니다.
 *
 * 형태(v4 §2): 보더·그림자 없이 옅은 틸 면(`#e7f4f2`) 한 장 · 라운드 14px.
 * 주소는 자막에 준하는 **코어 콘텐츠**라 26px를 유지하고, 머리말과 고지는 12px로 낮춰
 * 읽어야 할 글자 하나만 커 보이게 합니다.
 */
export function ProtocolAddressCard({ address, className }: ProtocolAddressCardProps) {
  return (
    <div
      className={["mt-4 rounded-[14px] bg-tint px-4 py-5 text-center", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-[12px] leading-[1.5] font-bold tracking-[0.06em] text-brand-800">
        읽어 말씀하실 주소
      </p>
      <p className="mt-2 text-[26px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">
        {address}
      </p>
      <p className="mt-2 text-[12px] leading-[1.5] font-semibold text-warn-ink">
        {PROTOCOL_ADDRESS_NOTICE}
      </p>
    </div>
  );
}

export default ProtocolAddressCard;
