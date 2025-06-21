'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Save, RotateCcw, FileText } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cadEngine } from '../lib/cadEngine';
import { toast } from 'sonner';
import styles from './CodeEditor.module.css';

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <span>Loading Code Editor...</span>
    </div>
  )
});

interface CodeEditorProps {
  isVisible: boolean;
}

export default function CodeEditor({ isVisible }: CodeEditorProps) {
  const { theme } = useTheme();
  const [code, setCode] = useState(getDefaultCode());
  const [isRunning, setIsRunning] = useState(false);
  const editorRef = useRef<any>(null);

  function getDefaultCode() {
    return `// Welcome to the Replicad Code Editor!
// This editor lets you create CAD models using JavaScript and the Replicad library.

const { drawCircle, drawRectangle, makeCylinder, makeBox } = replicad;

const main = () => {
  // Create a simple box
  const box = makeBox(20, 30, 10);
  
  // Create a cylinder and position it
  const cylinder = makeCylinder(5, 15).translate([0, 0, 10]);
  
  // Combine them using boolean operations
  const result = box.fuse(cylinder);
  
  // Apply some finishing touches
  return result.fillet(2);
};

// Export the main function
export default main;`;
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure TypeScript/JavaScript language features
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      typeRoots: ['node_modules/@types']
    });

    // Add Replicad type definitions (simplified)
    const replicadTypes = `
      declare namespace replicad {
        export function makeBox(width: number, height: number, depth: number): Solid;
        export function makeCylinder(radius: number, height: number): Solid;
        export function makeSphere(radius: number): Solid;
        export function drawCircle(radius: number): Drawing;
        export function drawRectangle(width: number, height: number): Drawing;
        export function drawRoundedRectangle(width: number, height: number, radius?: number): Drawing;
        
        export interface Solid {
          fuse(other: Solid): Solid;
          cut(other: Solid): Solid;
          intersect(other: Solid): Solid;
          fillet(radius: number): Solid;
          chamfer(distance: number): Solid;
          translate(offset: [number, number, number]): Solid;
          rotate(angle: number, axis?: [number, number, number]): Solid;
          mirror(plane: string): Solid;
        }
        
        export interface Drawing {
          sketchOnPlane(plane?: string, offset?: number): Face;
        }
        
        export interface Face {
          extrude(distance: number): Solid;
          revolve(axis?: [number, number, number]): Solid;
        }
      }
    `;

    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      replicadTypes,
      'replicad.d.ts'
    );
  };

  const runCode = async () => {
    if (!code.trim()) {
      toast.error('No code to run');
      return;
    }

    setIsRunning(true);
    try {
      // Generate code and execute it through the CAD engine
      const result = await cadEngine.executeCode(code);
      
      if (result?.success) {
        toast.success('Code executed successfully');
      } else {
        toast.error(result?.error || 'Failed to execute code');
      }
    } catch (err) {
      console.error('Code execution failed:', err);
      toast.error('Code execution failed: ' + (err as Error).message);
    } finally {
      setIsRunning(false);
    }
  };

  const generateCode = async () => {
    try {
      const generatedCode = await cadEngine.generateCode();
      if (generatedCode) {
        setCode(generatedCode);
        toast.success('Code generated from current scene');
      } else {
        toast.info('No objects in scene to generate code from');
      }
    } catch (err) {
      console.error('Code generation failed:', err);
      toast.error('Failed to generate code');
    }
  };

  const resetCode = () => {
    setCode(getDefaultCode());
    toast.info('Code reset to default example');
  };

  const saveCode = () => {
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cad-model.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Code saved to file');
  };

  if (!isVisible) return null;

  return (
    <div className={styles.container} data-theme={theme}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <FileText size={20} />
          <h3>Code Editor</h3>
          <span className={styles.subtitle}>Replicad JavaScript</span>
        </div>
        <div className={styles.headerRight}>
          <button 
            className={styles.headerButton}
            onClick={generateCode}
            title="Generate code from current scene"
          >
            <RotateCcw size={16} />
            Generate
          </button>
          <button 
            className={styles.headerButton}
            onClick={resetCode}
            title="Reset to default example"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button 
            className={styles.headerButton}
            onClick={saveCode}
            title="Save code to file"
          >
            <Save size={16} />
            Save
          </button>
          <button 
            className={`${styles.runButton} ${isRunning ? styles.running : ''}`}
            onClick={runCode}
            disabled={isRunning}
            title="Run code (Ctrl+Enter)"
          >
            <Play size={16} />
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>
      
      <div className={styles.editorContainer}>
        <MonacoEditor
          height="100%"
          defaultLanguage="javascript"
          value={code}
          onChange={(value) => setCode(value || '')}
          onMount={handleEditorDidMount}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            contextmenu: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            snippetSuggestions: 'top',
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'always',
          }}
        />
      </div>
    </div>
  );
} 