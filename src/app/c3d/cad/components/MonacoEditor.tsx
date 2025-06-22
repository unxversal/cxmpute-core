'use client';

import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
}

export default function MonacoEditor({ value, onChange, language }: MonacoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Define dark theme
    monaco.editor.defineTheme('cad-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '666666', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ffffff', fontStyle: 'bold' },
        { token: 'string', foreground: 'cccccc' },
        { token: 'number', foreground: 'ffffff' },
        { token: 'function', foreground: 'ffffff' },
        { token: 'variable', foreground: 'cccccc' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#ffffff',
        'editor.lineHighlightBackground': '#1a1a1a',
        'editor.selectionBackground': '#333333',
        'editor.selectionHighlightBackground': '#2a2a2a',
        'editorCursor.foreground': '#ffffff',
        'editorWhitespace.foreground': '#333333',
        'editorLineNumber.foreground': '#666666',
        'editorLineNumber.activeForeground': '#ffffff',
        'editor.findMatchBackground': '#333333',
        'editor.findMatchHighlightBackground': '#2a2a2a',
        'scrollbar.shadow': '#000000',
        'scrollbarSlider.background': '#333333',
        'scrollbarSlider.hoverBackground': '#555555',
        'scrollbarSlider.activeBackground': '#666666',
      }
    });

    // Create editor
    const editor = monaco.editor.create(editorRef.current, {
      value,
      language,
      theme: 'cad-dark',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
      fontWeight: '300',
      lineHeight: 1.5,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      lineNumbers: 'on',
      glyphMargin: false,
      folding: true,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'line',
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      cursorStyle: 'line',
      cursorWidth: 2,
      cursorBlinking: 'phase',
      smoothScrolling: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showFunctions: true,
        showVariables: true,
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      parameterHints: {
        enabled: true,
      },
      hover: {
        enabled: true,
        delay: 300,
      },
    });

    monacoRef.current = editor;

    // Set up change listener
    const changeListener = editor.onDidChangeModelContent(() => {
      const currentValue = editor.getValue();
      onChange(currentValue);
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      // This will be handled by the parent component's keyboard listener
    });

    return () => {
      changeListener.dispose();
      editor.dispose();
    };
  }, []);

  // Update value when prop changes
  useEffect(() => {
    if (monacoRef.current && monacoRef.current.getValue() !== value) {
      monacoRef.current.setValue(value);
    }
  }, [value]);

  return (
    <div 
      ref={editorRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#0a0a0a'
      }} 
    />
  );
} 