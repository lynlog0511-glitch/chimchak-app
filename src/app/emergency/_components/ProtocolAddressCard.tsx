"use client";

import { useEffect, useId, useState } from "react";
import { cx } from "@/components/utils";
import {
  MAX_VISIT_ADDRESS_LEN,
  SAVE_FAILED_TITLE,
  clearVisitAddress,
  loadVisitAddress,
  normalizeVisitAddress,
  saveVisitAddress,
} from "@/lib/storage";

export interface ProtocolAddressCardProps {
  /**
   * 데이터의 연습용 예시 주소(`protocols.ts`의 `TRAINING_ADDRESS`).
   *
   * **화면에 그리지 않습니다.** 저장해 두신 주소가 없을 때 이 자리에 세울 것은 예시가 아니라
   * 적으실 칸이라, 이 값은 카드가 쓰지 않습니다.
   *
   * 2026-08-25 선택 프로퍼티로 내렸습니다 — 훈련 쪽 호출부(`ProtocolInline`)는 넘기기를
   * 그만두었고, 응급 쪽(`ProtocolPlayer`)은 아직 `step.address`를 넘기고 있습니다.
   * 두 호출부가 모두 손을 떼면 이 줄을 지웁니다.
   */
  address?: string;
  /**
   * 읽기 전용 — **훈련 세션 안**에서만 참입니다.
   *
   * 훈련 중에 이 카드가 서는 것은 연습이고, 그 자리에서 실제 방문지 주소를 적어 넣게 하면
   * 「지금 하는 것이 연습인가 진짜인가」가 섞입니다. 적어 두신 주소가 있으면 그대로 보여 드리고
   * (급할 때 무엇이 뜨는지 연습에서 미리 보는 것이 이 카드의 값입니다), 없으면 적으실 칸 대신
   * 어디에서 적을 수 있는지 한 줄만 답니다. 저장·수정·삭제는 응급 화면 한 곳에서만 일어납니다.
   */
  readOnly?: boolean;
  className?: string;
}

/** 카드 겉면 — 보더·그림자 없이 회색 면(`paper-2`) 한 장 · 라운드 14px · 좌정렬. */
const SHELL = "rounded-card bg-paper-2 px-4 py-[14px]";

const INPUT =
  "mt-[10px] min-h-[48px] w-full rounded-card border border-line-strong bg-white px-[13px] " +
  /* 자리 문구는 지문 색(ink-faint) — 이 앱의 다른 입력 칸과 같은 단입니다. */
  "text-[0.9375rem] leading-[1.6] text-ink placeholder:text-ink-faint";

const SAVE_BUTTON =
  "flex min-h-[48px] flex-1 items-center justify-center rounded-card bg-brand-700 px-3 " +
  "text-[0.9375rem] font-bold text-white transition-colors duration-150 active:bg-brand-800 " +
  "disabled:cursor-not-allowed disabled:opacity-45";

const OUTLINE_BUTTON =
  "flex min-h-[48px] items-center justify-center rounded-card border border-line-strong bg-paper px-4 " +
  "text-[0.9375rem] font-semibold text-ink-soft transition-colors duration-150 active:bg-paper-2";

const QUIET_BUTTON =
  "mt-[6px] flex min-h-[48px] items-center rounded-field px-1 text-[0.8438rem] font-semibold " +
  "text-ink-muted transition-colors duration-150 active:bg-paper-2";

/**
 * 주소 단계에서 화면에 띄우는 방문지 주소 카드 (시안 6d · 가이드 §4.8).
 *
 * 이 카드가 서는 자리의 음성은 「지금 계신 곳 주소를 119에 말씀하세요」입니다. 그 순간 화면이
 * 해야 할 일은 하나뿐입니다 — 불러 줄 주소를 크게 보여 주는 것. 예전에는 그 자리에 연습용
 * 예시 주소 `○○구 ○○로 00`이 서 있었고, 진짜 상황에서 화면을 봤는데 동그라미만 있는 2~3초는
 * 119에 대고 말문이 막히는 시간이었습니다(페르소나 현직 P0).
 *
 * 2026-08-25 방문지 주소 저장 칸을 들였습니다.
 * - **적어 두셨으면** 그 주소를 이 카드에서 가장 큰 글자로 세우고 「고치기」만 답니다.
 * - **아직이면** 예시를 세우는 대신 적으실 칸을 엽니다. 연습용 예시 주소는 저장 전에는
 *   화면 어디에도 나오지 않습니다 — 급할 때 가짜 주소를 읽게 되는 길을 아예 없앱니다.
 *
 * 주소는 이 기기(localStorage `chimchak.address.v1`)에만 남고 어디로도 전송되지 않습니다.
 * 저장·수정·삭제가 전부 이 카드 안에서 끝납니다(`src/lib/storage.ts`의 세 함수).
 *
 * 수화 안전: 서버 렌더와 첫 페인트는 저장소를 읽을 수 없으므로 마운트 전에는 아무것도 그리지
 * 않습니다. 「확인 중」 같은 중간 상태를 두지 않는 이유는, 그 한 프레임이 「적어 두세요」로
 * 보였다가 주소로 바뀌면 급할 때 눈이 두 번 가기 때문입니다.
 */
