'use client';

import { useEffect, useMemo, useState } from 'react';
import { ROOM_ID, supabase, supabaseConfigError } from '@/lib/supabase';
import { Choice, Room } from '@/lib/types';

const choiceLabels: Choice[] = ['A', 'B', 'C', 'D'];

export default function PlayerPage() {
  const [name, setName] = useState('');
  const [joinedName, setJoinedName] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    const load = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', ROOM_ID).maybeSingle();
      if (data) setRoom(data as Room);
    };
    void load();

    const channel = supabase
      .channel('player-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${ROOM_ID}` }, load)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !joinedName || !room?.question_id) return;

    const load = async () => {
      const { data } = await supabase
        .from('answers')
        .select('selected_choice')
        .eq('room_id', ROOM_ID)
        .eq('question_id', room.question_id)
        .eq('name', joinedName)
        .maybeSingle();
      setSubmitted(Boolean(data));
      if (data?.selected_choice) setSelected(data.selected_choice as Choice);
    };
    void load();

    const channel = supabase
      .channel(`player-answer-${joinedName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `room_id=eq.${ROOM_ID}` }, load)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [joinedName, room?.question_id]);

  const canAnswer = useMemo(() => !!joinedName && room?.status === 'open' && !submitted, [joinedName, room?.status, submitted]);

  const submitAnswer = async () => {
    if (!supabase || !room || !selected || !joinedName || submitted) return;
    await supabase.from('answers').insert({
      room_id: ROOM_ID,
      question_id: room.question_id,
      name: joinedName,
      selected_choice: selected,
    });
    setSubmitted(true);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 p-4">
      <h1 className="text-2xl font-bold">参加者画面</h1>
      <p className="rounded bg-slate-200 p-3 text-sm">手順: ①名前入力 → ②選択肢を1つ選ぶ → ③送信</p>
      {supabaseConfigError && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{supabaseConfigError}</p>}

      {!joinedName ? (
        <div className="space-y-3 rounded bg-white p-4 shadow">
          <label className="text-sm font-medium">表示名</label>
          <input className="w-full rounded border p-2" placeholder="例: たなか" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="w-full rounded bg-blue-600 p-3 text-white disabled:bg-slate-400" disabled={!name.trim() || !!supabaseConfigError} onClick={() => setJoinedName(name.trim())}>参加する</button>
        </div>
      ) : (
        <section className="space-y-3 rounded bg-white p-4 shadow">
          <p className="text-sm text-slate-600">参加名: <span className="font-semibold">{joinedName}</span></p>
          <h2 className="font-semibold">現在の問題</h2>
          <p>{room?.question_text || 'ホストが問題を準備中です。'}</p>
          <div className="grid grid-cols-2 gap-2">
            {choiceLabels.map((c) => {
              const text = c === 'A' ? room?.choice_a : c === 'B' ? room?.choice_b : c === 'C' ? room?.choice_c : room?.choice_d;
              return (
                <button key={c} disabled={!canAnswer} onClick={() => setSelected(c)} className={`rounded border p-3 text-left ${selected === c ? 'border-blue-600 bg-blue-50' : 'border-slate-300'} disabled:opacity-50`}>
                  <div className="font-bold">{c}</div>
                  <div className="text-sm">{text || '-'}</div>
                </button>
              );
            })}
          </div>
          <button disabled={!canAnswer || !selected} onClick={submitAnswer} className="w-full rounded bg-emerald-600 p-3 font-semibold text-white disabled:bg-slate-400">回答を送信</button>
          {submitted && <p className="font-semibold text-emerald-700">回答済みです（変更不可）</p>}
          {room?.status === 'closed' && <p className="text-slate-700">この問題は締め切られました。</p>}
        </section>
      )}
    </main>
  );
}
