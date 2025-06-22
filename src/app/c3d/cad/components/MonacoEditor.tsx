'use client';

import Editor from '@monaco-editor/react';
import styles from '../page.module.css';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  isExecuting: boolean;
}

export function MonacoEditor({ value, onChange, isExecuting }: MonacoEditorProps) {
  const handleEditorDidMount = () => {
    // Monaco editor is ready
    console.log('Monaco editor mounted');
  };

  const handleEditorChange = (newValue: string | undefined) => {
    if (newValue !== undefined) {
      onChange(newValue);
    }
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorHeader}>
        <h3 className={styles.editorTitle}>Code Editor</h3>
        <div className={`${styles.editorStatus} ${isExecuting ? styles.executing : ''}`}>
          {isExecuting ? 'Executing...' : 'Ready'}
        </div>
      </div>
      <div className={styles.editorWrapper}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            folding: true,
            contextmenu: false,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
          }}
        />
      </div>
    </div>
  );
} 