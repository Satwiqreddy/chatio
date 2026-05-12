'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, LogIn, UserPlus, ArrowRight, Loader2 } from 'lucide-react';
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

    // Clear any stale tokens from previous sessions/databases
    localStorage.removeItem('jwt');
    localStorage.removeItem('username');


    try {
      if (isLogin) {
        const { data } = await api.post('/api/auth/local', {
          identifier: username,
          password: password,
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
      setError(err.response?.data?.error?.message || 'Authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div className="glass p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
        {/* Decorative background blur */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-400/20 rounded-full blur-3xl group-hover:bg-green-500/30 transition-all duration-500"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-400/20 rounded-full blur-3xl group-hover:bg-teal-500/30 transition-all duration-500"></div>

        <div className="relative z-10">
          <div className="flex justify-center mb-6">
            <img src="https://img.icons8.com/fluency/96/chat--v1.png" alt="ChatIO Logo" className="w-16 h-16" />
          </div>
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-center text-slate-600 mb-8 text-sm">
            {isLogin ? 'Sign in to stay connected' : 'Join our premium chat community'}
          </p>
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-xs flex items-center gap-2"
              >
                <div className="w-1 h-1 rounded-full bg-red-400"></div>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-slate-900 outline-none transition-all placeholder:text-slate-400"
                  placeholder="Your username"
                />
              </div>
            </div>

            {!isLogin && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1"
              >
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-slate-900 outline-none transition-all placeholder:text-slate-400"
                    placeholder="name@example.com"
                  />
                </div>
              </motion.div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-slate-900 outline-none transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  {isLogin ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center gap-2 mx-auto group"
            >
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <span className="text-green-600 font-semibold group-hover:underline">
                {isLogin ? 'Sign up' : 'Sign in'}
              </span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
