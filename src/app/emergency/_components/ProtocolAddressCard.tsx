import { Badge } from "@/components";
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
 */
export function ProtocolAddressCard({ address, className }: ProtocolAddressCardProps) {
  return (
    <div
      className={[
        "mt-4 rounded-card border border-brand-300 bg-brand-50 px-4 py-4 text-center",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-base font-bold text-brand-800">읽어 말씀하실 주소</p>
      <p className="mt-2 text-2xl leading-snug font-extrabold tracking-tight text-ink md:text-3xl">
        {address}
      </p>
      <div className="mt-3 flex justify-center">
        <Badge tone="warn" className="max-w-full whitespace-normal">
          {PROTOCOL_ADDRESS_NOTICE}
        </Badge>
      </div>
    </div>
  );
}

export default ProtocolAddressCard;
