// frontend/src/components/editor/CodeEditor.tsx
import React from 'react';
import { Editor, OnMount } from '@monaco-editor/react';
import { useCodeEditor } from '../../hooks/useCodeEditor';
import ExecutionHighlighter from './ExecutionHighlighter';
import { useEditorStore } from '../../store/slices/editorSlice';
import { useExecutionStore } from '../../store/slices/executionSlice';

const CodeEditor: React.FC = () => {
  const { editor, handleEditorDidMount: originalHandleEditorDidMount } = useCodeEditor();
  
  const code = useEditorStore((state) => state.code);
  const language = useEditorStore((state) => state.language);
  const setCode = useEditorStore((state) => state.setCode);
  
  const currentLine = useExecutionStore(
    (state) => state.executionTrace?.steps[state.currentStep]?.line || 0
  );

  const handleEditorChange = (value: string | undefined) => {
    setCode(value || '');
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme('visualizer-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0f172a', // slate-900
        'editor.foreground': '#f8fafc', // slate-50
        'editorLineNumber.foreground': '#475569', // slate-600
        'editorLineNumber.activeForeground': '#a855f7', // control-default (purple)
        'editorCursor.foreground': '#a855f7',
        'editor.selectionBackground': '#a855f733', // purple with transparency
      },
    });
    monaco.editor.setTheme('visualizer-dark');
    originalHandleEditorDidMount(editor);
  };

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Editor
        height="100%"
        language={language}
        value={code}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        options={{
          readOnly: false,
          domReadOnly: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
      />
      {editor && <ExecutionHighlighter editor={editor} currentLine={currentLine} />}
    </div>
  );
};

export default CodeEditor;
