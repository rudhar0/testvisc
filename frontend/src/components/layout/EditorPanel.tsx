import CodeEditor from '@components/editor/CodeEditor';
import { useEditorStore } from '@store/slices/editorSlice';

export default function EditorPanel() {
  const { language } = useEditorStore();

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">Code Editor</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400">
            {language === 'cpp' ? 'C++' : 'C'}
          </span>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeEditor />
      </div>
    </div>
  );
}