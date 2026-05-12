'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquare, ArrowRight, Shield, Zap, Sparkles, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="max-w-4xl w-full text-center space-y-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-700 text-xs font-bold uppercase tracking-widest mb-8">
            <Sparkles className="w-3 h-3" /> New: Real-time Audio soon
          </div>
          <div className="flex justify-center mb-8">
            <img src="https://img.icons8.com/fluency/144/chat--v1.png" alt="ChatIO Logo" className="w-24 h-24 rounded-3xl" />
          </div>
          <h1 className="text-7xl md:text-8xl font-black text-slate-900 tracking-tighter mb-6">
            Chat<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600">IO</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            The next generation of real-time communication. 
            Experience speed and security in every message.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
        >
          <Link
            href="/login"
            className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-green-500/20 transform transition-all hover:-translate-y-1 flex items-center justify-center gap-2 group"
          >
            Start Chatting Now
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <button className="w-full sm:w-auto px-10 py-5 glass hover:bg-white/90 text-slate-900 font-bold rounded-2xl transition-all">
            View Features
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12"
        >
          {[
            { icon: <Zap className="w-6 h-6 text-amber-500" />, title: "Instant", desc: "Sub-millisecond delivery" },
            { icon: <Shield className="w-6 h-6 text-green-500" />, title: "Secure", desc: "End-to-end encrypted" },
            { icon: <Users className="w-6 h-6 text-emerald-500" />, title: "Social", desc: "Unlimited active rooms" }
          ].map((feature, i) => (
            <div key={i} className="glass p-6 rounded-2xl text-left group hover:border-green-500/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <div className="flex justify-center mb-6">
                <img src="/logo.png" alt="ChatIO Logo" className="w-16 h-16 rounded-2xl shadow-lg" />
              </div>
              <h2 className="text-3xl font-bold text-center text-slate-900 mb-2">
                {feature.title}
              </h2>
              <p className="text-sm text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <footer className="absolute bottom-10 text-slate-600 text-xs font-bold uppercase tracking-[0.2em]">
        Built for Full-Stack Excellence
      </footer>
    </div>
  );
}
