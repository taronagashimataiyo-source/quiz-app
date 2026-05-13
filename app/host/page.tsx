'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ResponseBar } from '@/components/ResponseBar';
import { ROOM_ID, supabase, supabaseConfigError } from '@/lib/supabase';
import { Answer, Choice, Question, Room, Score } from '@/lib/types';

const choices: Choice[] = ['A', 'B', 'C', 'D'];

const initialRoom: Room = {
  id: ROOM_ID,
  question_id: null,
  status: 'waiting',
  updated_at: new Date().toISOString(),
};

export default function HostPage() {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [busy, setBusy] = useState(false);

  const currentQuestion = useMemo(
    () => questions.find((q) => q.id === room.question_id) ?? null,
    [questions, room.question_id],
  );

  const loadRoom = useCallback(async () => {
    if (!supabase) return;
    const client = supabase;
    const { data } = await client.from('rooms').select('*').eq('id', ROOM_ID).maybeSingle();
    if (data) setRoom(data as Room);
  }, []);

  const loadQuestions = useCallback(async () => {
    if (!supabase) return;
    const client = supabase;
    const { data } = await client.from('questions').select('*').order('question_no', { ascending: true });
    setQuestions((data || []) as Question[]);
  }, []);

  const loadAnswers = useCallback(async (questionId?: string | null) => {
    if (!supabase || !questionId) {
      setAnswers([]);
      return;
    }
    const client = supabase;
    const { data } = await client
      .from('answers')
      .select('*')
      .eq('room_id', ROOM_ID)
      .eq('question_id', questionId);
    setAnswers((data || []) as Answer[]);
  }, []);

  const loadScores = useCallback(async () => {
    if (!supabase) return;
    const client = supabase;
    const { data } = await client
      .from('scores')
      .select('*')
      .eq('room_id', ROOM_ID)
      .order('correct_count', { ascending: false })
      .order('updated_at', { ascending: true });
    setScores((data || []) as Score[]);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    void loadRoom();
    void loadQuestions();
    void loadScores();

    const roomChannel = client
      .channel('host-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${ROOM_ID}` }, loadRoom)
      .subscribe();

    const questionChannel = client
      .channel('host-questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, loadQuestions)
      .subscribe();

    const answerChannel = client
      .channel('host-answers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `room_id=eq.${ROOM_ID}` }, () => loadAnswers(room.question_id))
      .subscribe();

    const scoreChannel = client
      .channel('host-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `room_id=eq.${ROOM_ID}` }, loadScores)
      .subscribe();

    return () => {
      void client.removeChannel(roomChannel);
      void client.removeChannel(questionChannel);
      void client.removeChannel(answerChannel);
      void client.removeChannel(scoreChannel);
    };
  }, [loadAnswers, loadQuestions, loadRoom, loadScores, room.question_id]);

  useEffect(() => {
    void loadAnswers(room.question_id);
  }, [loadAnswers, room.question_id]);

  const counts = useMemo(
    () =>
      choices.reduce(
        (acc, c) => ({ ...acc, [c]: answers.filter((a) => a.selected_choice === c).length }),
        { A: 0, B: 0, C: 0, D: 0 },
      ),
    [answers],
  );

  const startQuestion = async (questionId: string) => {
    if (!supabase) return;
    const client = supabase;
    setBusy(true);
    try {
      await client.from('rooms').upsert({
        id: ROOM_ID,
        question_id: questionId,
        status: 'open',
        updated_at: new Date().toISOString(),
      });
      await loadRoom();
      await loadAnswers(questionId);
    } finally {
      setBusy(false);
    }
  };

  const closeQuestion = async () => {
    if (!supabase || !room.question_id) return;
    const client = supabase;
    await client.from('rooms').upsert({
      id: ROOM_ID,
      question_id: room.question_id,
      status: 'closed',
      updated_at: new Date().toISOString(),
    });
    await loadRoom();
  };

  const applyScore = async () => {
    if (!supabase || !room.question_id || !currentQuestion) return;
    const client = supabase;
    setBusy(true);
    try {
      const { data: existingEvent } = await client
        .from('score_events')
        .select('room_id, question_id')
        .eq('room_id', ROOM_ID)
        .eq('question_id', room.question_id)
        .maybeSingle();

      if (existingEvent) {
        alert('この問題はすでに正解反映済みです。');
        return;
      }

      const winners = answers.filter((a) => a.selected_choice === currentQuestion.correct_choice);
      for (const w of winners) {
        const { data } = await client
          .from('scores')
          .select('correct_count')
          .eq('room_id', ROOM_ID)
          .eq('name', w.name)
          .maybeSingle();

        const nextCount = (data?.correct_count || 0) + 1;
        await client.from('scores').upsert({
          room_id: ROOM_ID,
          name: w.name,
          correct_count: nextCount,
          updated_at: new Date().toISOString(),
        });
      }

      await client.from('score_events').insert({
        room_id: ROOM_ID,
        question_id: room.question_id,
      });

      await loadScores();
      alert('正解反映が完了しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">ホスト画面</h1>
      <p className="rounded bg-slate-200 p-3 text-sm">
        手順: 問題一覧から開始 → 回答締切 → スライドで正解発表 → 正解反映 → 次の問題へ
      </p>
      {supabaseConfigError && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{supabaseConfigError}</p>
      )}

      <section className="rounded bg-white p-4 shadow space-y-2">
        <h2 className="font-semibold">現在の出題</h2>
        <p className="text-sm text-slate-600">状態: {room.status}</p>
        <p className="font-semibold">{currentQuestion?.question_text || 'まだ問題は開始されていません'}</p>
      </section>

      <section className="rounded bg-white p-4 shadow space-y-3">
        <h2 className="font-semibold">問題一覧（事前登録）</h2>
        {questions.length === 0 ? (
          <p className="text-slate-500">questions テーブルに問題を登録してください。</p>
        ) : (
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Q{q.question_no}. {q.question_text}</p>
                  <button
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                    disabled={!!supabaseConfigError || busy}
                    onClick={() => startQuestion(q.id)}
                  >
                    この問題を開始
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-600">A:{q.choice_a} / B:{q.choice_b} / C:{q.choice_c} / D:{q.choice_d}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded bg-white p-4 shadow space-y-3">
        <h2 className="font-semibold">回答状況（{answers.length}人）</h2>
        {choices.map((c) => (
          <ResponseBar key={c} label={c} count={counts[c]} total={answers.length} />
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            className="rounded bg-rose-600 p-3 text-white disabled:bg-slate-400"
            disabled={!room.question_id || !!supabaseConfigError || busy}
            onClick={closeQuestion}
          >
            回答締切
          </button>
          <button
            className="rounded bg-emerald-600 p-3 text-white disabled:bg-slate-400"
            disabled={!room.question_id || !currentQuestion || !!supabaseConfigError || busy}
            onClick={applyScore}
          >
            正解反映
          </button>
        </div>
      </section>

      <section className="rounded bg-white p-4 shadow space-y-2">
        <h2 className="font-semibold">ランキング</h2>
        {scores.length === 0 ? (
          <p className="text-slate-500">まだスコアがありません</p>
        ) : (
          <ol className="space-y-1">
            {scores.map((s, i) => (
              <li key={s.name} className="flex justify-between rounded bg-slate-50 p-2">
                <span>{i + 1}. {s.name}</span>
                <span>{s.correct_count}問</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
