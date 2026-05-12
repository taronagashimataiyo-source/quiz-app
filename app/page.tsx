import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-center text-2xl font-bold">リアルタイムクイズMVP</h1>
      <p className="text-center text-sm text-slate-600">利用する画面を選んでください</p>
      <Link className="w-full rounded bg-slate-800 p-3 text-center font-semibold text-white" href="/host">ホスト画面へ</Link>
      <Link className="w-full rounded bg-blue-600 p-3 text-center font-semibold text-white" href="/player">参加者画面へ</Link>
    </main>
  );
}
