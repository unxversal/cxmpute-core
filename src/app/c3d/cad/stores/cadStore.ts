import { atom } from 'jotai';
import { CADScene, CADObject, CADLayer, CADOperation, ToolState, CADTool, ViewportSettings } from '../types/cad';

// Generate unique IDs
const generateId = () => `cad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Default viewport settings
const defaultViewportSettings: ViewportSettings = {
  camera: {
    position: [10, 10, 10],
    target: [0, 0, 0],
    fov: 75,
  },
  grid: {
    visible: true,
    size: 10,
    divisions: 10,
  },
  lighting: {
    ambient: 0.4,
    directional: {
      intensity: 1,
      position: [10, 10, 5],
    },
  },
};

// Default layer
const defaultLayer: CADLayer = {
  id: 'default',
  name: 'Default Layer',
  visible: true,
  locked: false,
  color: '#ffffff',
  opacity: 1,
  objects: [],
};

// Initial scene state
const initialScene: CADScene = {
  objects: {},
  layers: { default: defaultLayer },
  selectedObjectIds: [],
  activeLayerId: 'default',
  viewportSettings: defaultViewportSettings,
};

// Initial tool state
const initialToolState: ToolState = {
  activeTool: 'select',
  isDrawing: false,
  snapToGrid: true,
  snapTolerance: 0.1,
};

// Core atoms
export const cadSceneAtom = atom<CADScene>(initialScene);
export const cadHistoryAtom = atom<CADOperation[]>([]);
export const toolStateAtom = atom<ToolState>(initialToolState);

// Derived atoms
export const cadObjectsAtom = atom(
  (get) => get(cadSceneAtom).objects,
  (get, set, newObjects: Record<string, CADObject>) => {
    const scene = get(cadSceneAtom);
    set(cadSceneAtom, { ...scene, objects: newObjects });
  }
);

export const cadLayersAtom = atom(
  (get) => get(cadSceneAtom).layers,
  (get, set, newLayers: Record<string, CADLayer>) => {
    const scene = get(cadSceneAtom);
    set(cadSceneAtom, { ...scene, layers: newLayers });
  }
);

export const selectedObjectsAtom = atom(
  (get) => get(cadSceneAtom).selectedObjectIds,
  (get, set, newSelection: string[]) => {
    const scene = get(cadSceneAtom);
    set(cadSceneAtom, { ...scene, selectedObjectIds: newSelection });
  }
);

export const activeLayerAtom = atom(
  (get) => {
    const scene = get(cadSceneAtom);
    return scene.layers[scene.activeLayerId];
  },
  (get, set, layerId: string) => {
    const scene = get(cadSceneAtom);
    if (scene.layers[layerId]) {
      set(cadSceneAtom, { ...scene, activeLayerId: layerId });
    }
  }
);

export const viewportSettingsAtom = atom(
  (get) => get(cadSceneAtom).viewportSettings,
  (get, set, newSettings: Partial<ViewportSettings>) => {
    const scene = get(cadSceneAtom);
    set(cadSceneAtom, {
      ...scene,
      viewportSettings: { ...scene.viewportSettings, ...newSettings }
    });
  }
);

export const activeToolAtom = atom(
  (get) => get(toolStateAtom).activeTool,
  (get, set, tool: CADTool) => {
    const toolState = get(toolStateAtom);
    set(toolStateAtom, { ...toolState, activeTool: tool });
  }
);

// Action atoms (write-only)
export const addObjectAtom = atom(
  null,
  (get, set, object: Omit<CADObject, 'id'>) => {
    const scene = get(cadSceneAtom);
    const id = generateId();
    const newObject: CADObject = { ...object, id };
    
    const newObjects = { ...scene.objects, [id]: newObject };
    
    // Add to active layer
    const activeLayer = scene.layers[scene.activeLayerId];
    const updatedLayer = { ...activeLayer, objects: [...activeLayer.objects, id] };
    const newLayers = { ...scene.layers, [scene.activeLayerId]: updatedLayer };
    
    set(cadSceneAtom, {
      ...scene,
      objects: newObjects,
      layers: newLayers,
    });
    
    return id;
  }
);

export const removeObjectAtom = atom(
  null,
  (get, set, objectId: string) => {
    const scene = get(cadSceneAtom);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [objectId]: _, ...remainingObjects } = scene.objects;
    
    // Remove from all layers
    const newLayers = Object.fromEntries(
      Object.entries(scene.layers).map(([layerId, layer]) => [
        layerId,
        { ...layer, objects: layer.objects.filter(id => id !== objectId) }
      ])
    );
    
    // Remove from selection
    const newSelection = scene.selectedObjectIds.filter(id => id !== objectId);
    
    set(cadSceneAtom, {
      ...scene,
      objects: remainingObjects,
      layers: newLayers,
      selectedObjectIds: newSelection,
    });
  }
);

export const updateObjectAtom = atom(
  null,
  (get, set, objectId: string, updates: Partial<CADObject>) => {
    const scene = get(cadSceneAtom);
    const currentObject = scene.objects[objectId];
    
    if (currentObject) {
      const updatedObject = { ...currentObject, ...updates };
      const newObjects = { ...scene.objects, [objectId]: updatedObject };
      set(cadSceneAtom, { ...scene, objects: newObjects });
    }
  }
);

export const addLayerAtom = atom(
  null,
  (get, set, layer: Omit<CADLayer, 'id'>) => {
    const scene = get(cadSceneAtom);
    const id = generateId();
    const newLayer: CADLayer = { ...layer, id };
    const newLayers = { ...scene.layers, [id]: newLayer };
    
    set(cadSceneAtom, { ...scene, layers: newLayers });
    return id;
  }
);

export const removeLayerAtom = atom(
  null,
  (get, set, layerId: string) => {
    const scene = get(cadSceneAtom);
    
    // Don't remove default layer
    if (layerId === 'default') return;
    
    const layer = scene.layers[layerId];
    if (!layer) return;
    
    // Move objects to default layer
    const defaultLayer = scene.layers.default;
    const updatedDefaultLayer = {
      ...defaultLayer,
      objects: [...defaultLayer.objects, ...layer.objects]
    };
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [layerId]: _, ...remainingLayers } = scene.layers;
    const newLayers = { ...remainingLayers, default: updatedDefaultLayer };
    
    // Switch to default layer if removing active layer
    const newActiveLayerId = scene.activeLayerId === layerId ? 'default' : scene.activeLayerId;
    
    set(cadSceneAtom, {
      ...scene,
      layers: newLayers,
      activeLayerId: newActiveLayerId,
    });
  }
);

export const addOperationAtom = atom(
  null,
  (get, set, operation: Omit<CADOperation, 'id' | 'timestamp'>) => {
    const history = get(cadHistoryAtom);
    const newOperation: CADOperation = {
      ...operation,
      id: generateId(),
      timestamp: new Date(),
    };
    
    set(cadHistoryAtom, [...history, newOperation]);
    return newOperation.id;
  }
);

// Utility atoms
export const selectedObjectsDataAtom = atom(
  (get) => {
    const scene = get(cadSceneAtom);
    return scene.selectedObjectIds.map(id => scene.objects[id]).filter(Boolean);
  }
);

export const visibleObjectsAtom = atom(
  (get) => {
    const scene = get(cadSceneAtom);
    return Object.values(scene.objects).filter(obj => {
      const layer = scene.layers[obj.layerId];
      return obj.visible && layer?.visible;
    });
  }
);

export const layerObjectsAtom = atom(
  (get) => (layerId: string) => {
    const scene = get(cadSceneAtom);
    const layer = scene.layers[layerId];
    if (!layer) return [];
    
    return layer.objects.map(id => scene.objects[id]).filter(Boolean);
  }
); 