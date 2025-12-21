/**
 * Code Editor Component
 * Monaco Editor integration with C/C++ support
 */

import { useEffect, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useEditorStore } from '@store/slices/editorSlice';
import { COLORS } from '@config/theme.config';

export default function CodeEditor() {
  const { code, setCode, language, errors, warnings } = useEditorStore();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  /**
   * Handle editor mount
   */
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure editor theme
    monaco.editor.defineTheme('codeviz-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
      ],
      colors: {
        'editor.background': COLORS.dark.background.primary,
        'editor.foreground': COLORS.dark.text.primary,
        'editor.lineHighlightBackground': COLORS.dark.background.secondary,
        'editorLineNumber.foreground': COLORS.dark.text.tertiary,
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
      },
    });

    monaco.editor.setTheme('codeviz-dark');

    // Focus editor
    editor.focus();
  };

  /**
   * Handle code change
   */
  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  /**
   * Update error markers
   */
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();
    
    if (!model) return;

    // Convert errors to Monaco markers
    const markers = [
      ...errors.map(error => ({
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: error.line,
        startColumn: error.column || 1,
        endLineNumber: error.line,
        endColumn: error.column ? error.column + 10 : 1000,
        message: error.message,
      })),
      ...warnings.map(warning => ({
        severity: monaco.MarkerSeverity.Warning,
        startLineNumber: warning.line,
        startColumn: warning.column || 1,
        endLineNumber: warning.line,
        endColumn: warning.column ? warning.column + 10 : 1000,
        message: warning.message,
      })),
    ];

    monaco.editor.setModelMarkers(model, 'codeviz', markers);
  }, [errors, warnings]);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language === 'cpp' ? 'cpp' : 'c'}
        value={code}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="codeviz-dark"
        options={{
          fontSize: 14,
          fontFamily: '"Fira Code", "JetBrains Mono", monospace',
          fontLigatures: true,
          minimap: { enabled: true },
          lineNumbers: 'on',
          rulers: [80],
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
          autoIndent: 'advanced',
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          bracketPairColorization: {
            enabled: true,
          },
          padding: {
            top: 10,
            bottom: 10,
          },
        }}
        loading={
          <div className="flex h-full items-center justify-center">
            <div className="text-slate-400">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}