import { describe, expect, it } from "vitest";
import {
  TAP_SPEECH_WINDOW_EXIT_EVENTS,
  bindTapSpeechTermination,
  nextTapSpeechPhase,
  terminateTapSpeechCapture,
  type TapSpeechPhase,
} from "@/lib/useTapSpeechCapture";

describe("탭 방식 음성 상태", () => {
  it("idle → requesting → listening → review → submitting 순서로만 진행한다", () => {
    let phase: TapSpeechPhase = "idle";
    phase = nextTapSpeechPhase(phase, "request");
    expect(phase).toBe("requesting");
    phase = nextTapSpeechPhase(phase, "started");
    expect(phase).toBe("listening");
    phase = nextTapSpeechPhase(phase, "review");
    expect(phase).toBe("review");
    phase = nextTapSpeechPhase(phase, "submit");
    expect(phase).toBe("submitting");
  });

  it("지원하지 않는 기기는 요청·초기화 모두 unsupported로 복구한다", () => {
    expect(nextTapSpeechPhase("idle", "request", false)).toBe("unsupported");
    expect(nextTapSpeechPhase("error", "reset", false)).toBe("unsupported");
  });

  it("듣는 중에는 제출 이벤트가 와도 자동 제출 상태로 가지 않는다", () => {
    expect(nextTapSpeechPhase("listening", "submit")).toBe("listening");
  });

  it("페이지 이탈 이벤트를 모두 동기 종료 대상으로 등록한다", () => {
    expect(TAP_SPEECH_WINDOW_EXIT_EVENTS).toEqual(["pagehide", "beforeunload"]);
  });

  it("이탈 종료는 500ms를 기다리지 않고 recognizer.stop을 동기 호출한다", () => {
    let stoppedAt = Number.POSITIVE_INFINITY;
    const startedAt = performance.now();
    terminateTapSpeechCapture({
      stop: () => {
        stoppedAt = performance.now();
      },
    });

    expect(stoppedAt).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(stoppedAt - startedAt).toBeLessThan(500);
  });

  it("숨김·pagehide·beforeunload·해제에서 실제 이벤트 연결을 통해 즉시 종료한다", () => {
    class VisibilityTarget extends EventTarget {
      visibilityState = "visible";
    }

    const documentTarget = new VisibilityTarget();
    const windowTarget = new EventTarget();
    let stopCount = 0;
    const unbind = bindTapSpeechTermination({
      documentTarget,
      windowTarget,
      terminate: () => {
        stopCount += 1;
      },
    });

    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(stopCount).toBe(0);
    documentTarget.visibilityState = "hidden";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    windowTarget.dispatchEvent(new Event("pagehide"));
    windowTarget.dispatchEvent(new Event("beforeunload"));
    expect(stopCount).toBe(3);

    unbind();
    expect(stopCount).toBe(4);
    windowTarget.dispatchEvent(new Event("pagehide"));
    expect(stopCount).toBe(4);
  });
});
