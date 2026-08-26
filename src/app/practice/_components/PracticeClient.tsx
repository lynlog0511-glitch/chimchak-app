"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BigButton, EyebrowLabel } from "@/components";
import type { CriticalCheck } from "@/engine/rules";
import {
  buildReplyRequest,
  buildSetupRequest,
  buildSummaryRequest,
  bumpPracticeCount,
  checkLearnerUtterance,
  readPracticeCount,
  requestFreeLine,
  requestFreeSetup,
  requestFreeSummary,
  FREE_MAX_TURNS,
  type FreeSceneContext,
  type FreeSeed,
  type FreeSummaryOutcome,
  type FreeTurn,
} from "@/lib/onlineFree";
import {
  ONLINE_COACHING_NOTICE,
  ONLINE_MODE_LABEL,
  getSettings,
  isOnlineCoachingActive,
  setOnlineCoaching,
  subscribeSettings,
} from "@/lib/settings";
import { speak, stopSpeaking } from "@/lib/speech";
import {
  GATE_ENABLE_CTA,
  GATE_ENABLE_HINT,
  GATE_OFFLINE_BODY,
  GATE_OFFLINE_TITLE,
  GATE_OFF_BODY,
  GATE_OFF_TITLE,
  GATE_SETTINGS_HINT,
  GATE_TRAIN_CTA,
  GATE_UNCONFIGURED_BODY,
  GATE_UNCONFIGURED_TITLE,
  REPLY_FAILED,
  REPLY_RATE_LIMITED,
  REPLY_UNCONFIGURED,
  SETUP_BLOCKED,
  SETUP_FAILED,
} from "./constants";
import { FreeComposer } from "./FreeComposer";
import { FreeDialogue, type ChatItem } from "./FreeDialogue";
import { FreeInterrupt } from "./FreeInterrupt";
import { FreeSummary } from "./FreeSummary";
import { SeedForm } from "./SeedForm";

type Phase = "seed" | "scene" | "summary";

/** 문 앞에서 멈추는 까닭 — 셋뿐이고, 셋 다 화면에 그대로 적습니다. */
type GateReason = "off" | "offline" | "unconfigured";

interface Scene {
  situation: string;
  persona: string;
}

/**
 * 안내 카드 한 장 — 깨진 화면 대신 「왜 안 열리는지」와 「대신 어디로」를 세웁니다.
 *
 * 꺼져 있어서 막힌 경우(`onEnable`이 주어진 경우)에는 **여기서 바로 켤 수 있는 버튼**을 답니다.
 * 예전에는 문 앞에서 「이 문은 열쇠로 열립니다」라고만 하고 열쇠가 어디 있는지는 안 알려
 * 주었습니다 — 홈까지 나가 설정을 찾아 켜고 두 화면을 되짚어 들어오라는 뜻이라, 그 지점에서
 * 대부분 포기하고 돌아갑니다(페르소나 교육생 high · UI/UX high).
 * 게이트 → 해제 → 복귀가 한 화면에서 끝나게 두는 편이 옳습니다.
 */
function Gate({
  title,
  body,
  onEnable,
}: {
  title: string;
  body: string;
  onEnable?: () => void;
}) {
  return (
    <section className="mt-4 rounded-card bg-paper-2 px-4 py-[15px]">
      <h2 className="text-[1.0625rem] leading-[1.45] font-extrabold text-ink">{title}</h2>
      <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-ink-soft">{body}</p>
      <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-muted">
        {onEnable ? GATE_ENABLE_HINT : GATE_SETTINGS_HINT}
      </p>
      {onEnable && (
        <>
          {/* 스위치를 켜는 자리는 곧 **동의를 받는 자리**입니다. 설정 팝오버에서 이 버튼을
              누르실 때 읽으시는 고지와 **한 글자도 다르지 않은 문장**을 여기에도 둡니다 —
              지름길을 만들면서 고지를 건너뛰면, 편의를 얻은 만큼 동의가 얇아집니다. */}
          <div className="mt-3 rounded-card bg-paper px-[14px] py-[12px]">
            <EyebrowLabel>
              {ONLINE_MODE_LABEL}
            </EyebrowLabel>
            <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              {ONLINE_COACHING_NOTICE}
            </p>
          </div>
          <BigButton onClick={onEnable} size="lg" block className="mt-3">
            {GATE_ENABLE_CTA}
          </BigButton>
        </>
      )}
      <BigButton href="/train" variant={onEnable ? "secondary" : "primary"} block className="mt-2">
        {GATE_TRAIN_CTA}
      </BigButton>
    </section>
  );
}

