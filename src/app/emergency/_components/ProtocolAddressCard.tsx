import { cx } from "@/components/utils";

export interface ProtocolAddressCardProps {
  address: string;
  className?: string;
}

/**
 * "주소를 말하세요. 화면에 있습니다" 단계에서 화면에 띄우는 주소 카드 (시안 6d · 가이드 §4.8).
 *
 * 2026-08-25 위계 뒤집기. 예전에는 「방문지 주소 · 연습용 예시」 12px 머리말 아래에 예시 주소
 * `○○구 ○○로 00`이 21px/800으로 **가장 크게** 서 있었습니다. 그런데 앱은 이 화면을
 * 「근무 중 · 손이 급할 때」 쓰라고 권하고, 그 자리에서 음성은 「화면에 있습니다」라고
 * 단언합니다 — 진짜 상황에서 화면을 봤는데 동그라미만 있으면 그 2~3초가 119에 대고 말문이
 * 막히는 시간입니다(페르소나 현직 high).
 *
 * 그래서 카드에서 가장 큰 글자를 **지금 하실 일**로 바꿉니다. 예시 주소는 지우지 않고
 * 흐린 보조로 내려, 연습 때 무엇을 읽는 자리인지는 그대로 보이게 둡니다.
 *
 * **데이터는 건드리지 않습니다.** `src/data/protocols.ts`의 `TRAINING_ADDRESS`와 단계 음성은
 * 검수 문구라 이 배치의 소유 범위 밖이고, 바꾼 것은 이 카드가 화면에 세우는 위계뿐입니다.
 * (방문지 주소를 기기에 미리 저장하는 칸은 저장 항목이 하나 느는 일이라 이 배치에서 만들지
 *  않았습니다 — 약관의 저장 목록·안전 설계와 함께 정해야 하는 결정입니다.)
 *
 * 형태: 보더·그림자 없이 회색 면(`paper-2`) 한 장 · 라운드 14px · 좌정렬.
 */
export function ProtocolAddressCard({ address, className }: ProtocolAddressCardProps) {
  return (
    <div className={cx("rounded-[14px] bg-paper-2 px-4 py-[14px]", className)}>
      {/* 이 카드에서 가장 큰 글자 — 자막(29px) 다음으로 눈이 가는 자리입니다. */}
      <p className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
        실제 방문지 주소를 미리 확인해 적어 두세요
      </p>
      <p className="mt-[5px] text-[0.9375rem] leading-[1.6] text-ink-soft">
        지금 계신 곳 주소를 119에 그대로 말씀하시면 됩니다.
      </p>
      {/* 연습용 예시 — 지우지 않고 한 단 내립니다. 실제 주소가 아니라는 사실이 라벨과 톤
          양쪽에서 읽혀야 합니다. */}
      <p className="mt-[10px] text-[0.7813rem] leading-[1.45] text-tertiary">연습용 예시</p>
      <p className="mt-[2px] text-[0.9375rem] leading-[1.45] font-semibold text-ink-muted">
        {address}
      </p>
    </div>
  );
}

export default ProtocolAddressCard;
