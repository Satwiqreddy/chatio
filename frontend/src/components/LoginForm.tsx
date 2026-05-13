'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, User, Mail, Lock, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    localStorage.removeItem('jwt');
    localStorage.removeItem('username');

    try {
      if (isLogin) {
        const { data } = await api.post('/api/auth/local', {
          identifier: username,
          password,
        });
        localStorage.setItem('jwt', data.jwt);
        localStorage.setItem('username', data.user.username);
        router.push('/chat');
      } else {
        const { data } = await api.post('/api/auth/local/register', {
          username,
          email,
          password,
        });
        localStorage.setItem('jwt', data.jwt);
        localStorage.setItem('username', data.user.username);
        router.push('/chat');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Something went wrong. Try again.';
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-[#2b6ef5] rounded-full flex items-center justify-center mb-3 shadow">
          <MessageCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#111b21]">ChatIO</h1>
        <p className="text-[#667781] text-sm mt-1">Real-time messaging for everyone</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <h2 className="text-xl font-semibold text-[#111b21] mb-1 text-center">
          {isLogin ? 'Sign in' : 'Create account'}
        </h2>
        <p className="text-sm text-[#667781] text-center mb-6">
          {isLogin ? 'Welcome back!' : 'Join the conversation today.'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-xs font-medium text-[#667781] uppercase tracking-wide block mb-1">Username</label>
            <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2.5 bg-[#f0f2f5] focus-within:border-[#25d366] transition">
              <User className="w-4 h-4 text-[#adb5bd] mr-2 shrink-0" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="flex-1 bg-transparent text-[#111b21] text-sm placeholder:text-[#adb5bd]"
              />
            </div>
          </div>

          {/* Email (register only) */}
          {!isLogin && (
            <div>
              <label className="text-xs font-medium text-[#667781] uppercase tracking-wide block mb-1">Email</label>
              <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2.5 bg-[#f0f2f5] focus-within:border-[#25d366] transition">
                <Mail className="w-4 h-4 text-[#adb5bd] mr-2 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="flex-1 bg-transparent text-[#111b21] text-sm placeholder:text-[#adb5bd]"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-[#667781] uppercase tracking-wide block mb-1">Password</label>
            <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2.5 bg-[#f0f2f5] focus-within:border-[#25d366] transition">
              <Lock className="w-4 h-4 text-[#adb5bd] mr-2 shrink-0" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                className="flex-1 bg-transparent text-[#111b21] text-sm placeholder:text-[#adb5bd]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#25d366] hover:bg-[#2563eb] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p className="text-center text-sm text-[#667781] mt-6">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-[#1a4fc4] font-semibold hover:underline"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