/**
 * 자유 대화 연습의 화면 전체 — 시드 고르기 → 대화 → 마무리.
 *
 * 이 컴포넌트가 지키는 것 넷.
 *  ① **판정을 만들지 않습니다.** `SessionRecord`도 게이지도 점수도 없습니다. 저장소에 닿는
 *     호출은 `bumpPracticeCount()` 하나뿐이고, 그것도 실제로 몇 마디 오간 뒤에만 셉니다.
 *  ② **학습자 발화는 보내기 전에 규칙 사전을 지납니다.** ⚑CF면 요청 자체가 나가지 않고
 *     시트가 뜹니다 — 이 모드에서 발화가 기기 밖으로 나가기 때문에, 멈추는 자리가
 *     네트워크보다 앞에 있어야 합니다.
 *  ③ **못 받은 것을 받은 척하지 않습니다.** 연결이 안 되면 말풍선을 만들지 않고, 방금 하신
 *     말씀을 입력창에 그대로 돌려 드린 뒤 무슨 일이 있었는지 한 줄로 적습니다.
 *  ④ **깨진 화면을 두지 않습니다.** 꺼져 있거나·오프라인이거나·서버에 연결이 없으면
 *     그 사실과 대신 갈 곳(검증 훈련)을 세웁니다.
 */
