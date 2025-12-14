
import React, { useState } from 'react';
import { ProjectState } from '../types';
import { generateComicPanel } from '../geminiService';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
}

const StepComic: React.FC<Props> = ({ project, setProject }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGen = async () => {
      setLoading(true);
      try {
          const img = await generateComicPanel(prompt);
          setGeneratedImage(img);
      } catch (e) {
          alert("Generation failed");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
            <span>🎨</span> 漫画生成实验室
        </h2>
        
        <div className="flex-1 flex flex-col gap-6">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述分镜画面，例如：一个身穿黑色风衣的男子站在雨中，眼神冷冽..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:border-purple-500 focus:outline-none min-h-[100px]"
                />
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={handleGen}
                        disabled={loading || !prompt}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        {loading ? '绘制中...' : '生成分镜'}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-black rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden relative">
                {generatedImage ? (
                    <img src={generatedImage} alt="Comic" className="max-h-full max-w-full object-contain" />
                ) : (
                    <div className="text-slate-600 flex flex-col items-center">
                        <span className="text-4xl mb-2">🖼️</span>
                        <p>预览区域</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default StepComic;
