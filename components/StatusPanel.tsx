import React from 'react';
import { AgentStatus } from '../types';

interface Props {
  status: AgentStatus;
  task: string;
}

const StatusPanel: React.FC<Props> = ({ status, task }) => {
  if (status === 'idle') {
      return (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex items-center gap-3 w-full transition-all">
              <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
              <span className="text-xs text-slate-500 font-mono">AGENT STANDBY</span>
          </div>
      )
  }

  return (
    <div className={`bg-slate-900/90 backdrop-blur border ${status === 'error' ? 'border-red-500/50' : 'border-indigo-500/50'} rounded-xl p-4 w-full shadow-lg animate-fade-in relative overflow-hidden`}>
      {/* Background Pulse Effect */}
      <div className={`absolute inset-0 opacity-10 ${status === 'error' ? 'bg-red-500' : 'bg-indigo-500'} animate-pulse pointer-events-none`}></div>

      <div className="flex items-center gap-3 mb-2 relative z-10">
        {status === 'thinking' && (
             <div className="relative flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
             </div>
        )}
        {status === 'generating' && (
             <div className="relative flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
             </div>
        )}
        {status === 'error' && (
             <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
        )}
        
        <span className={`text-xs font-bold uppercase tracking-wider ${
            status === 'thinking' ? 'text-amber-400' : 
            status === 'generating' ? 'text-emerald-400' :
            'text-red-400'
        }`}>
            {status === 'thinking' ? 'AGENT THINKING' : status === 'generating' ? 'AGENT GENERATING' : 'SYSTEM ERROR'}
        </span>
      </div>
      <div className="text-xs text-slate-300 font-mono border-t border-slate-700/50 pt-2 mt-1 relative z-10 leading-relaxed">
          &gt; {task}
          <span className="animate-pulse">_</span>
      </div>
    </div>
  );
};

export default StatusPanel;