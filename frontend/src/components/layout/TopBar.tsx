import { Menu, Play, FileCode, Settings } from 'lucide-react';
import { useUIStore } from '@store/slices/uiSlice';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useEditorStore } from '@store/slices/editorSlice';
import { useSocket } from '@hooks/useSocket';
import FileLoader from '@components/editor/FileLoader';
import { APP_CONFIG } from '@config/app.config';

export default function TopBar() {
  const { isSidebarOpen, toggleSidebar } = useUIStore();
  const { isAnalyzing } = useExecutionStore();
  const { code } = useEditorStore();
  const { generateTrace, isConnected } = useSocket();

  const handleRun = () => {
    if (!code.trim()) {
      return;
    }
    
    if (!isConnected) {
      alert('Not connected to server');
      return;
    }
    
    // Auto-detect language
    const language = code.includes('iostream') || code.includes('std::') ? 'cpp' : 'c';
    generateTrace(code, language);
  };

  return (
    <div className="flex h-12 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
      {/* Left Section */}
      <div className="flex items-center gap-2">
        {/* Sidebar Toggle */}
        <button
          onClick={toggleSidebar}
          className="rounded p-2 hover:bg-slate-800 transition-colors"
          title={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          <Menu className="h-5 w-5 text-slate-300" />
        </button>

        {/* App Title */}
        <div className="flex items-center gap-2 ml-2">
          <FileCode className="h-5 w-5 text-blue-400" />
          <div className="flex flex-col">
            <span className="font-semibold text-slate-200">{APP_CONFIG.name}</span>
            <span className="text-xs text-slate-500">{APP_CONFIG.tagline}</span>
          </div>
        </div>
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-4">
        {/* Run Button */}
        <button
          onClick={handleRun}
          disabled={!code.trim() || isAnalyzing || !isConnected}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="h-4 w-4" />
          {isAnalyzing ? 'Analyzing...' : 'Run'}
        </button>

        {/* File Loader */}
        <FileLoader />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <div className="flex items-center gap-2 text-xs">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-slate-400">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        
        {/* Settings */}
        <button
          className="rounded p-2 hover:bg-slate-800 transition-colors"
          title="Settings"
        >
          <Settings className="h-5 w-5 text-slate-300" />
        </button>
      </div>
    </div>
  );
}