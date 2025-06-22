'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MonacoEditor } from './components/MonacoEditor';
import { CADViewer } from './components/CADViewer';
import { ControlPanel } from './components/ControlPanel';
import { ErrorDisplay } from './components/ErrorDisplay';
import { CADEngine, CADShape } from './utils/cadEngine';
import styles from './page.module.css';

// Initialize CAD engine singleton
let cadEngine: CADEngine | null = null;

const defaultCode = `const { drawCircle, drawRectangle } = replicad;

const main = () => {
  // Create a cylinder
  const base = drawCircle(20).sketchOnPlane().extrude(10);
  
  // Create a smaller cylinder to cut a hole
  const hole = drawCircle(8).sketchOnPlane().extrude(15);
  
  // Cut the hole from the base
  const result = base.cut(hole);
  
  return result;
};`;

export default function CADPage() {
  const [code, setCode] = useState(defaultCode);
  const [shapes, setShapes] = useState<CADShape[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const executeTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize CAD engine
  useEffect(() => {
    const initEngine = async () => {
      try {
        if (!cadEngine) {
          cadEngine = new CADEngine();
          await cadEngine.initialize();
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize CAD engine:', err);
        setError('Failed to initialize CAD engine');
        setIsLoading(false);
      }
    };

    initEngine();
  }, []);

  // Execute code with debouncing
  const executeCode = useCallback(async (codeToExecute: string) => {
    if (!cadEngine || isLoading) return;

    // Clear previous timeout
    if (executeTimeoutRef.current) {
      clearTimeout(executeTimeoutRef.current);
    }

    // Debounce execution
    executeTimeoutRef.current = setTimeout(async () => {
      setIsExecuting(true);
      setError(null);

      try {
        const result = await cadEngine.executeCode(codeToExecute);
        setShapes(result);
      } catch (err) {
        console.error('Code execution error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setShapes([]);
      } finally {
        setIsExecuting(false);
      }
    }, 500); // 500ms debounce
  }, [isLoading]);

  // Execute code when it changes
  useEffect(() => {
    executeCode(code);
  }, [code, executeCode]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleExport = async (format: 'stl' | 'step') => {
    if (!cadEngine || shapes.length === 0) return;

    try {
      await cadEngine.exportShapes(shapes, format);
    } catch (err) {
      console.error('Export error:', err);
      setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // AI Agent function to set code
  const setCodeFromAI = (newCode: string) => {
    setCode(newCode);
  };

  // Expose setCodeFromAI to global scope for AI agent
  useEffect(() => {
    (window as any).setCADCode = setCodeFromAI;
    return () => {
      delete (window as any).setCADCode;
    };
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Initializing CAD Engine...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>C3D CAD Studio</h1>
        <ControlPanel 
          onExport={handleExport}
          canExport={shapes.length > 0 && !isExecuting}
        />
      </div>
      
      <div className={styles.workspace}>
        <div className={styles.viewerPanel}>
          <CADViewer 
            shapes={shapes}
            isLoading={isExecuting}
          />
          {error && (
            <ErrorDisplay 
              error={error}
              onDismiss={() => setError(null)}
            />
          )}
        </div>
        
        <div className={styles.editorPanel}>
          <MonacoEditor
            value={code}
            onChange={handleCodeChange}
            isExecuting={isExecuting}
          />
        </div>
      </div>
    </div>
  );
} 