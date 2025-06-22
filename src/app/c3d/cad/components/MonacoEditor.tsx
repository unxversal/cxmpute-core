'use client';

import React from 'react';
import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
}

export default function MonacoEditor({ value, onChange, language }: MonacoEditorProps) {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  const handleEditorWillMount = (monaco: Monaco) => {
    // Define custom ultra-dark theme to match the page
    monaco.editor.defineTheme('cad-ultra-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '666666', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ffffff' },
        { token: 'string', foreground: 'cccccc' },
        { token: 'number', foreground: 'ffffff' },
        { token: 'function', foreground: 'ffffff' },
        { token: 'variable', foreground: 'cccccc' },
        { token: 'type', foreground: 'ffffff' },
        { token: 'identifier', foreground: 'cccccc' },
      ],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#ffffff',
        'editor.lineHighlightBackground': '#0a0a0a',
        'editor.selectionBackground': '#1a1a1a',
        'editor.selectionHighlightBackground': '#111111',
        'editorCursor.foreground': '#ffffff',
        'editorWhitespace.foreground': '#333333',
        'editorLineNumber.foreground': '#555555',
        'editorLineNumber.activeForeground': '#ffffff',
        'editor.findMatchBackground': '#1a1a1a',
        'editor.findMatchHighlightBackground': '#111111',
        'scrollbar.shadow': '#000000',
        'scrollbarSlider.background': '#1a1a1a',
        'scrollbarSlider.hoverBackground': '#333333',
        'scrollbarSlider.activeBackground': '#555555',
        'editorGutter.background': '#000000',
        'editorOverviewRuler.border': '#0a0a0a',
        'editor.rangeHighlightBackground': '#0a0a0a',
        'editorBracketMatch.background': '#1a1a1a',
        'editorBracketMatch.border': '#555555',
        'editorIndentGuide.background': '#0a0a0a',
        'editorIndentGuide.activeBackground': '#1a1a1a',
        'editorWidget.background': '#000000',
        'editorWidget.border': '#0a0a0a',
        'editorSuggestWidget.background': '#000000',
        'editorSuggestWidget.border': '#0a0a0a',
        'editorSuggestWidget.foreground': '#ffffff',
        'editorSuggestWidget.selectedBackground': '#0a0a0a',
        'editorHoverWidget.background': '#000000',
        'editorHoverWidget.border': '#0a0a0a',
        'input.background': '#000000',
        'input.border': '#0a0a0a',
        'input.foreground': '#ffffff',
        'inputOption.activeBorder': '#555555',
        'dropdown.background': '#000000',
        'dropdown.border': '#0a0a0a',
        'dropdown.foreground': '#ffffff',
        'list.activeSelectionBackground': '#0a0a0a',
        'list.activeSelectionForeground': '#ffffff',
        'list.hoverBackground': '#0a0a0a',
        'list.inactiveSelectionBackground': '#0a0a0a',
        'list.focusBackground': '#0a0a0a',
        'menu.background': '#000000',
        'menu.border': '#0a0a0a',
        'menu.foreground': '#ffffff',
        'menu.selectionBackground': '#0a0a0a',
        'menu.selectionForeground': '#ffffff',
      }
    });
  };

  return (
    <Editor
      height="100%"
      width="100%"
      language={language}
      value={value}
      onChange={handleEditorChange}
      theme="cad-ultra-dark"
      beforeMount={handleEditorWillMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        renderLineHighlight: 'all',
        renderWhitespace: 'none',
        tabSize: 2,
        insertSpaces: true,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontLigatures: true,
        fontWeight: '300',
        lineHeight: 1.5,
        padding: { top: 16, bottom: 16 },
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        suggest: {
          showSnippets: true,
          showKeywords: true,
        },
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false,
        },
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        overviewRulerLanes: 0,
      }}
      loading={
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          backgroundColor: '#000000',
          color: '#666666',
          fontSize: '14px',
          fontFamily: 'system-ui, sans-serif'
        }}>
          Loading editor...
        </div>
      }
    />
  );
} 