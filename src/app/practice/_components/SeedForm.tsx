"use client";

import { useId, useState } from "react";
import { BigButton } from "@/components";
import { cx } from "@/components/utils";
import {
  FREE_CONSENT_LINES,
  FREE_EXCLUDED_TYPE_LABEL,
  FREE_EXCLUDED_TYPE_REASON,
  FREE_HINT_MAX,
  FREE_LEVELS,
  FREE_SEED_TYPES,
  type FreeLevel,
  type FreeSeed,
  type FreeSeedType,
} from "@/lib/onlineFree";
import {
  SEED_HINT_LABEL,
  SEED_HINT_NOTE,
  SEED_HINT_PLACEHOLDER,
  SEED_LEVEL_LABEL,
  SEED_MAKING,
  SEED_PRESET_LABEL,
  SEED_PRESET_NOTE,
  SEED_PRESET_OVERLAP_NOTE,
  SEED_PRESETS,
  SEED_START,
  SEED_TYPE_LABEL,
} from "./constants";

export interface SeedFormProps {
  busy: boolean;
  onStart: (seed: FreeSeed) => void;
}

function OptionButton({
  label,
  note,
  selected,
  onSelect,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "min-h-[48px] flex-1 rounded-card px-3 py-2.5 text-left",
        "transition-colors duration-150 ease-soft",
        selected
          ? "bg-brand-700 text-paper active:bg-brand-800"
          : "bg-paper-2 text-ink hover:bg-neutral-line active:bg-neutral-line",
      )}
    >
      <span className="block text-[0.9375rem] leading-[1.45] font-bold">{label}</span>
      {note && (
        <span
          className={cx(
            "mt-[2px] block text-[0.7813rem] leading-[1.45]",
            selected ? "text-paper/85" : "text-ink-muted",
          )}
        >
          {note}
        </span>
      )}
    </button>
  );
}

/**
 * 시드 고르기 — 유형 · 난이도 · 한 줄, 그리고 **시작 전 고지**입니다.
 *
 * 유형 목록에 응급이 없습니다. 「준비 중」으로 흐리지 않고, 목록 바로 아래에 이름과 사유를
 * 그대로 적습니다(L3 원칙) — 빠진 자리를 못 본 척하면, 남은 자리에 대한 표기도 함께 흐려집니다.
 *
 * 고지는 접어 두지 않습니다. 이 모드는 이 앱에서 **학습자의 말이 기기 밖으로 나가는 유일한
 * 자리**라, 시작 버튼을 누르기 전에 반드시 눈에 들어와야 합니다.
 */
