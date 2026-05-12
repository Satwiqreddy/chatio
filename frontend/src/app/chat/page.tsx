import ChatRoom from '@/components/ChatRoom';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <header className="max-w-6xl mx-auto py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
          ChatIO
        </h1>
      </header>
      <ChatRoom />
    </div>
  );
}
