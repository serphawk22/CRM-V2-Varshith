"use client";

import { useState } from 'react';
import { MessageSquare, X, Users, UserPlus, Mail, ChevronRight, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user', text: string }[]>([
    { role: 'bot', text: 'Hi! I am the SERP Hawk Assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const router = useRouter();

  const handleCommand = (command: string) => {
    setMessages(prev => [...prev, { role: 'user', text: command }]);
    
    setTimeout(() => {
      let botResponse = '';
      if (command === 'View Customer') {
        botResponse = 'Taking you to the clients list. You can select a customer to view their details.';
        router.push('/clients');
      } else if (command === 'Add Customer') {
        botResponse = 'Navigating to the clients page where you can add a new customer.';
        router.push('/clients?action=add');
      } else if (command === 'Send Email') {
        botResponse = 'Opening the Email Agent to generate and send a new email.';
        router.push('/email-agent');
      } else {
        botResponse = 'I can help you with specific tasks. Try clicking one of the quick actions below!';
      }
      
      setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    handleCommand(input);
    setInput('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 lg:w-96 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span className="font-bold">SERP Hawk Assistant</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-blue-100 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 h-80 overflow-y-auto bg-slate-50 flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="p-3 border-t border-gray-100 bg-white space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Quick Actions</p>
            <button 
              onClick={() => handleCommand('View Customer')}
              className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-sm text-gray-700 transition-colors border border-transparent hover:border-slate-200"
            >
              <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> View Customer</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button 
              onClick={() => handleCommand('Add Customer')}
              className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-sm text-gray-700 transition-colors border border-transparent hover:border-slate-200"
            >
              <span className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-green-500" /> Add Customer</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button 
              onClick={() => handleCommand('Send Email')}
              className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-sm text-gray-700 transition-colors border border-transparent hover:border-slate-200"
            >
              <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-purple-500" /> Send Email</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              type="submit"
              disabled={!input.trim()}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center group"
        >
          <MessageSquare className="w-6 h-6 group-hover:animate-pulse" />
        </button>
      )}
    </div>
  );
}
