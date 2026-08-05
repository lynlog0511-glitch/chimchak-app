import { IconAlert } from "@/components/icons";
import { PROTOCOL_ADDRESS_NOTICE } from "@/data/protocols";

export interface ProtocolAddressCardProps {
  address: string;
  className?: string;
}

/**
 * "주소를 말하세요. 화면에 있습니다" 단계에서 화면에 띄우는 주소 카드.
 *
 * 이 단계에서 사용자가 할 일은 **화면을 보고 그대로 읽어 말하는 것**뿐입니다.
 * 그래서 주소를 설명문이 아니라 대형 글자로 직접 띄우고, 바로 옆에
 * 훈련용 더미 주소라는 고지를 붙여 실제 방문지 주소로 오해하지 않게 합니다.
 *
 * 크기(v3 §3): 주소는 자막에 준하는 **코어 콘텐츠**라 28px(모바일)/36px(md↑)를 유지합니다.
 * 머리말과 고지는 UI 크롬이므로 15px·13px로 낮춰, 읽어야 할 글자 하나만 커 보이게 합니다.
 * 보더는 두르지 않습니다 — 옅은 브랜드 면 하나로 구분합니다(§1-4·§7).
 */
export function ProtocolAddressCard({ address, className }: ProtocolAddressCardProps) {
  return (
    <div
      className={["mt-4 rounded-card bg-brand-50 px-4 py-5 text-center", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="chim-label text-brand-800">읽어 말씀하실 주소</p>
      <p className="mt-2 text-[1.75rem] leading-snug font-extrabold tracking-tight text-ink md:text-[2.25rem]">
        {address}
      </p>
      <p className="chim-caption mt-3 flex items-center justify-center gap-1.5 font-semibold text-warn-ink">
        <IconAlert className="h-4 w-4 shrink-0" />
        {PROTOCOL_ADDRESS_NOTICE}
      </p>
    </div>
  );
}

export default ProtocolAddressCard;
