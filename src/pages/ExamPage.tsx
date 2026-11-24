import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Exam, ExamQuestion } from '../types/database';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RotateCcw,
  Award,
  ArrowRight,
} from 'lucide-react';

interface ExamPageProps {
  examId: string;
  textId: string;
  onBackToReader: (textId: string) => void;
  onBackToFeed: () => void;
}

export function ExamPage({ examId, textId, onBackToReader, onBackToFeed }: ExamPageProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  const [attemptError, setAttemptError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      supabase.from('exams').select('*').eq('id', examId).single(),
      supabase.from('exam_questions').select('*').eq('exam_id', examId),
    ]).then(([examRes, qRes]) => {
      if (!active) return;
      if (examRes.error || !examRes.data) {
        setError(examRes.error?.message || 'Exame não encontrado.');
        setLoading(false);
        return;
      }

      const rawQuestions = (qRes.data || []) as Array<{
        id: string;
        exam_id: string;
        question_text: string;
        options: unknown;
        correct_option_index: number;
        explanation: string | null;
      }>;

      const parsedQuestions: ExamQuestion[] = rawQuestions.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options.map(String) : [],
      }));

      setExam(examRes.data as Exam);
      setQuestions(parsedQuestions);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [examId]);

  const currentQuestion = questions[currentIndex];
  const selectedOption = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleSelectOption = (optIndex: number) => {
    if (!currentQuestion || revealed) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optIndex }));
    setRevealed(true);
  };

  const handleAdvance = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setRevealed(false);
      return;
    }

    // Complete exam and record attempt + XP points
    setFinished(true);
    const score = questions.reduce(
      (acc, q) => (answers[q.id] === q.correct_option_index ? acc + 1 : acc),
      0
    );

    if (!user) return;
    setSavingAttempt(true);
    setAttemptError(null);

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('submit_exam_attempt', {
        p_exam_id: examId,
        p_score: score,
        p_total_questions: questions.length,
      });

      if (!rpcErr && Array.isArray(rpcData) && rpcData[0]) {
        setXpAwarded(Number(rpcData[0].xp_awarded) || 0);
      } else {
        // Fallback if RPC wasn't executed yet: direct insert + profile xp update
        const { error: insertErr } = await supabase.from('user_exam_attempts').insert({
          user_id: user.id,
          exam_id: examId,
          score,
          total_questions: questions.length,
        });
        if (insertErr) throw insertErr;

        const gain = 10 + score * 15;
        const nextXp = (profile?.xp_points || 0) + gain;
        await supabase.from('profiles').update({ xp_points: nextXp }).eq('id', user.id);
        setXpAwarded(gain);
      }

      await refreshProfile();
    } catch (err) {
      setAttemptError(
        err instanceof Error ? err.message : 'Não foi possível salvar o resultado do exame.'
      );
    } finally {
      setSavingAttempt(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentIndex(0);
    setRevealed(false);
    setFinished(false);
    setXpAwarded(null);
    setAttemptError(null);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
        <p className="text-sm">Carregando questões do exame...</p>
      </div>
    );
  }

  if (error || !exam || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          type="button"
          onClick={() => onBackToReader(textId)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para leitura</span>
        </button>
        <div className="p-6 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          <p className="font-semibold text-base text-slate-900 dark:text-white">
            {error || 'Este exame ainda não possui questões cadastradas.'}
          </p>
        </div>
      </div>
    );
  }

  const totalScore = questions.reduce(
    (acc, q) => (answers[q.id] === q.correct_option_index ? acc + 1 : acc),
    0
  );
  const accuracyPct = Math.round((totalScore / questions.length) * 100);

  if (finished) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-28 md:pb-16">
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                Resultado do Exame
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold text-slate-950 dark:text-slate-50">
                {exam.title}
              </h1>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 py-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Pontuação</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-slate-950 dark:text-white tabular-nums">
                {totalScore}/{questions.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Aproveitamento</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-slate-950 dark:text-white tabular-nums">
                {accuracyPct}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">XP ganho</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {savingAttempt ? '...' : `+${xpAwarded ?? 0} XP`}
              </div>
            </div>
          </div>

          {attemptError && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{attemptError}</span>
            </div>
          )}

          {/* Answer Review */}
          <div className="mt-8 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Revisão das respostas
            </h2>
            {questions.map((q, idx) => {
              const userAns = answers[q.id];
              const isRight = userAns === q.correct_option_index;
              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {idx + 1}. {q.question_text}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                        isRight
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {isRight ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Correta</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          <span>Incorreta</span>
                        </>
                      )}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    Resposta correta:{' '}
                    <strong className="font-semibold text-slate-900 dark:text-white">
                      {q.options[q.correct_option_index]}
                    </strong>
                    {!isRight && userAns !== undefined && (
                      <>
                        {' · '}Sua escolha:{' '}
                        <span className="text-red-700 dark:text-red-400">
                          {q.options[userAns]}
                        </span>
                      </>
                    )}
                  </p>

                  {q.explanation && (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onBackToReader(textId)}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors min-h-[44px]"
            >
              Voltar ao texto
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Refazer exame</span>
            </button>
            <button
              type="button"
              onClick={onBackToFeed}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Ir para biblioteca
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-16">
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={() => onBackToReader(textId)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para leitura</span>
        </button>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          Questão {currentIndex + 1} de {questions.length}
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-orange-600 transition-transform duration-200 origin-left"
          style={{
            transform: `scaleX(${(currentIndex + (revealed ? 1 : 0)) / questions.length})`,
          }}
        />
      </div>

      <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{exam.title}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-slate-950 dark:text-slate-50 leading-snug">
          {currentQuestion.question_text}
        </h1>

        <div className="mt-6 space-y-3">
          {currentQuestion.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentQuestion.correct_option_index;

            let stateClass =
              'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200 hover:border-orange-500';
            if (revealed) {
              if (isCorrect) {
                stateClass =
                  'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100';
              } else if (isSelected && !isCorrect) {
                stateClass =
                  'border-red-600 bg-red-50/80 dark:bg-red-950/40 text-red-950 dark:text-red-100';
              } else {
                stateClass =
                  'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0B0F17] text-slate-500 dark:text-slate-500';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={revealed}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-4 rounded-xl border transition-colors flex items-center justify-between gap-3 min-h-[52px] ${stateClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span className="text-sm font-medium">{opt}</span>
                </div>

                {revealed && isCorrect && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Correta</span>
                  </span>
                )}
                {revealed && isSelected && !isCorrect && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400 shrink-0">
                    <XCircle className="w-4 h-4" />
                    <span>Incorreta</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {revealed && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {currentQuestion.explanation ? (
                <>
                  <span className="font-semibold text-slate-900 dark:text-white">Explicação: </span>
                  {currentQuestion.explanation}
                </>
              ) : selectedOption === currentQuestion.correct_option_index ? (
                'Resposta correta! Continue para a próxima etapa.'
              ) : (
                `A alternativa correta é "${currentQuestion.options[currentQuestion.correct_option_index]}".`
              )}
            </div>

            <button
              type="button"
              onClick={handleAdvance}
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 min-h-[44px] whitespace-nowrap shrink-0"
            >
              <span>
                {currentIndex < questions.length - 1 ? 'Próxima questão' : 'Finalizar exame'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
