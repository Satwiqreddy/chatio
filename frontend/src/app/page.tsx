'use client';

import Link from 'next/link';
import { MessageCircle, Shield, Zap, Users, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-[#128c7e] text-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-7 h-7" />
          <span className="text-xl font-bold">ChatIO</span>
        </div>
        <Link
          href="/login"
          className="bg-white text-[#128c7e] font-semibold text-sm px-5 py-2 rounded-full hover:bg-gray-100 transition"
        >
          Get Started
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center bg-[#f0f2f5]">
        <div className="w-24 h-24 bg-[#25d366] rounded-full flex items-center justify-center mb-6 shadow-lg">
          <MessageCircle className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-[#111b21] mb-4">
          Simple, Reliable Messaging
        </h1>
        <p className="text-[#667781] text-lg max-w-md mb-8 leading-relaxed">
          Connect with friends and groups in real time. Fast, secure, and always free.
        </p>
        <Link
          href="/login"
          className="flex items-center gap-2 bg-[#25d366] hover:bg-[#22c55e] text-white font-semibold px-8 py-4 rounded-full text-lg shadow-md transition"
        >
          Start Chatting <ArrowRight className="w-5 h-5" />
        </Link>
      </main>

      {/* Features */}
      <section className="bg-white py-12 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: <Zap className="w-6 h-6 text-[#25d366]" />, title: 'Instant', desc: 'Messages delivered in milliseconds' },
            { icon: <Shield className="w-6 h-6 text-[#25d366]" />, title: 'Secure', desc: 'JWT-protected authentication' },
            { icon: <Users className="w-6 h-6 text-[#25d366]" />, title: 'Groups', desc: 'Create and manage group chats' },
          ].map((f, i) => (
            <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl border border-gray-100 hover:shadow-sm transition">
              <div className="w-12 h-12 bg-[#f0fdf4] rounded-full flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold text-[#111b21] mb-1">{f.title}</h3>
              <p className="text-sm text-[#667781]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-sm text-[#adb5bd] py-6 border-t border-gray-100">
        © 2026 ChatIO. All rights reserved.
      </footer>
    </div>
  );
}
