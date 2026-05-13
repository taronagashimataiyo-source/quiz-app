'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResponseBar } from '@/components/ResponseBar';
import { ROOM_ID, supabase, supabaseConfigError } from '@/lib/supabase';
import { Answer, Choice, Room, Score } from '@/lib/types';

const choices: Choice[] = ['A', 'B', 'C', 'D'];

const initialRoom: Room = {
  id: ROOM_ID,
  question_id: 'q1',
  question_text: '',
  choice_a: '',
  choice_b: '',
  choice_c: '',
  choice_d: '',
  correct_choice: null,
  status: 'waiting',
  updated_at: new Date().toISOString(),
};

export default function HostPage() {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const loadRoom = async () => {
      const { data } = await client.from('rooms').select('*').eq('id', ROOM_ID).maybeSingle();
      if (data) setRoom(data as Room);
    };
    const loadScores = async () => {
      const { data } = await client.from('scores').select('*').eq('room_id', ROOM_ID).order('correct_count', { ascending: false });
      setScores((data || []) as Score[]);
    };
    void loadRoom();
    void loadScores();

    const roomChannel = client.channel('host-room').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${ROOM_ID}` }, loadRoom).subscribe();
    const answerChannel = client.channel('host-answers').on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `room_id=eq.${ROOM_ID}` }, async () => {
      const { data } = await client.from('answers').select('*').eq('room_id', ROOM_ID).eq('question_id', room.question_id);
      setAnswers((data || []) as Answer[]);
    }).subscribe();
    const scoreChannel = client.channel('host-scores').on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `room_id=eq.${ROOM_ID}` }, loadScores).subscribe();

    return () => {
      void client.removeChannel(roomChannel);
      void client.removeChannel(answerChannel);
      void client.removeChannel(scoreChannel);
    };
  }, [room.question_id]);

  const counts = useMemo(() => choices.reduce((acc, c) => ({ ...acc, [c]: answers.filter((a) => a.selected_choice === c).length }), { A: 0, B: 0, C: 0, D: 0 }), [answers]);

  const upsertRoom = async (next: Room) => {
    if (!supabase) return;
    const client = supabase;
    await client.from('rooms').upsert({ ...next, updated_at: new Date().toISOString() });
  };

  const startQuestion = async () => {
    const next = { ...room, question_id: `q${Date.now()}`, status: 'open' as const };
    setRoom(next);
    await upsertRoom(next);
  };

  const closeQuestion = async () => {
    const closed = { ...room, status: 'closed' as const };
    setRoom(closed);
    await upsertRoom(closed);
    if (!supabase || !room.correct_choice) return;
    const client = supabase;

    const winners = answers.filter((a) => a.selected_choice === room.correct_choice);
    for (const w of winners) {
      const { data } = await client.from('scores').select('correct_count').eq('room_id', ROOM_ID).eq('name', w.name).maybeSingle();
      const nextCount = (data?.correct_count || 0) + 1;
      await client.from('scores').upsert({ room_id: ROOM_ID, name: w.name, correct_count: nextCount, updated_at: new Date().toISOString() });
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">ホスト画面</h1>
      <p className="rounded bg-slate-200 p-3 text-sm">手順: 問題入力 → 正解選択 → 問題開始 → 回答締切 → ランキング確認</p>
      {supabaseConfigError && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{supabaseConfigError}</p>}

      <section className="space-y-3 rounded bg-white p-4 shadow">
        <h2 className="font-semibold">問題設定</h2>
        <input className="w-full rounded border p-2" placeholder="問題文" value={room.question_text} onChange={(e) => setRoom((v) => ({ ...v, question_text: e.target.value }))} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className="rounded border p-2" placeholder="選択肢 A" value={room.choice_a} onChange={(e) => setRoom((v) => ({ ...v, choice_a: e.target.value }))} />
          <input className="rounded border p-2" placeholder="選択肢 B" value={room.choice_b} onChange={(e) => setRoom((v) => ({ ...v, choice_b: e.target.value }))} />
          <input className="rounded border p-2" placeholder="選択肢 C" value={room.choice_c} onChange={(e) => setRoom((v) => ({ ...v, choice_c: e.target.value }))} />
          <input className="rounded border p-2" placeholder="選択肢 D" value={room.choice_d} onChange={(e) => setRoom((v) => ({ ...v, choice_d: e.target.value }))} />
        </div>
        <div>
          <p className="mb-2 text-sm text-slate-600">正解を選択</p>
          <div className="flex flex-wrap gap-2">
            {choices.map((c) => <button key={c} onClick={() => setRoom((v) => ({ ...v, correct_choice: c }))} className={`rounded border px-3 py-2 ${room.correct_choice === c ? 'border-green-600 bg-green-50' : ''}`}>正解: {c}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded bg-blue-600 p-3 text-white disabled:bg-slate-400" disabled={!!supabaseConfigError} onClick={startQuestion}>問題開始</button>
          <button className="rounded bg-rose-600 p-3 text-white disabled:bg-slate-400" disabled={!!supabaseConfigError} onClick={closeQuestion}>回答締切</button>
        </div>
      </section>

      <section className="rounded bg-white p-4 shadow space-y-3">
        <h2 className="font-semibold">回答状況（{answers.length}人）</h2>
        {choices.map((c) => <ResponseBar key={c} label={c} count={counts[c]} total={answers.length} />)}
      </section>

      <section className="rounded bg-white p-4 shadow space-y-2">
        <h2 className="font-semibold">ランキング</h2>
        {scores.length === 0 ? <p className="text-slate-500">まだスコアがありません</p> : (
          <ol className="space-y-1">
            {scores.map((s, i) => <li key={s.name} className="flex justify-between rounded bg-slate-50 p-2"><span>{i + 1}. {s.name}</span><span>{s.correct_count}問</span></li>)}
          </ol>
        )}
      </section>
    </main>
  );
}
