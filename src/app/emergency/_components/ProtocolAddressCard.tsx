"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EyebrowLabel, cx } from "@/components";
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
   * 훈련 세션 안인지 — 적어 두신 주소가 **없을 때 세우는 한 줄**만 가릅니다.
   *
   * 이 카드는 어느 자리에서나 **표시 전용**입니다. 재생 중에는 화면이 사람에게 타자를 시키지
   * 않습니다(2026-08-26). 갈리는 것은 빈 자리의 말 한 줄뿐입니다.
   * - 참(훈련 세션) — 연습 중이므로 **어디에서 적을 수 있는지**를 알려 드립니다.
   * - 거짓(실전 응급 재생) — 지금 당장 하실 일 한 줄만 세웁니다. 그 순간에 「미리 적어
   *   두세요」라고 권하는 것은 이미 늦은 말이라, 재생 화면에서는 하지 않습니다.
   */
  session?: boolean;
  className?: string;
}

/** 카드 겉면 — 보더·그림자 없이 회색 면(`paper-2`) 한 장 · 라운드 14px · 좌정렬. */
const SHELL = "rounded-card bg-paper-2 px-4 py-[14px]";

/* 입력 글자는 17px(코어 단)입니다 — 16px 미만이면 iOS가 포커스 순간 화면을 강제로 확대하고,
   그 확대는 손가락으로 되돌려야 합니다(/report 초안 폼이 같은 이유로 17px입니다). */
const INPUT =
  "mt-[10px] min-h-[48px] w-full rounded-card border border-line-strong bg-paper px-[13px] " +
  /* 자리 문구는 지문 색(ink-faint) — 이 앱의 다른 입력 칸과 같은 단입니다. */
  "text-[1.0625rem] leading-[1.6] text-ink placeholder:text-ink-faint";

const SAVE_BUTTON =
  "flex min-h-[48px] flex-1 items-center justify-center rounded-card bg-brand-700 px-3 " +
  "text-[0.9375rem] font-bold text-paper transition-colors duration-150 active:bg-brand-800 " +
  "disabled:cursor-not-allowed disabled:opacity-45";

const OUTLINE_BUTTON =
  "flex min-h-[48px] items-center justify-center rounded-card border border-line-strong bg-paper px-4 " +
  "text-[0.9375rem] font-semibold text-ink-soft transition-colors duration-150 active:bg-paper-2";

const QUIET_BUTTON =
  "mt-[6px] flex min-h-[48px] items-center rounded-field px-1 text-[0.8438rem] font-semibold " +
  "text-ink-muted transition-colors duration-150 active:bg-paper-2";

/** 저장·지우기 결과를 낭독으로 전하는 한 줄 — 화면에는 늘지 않습니다. */
const SAVED_NOTICE = "방문지 주소를 이 기기에 저장했습니다.";
const CLEARED_NOTICE = "적어 둔 방문지 주소를 지웠습니다.";

/**
 * 이 기기에 적어 둔 방문지 주소를 읽어 오는 한 벌.
 *
 * 카드(`ProtocolAddressCard`)와 **재생 화면**(`ProtocolPlayer`)이 같은 값을 봅니다. 재생
 * 화면이 이 값을 알아야 하는 이유는 하나입니다 — 주소 단계의 화면 보조 문구가
 * 「적어 두신 …**있으면**」으로 시작하는 조건절이라, 적어 두지 않으신 기기에서는 바로 아래
 * 카드의 「적어 두신 주소가 **없으면**」과 조건절 둘이 나란히 서기 때문입니다.
 * 29px 자막 아래에서 조건절 두 개를 읽는 것은 그 순간에 하실 수 있는 일이 아닙니다
 * (5차 페르소나 현직 low).
 *
 * 수화 안전: 서버 렌더와 첫 페인트는 저장소를 읽을 수 없으므로 `ready` 전에는 「없음」과
 * 구별되지 않습니다. 두 소비처 모두 그동안 아무것도 그리지 않는 쪽을 고릅니다 —
 * 한 프레임 다른 문장을 보였다가 바꾸면 급할 때 눈이 두 번 갑니다.
 */
export function useSavedVisitAddress(): { ready: boolean; saved: string } {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setSaved(loadVisitAddress());
    setReady(true);
  }, []);

  return { ready, saved };
}