export function SeedForm({ busy, onStart }: SeedFormProps) {
  const [type, setType] = useState<FreeSeedType>("BPSD");
  const [level, setLevel] = useState<FreeLevel>(1);
  const [hint, setHint] = useState("");

  const typeLabelId = useId();
  const levelLabelId = useId();
  const hintId = useId();
  const hintNoteId = useId();
  const presetLabelId = useId();

  return (
    <div>
      <section aria-labelledby={typeLabelId}>
        <p id={typeLabelId} className="chim-label text-ink">
          {SEED_TYPE_LABEL}
        </p>
        <div role="group" aria-labelledby={typeLabelId} className="mt-2 flex gap-2">
          {FREE_SEED_TYPES.map((option) => (
            <OptionButton
              key={option.value}
              label={option.label}
              note={option.note}
              selected={type === option.value}
              onSelect={() => setType(option.value)}
            />
          ))}
        </div>
        {/* 빠진 자리와 그 까닭 — 화면이 스스로 밝힙니다. */}
        <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-muted">
          <b className="font-bold text-ink">{FREE_EXCLUDED_TYPE_LABEL}</b> 유형은 이 목록에
          없습니다. {FREE_EXCLUDED_TYPE_REASON}
        </p>
      </section>

      <section aria-labelledby={levelLabelId} className="mt-5">
        <p id={levelLabelId} className="chim-label text-ink">
          {SEED_LEVEL_LABEL}
        </p>
        <div role="group" aria-labelledby={levelLabelId} className="mt-2 flex gap-2">
          {FREE_LEVELS.map((option) => (
            <OptionButton
              key={option.value}
              label={option.label}
              note={option.note}
              selected={level === option.value}
              onSelect={() => setLevel(option.value)}
            />
          ))}
        </div>
      </section>

      <section className="mt-5">
        <label htmlFor={hintId} className="chim-label block text-ink">
          {SEED_HINT_LABEL}
        </label>
        <input
          id={hintId}
          type="text"
          value={hint}
          maxLength={FREE_HINT_MAX}
          onChange={(event) => setHint(event.target.value)}
          placeholder={SEED_HINT_PLACEHOLDER}
          aria-describedby={hintNoteId}
          className="mt-2 h-12 w-full rounded-card border border-line-strong bg-paper-2 px-4 text-[1.0625rem] text-ink placeholder:text-ink-muted"
        />
        <p id={hintNoteId} className="mt-1.5 text-[0.8438rem] leading-[1.6] text-ink-muted">
          {SEED_HINT_NOTE}
        </p>
      </section>

      {/* 현장에서 온 상황 — 누르면 위 입력칸이 채워집니다. 새 모드가 아니라 시작 지문일 뿐이라,
          채점하지 않는다는 이 화면의 성격은 그대로입니다. 출처를 바로 아래 한 줄로 밝힙니다. */}
      <section aria-labelledby={presetLabelId} className="mt-5">
        <p id={presetLabelId} className="chim-label text-ink">
          {SEED_PRESET_LABEL}
        </p>
        <p className="mt-1.5 text-[0.8438rem] leading-[1.6] text-ink-muted">{SEED_PRESET_NOTE}</p>
        {/* 부제는 「검수된 N 상황 **밖**」이라고 적어 두었는데, 아래 보기 하나는 검수 훈련의
            갈등 회차와 주제가 겹칩니다. 겹침을 지우는 대신 무엇이 다른지를 적습니다 —
            여기서 다른 것은 소재가 아니라 판정을 내리지 않는다는 것입니다(2026-08-30). */}
        <p className="mt-1 text-[0.8438rem] leading-[1.6] text-ink-muted">
          {SEED_PRESET_OVERLAP_NOTE}
        </p>
        {/* 세로로 쌓습니다 — 유형·난이도 줄과 달리 한 줄 지문이 통째로 보여야 고를 수 있습니다.
            `grid`인 이유는 `OptionButton`이 들고 있는 `flex-1` 때문입니다. 세로 flex 안에서는
            그 한 줄이 세 칸의 높이를 서로 맞춰 버려, 짧은 지문 아래 빈 공간이 남습니다. */}
        <div role="group" aria-labelledby={presetLabelId} className="mt-2 grid gap-2">
          {SEED_PRESETS.map((preset) => (
            <OptionButton
              key={preset.id}
              label={preset.label}
              note={preset.hint}
              selected={hint === preset.hint}
              onSelect={() => setHint(preset.hint)}
            />
          ))}
        </div>
      </section>

      {/* 시작 전 고지 — 접히지 않습니다. */}
      <section className="mt-5 rounded-card bg-paper-2 px-4 py-[15px]">
        <p className="text-[0.9375rem] leading-[1.45] font-extrabold text-ink">시작하기 전에</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {FREE_CONSENT_LINES.map((line) => (
            <li key={line} className="text-[0.9375rem] leading-[1.6] text-ink-soft">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <BigButton
        size="lg"
        block
        disabled={busy}
        onClick={() => onStart({ type, level, hint })}
        className="mt-5"
      >
        {busy ? SEED_MAKING : SEED_START}
      </BigButton>
    </div>
  );
}

export default SeedForm;
