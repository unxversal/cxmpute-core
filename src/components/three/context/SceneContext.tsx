import { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';

interface SceneState {
  score: number;
  interactionCount: number;
  lastInteraction: string | null;
}

type SceneAction = 
  | { type: 'INCREMENT_SCORE'; points: number }
  | { type: 'RECORD_INTERACTION'; object: string }
  | { type: 'RESET' };

const initialState: SceneState = {
  score: 0,
  interactionCount: 0,
  lastInteraction: null,
};

const SceneContext = createContext<{
  state: SceneState;
  dispatch: React.Dispatch<SceneAction>;
} | null>(null);

function sceneReducer(state: SceneState, action: SceneAction): SceneState {
  switch (action.type) {
    case 'INCREMENT_SCORE':
      return {
        ...state,
        score: state.score + action.points,
      };
    case 'RECORD_INTERACTION':
      return {
        ...state,
        interactionCount: state.interactionCount + 1,
        lastInteraction: action.object,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function SceneProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sceneReducer, initialState);

  return (
    <SceneContext.Provider value={{ state, dispatch }}>
      {children}
    </SceneContext.Provider>
  );
}

export function useScene() {
  const context = useContext(SceneContext);
  if (!context) {
    throw new Error('useScene must be used within a SceneProvider');
  }
  return context;
}

export function useSceneInteraction() {
  const { state, dispatch } = useScene();
  
  const handleInteraction = useCallback((objectName: string, points: number = 1) => {
    dispatch({ type: 'RECORD_INTERACTION', object: objectName });
    dispatch({ type: 'INCREMENT_SCORE', points });
  }, [dispatch]);

  return {
    score: state.score,
    interactionCount: state.interactionCount,
    lastInteraction: state.lastInteraction,
    handleInteraction,
  };
} 