/**
 * 주소 단계에서 화면에 띄우는 방문지 주소 카드 (시안 6d · 가이드 §4.8) — **표시 전용**입니다.
 *
 * 이 카드가 서는 자리의 음성은 「지금 계신 곳 주소를 119에 말씀하세요」입니다. 그 순간 화면이
 * 해야 할 일은 하나뿐입니다 — 불러 줄 주소를 크게 보여 주는 것. 예전에는 그 자리에 연습용
 * 예시 주소 `○○구 ○○로 00`이 서 있었고, 진짜 상황에서 화면을 봤는데 동그라미만 있는 2~3초는
 * 119에 대고 말문이 막히는 시간이었습니다(페르소나 현직 P0).
 *
 * 2026-08-25 저장 칸을 이 카드 안에 들였다가, 2026-08-26 **도로 걷어냈습니다**. 저장 칸이
 * 열리는 자리가 재생 중인 주소 단계 한 곳뿐이었는데 그 단계는 4초쯤 뒤 자동으로 넘어가고
 * (`useProtocolPlayback`), 무엇보다 어르신이 사레들려 계신 앞에서 화면이 도로명 주소를 타자로
 * 치라고 하는 것 자체가 틀린 요구였습니다(페르소나 현직 P0 둘째). 적어 두는 자리는 재생 밖
 * — `/emergency` 목록 화면의 `ProtocolAddressPanel` 한 곳입니다.
 *
 * 그래서 이 카드가 그리는 것은 두 가지뿐입니다.
 * - **적어 두셨으면** 그 주소를 이 카드에서 가장 큰 글자로 세웁니다.
 * - **아직이면** 지금 하실 일 한 줄(실전) 또는 어디에서 적을 수 있는지 한 줄(훈련)만 답니다.
 *   연습용 예시 주소는 화면 어디에도 나오지 않습니다 — 급할 때 가짜 주소를 읽게 되는 길을
 *   아예 없앱니다.
 *
 * 주소는 이 기기(localStorage `chimchak.address.v1`)에만 남고 어디로도 전송되지 않습니다.
 *
 * 수화 안전: 서버 렌더와 첫 페인트는 저장소를 읽을 수 없으므로 마운트 전에는 아무것도 그리지
 * 않습니다. 「확인 중」 같은 중간 상태를 두지 않는 이유는, 그 한 프레임이 「적어 두세요」로
 * 보였다가 주소로 바뀌면 급할 때 눈이 두 번 가기 때문입니다.
 */
export function ProtocolAddressCard({ session = false, className }: ProtocolAddressCardProps) {
  const { ready, saved } = useSavedVisitAddress();

  if (!ready) return null;

  return (
    <div className={cx(SHELL, className)}>
      {/* 아래 목록 화면(`ProtocolAddressPanel`)의 같은 이름표와 **한 벌**입니다 — 사용자가
          오가며 같은 넉 자를 보는 두 화면이라, 한 파일 안에서 두 벌로 적지 않습니다.
          (2026-08-27: 여기만 400/자간 0/ink-faint 손수 사본이었습니다 — 5차에 「먼저 이것부터」로
           이름까지 댄 자리인데, 게이트 ⑮가 자간을 키로 삼아 이 형태를 못 세고 있었습니다.
           게이트도 함께 넓혔습니다 — 7차 페르소나 디자이너 P0.) */}
      <EyebrowLabel>방문지 주소</EyebrowLabel>
      {saved.length > 0 ? (
        /* 카드에서 가장 큰 글자 — 자막(29px) 다음으로 눈이 가는 자리입니다. */
        <p className="mt-[4px] text-[1.375rem] leading-[1.3] font-extrabold text-ink">{saved}</p>
      ) : session ? (
        /* 연습 중에 적어 넣게 하지 않습니다 — 여기서 적은 것이 진짜로 남는지 아닌지가
           그 순간 화면에서 분명하지 않습니다. 어디에서 적을 수 있는지만 알려 드립니다. */
        <p className="mt-[4px] text-[0.9375rem] leading-[1.6] text-ink-soft">
          응급 안내 첫 화면에서 미리 적어 두실 수 있어요. 적어 두시면 이 자리에 큰 글씨로 뜹니다.
        </p>
      ) : (
        /* 실전 — 음성은 「지금 계신 곳 주소를 119에 말씀하세요」입니다. 화면은 그 말과 어긋나지
           않게 같은 일을 시키고, 손을 어르신에게서 떼게 하는 말은 한 마디도 하지 않습니다. */
        <p className="mt-[4px] text-[1.0625rem] leading-[1.45] font-semibold text-ink">
          적어 두신 주소가 없으면, 지금 계신 곳 주소를 그대로 말씀하세요.
        </p>
      )}
    </div>
  );
}

