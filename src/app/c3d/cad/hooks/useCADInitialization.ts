import { useEffect, useState } from 'react';
import { cadEngine } from '../lib/cadEngine';
import { showToast } from '../lib/toast';

interface CADInitializationState {
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;
  isFallbackMode: boolean;
}

export function useCADInitialization() {
  const [state, setState] = useState<CADInitializationState>({
    isInitializing: false,
    isInitialized: false,
    error: null,
    isFallbackMode: false,
  });

  useEffect(() => {
    const initializeCAD = async () => {
      if (state.isInitialized || state.isInitializing) {
        return;
      }

      console.log('🚀 Starting CAD engine initialization...');
      setState(prev => ({ ...prev, isInitializing: true, error: null }));
      
      // Show initialization toast
      const toastId = showToast.engineStatus('initializing');

      try {
        await cadEngine.initialize();
        
        const status = cadEngine.getStatus();
        console.log('✅ CAD engine initialization completed:', status);
        
        setState({
          isInitializing: false,
          isInitialized: true,
          error: null,
          isFallbackMode: status.fallbackMode,
        });

        // Dismiss the loading toast
        showToast.dismiss(toastId);

        if (status.fallbackMode) {
          showToast.engineStatus('fallback', 'basic shapes only');
        } else {
          showToast.engineStatus('ready');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
        console.error('❌ CAD engine initialization failed:', error);
        
        setState({
          isInitializing: false,
          isInitialized: false,
          error: errorMessage,
          isFallbackMode: true,
        });

        // Dismiss the loading toast
        showToast.dismiss(toastId);
        showToast.engineStatus('error', errorMessage);
      }
    };

    // Initialize when component mounts
    initializeCAD();
  }, []); // Empty dependency array - run once on mount

  return {
    ...state,
    reinitialize: () => {
      setState({
        isInitializing: false,
        isInitialized: false,
        error: null,
        isFallbackMode: false,
      });
    }
  };
} 