export function PracticeClient() {
  /* 서버에서는 설정도 회선도 알 수 없으므로, 마운트 전에는 아무 판단도 세우지 않습니다. */
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [online, setOnline] = useState(true);
  const [unconfigured, setUnconfigured] = useState(false);

  const [phase, setPhase] = useState<Phase>("seed");
  const [seed, setSeed] = useState<FreeSeed | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [interrupt, setInterrupt] = useState<CriticalCheck | null>(null);
  const [summary, setSummary] = useState<FreeSummaryOutcome | null>(null);
  const [practiceCount, setPracticeCount] = useState(0);
  const [ttsOn, setTtsOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  /** 말풍선 열쇠 — 화면 안에서만 쓰는 번호입니다(저장되지 않습니다). */
  const nextId = useRef(1);
  const takeId = useCallback(() => (nextId.current += 1), []);

  useEffect(() => {
    setMounted(true);
    setEnabled(isOnlineCoachingActive(getSettings()));
    setPracticeCount(readPracticeCount());
    return subscribeSettings((settings) => setEnabled(isOnlineCoachingActive(settings)));
  }, []);

  useEffect(() => {
    const read = () => setOnline(typeof navigator === "undefined" || navigator.onLine !== false);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  /** 화면을 벗어나면 낭독을 끊습니다 — 소리가 다음 화면까지 따라가지 않게. */
  useEffect(() => () => stopSpeaking(), []);

  const spokenTurns = items.filter((item) => item.speaker === "learner").length;
  const turnsLeft = Math.max(0, FREE_MAX_TURNS - spokenTurns);

  /** 못 받은 까닭을 화면 문장으로 — 한도와 미설정만 따로 말합니다(대응이 다릅니다). */
  const noticeFor = useCallback((fallback: string | undefined, base: string): string => {
    if (fallback === "rate_limited") return REPLY_RATE_LIMITED;
    if (fallback === "config") return REPLY_UNCONFIGURED;
    return base;
  }, []);

  const toTurns = useCallback(
    (list: readonly ChatItem[]): FreeTurn[] =>
      list.map((item) => ({ speaker: item.speaker, text: item.text })),
    [],
  );

  const sceneContext = useCallback(
    (list: readonly ChatItem[]): FreeSceneContext | null => {
      if (!seed || !scene) return null;
      return {
        seed,
        situation: scene.situation,
        persona: scene.persona,
        turns: toTurns(list),
      };
    },
    [scene, seed, toTurns],
  );

  /* ── 시작 ────────────────────────────────────────────── */

  const start = useCallback(
    async (next: FreeSeed) => {
      setSeed(next);
      setBusy(true);
      setNotice(undefined);
      const outcome = await requestFreeSetup(
        buildSetupRequest(next),
        getSettings().onlineCoaching,
        next.type,
      );
      setBusy(false);

      if (outcome.status === "ok") {
        setScene({ situation: outcome.situation, persona: outcome.persona });
        setItems([]);
        setDraft("");
        setSummary(null);
        setPhase("scene");
        return;
      }
      if (outcome.fallback === "config") {
        setUnconfigured(true);
        return;
      }
      setNotice(
        outcome.status === "blocked"
          ? SETUP_BLOCKED
          : noticeFor(outcome.fallback, SETUP_FAILED),
      );
    },
    [noticeFor],
  );

  /* ── 한 마디 보내기 ──────────────────────────────────── */

  const send = useCallback(async () => {
    const text = draft.trim();
    if (text.length === 0 || busy || !seed || !scene || turnsLeft <= 0) return;

    /* 규칙 사전이 **네트워크보다 먼저** 봅니다 — 걸리면 이 말은 기기 밖으로 나가지 않습니다. */
    const critical = checkLearnerUtterance(text, seed.type);
    if (critical.cf) {
      setInterrupt(critical);
      return;
    }

    const mine: ChatItem = { id: takeId(), speaker: "learner", text };
    const next = [...items, mine];
    setItems(next);
    setDraft("");
    setBusy(true);
    setNotice(undefined);
    stopSpeaking();

    const context = sceneContext(next);
    if (!context) {
      setBusy(false);
      return;
    }

    const outcome = await requestFreeLine(
      buildReplyRequest(context),
      getSettings().onlineCoaching,
      seed.type,
    );
    setBusy(false);

    if (outcome.status === "fallback") {
      // 받지 못했으면 말풍선을 만들지 않습니다 — 방금 하신 말씀을 입력창에 돌려 드립니다.
      setItems((prev) => prev.filter((item) => item.id !== mine.id));
      setDraft(text);
      if (outcome.fallback === "config") setUnconfigured(true);
      setNotice(noticeFor(outcome.fallback, REPLY_FAILED));
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: takeId(),
        speaker: "character",
        text: outcome.text,
        ...(outcome.status === "replaced" ? { replaced: true } : {}),
      },
    ]);

    if (ttsOn) {
      setSpeaking(true);
      void speak(outcome.text).finally(() => setSpeaking(false));
    }
  }, [busy, draft, items, noticeFor, scene, sceneContext, seed, takeId, ttsOn, turnsLeft]);

  /* ── 마무리 ──────────────────────────────────────────── */

  const reset = useCallback(() => {
    stopSpeaking();
    setPhase("seed");
    setScene(null);
    setItems([]);
    setDraft("");
    setSummary(null);
    setNotice(undefined);
    setSpeaking(false);
  }, []);

  const finish = useCallback(async () => {
    stopSpeaking();
    setSpeaking(false);
    // 한 마디도 오가지 않았으면 청할 것이 없습니다 — 호출도 세기도 하지 않고 처음으로 돌아갑니다.
    if (spokenTurns === 0) {
      reset();
      return;
    }

    const context = sceneContext(items);
    setPhase("summary");
    setSummary(null);
    setBusy(true);
    setPracticeCount(bumpPracticeCount());

    if (!context) {
      setBusy(false);
      return;
    }
    const outcome = await requestFreeSummary(
      buildSummaryRequest(context),
      getSettings().onlineCoaching,
    );
    setSummary(outcome);
    setBusy(false);
  }, [items, reset, sceneContext, spokenTurns]);

  const closeInterrupt = useCallback((alternative?: string) => {
    setInterrupt(null);
    // 고르신 문장은 입력창에 놓아 드립니다 — 되돌아갈 「같은 장면」이 없는 자리라서입니다.
    if (alternative) setDraft(alternative);
  }, []);

  /* ── 그리기 ──────────────────────────────────────────── */

  if (!mounted) {
    return (
      <p role="status" className="mt-4 text-[0.9375rem] leading-[1.6] text-ink-soft">
        이 기기의 설정을 확인하고 있습니다…
      </p>
    );
  }

  const gate: GateReason | null = !enabled
    ? "off"
    : !online
      ? "offline"
      : unconfigured
        ? "unconfigured"
        : null;

  if (gate === "off") {
    /* 스위치를 켜는 것은 「내 발화를 밖으로 내보낼 것인가」에 답하는 일입니다 — 그 답은 카드
       본문(무엇이 어디로 나가는지)을 읽고 누르는 이 버튼으로 표시하십니다. 켜는 즉시
       `subscribeSettings`가 이 화면을 다시 그려 게이트가 걷힙니다. */
    return (
      <Gate
        title={GATE_OFF_TITLE}
        body={GATE_OFF_BODY}
        onEnable={() => setOnlineCoaching({ enabled: true })}
      />
    );
  }
  if (gate === "offline") return <Gate title={GATE_OFFLINE_TITLE} body={GATE_OFFLINE_BODY} />;
  if (gate === "unconfigured") {
    return <Gate title={GATE_UNCONFIGURED_TITLE} body={GATE_UNCONFIGURED_BODY} />;
  }

  if (phase === "summary") {
    return (
      <div className="mt-4">
        <FreeSummary
          outcome={summary}
          spokenTurns={spokenTurns}
          practiceCount={practiceCount}
          onAgain={reset}
        />
      </div>
    );
  }

  if (phase === "scene" && scene) {
    return (
      <div className="mt-4">
        <FreeDialogue
          situation={scene.situation}
          persona={scene.persona}
          items={items}
          pending={busy}
          speaking={speaking}
        />
        <FreeComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          onFinish={finish}
          busy={busy}
          turnsLeft={turnsLeft}
          ttsOn={ttsOn}
          onToggleTts={() => {
            stopSpeaking();
            setSpeaking(false);
            setTtsOn((on) => !on);
          }}
          {...(notice ? { notice } : {})}
        />
        {interrupt && <FreeInterrupt check={interrupt} onClose={closeInterrupt} />}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <SeedForm busy={busy} onStart={start} />
      {notice && (
        <p role="status" className="mt-3 text-[0.9375rem] leading-[1.6] text-warn-ink">
          {notice}
        </p>
      )}
    </div>
  );
}

export default PracticeClient;
