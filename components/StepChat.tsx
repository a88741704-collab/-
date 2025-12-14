
import React, { useState } from 'react';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepChat: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'assistant' | 'topics'>('assistant');
  const [expandedDirectory, setExpandedDirectory] = useState(false);

  // Mock messages for demo since ProjectState needs deep updates to support full chat history logic properly
  // In a real app, this would use project.conversations
  const [messages, setMessages] = useState([
      { id: '1', role: 'assistant', content: '你好！我是你的小说创作助手。我们可以从灵感构思开始，或者你可以上传现有的大纲。输入 / 呼出指令。' }
  ]);

  const handleSend = () => {
      if (!input.trim()) return;
      const newMsg = { id: Date.now().toString(), role: 'user', content: input };
      // @ts-ignore
      setMessages([...messages, newMsg]);
      setInput('');
      
      // Simulate reply
      setTimeout(() => {
          // @ts-ignore
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: '收到！这是一个很棒的点子。我们可以从世界观开始构建...' }]);
      }, 1000);
  };

  return (
    <div className="h-full flex gap-0 bg-[#0B0C0F] text-slate-200">
        
        {/* Left Sidebar (Topics/Assistant) */}
        <div className="w-64 flex flex-col border-r border-slate-800 bg-[#151b28]">
             <div className="flex border-b border-slate-800">
                 <button onClick={() => setActiveTab('assistant')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'assistant' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>助手</button>
                 <button onClick={() => setActiveTab('topics')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'topics' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>话题</button>
             </div>
             
             <div className="p-4">
                 <button className="w-full flex items-center gap-2 text-slate-400 hover:text-white mb-4">
                     <span className="text-xl">+</span> 添加会话
                 </button>
                 <div className="space-y-2">
                     <div className="p-2 bg-slate-800 rounded text-sm text-white">未命名会话</div>
                     <div className="p-2 hover:bg-slate-800/50 rounded text-sm text-slate-400 cursor-pointer">女尊小说续写第三章</div>
                     <div className="p-2 hover:bg-slate-800/50 rounded text-sm text-slate-400 cursor-pointer">去AI味提示词精简</div>
                 </div>
             </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative">
             {/* Header */}
             <div className="h-12 border-b border-slate-800 flex items-center px-6 gap-2 text-sm text-slate-400">
                 <span className="text-amber-500">★ Agent</span>
                 <span>&gt;</span>
                 <span>续写第三章完成</span>
                 <span>&gt;</span>
                 <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-xs">
                     <span>🌊</span> DeepSeek Reasoner
                 </div>
             </div>

             {/* Messages */}
             <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                 {messages.map((msg: any) => (
                     <div key={msg.id} className="flex gap-4 max-w-3xl mx-auto">
                         <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                             {msg.role === 'user' ? 'U' : 'AI'}
                         </div>
                         <div className="flex-1 space-y-1">
                             <div className="font-bold text-sm text-slate-300">{msg.role === 'user' ? '用户' : 'Agent'}</div>
                             <div className="text-slate-200 leading-relaxed bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                 {msg.content}
                             </div>
                         </div>
                     </div>
                 ))}
             </div>

             {/* Input Area */}
             <div className="p-6 pb-8">
                 <div className="max-w-3xl mx-auto bg-[#1e232b] border border-slate-700 rounded-xl p-2 shadow-xl relative focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
                     <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="在这里输入消息，按 Enter 发送 - @ 选择路径，/ 选择命令"
                        className="w-full bg-transparent border-none text-slate-200 p-2 resize-none focus:outline-none min-h-[60px]"
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                     />
                     <div className="flex justify-between items-center px-2 pb-1 text-slate-500">
                         <div className="flex gap-2">
                             <button className="hover:text-emerald-400 p-1" title="上传文件">➕</button>
                             <button className="hover:text-emerald-400 p-1" title="命令">></button>
                             <button onClick={() => setExpandedDirectory(!expandedDirectory)} className={`hover:text-emerald-400 p-1 ${expandedDirectory ? 'text-emerald-400' : ''}`} title="活动目录">📂</button>
                         </div>
                         <button onClick={handleSend} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs">发送</button>
                     </div>

                     {/* Quick Phrases / Active Directory Popup */}
                     {expandedDirectory && (
                         <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#151b28] border border-slate-700 rounded-xl shadow-2xl p-2 animate-fade-in">
                             <h4 className="text-xs font-bold text-slate-500 uppercase px-2 mb-2">活动目录 (Quick Phrases)</h4>
                             <div className="space-y-1">
                                 {project.quickPhrases.map((phrase, i) => (
                                     <div key={i} className="text-xs text-slate-300 p-2 hover:bg-slate-700 rounded cursor-pointer truncate" onClick={() => setInput(prev => prev + phrase)}>
                                         {phrase}
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}
                 </div>
             </div>
        </div>
    </div>
  );
};

export default StepChat;
