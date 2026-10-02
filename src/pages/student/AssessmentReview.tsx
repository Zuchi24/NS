import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type {
  AssessmentReview,
  AssessmentReviewQuestion,
  StudentAssessmentChoice,
} from "@/features/assessments/studentAssessmentService";

/**
 * A submitted attempt, read back question by question.
 *
 * Only ever mounted for an attempt the server has already answered with — the
 * one reply a student is sent that carries the answer key. Nothing here is
 * reachable while an assessment is being answered: the page shows the form or
 * the review, never both, and the form's types have no field a key could
 * arrive in.
 *
 * It reads and shows. There is no control in it: no radio to move, no button
 * to press, nothing disabled standing in for something that was. What was
 * picked cannot be changed, and an assessment is taken once, so a control here
 * could only be one that does nothing.
 *
 * Every state is said in words as well as in colour — "Your answer", "Correct
 * answer", "Correct", "Incorrect", "Not answered" — because a student who
 * cannot tell green from red still has to be able to tell a right answer from
 * a wrong one. The icons beside them are decoration and are hidden from
 * assistive software.
 */

type Verdict = "correct" | "incorrect" | "unanswered";

/**
 * How a question went, in the server's terms and never in our own.
 *
 * `isCorrect` is the scorer's word, read as it wrote it. A question with no
 * answer stored is not called wrong, because nothing was answered to be wrong:
 * it is its own state, which is what the student is shown.
 */
function verdictOf(question: AssessmentReviewQuestion): Verdict {
  if (question.isCorrect === true) return "correct";

  // Nothing picked, or — for a fill-in-the-blank question — nothing typed.
  const answered =
    question.type === "fill_in_blank"
      ? question.responseText !== null
      : question.selectedChoiceId !== null;

  return answered ? "incorrect" : "unanswered";
}

const VERDICTS: Record<
  Verdict,
  { label: string; icon: typeof CheckCircle2; tone: string; card: string }
> = {
  correct: {
    label: "Correct",
    icon: CheckCircle2,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    card: "border-emerald-200",
  },
  incorrect: {
    label: "Incorrect",
    icon: XCircle,
    tone: "text-red-700 bg-red-50 border-red-200",
    card: "border-red-200",
  },
  unanswered: {
    label: "Not answered",
    icon: MinusCircle,
    tone: "text-amber-800 bg-amber-50 border-amber-200",
    card: "border-amber-200",
  },
};

/** "1 point", "3 points" — the same wording the form uses while answering. */
function points(count: number): string {
  return count === 1 ? "1 point" : `${count} points`;
}

export function AssessmentAnswerReview({ review }: { review: AssessmentReview }) {
  // An assessment with no questions has nothing to review. The score above
  // still stands on its own, so this says nothing rather than saying it twice.
  if (review.questions.length === 0) return null;

  return (
    <section aria-labelledby="assessment-review-title" className="space-y-4">
      <h2
        id="assessment-review-title"
        className="text-lg font-bold text-gray-900 px-1"
      >
        Your answers
      </h2>

      <ol className="space-y-4">
        {review.questions.map((question, index) => (
          <li key={question.id}>
            <QuestionReview question={question} number={index + 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function QuestionReview({
  question,
  number,
}: {
  question: AssessmentReviewQuestion;
  number: number;
}) {
  const verdict = verdictOf(question);
  const { label, icon: Icon, tone, card } = VERDICTS[verdict];

  const headingId = `review-question-${question.id}`;
  const verdictId = `review-question-${question.id}-verdict`;

  return (
    <Card className={`border shadow-sm ${card}`}>
      <CardContent className="p-5 sm:p-6">
        {/* Named by the question and by how it went, so that reaching it with a
            screen reader gives both before any of the choices are read. */}
        <div role="group" aria-labelledby={`${headingId} ${verdictId}`}>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            {/* Asks for a readable column before it asks to share the line:
                `grow` with a basis rather than `flex-1`, whose zero basis let
                the prompt shrink to a few words a line at a phone's width
                while the badge kept its own. Below about 455px there is no
                room for both, and the badge takes the line underneath. */}
            <h3 id={headingId} className="min-w-0 grow basis-64">
              <span className="block text-xs font-semibold text-gray-600">
                Question {number}
              </span>
              <span className="block mt-1 text-base text-gray-900 whitespace-pre-line break-words">
                {question.prompt}
              </span>
            </h3>

            <span
              id={verdictId}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${tone}`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {label}
            </span>
          </div>

          {/* What the scorer awarded, beside what the question was worth. Both
              are the server's numbers; neither is worked out here. */}
          <p className="mt-1 text-xs text-gray-500">
            {question.pointsAwarded ?? 0} of {points(question.points)} awarded
          </p>

          {question.type === "fill_in_blank" ? (
            // What the student typed, and the verdict above. Never the answers
            // that would have been accepted: the server does not send them.
            question.responseText !== null && (
              <p
                className={`mt-4 rounded-md border px-3 py-2.5 text-sm ${
                  question.isCorrect
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-red-300 bg-red-50"
                }`}
              >
                <span
                  className={`block text-xs font-semibold ${
                    question.isCorrect ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  Your answer
                </span>
                <span className="block mt-1 text-gray-900 break-words">{question.responseText}</span>
              </p>
            )
          ) : (
            <ul className="mt-4 space-y-2">
              {question.choices.map((choice) => (
                <ChoiceReview
                  key={choice.id}
                  choice={choice}
                  picked={choice.id === question.selectedChoiceId}
                  correct={choice.id === question.correctChoiceId}
                />
              ))}
            </ul>
          )}

          {verdict === "unanswered" && (
            <p className="mt-3 text-sm text-amber-800">
              You did not answer this question.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * One choice as it was offered, and what became of it.
 *
 * A choice the student picked and a choice that was right are two different
 * things, said separately, so that a question answered rightly shows one row
 * carrying both labels and a question answered wrongly shows two rows carrying
 * one each. Neither is inferred from the other.
 */
function ChoiceReview({
  choice,
  picked,
  correct,
}: {
  choice: StudentAssessmentChoice;
  picked: boolean;
  correct: boolean;
}) {
  const tone = correct
    ? "border-emerald-300 bg-emerald-50"
    : picked
      ? "border-red-300 bg-red-50"
      : "border-gray-200 bg-white";

  return (
    <li className={`rounded-md border px-3 py-2.5 ${tone}`}>
      <div className="flex items-start gap-3">
        {correct ? (
          <CheckCircle2
            className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
        ) : picked ? (
          <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
        ) : (
          // Keeps every label on the same left edge, marked or not.
          <span className="w-4 shrink-0" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 break-words">{choice.label}</p>

          {(picked || correct) && (
            <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold">
              {picked && (
                <span className={correct ? "text-emerald-700" : "text-red-700"}>
                  Your answer
                </span>
              )}
              {correct && <span className="text-emerald-700">Correct answer</span>}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
