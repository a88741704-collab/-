
import React, { useState } from 'react';
import { ProjectState } from '../types';
import { generateSceneVideo } from '../geminiService';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
}

const StepVideo: React.FC<Props> = ({ project, setProject }) => {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGen = async () => {
      setLoading(true);
      try {
          const url = await generateSceneVideo(prompt);
          setVideoUrl(url);
      } catch (e) {
          alert("Generation failed");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-pink-400 flex items-center gap-2">
            <span>🎬</span> 视频生成实验室 (Veo)
        </h2>
        
        <div className="flex-1 flex flex-col gap-6">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述动态场景，例如：镜头推进，展现一座赛博朋克城市的霓虹灯夜景..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:border-pink-500 focus:outline-none min-h-[100px]"
                />
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={handleGen}
                        disabled={loading || !prompt}
                        className="bg-pink-600 hover:bg-pink-500 text-white px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        {loading ? '渲染中 (需等待)...' : '生成视频'}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-black rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden relative">
                {videoUrl ? (
                    <video controls src={videoUrl} className="max-h-full max-w-full" />
                ) : (
                    <div className="text-slate-600 flex flex-col items-center">
                        <span className="text-4xl mb-2">🎥</span>
                        <p>视频预览</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default StepVideo;
