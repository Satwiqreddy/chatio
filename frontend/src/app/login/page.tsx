import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-2">
          ChatIO
        </h1>
        <p className="text-slate-400">Connect in real-time with everyone.</p>
      </div>
      <LoginForm />
    </div>
  );
}