/**
 * 방문지 주소를 적어 두는 자리 — `/emergency` 목록 화면 한 곳뿐입니다.
 *
 * **왜 목록 화면인가.** 적어 두는 일은 근무 전·이동 중에 하는 일이고, 재생 화면은 어르신 앞에
 * 선 순간입니다. 예전에는 이 둘이 한 카드 안에 겹쳐 있어서 「미리 적어 두는 길」이 실질적으로
 * 막혀 있었습니다 — 저장 칸을 보려면 「지금 119를 누르세요」가 소리로 나오는 안내를 근무 중에
 * 재생해야 했고, 그렇게 열어도 4초 뒤 단계가 넘어가며 치던 글자가 사라졌습니다(페르소나 현직
 * P0, 3차). 이제 적는 자리는 여기 하나, 보는 자리는 재생 화면(`ProtocolAddressCard`) 하나입니다.
 *
 * **왜 5종 목록 아래인가.** 이 화면의 주인은 「다섯 개 중 지금 상황 하나 고르기」입니다.
 * 위계상 뒤에 서는 것이 맞고, 실용적인 이유가 하나 더 있습니다 — 이 블록은 저장소를 읽은 뒤
 * (마운트 후) 나타나므로 목록 **위**에 있으면 손가락이 닿는 순간 다섯 줄을 아래로 밀 수
 * 있습니다. 아래에 두면 어떤 경우에도 목록이 움직이지 않습니다.
 *
 * 저장·수정·삭제가 전부 이 블록 안에서 끝납니다(`src/lib/storage.ts`의 세 함수).
 * 저장 결과는 화면(칸이 주소 표시로 바뀝니다)과 낭독(상시 `role="status"` 한 줄) 양쪽으로
 * 전하고, 누른 버튼이 사라지는 자리마다 초점을 다음 자리로 넘깁니다 — 저장·취소 뒤에는
 * 「고치기」로, 「고치기」·「지우기」 뒤에는 입력 칸으로(WCAG 2.2 AA 4.1.3 · 2.4.3).
 */