export function ProtocolAddressCard({ readOnly = false, className }: ProtocolAddressCardProps) {
  const inputId = useId();
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSaved(loadVisitAddress());
    setReady(true);
  }, []);

  if (!ready) return null;

  const handleSave = (): void => {
    const value = normalizeVisitAddress(draft);
    if (value.length === 0) return;
    if (!saveVisitAddress(value)) {
      setFailed(true);
      return;
    }
    setSaved(value);
    setDraft("");
    setEditing(false);
    setFailed(false);
  };

  const handleClear = (): void => {
    clearVisitAddress();
    setSaved("");
    setDraft("");
    setEditing(false);
    setFailed(false);
  };

  /* 훈련 세션 안 — 보여 주기만 합니다. 고치는 문은 응급 화면 한 곳에만 둡니다. */
  if (readOnly) {
    return (
      <div className={cx(SHELL, className)}>
        <p className="text-[0.7813rem] leading-[1.45] text-ink-faint">방문지 주소</p>
        {saved.length > 0 ? (
          <p className="mt-[4px] text-[1.375rem] leading-[1.3] font-extrabold text-ink">{saved}</p>
        ) : (
          /* 연습 중에 적어 넣게 하지 않습니다 — 여기서 적은 것이 진짜로 남는지 아닌지가
             그 순간 화면에서 분명하지 않습니다. 어디에서 적을 수 있는지만 알려 드립니다. */
          <p className="mt-[4px] text-[0.9375rem] leading-[1.6] text-ink-soft">
            응급 화면에서 미리 적어 두실 수 있어요. 적어 두시면 이 자리에 큰 글씨로 뜹니다.
          </p>
        )}
      </div>
    );
  }

  /* 적어 두신 주소가 있고 고치는 중이 아닐 때 — 이 카드가 하는 일은 크게 보여 주는 것뿐입니다. */
  if (saved.length > 0 && !editing) {
    return (
      <div className={cx(SHELL, className)}>
        <p className="text-[0.7813rem] leading-[1.45] text-ink-faint">방문지 주소</p>
        {/* 카드에서 가장 큰 글자 — 자막(29px) 다음으로 눈이 가는 자리입니다. */}
        <p className="mt-[4px] text-[1.375rem] leading-[1.3] font-extrabold text-ink">{saved}</p>
        {/* 버튼은 내용 폭만 차지합니다 — 이 카드에서 눈이 먼저 닿아야 할 것은 주소입니다. */}
        <div className="mt-[10px] flex">
          <button
            type="button"
            onClick={() => {
              setDraft(saved);
              setEditing(true);
            }}
            className={OUTLINE_BUTTON}
          >
            고치기
          </button>
        </div>
      </div>
    );
  }

  const editingSaved = saved.length > 0;

  return (
    <div className={cx(SHELL, className)}>
      <label
        htmlFor={inputId}
        className="block text-[1.0625rem] leading-[1.45] font-bold text-ink"
      >
        {editingSaved ? "방문지 주소 고치기" : "실제 방문지 주소를 미리 적어 두세요"}
      </label>
      <p className="mt-[5px] text-[0.9375rem] leading-[1.6] text-ink-soft">
        적어 두시면 급할 때 이 자리에 큰 글씨로 뜹니다. 이 기기에만 남고 어디로도 전송되지
        않습니다.
      </p>
      <input
        id={inputId}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={MAX_VISIT_ADDRESS_LEN}
        autoComplete="off"
        placeholder="도로명 주소와 동·호수"
        className={INPUT}
      />
      <div className="mt-[10px] flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={normalizeVisitAddress(draft).length === 0}
          className={SAVE_BUTTON}
        >
          저장
        </button>
        {editingSaved && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(false);
              setFailed(false);
            }}
            className={OUTLINE_BUTTON}
          >
            취소
          </button>
        )}
      </div>
      {editingSaved && (
        <button type="button" onClick={handleClear} className={QUIET_BUTTON}>
          적어 둔 주소 지우기
        </button>
      )}
      {/* 저장이 막힌 브라우저에서 「저장했습니다」라고 말하지 않습니다(storage.ts와 같은 규율). */}
      {failed && (
        <p className="mt-[6px] text-[0.7813rem] leading-[1.6] font-bold text-danger-ink">
          {SAVE_FAILED_TITLE}
        </p>
      )}
    </div>
  );
}

/**
 * 응급 목록(`/emergency`) 상단의 조용한 한 줄 — 방문지 주소를 아직 적어 두지 않으셨을 때만.
 *
 * 응급 안내를 여는 순간은 주소를 적어 둘 순간이 아닙니다. 그래서 미리 적어 둘 수 있다는 사실을
 * 목록 화면에서 한 번 알려 드리고, 적어 두신 뒤에는 이 줄이 사라집니다. 화면을 여는 목적
 * (다섯 개 중 지금 상황 하나 고르기)을 가리지 않도록 12.5px 한 문단으로만 둡니다.
 */
export function ProtocolAddressHint({ className }: { className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(loadVisitAddress().length === 0);
  }, []);

  if (!show) return null;

  return (
    <p
      className={cx(
        "text-[0.7813rem] leading-[1.6] text-ink-muted",
        className,
      )}
    >
      응급 때 부르실 방문지 주소를 미리 적어 두시면 주소 단계에서 바로 보입니다. 아래 안내를 열어
      주소 단계에서 적으실 수 있습니다.
    </p>
  );
}

export default ProtocolAddressCard;
