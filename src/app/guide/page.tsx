import type { Metadata } from "next";
import Link from "next/link";
import {
  BigButton,
  ChevronGlyph,
  InlineDisclaimer,
  ListRow,
  ListRows,
  PageShell,
  ScreenHeader,
} from "@/components";
import { CALL_119_CAPTION } from "@/app/emergency/_components/Call119Bar";
import { SOURCE_DOCS } from "@/data/docs";
import { CHK_A01 } from "@/data/scenarios";
import { DocCloseButton } from "../_components/DocCloseButton";
import { GUIDE_PRIVACY_FAQ_ID } from "../_components/guideAnchors";

export const metadata: Metadata = {
  title: "사용 방법",
  description: "연습을 시작하는 세 단계와 자주 묻는 질문을 간단히 안내합니다.",
};

const FIRST_SCENARIO_HREF = `/train/${CHK_A01.id.toLowerCase()}`;

const STEPS: readonly { title: string; description: string }[] = [
  {
    title: "연습할 상황을 고르세요.",
    description: "처음에는 ‘현관 앞, 집에 가야 해요’를 추천해요.",
  },
  {
    title: "어르신의 말을 듣고 답하세요.",
    description: "마이크가 어려우면 큰 버튼이나 글 입력으로 답할 수 있어요.",
  },
  {
    title: "바로 나오는 도움말을 확인하세요.",
    description: "한 번 답할 때마다 잘한 점과 다음에 해 볼 말을 알려드려요.",
  },
];

const FAQ: readonly {
  id?: string;
  question: string;
  answer: string;
  href: string;
  linkLabel: string;
}[] = [
  {
    question: "마이크가 안 돼요",
    answer:
      "괜찮아요. 제안 버튼이나 글 입력만으로 처음부터 끝까지 연습할 수 있어요. 소리로 읽어주는 기능이 없어도 안내 글은 모두 보여요.",
    href: "/train",
    linkLabel: "연습 화면 열기",
  },
  {
    question: "인터넷이 끊겼어요",
    answer:
      "한 번 연 기기에서는 저장된 응급 안내와 연습 한 바퀴를 다시 열 수 있어요. 음성 인식은 기기나 브라우저에 따라 인터넷이 필요할 수 있지만, 버튼과 글 입력은 그대로 쓸 수 있어요.",
    href: "/emergency",
    linkLabel: "응급 안내 열기",
  },
  {
    id: GUIDE_PRIVACY_FAQ_ID,
    question: "내 말은 어디로 가나요?",
    answer:
      "기본 상태에서는 이 기기 밖으로 나가지 않고, 말씀 원문도 저장하지 않아요. 글자·소리의 AI·개인정보에서 전송을 허용한 경우에만 앱이 판단하지 못한 답변 한 문장과 자유 연습 내용·대화가 가림 처리를 거쳐 침착 서버를 통해 외부 AI로 전송돼요. 가림이 완벽하지 않을 수 있으니 실제 개인정보는 입력하거나 말하지 마세요.",
    href: "/safety",
    linkLabel: "안전·개인정보 자세히 보기",
  },
  {
    question: "왜 점수가 없나요?",
    answer:
      "점수를 올리는 연습이 되지 않도록 등수와 등급을 만들지 않았어요. 대신 답할 때마다 잘한 점과 다시 해 볼 말을 보여드려요.",
    href: "/history",
    linkLabel: "내 기록 보기",
  },
  {
    question: "119 버튼을 눌러도 되나요?",
    answer: `훈련 중에는 누르지 마세요. 실제 전화 앱을 여는 버튼이에요. 버튼 아래에도 ‘${CALL_119_CAPTION}’라고 적혀 있어요. 실제 상황이라면 먼저 119에 신고하세요.`,
    href: "/emergency",
    linkLabel: "응급 안내 열기",
  },
];

export default function GuidePage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS} tabBar={false}>
      <ScreenHeader
        title="사용 방법"
        action={
          <DocCloseButton
            fallbackHref="/"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-field px-1 text-[0.9375rem] font-bold text-ink-muted transition-colors duration-150 active:bg-paper-2"
          />
        }
      />

      <p className="mt-4 text-[1rem] leading-[1.6] text-ink-soft">
        처음 한 번은 마이크 없이도 약 4분이면 할 수 있어요.
      </p>

      <section className="mt-6" aria-labelledby="guide-steps">
        <h2 id="guide-steps" className="text-[1.1875rem] leading-[1.3] font-extrabold text-ink">
          이렇게 연습해요
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-card bg-paper-2 px-4 py-4">
              <p className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
                <span className="chim-num text-brand-800">{index + 1}</span>. {step.title}
              </p>
              <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
                {step.description}
              </p>
            </li>
          ))}
        </ol>

        <BigButton href={FIRST_SCENARIO_HREF} size="lg" block className="mt-4 font-bold">
          첫 연습 시작하기
        </BigButton>
      </section>

      <section className="mt-7" aria-labelledby="guide-faq">
        <h2 id="guide-faq" className="text-[1.1875rem] leading-[1.3] font-extrabold text-ink">
          자주 묻는 질문
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {FAQ.map((item) => (
            <details
              key={item.question}
              {...(item.id ? { id: item.id } : {})}
              className="group scroll-mt-4 rounded-card bg-paper-2"
            >
              <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[1rem] leading-[1.45] font-bold text-ink transition-colors duration-150 active:bg-neutral-line [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <ChevronGlyph
                  size="sm"
                  className="flex-none text-ink-muted transition-transform duration-150 group-open:rotate-180"
                />
              </summary>
              <div className="border-t border-line px-4 pt-4 pb-3">
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{item.answer}</p>
                <Link
                  href={item.href}
                  prefetch={false}
                  className="mt-2 inline-flex min-h-[48px] items-center rounded-field text-[0.9375rem] font-bold text-brand-800 underline underline-offset-4"
                >
                  {item.linkLabel}
                </Link>
              </div>
            </details>
          ))}
        </div>
      </section>

      <details className="group mt-6 border-y border-line">
        <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[1rem] leading-[1.45] font-bold text-ink [&::-webkit-details-marker]:hidden">
          <span>더 자세한 안내</span>
          <ChevronGlyph
            size="sm"
            className="flex-none text-ink-muted transition-transform duration-150 group-open:rotate-180"
          />
        </summary>
        <div className="pb-3">
          <ListRows>
            <ListRow href="/safety" title="안전·개인정보 설계" size="lg" />
            <ListRow href="/for-orgs" title="기관 도입 안내" size="lg" />
            <ListRow href="/legal" title="약관·개인정보" size="lg" />
          </ListRows>
        </div>
      </details>

      <BigButton href="/" variant="secondary" size="lg" block className="mt-5">
        홈으로
      </BigButton>

      <InlineDisclaimer size="md" tone="readable" className="mt-3 mb-5" />
    </PageShell>
  );
}