export function ProtocolAddressPanel({ className }: { className?: string }) {
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const labelId = `${fieldId}-label`;

  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  /** 낭독으로 전하는 한 줄 — 저장·지우기·저장 실패 셋이 모두 이 한 통로로 나갑니다. */
  const [notice, setNotice] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSaved(loadVisitAddress());
    setReady(true);
  }, []);

  /* 누른 버튼이 사라지는 전환이라 초점을 손으로 옮깁니다 — 두지 않으면 초점이 BODY로 떨어져
     낭독·키보드 사용자가 화면 맨 위부터 다시 찾아 내려와야 합니다(페르소나 UI/UX med, 3차).
     `rAF` 한 겹은 이 저장소가 이미 쓰는 문법입니다(CueResponder의 `openInput`). */
  const focusInput = (): void => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };
  const focusEditButton = (): void => {
    window.requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  const startEditing = (): void => {
    setDraft(saved);
    setEditing(true);
    setFailed(false);
    setNotice("");
    focusInput();
  };

  const handleSave = (): void => {
    const value = normalizeVisitAddress(draft);
    if (value.length === 0) return;
    /* 저장이 막힌 브라우저에서 「저장했습니다」라고 말하지 않습니다(storage.ts와 같은 규율).
       화면에는 실패 문구가 서고, 같은 말이 낭독 리전으로도 나갑니다. */
    if (!saveVisitAddress(value)) {
      setFailed(true);
      setNotice(SAVE_FAILED_TITLE);
      return;
    }
    setSaved(value);
    setDraft("");
    setEditing(false);
    setFailed(false);
    setNotice(SAVED_NOTICE);
    focusEditButton();
  };

  const handleCancel = (): void => {
    setDraft("");
    setEditing(false);
    setFailed(false);
    setNotice("");
    focusEditButton();
  };

  const handleClear = (): void => {
    clearVisitAddress();
    setSaved("");
    setDraft("");
    setEditing(false);
    setFailed(false);
    setNotice(CLEARED_NOTICE);
    /* 지운 뒤 남는 화면은 빈 입력 칸입니다 — 지우기 버튼이 사라진 자리의 초점을 그 칸으로. */
    focusInput();
  };

  /** 적어 두신 것이 없으면 고르고 말고 할 것이 없습니다 — 그대로 적는 칸을 엽니다. */
  const showForm = editing || saved.length === 0;
  const hasSaved = saved.length > 0;

  return (
    <>
      {/* 리전은 늘 그려 둡니다 — 알림과 함께 리전이 생기면 읽지 않는 리더가 있습니다.
          저장했는지·지웠는지·저장이 막혔는지가 여기 한 줄로만 낭독됩니다(WCAG 2.2 AA 4.1.3).

          「늘」은 **저장소를 읽기 전에도**라는 뜻입니다. 그래서 이 한 줄만 아래 `ready` 게이트
          바깥에 있습니다 — 본체는 마운트 뒤에야 서지만(첫 페인트가 「적어 두세요」였다가 주소로
          바뀌면 급할 때 눈이 두 번 갑니다), 리전까지 본체와 함께 태어나면 규칙을 적어 놓고
          그 옆에서 어기는 셈이 됩니다(5차 페르소나 UI/UX low). 서버 렌더부터 빈 상자로 서
          있으므로, 첫 알림이 들어오는 순간 리더에게는 **내용만 바뀐 리전**으로 읽힙니다. */}
      <p role="status" className="sr-only">
        {notice}
      </p>

      {ready && (
        <section aria-labelledby={labelId} className={cx(SHELL, className)}>
          {/* 이 블록의 이름 — 지면의 아이브로가 그대로 리전 이름이 됩니다(이름을 두 번 적지 않게). */}
          <EyebrowLabel id={labelId}>방문지 주소</EyebrowLabel>

          {showForm ? (
            <>
              <label
                htmlFor={fieldId}
                className="mt-[6px] block text-[0.9375rem] leading-[1.6] font-bold text-ink"
              >
                {hasSaved ? "적어 둔 주소 고치기" : "지금 가시는 곳 주소를 적어 두세요"}
              </label>
              <p id={hintId} className="mt-[4px] text-[0.8438rem] leading-[1.6] text-ink-soft">
                적어 두시면 응급 안내의 주소 단계에 큰 글씨로 떠서, 119에 그대로 읽어 드릴 수
                있습니다. 이 기기에만 남고 어디로도 전송되지 않습니다.
              </p>
              <input
                id={fieldId}
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                /* 이 화면에 폼은 이 칸 하나뿐이라, 키보드의 「완료」로도 저장됩니다. */
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  handleSave();
                }}
                maxLength={MAX_VISIT_ADDRESS_LEN}
                autoComplete="off"
                placeholder="도로명 주소와 동·호수"
                aria-describedby={failed ? `${hintId} ${errorId}` : hintId}
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
                {hasSaved && (
                  <button type="button" onClick={handleCancel} className={OUTLINE_BUTTON}>
                    취소
                  </button>
                )}
              </div>
              {hasSaved && (
                <button type="button" onClick={handleClear} className={QUIET_BUTTON}>
                  적어 둔 주소 지우기
                </button>
              )}
              {/* 낭독은 위의 상시 리전이 맡으므로 이 문단에는 `role`을 달지 않습니다 — 나타나는
                  순간 함께 생기는 리전은 읽지 않는 리더가 있고, 둘 다 달면 두 번 읽힙니다.
                  대신 입력 칸이 `aria-describedby`로 이 문단을 물고 있어, 칸으로 돌아오면
                  무엇이 잘못되었는지 다시 들으실 수 있습니다. */}
              {failed && (
                <p
                  id={errorId}
                  className="mt-[6px] text-[0.7813rem] leading-[1.6] font-bold text-danger-ink"
                >
                  {SAVE_FAILED_TITLE}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="mt-[6px] flex items-center gap-3">
                {/* 목록의 굵은 제목(17px)보다 앞서지 않게 같은 단에서 멈춥니다 — 크게 읽을 자리는
                    재생 화면의 주소 카드(22px)이고, 여기는 확인하는 자리입니다. */}
                <p className="min-w-0 flex-1 text-[1.0625rem] leading-[1.45] font-bold text-ink">
                  {saved}
                </p>
                <button
                  type="button"
                  ref={editButtonRef}
                  onClick={startEditing}
                  className={OUTLINE_BUTTON}
                >
                  고치기
                </button>
              </div>
              <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-muted">
                응급 안내의 주소 단계에서 이 주소가 큰 글씨로 뜹니다. 오늘 가시는 곳이 다르면
                여기서 고쳐 주세요.
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}

export default ProtocolAddressCard;
