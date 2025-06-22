'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import styles from './page.module.css';

// Import components
import MonacoEditor from './components/MonacoEditor';
import ErrorDisplay from './components/ErrorDisplay';
import CADViewer from './components/CADViewer';

// Import the CAD engine - fix the import
import { CADEngine } from './utils/cadEngine';

// Create a singleton instance
const cadEngine = new CADEngine();

// Extend the Window interface for our global function
declare global {
  interface Window {
    setCADCode?: (code: string) => void;
  }
}

// Default example code
const DEFAULT_CODE = `const { draw, drawCircle } = replicad;

const main = () => {
  // Create a cylinder with a hole
  const cylinder = drawCircle(20)
    .sketchOnPlane()
    .extrude(50);
  
  const hole = drawCircle(8)
    .sketchOnPlane()
    .extrude(60)
    .translateZ(-5);
  
  return cylinder.cut(hole);
};`;

export default function CADPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [shapes, setShapes] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Execute code with debouncing
  const executeCode = useCallback(async (codeToExecute: string = code) => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    setError(null);

    try {
      const result = await cadEngine.executeCode(codeToExecute);
      setShapes(result);
      toast.success('Code executed successfully', {
        description: `Generated ${result.length} shape${result.length !== 1 ? 's' : ''}`,
        duration: 2000
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error('Execution failed', {
        description: errorMessage.slice(0, 80) + (errorMessage.length > 80 ? '...' : ''),
        duration: 4000
      });
    } finally {
      setIsExecuting(false);
    }
  }, [code, isExecuting]);

  // Debounced execution for auto-run
  const debouncedExecute = useCallback((newCode: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      executeCode(newCode);
    }, 500);
  }, [executeCode]);

  // Handle code changes
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    debouncedExecute(newCode);
  }, [debouncedExecute]);

  // Manual run function
  const handleRunCode = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    executeCode();
  }, [executeCode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter to run code
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleRunCode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunCode]);

  // Initialize CAD engine
  useEffect(() => {
    const initEngine = async () => {
      try {
        toast.loading('Initializing CAD engine...', { id: 'init' });
        await cadEngine.initialize();
        toast.success('CAD engine initialized', { id: 'init' });
        
        // Execute initial code
        await executeCode(DEFAULT_CODE);
        setIsLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
        toast.error('Initialization failed', { 
          id: 'init',
          description: errorMessage,
          duration: 5000
        });
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initEngine();
  }, [executeCode]);

  // Set up global function for AI agents
  useEffect(() => {
    // Use proper type declaration for window
    window.setCADCode = (newCode: string) => {
      setCode(newCode);
      executeCode(newCode);
    };

    return () => {
      delete window.setCADCode;
    };
  }, [executeCode]);

  // Export functions
  const handleExportSTL = useCallback(() => {
    if (shapes.length === 0) {
      toast.error('No shapes to export');
      return;
    }
    // TODO: Implement STL export
    toast.info('STL export coming soon');
  }, [shapes]);

  const handleExportSTEP = useCallback(() => {
    if (shapes.length === 0) {
      toast.error('No shapes to export');
      return;
    }
    // TODO: Implement STEP export
    toast.info('STEP export coming soon');
  }, [shapes]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Initializing CAD Engine...</p>
        {/* Global Toaster in Providers handles notifications */}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>C3D CAD</h1>
        <div className={styles.controlPanel}>
          <button
            className={styles.runButton}
            onClick={handleRunCode}
            disabled={isExecuting}
            title="Run code (⌘+Enter)"
          >
            {isExecuting ? (
              <>
                <div className={styles.loadingSpinner} style={{ width: 12, height: 12, marginRight: 4 }} />
                Running
              </>
            ) : (
              <>▶ Run</>
            )}
          </button>
          <span className={styles.shortcutHint}>⌘+Enter</span>
          <button
            className={styles.button}
            onClick={handleExportSTL}
            disabled={shapes.length === 0}
          >
            Export STL
          </button>
          <button
            className={styles.button}
            onClick={handleExportSTEP}
            disabled={shapes.length === 0}
          >
            Export STEP
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        <div className={styles.viewerPanel}>
          <CADViewer shapes={shapes} />
          {error && (
            <ErrorDisplay 
              error={error} 
              onClose={() => setError(null)} 
            />
          )}
        </div>

        <div className={styles.editorPanel}>
          <div className={styles.editorHeader}>
            <h3 className={styles.editorTitle}>Code Editor</h3>
            <div className={styles.editorActions}>
              <span className={`${styles.editorStatus} ${isExecuting ? styles.executing : ''}`}>
                {isExecuting ? 'Executing...' : 'Ready'}
              </span>
            </div>
          </div>
          <div className={styles.editorWrapper}>
            <MonacoEditor
              value={code}
              onChange={handleCodeChange}
              language="javascript"
            />
          </div>
        </div>
      </div>

      {/* Toast notifications are managed globally via Providers */}
    </div>
  );
} 