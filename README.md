# Realtime Quiz MVP (Supabase版)

Next.js + TypeScript + Tailwind + Supabase Realtime で作る、20人規模クイズ大会MVPです。  
固定 `room_id = default-room` で運用します（複数ルームなし）。

## セットアップ

1. `npm install`
2. `.env.example` をコピーして `.env.local` を作成
3. Supabaseの値を設定
4. `npm run dev`

## 環境変数

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

## Supabaseプロジェクト作成

1. Supabaseにログインして New project
2. Organization / Project Name / DB Password / Region を入力して作成
3. 作成後、Settings > API で以下を取得
   - Project URL
   - anon public key
4. `.env.local` または Vercel の Environment Variables に設定

## Supabase SQL（SQL Editorに貼り付け）

Supabase Dashboard > SQL Editor にそのまま貼って実行してください。

```sql
create table if not exists rooms (
  id text primary key,
  question_id text,
  status text not null default 'waiting',
  updated_at timestamptz not null default now()
);

alter table rooms alter column question_id drop not null;

create table if not exists questions (
  id text primary key,
  question_no int not null,
  question_text text not null,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null,
  correct_choice text not null,
  answer_type text not null default 'single',
  created_at timestamptz not null default now()
);

create table if not exists answers (
  room_id text not null,
  question_id text not null,
  name text not null,
  selected_choice text not null,
  submitted_at timestamptz not null default now(),
  primary key (room_id, question_id, name)
);

create table if not exists scores (
  room_id text not null,
  name text not null,
  correct_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, name)
);

create table if not exists score_events (
  room_id text not null,
  question_id text not null,
  applied_at timestamptz not null default now(),
  primary key (room_id, question_id)
);

insert into rooms (id, question_id, status)
values ('default-room', null, 'waiting')
on conflict (id) do update set
  question_id = excluded.question_id,
  status = excluded.status,
  updated_at = now();

insert into questions (id, question_no, question_text, choice_a, choice_b, choice_c, choice_d, correct_choice, answer_type)
values
  ('q001', 1, '日本の首都はどこ？', '大阪', '東京', '名古屋', '福岡', 'B', 'single'),
  ('q002', 2, '2 + 2 = ?', '3', '4', '5', '6', 'B', 'single'),
  ('q003', 3, '地球は何番目の惑星？', '2番目', '3番目', '4番目', '5番目', 'B', 'single')
on conflict (id) do update set
  question_no = excluded.question_no,
  question_text = excluded.question_text,
  choice_a = excluded.choice_a,
  choice_b = excluded.choice_b,
  choice_c = excluded.choice_c,
  choice_d = excluded.choice_d,
  correct_choice = excluded.correct_choice,
  answer_type = excluded.answer_type;

alter table rooms disable row level security;
alter table questions disable row level security;
alter table answers disable row level security;
alter table scores disable row level security;
alter table score_events disable row level security;
```

## Realtime有効化手順

Supabase Dashboard で以下をONにしてください。

1. Database > Replication を開く
2. `rooms`, `questions`, `answers`, `scores` を Realtime対象にON
3. `score_events` は重複加点防止用なのでRealtime不要です

## 画面

- `/` : ホスト/参加者への導線
- `/player` : 名前入力 → 4択回答送信（1問1回、変更不可）
- `/host` : 問題一覧から開始、回答締切、正解反映、回答率バー、ランキング

## ホスト側の使い方

1. `/host` を開く
2. 「問題一覧（事前登録）」から対象問題の「この問題を開始」を押す
3. 参加者が回答すると、回答人数とA/B/C/D回答率バーがリアルタイム更新
4. スライド等で正解発表
5. 「回答締切」を押す
6. 「正解反映」を押す（この時だけ scores に加点）
7. 次の問題の「この問題を開始」を押す

## 二重加点防止

`score_events (room_id, question_id)` を記録し、同じ問題の正解反映を1回に制限しています。

## 参加者側の使い方

1. `/player` を開く（QRコード経由でも可）
2. 名前を入力して参加
3. 出題中の問題で A/B/C/D から1つ選んで送信
4. 送信後は同じ問題で再送信できません

## QRコードにするURL

参加者配布用: `https://あなたのドメイン/player`

このURLをQRコード化し、会場で表示してください。

## Vercelデプロイ手順

1. GitHub連携してVercelプロジェクトを作成
2. Vercel > Project Settings > Environment Variables に以下を登録
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 再デプロイ
4. `/host` と `/player` の動作を確認

## 動作確認チェック

1. `/host` で問題開始
2. `/player` で別名義から回答
3. `/host` の回答人数・回答率バーがリアルタイム更新
4. `/host` で回答締切
5. `/host` で正解反映
6. ランキングが更新
7. 同じ問題で再度正解反映すると重複加点されない
