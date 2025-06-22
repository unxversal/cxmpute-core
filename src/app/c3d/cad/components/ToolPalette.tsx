/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { 
  MousePointer, 
  Move, 
  RotateCcw, 
  ZoomIn,
  Square, 
  Circle, 
  Cylinder,
  Pencil,
  Plus,
  Minus,
  Layers,
  X,
  CornerUpRight,
  CornerDownLeft,
  Edit3,
  Check,
  Triangle
} from 'lucide-react';
import { activeToolAtom, addObjectAtom, selectedObjectsAtom, removeObjectAtom, cadObjectsAtom, isSketchingAtom, selectionAtom, currentSketchEntitiesAtom, sketchPlaneAtom } from '../stores/cadStore';
import { CADTool } from '../types/cad';
import { cadEngine } from '../lib/cadEngine';
import { useTheme } from '../hooks/useTheme';
import styles from './ToolPalette.module.css';
import { toast } from 'sonner';
import { CADUtils } from '../lib/cadUtils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  placeholder?: string;
  inputType?: 'text' | 'number';
  defaultValue?: string;
}

// Custom Modal Component to replace browser alert/confirm
function Modal({ isOpen, onClose, onConfirm, title, placeholder = '', inputType = 'number', defaultValue = '' }: ModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const { theme } = useTheme();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onConfirm(inputValue.trim());
      setInputValue('');
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modalContent} 
        data-theme={theme} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button onClick={onClose} className={styles.modalCloseButton}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <input
            type={inputType}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            className={styles.modalInput}
            autoFocus
            step={inputType === 'number' ? '0.1' : undefined}
            min={inputType === 'number' ? '0.1' : undefined}
          />
          <div className={styles.modalButtons}>
            <button 
              type="button" 
              onClick={onClose} 
              className={styles.modalCancelButton}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.modalConfirmButton}
              disabled={!inputValue.trim()}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ExtrudeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (distance: number, operation: 'add' | 'cut') => void;
  title: string;
}

function ExtrudeModal({ isOpen, onClose, onConfirm, title }: ExtrudeModalProps) {
  const [distance, setDistance] = useState('10');
  const [operation, setOperation] = useState<'add' | 'cut'>('add');
  const { theme } = useTheme();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dist = parseFloat(distance);
    if (!isNaN(dist) && dist > 0) {
      onConfirm(dist, operation);
      setDistance('10');
      setOperation('add');
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modalContent} 
        data-theme={theme} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button onClick={onClose} className={styles.modalCloseButton}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.extrudeControls}>
            <div className={styles.inputGroup}>
              <label>Distance (mm)</label>
              <input
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className={styles.modalInput}
                autoFocus
                step="0.1"
                min="0.1"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Operation</label>
              <div className={styles.operationToggle}>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${operation === 'add' ? styles.active : ''}`}
                  onClick={() => setOperation('add')}
                >
                  <Plus size={14} />
                  Add Material
                </button>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${operation === 'cut' ? styles.active : ''}`}
                  onClick={() => setOperation('cut')}
                >
                  <Minus size={14} />
                  Cut Material
                </button>
              </div>
            </div>
          </div>
          <div className={styles.modalButtons}>
            <button 
              type="button" 
              onClick={onClose} 
              className={styles.modalCancelButton}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.modalConfirmButton}
              disabled={!distance || parseFloat(distance) <= 0}
            >
              Extrude
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PlaneSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (plane: 'XY' | 'XZ' | 'YZ') => void;
}

function PlaneSelectionModal({ isOpen, onClose, onConfirm }: PlaneSelectionModalProps) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const handlePlaneSelect = (plane: 'XY' | 'XZ' | 'YZ') => {
    onConfirm(plane);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modalContent} 
        data-theme={theme} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Select Work Plane</h3>
          <button onClick={onClose} className={styles.modalCloseButton}>
            <X size={16} />
          </button>
        </div>
        <div className={styles.planeSelection}>
          <p>Choose a reference plane for sketching:</p>
          <div className={styles.planeButtons}>
            <button 
              className={styles.planeButton}
              onClick={() => handlePlaneSelect('XY')}
            >
              <div className={styles.planeIcon}>XY</div>
              <span>Top View</span>
            </button>
            <button 
              className={styles.planeButton}
              onClick={() => handlePlaneSelect('XZ')}
            >
              <div className={styles.planeIcon}>XZ</div>
              <span>Front View</span>
            </button>
            <button 
              className={styles.planeButton}
              onClick={() => handlePlaneSelect('YZ')}
            >
              <div className={styles.planeIcon}>YZ</div>
              <span>Side View</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToolButtonProps {
  tool: CADTool;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

// Fixed Tooltip component with absolute positioning
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className={styles.tooltipContainer}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={styles.tooltip}>
          {content}
        </div>
      )}
    </div>
  );
}

function ToolButton({ tool, icon, label, isActive, onClick, disabled = false }: ToolButtonProps) {
  // Enhanced tooltips with keyboard shortcuts
  const getTooltip = (label: string, tool: CADTool) => {
    const shortcuts: Record<CADTool, string> = {
      'select': 'V',
      'pan': 'P', 
      'rotate': 'R',
      'zoom': '',
      'box': 'B',
      'cylinder': 'C',
      'sphere': 'S',
      'cone': '',
      'sketch': 'S',
      'extrude': 'E',
      'revolve': '',
      'fillet': 'F',
      'chamfer': '',
      'shell': '',
      'union': 'U',
      'subtract': 'D',
      'intersect': 'I'
    };
    
    const shortcut = shortcuts[tool];
    return shortcut ? `${label} (${shortcut})` : label;
  };

  return (
    <Tooltip content={getTooltip(label, tool)}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${styles.toolButton} ${isActive ? styles.active : ''} ${disabled ? styles.disabled : ''}`}
      >
        {icon}
        <span className={styles.toolButtonLabel}>{label}</span>
      </button>
    </Tooltip>
  );
}

interface ToolSectionProps {
  title: string;
  children: React.ReactNode;
}

function ToolSection({ title, children }: ToolSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionContent}>
        {children}
      </div>
    </div>
  );
}

// Sketch Mode Component
interface SketchModeProps {
  onExit: () => void;
  selectedFaceId?: string;
  onCreateSketch: (type: 'circle' | 'rectangle', params: any) => void;
  openModal: (title: string, placeholder: string, inputType?: 'text' | 'number') => Promise<string>;
}

function SketchMode({ onExit, selectedFaceId, onCreateSketch, openModal }: SketchModeProps) {
  const { theme } = useTheme();
  const [activeSketchTool, setActiveSketchTool] = useState<'line' | 'circle' | 'rectangle' | null>(null);

  const handleQuickSketch = async (type: 'circle' | 'rectangle') => {
    let params;
    
    try {
      if (type === 'circle') {
        const radius = await openModal('Circle Radius', 'Enter radius (mm)');
        if (!radius || isNaN(parseFloat(radius))) {
          toast.error('Invalid radius');
          return;
        }
        params = { radius: parseFloat(radius) };
      } else if (type === 'rectangle') {
        const width = await openModal('Rectangle Width', 'Enter width (mm)');
        if (!width || isNaN(parseFloat(width))) {
          toast.error('Invalid width');
          return;
        }
        const height = await openModal('Rectangle Height', 'Enter height (mm)');
        if (!height || isNaN(parseFloat(height))) {
          toast.error('Invalid height');
          return;
        }
        params = { width: parseFloat(width), height: parseFloat(height) };
      }

      onCreateSketch(type, params);
      onExit();
    } catch {
      // User cancelled
      console.log('Sketch creation cancelled');
    }
  };

  if (!selectedFaceId) {
    return (
      <div className={styles.sketchPrompt} data-theme={theme}>
        <div className={styles.sketchPromptContent}>
          <Pencil size={24} />
          <h3>Create Quick Sketch</h3>
          <p>Create a simple sketch or select a face to sketch on</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button 
              onClick={() => handleQuickSketch('circle')}
              className={styles.exitSketchButton}
            >
              Circle
            </button>
            <button 
              onClick={() => handleQuickSketch('rectangle')}
              className={styles.exitSketchButton}
            >
              Rectangle
            </button>
            <button onClick={onExit} className={styles.exitSketchButton}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sketchTools} data-theme={theme}>
      <div className={styles.sketchHeader}>
        <h3>Sketch Mode</h3>
        <button onClick={onExit} className={styles.exitSketchButton}>
          <X size={16} />
        </button>
      </div>
      <div className={styles.sketchToolButtons}>
        <button 
          className={`${styles.sketchToolButton} ${activeSketchTool === 'line' ? styles.active : ''}`}
          onClick={() => setActiveSketchTool('line')}
        >
          <div style={{ width: 16, height: 2, backgroundColor: 'currentColor' }} />
          Line
        </button>
        <button 
          className={`${styles.sketchToolButton} ${activeSketchTool === 'circle' ? styles.active : ''}`}
          onClick={() => handleQuickSketch('circle')}
        >
          <Circle size={16} />
          Circle
        </button>
        <button 
          className={`${styles.sketchToolButton} ${activeSketchTool === 'rectangle' ? styles.active : ''}`}
          onClick={() => handleQuickSketch('rectangle')}
        >
          <Square size={16} />
          Rectangle
        </button>
      </div>
      <div className={styles.sketchInstructions}>
        {activeSketchTool === 'line' && <p>Click to create points, press Enter to finish</p>}
        {!activeSketchTool && <p>Select a drawing tool above to create a sketch</p>}
      </div>
    </div>
  );
}

export default function ToolPalette() {
  const [activeTool, setActiveTool] = useAtom(activeToolAtom);
  const [, addObject] = useAtom(addObjectAtom);
  const [selectedIds] = useAtom(selectedObjectsAtom);
  const [, removeObject] = useAtom(removeObjectAtom);
  const objects = useAtomValue(cadObjectsAtom);
  const { theme } = useTheme();

  // Sketch mode state
  const [isSketchMode, setIsSketchMode] = useState(false);
  const [selectedFaceId, setSelectedFaceId] = useState<string | undefined>(undefined);

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    inputType: 'text' | 'number';
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    placeholder: '',
    inputType: 'number',
    onConfirm: () => {},
  });

  // Extrude modal state
  const [extrudeModalState, setExtrudeModalState] = useState<{
    isOpen: boolean;
    onConfirm: (distance: number, operation: 'add' | 'cut') => void;
  }>({
    isOpen: false,
    onConfirm: () => {},
  });

  // Plane selection modal state
  const [planeModalState, setPlaneModalState] = useState<{
    isOpen: boolean;
    onConfirm: (plane: 'XY' | 'XZ' | 'YZ') => void;
  }>({
    isOpen: false,
    onConfirm: () => {},
  });

  const [isSketching, setIsSketching] = useAtom(isSketchingAtom);
  const [sketchEntities, setSketchEntities] = useAtom(currentSketchEntitiesAtom);
  const setSketchPlane = useSetAtom(sketchPlaneAtom);
  const [activeSketchTool, setActiveSketchTool] = useState<'line' | 'circle' | 'rectangle' | null>(null);

  const currentSelection = useAtomValue(selectionAtom);

  const openModal = (title: string, placeholder: string, inputType: 'text' | 'number' = 'number') => {
    return new Promise<string>((resolve) => {
      setModalState({
        isOpen: true,
        title,
        placeholder,
        inputType,
        onConfirm: (value) => {
          resolve(value);
          setModalState(prev => ({ ...prev, isOpen: false }));
        },
      });
    });
  };

  const handleToolSelect = (tool: CADTool) => {
    if (tool === 'sketch') {
      setIsSketchMode(true);
      setSelectedFaceId(undefined);
      toast.info('Sketch Mode: Select a face to sketch on');
    } else {
      setIsSketchMode(false);
      setSelectedFaceId(undefined);
    }
    setActiveTool(tool);
  };

  const exitSketchMode = () => {
    setIsSketchMode(false);
    setSelectedFaceId(undefined);
    setActiveTool('select');
  };

  const handleCreateSketch = async (type: 'circle' | 'rectangle', params: any) => {
    try {
      const result = await cadEngine.createBasicSketch(type, params);
      
      if (result) {
        addObject({
          name: `${type}_sketch_${Date.now()}`,
          type: 'sketch',
          // Sketch geometry kept internally by CADEngine
          visible: true,
          layerId: 'default',
          properties: {
            color: '#22d3ee',
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: params,
          },
          metadata: { 
            createdAt: new Date(), 
            updatedAt: new Date(), 
            creator: 'user', 
            replicadId: result.id 
          },
        });
        
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} sketch created`);
      }
    } catch (err) {
      console.error('Failed to create sketch:', err);
      toast.error('Failed to create sketch');
    }
  };

  // Boolean operations using cadUtils API
  const performBoolean = async (op: 'union' | 'subtract' | 'intersect') => {
    if (selectedIds.length !== 2) {
      toast.warning('Select exactly two solids first');
      return;
    }
    
    const [aId, bId] = selectedIds;
    const objA = objects[aId];
    const objB = objects[bId];
    
    if (!objA || !objB) {
      toast.error('Invalid objects selected');
      return;
    }
    
    if (objA.type !== 'solid' || objB.type !== 'solid') {
      toast.warning('Both objects must be solids');
      return;
    }

    const shapeIdA = objA.metadata?.replicadId || aId;
    const shapeIdB = objB.metadata?.replicadId || bId;
    
    try {
      let result;
      switch (op) {
        case 'union':
          result = await CADUtils.union(shapeIdA, shapeIdB);
          break;
        case 'subtract':
          result = await CADUtils.subtract(shapeIdA, shapeIdB);
          break;
        case 'intersect':
          result = await CADUtils.intersect(shapeIdA, shapeIdB);
          break;
      }
      
      if (result?.success && result.shape) {
        // Remove originals
        removeObject(aId);
        removeObject(bId);
        
        // Add new object
        addObject({
          name: `${op}_${Date.now()}`,
          type: 'solid',
          mesh: result.shape.mesh,
          visible: true,
          layerId: 'default',
          properties: {
            color: '#10b981',
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: result.shape.parameters,
          },
          metadata: { 
            createdAt: new Date(), 
            updatedAt: new Date(), 
            creator: 'user', 
            replicadId: result.shape.id 
          },
        });
        
        toast.success(result.message || `${op.charAt(0).toUpperCase() + op.slice(1)} complete`);
      } else {
        toast.error(result?.error || `Failed to ${op} objects`);
      }
    } catch (err) {
      console.error(`${op} operation failed:`, err);
      toast.error(`Failed to ${op} objects`);
    }
  };

  // Enhanced extrude with cut/add option using new modal
  const performExtrude = async () => {
    if (selectedIds.length !== 1) {
      toast.warning('Select a single sketch first');
      return;
    }
    
    const cadId = selectedIds[0];
    const obj = objects[cadId];
    
    if (!obj) {
      toast.error('Selected object not found');
      return;
    }
    
    if (obj.type !== 'sketch') {
      toast.warning('Selected object must be a sketch');
      return;
    }
    
    setExtrudeModalState({
      isOpen: true,
      onConfirm: async (distance: number, operation: 'add' | 'cut') => {
        try {
          const shapeId = obj.metadata?.replicadId || cadId;
          const result = await CADUtils.extrude(shapeId, distance);
          
          if (result?.success && result.shape) {
            removeObject(cadId);
            addObject({
              name: `${operation}_extruded_${Date.now()}`,
              type: 'solid',
              mesh: result.shape.mesh,
              visible: true,
              layerId: 'default',
              properties: {
                color: operation === 'add' ? '#3b82f6' : '#ef4444',
                opacity: 1,
                material: 'default',
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                dimensions: result.shape.parameters,
              },
              metadata: { 
                createdAt: new Date(), 
                updatedAt: new Date(), 
                creator: 'user', 
                replicadId: result.shape.id 
              },
            });
            
            toast.success(`${operation === 'add' ? 'Add' : 'Cut'} extrude complete`);
          } else {
            toast.error(result?.error || 'Failed to extrude');
          }
        } catch (err) {
          console.error('Extrude failed:', err);
          toast.error('Failed to extrude');
        }
        setExtrudeModalState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Improved revolve for sketches
  const performRevolve = async () => {
    if (selectedIds.length !== 1) {
      toast.warning('Select a single sketch first');
      return;
    }
    
    const cadId = selectedIds[0];
    const obj = objects[cadId];
    
    if (!obj || obj.type !== 'sketch') {
      toast.warning('Selected object must be a sketch');
      return;
    }
    
    try {
      const angle = await openModal('Revolve Angle', 'Enter angle in degrees (360 for full revolution)');
      const angleDeg = parseFloat(angle);
      
      if (isNaN(angleDeg)) {
        toast.error('Invalid angle');
        return;
      }
      
      const shapeId = obj.metadata?.replicadId || cadId;
      const result = await cadEngine.revolveSketch(shapeId, [0, 0, 1], angleDeg);
      
      if (result) {
        removeObject(cadId);
        addObject({
          name: `revolved_${Date.now()}`,
          type: 'solid',
          // Replicad solid kept internally by CADEngine
          mesh: result.mesh,
          visible: true,
          layerId: 'default',
          properties: {
            color: '#8b5cf6',
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: result.parameters,
          },
          metadata: { 
            createdAt: new Date(), 
            updatedAt: new Date(), 
            creator: 'user', 
            replicadId: result.id 
          },
        });
        
        toast.success('Revolve complete');
      }
    } catch (err) {
      console.error('Revolve failed:', err);
      toast.error('Failed to revolve');
    }
  };

  // Improved shell operation
  const performShell = async () => {
    if (selectedIds.length !== 1) {
      toast.warning('Select a single solid first');
      return;
    }
    
    const cadId = selectedIds[0];
    const obj = objects[cadId];
    
    if (!obj || obj.type !== 'solid') {
      toast.warning('Selected object must be a solid');
      return;
    }
    
    try {
      const thickness = await openModal('Shell Thickness', 'Enter wall thickness (mm)');
      const thick = parseFloat(thickness);
      
      if (isNaN(thick) || thick === 0) {
        toast.error('Invalid thickness');
        return;
      }
      
      const shapeId = obj.metadata?.replicadId || cadId;
      const result = await cadEngine.shellShape(shapeId, thick);
      
      if (result) {
        removeObject(cadId);
        addObject({
          name: `shell_${Date.now()}`,
          type: 'solid',
          // Replicad solid kept internally by CADEngine
          mesh: result.mesh,
          visible: true,
          layerId: 'default',
          properties: {
            color: '#f59e0b',
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: result.parameters,
          },
          metadata: { 
            createdAt: new Date(), 
            updatedAt: new Date(), 
            creator: 'user', 
            replicadId: result.id 
          },
        });
        
        toast.success('Shell complete');
      }
    } catch (err) {
      console.error('Shell failed:', err);
      toast.error('Failed to shell');
    }
  };

  // Improved fillet/chamfer operations
  const performFilletChamfer = async (mode: 'fillet' | 'chamfer') => {
    if (selectedIds.length !== 1) {
      toast.warning('Select a single solid first');
      return;
    }
    
    const cadId = selectedIds[0];
    const obj = objects[cadId];
    
    if (!obj || obj.type !== 'solid') {
      toast.warning('Selected object must be a solid');
      return;
    }
    
    try {
      const valStr = await openModal(
        `${mode.charAt(0).toUpperCase() + mode.slice(1)} ${mode === 'fillet' ? 'Radius' : 'Distance'}`, 
        `Enter ${mode === 'fillet' ? 'radius' : 'distance'} (mm)`
      );
      const val = parseFloat(valStr);
      
      if (isNaN(val) || val <= 0) {
        toast.error('Invalid number');
        return;
      }
      
      const shapeId = obj.metadata?.replicadId || cadId;
      let result;
      
      if (mode === 'fillet') {
        result = await CADUtils.fillet(shapeId, val);
      } else {
        result = await CADUtils.chamfer(shapeId, val);
      }
      
      if (result?.success && result.shape) {
        removeObject(cadId);
        addObject({
          name: `${mode}_${Date.now()}`,
          type: 'solid',
          mesh: result.shape.mesh,
          visible: true,
          layerId: 'default',
          properties: {
            color: '#eab308',
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: result.shape.parameters,
          },
          metadata: { 
            createdAt: new Date(), 
            updatedAt: new Date(), 
            creator: 'user', 
            replicadId: result.shape.id 
          },
        });
        
        toast.success(result.message || `${mode.charAt(0).toUpperCase() + mode.slice(1)} applied`);
      } else {
        toast.error(result?.error || `Failed to ${mode}`);
      }
    } catch (err) {
      console.error(`${mode} failed:`, err);
      toast.error(`Failed to ${mode}`);
    }
  };

  // Check if modification tools should be disabled
  const hasValidSolidsSelected = selectedIds.length > 0 && selectedIds.every(id => objects[id]?.type === 'solid');
  const hasValidSketchSelected = selectedIds.length === 1 && objects[selectedIds[0]]?.type === 'sketch';
  const hasTwoSolidsSelected = selectedIds.length === 2 && selectedIds.every(id => objects[id]?.type === 'solid');

  const handleStartSketch = async () => {
    if (currentSelection?.type === 'face') {
      // A face is selected, get its data and start sketching
      const { objectId, faceIndex } = currentSelection;
      const result = await CADUtils.getFaceData(objectId, faceIndex);

      if (result.success && result.data) {
        setSketchPlane({
          type: 'face',
          plane: null,
          faceId: objectId,
          normal: result.data.normal,
          center: result.data.center,
        });
        setIsSketching(true);
        toast.success('Sketch mode activated on selected face');
      } else {
        toast.error(result.error || 'Could not get face data to start sketch.');
      }
    } else if (!currentSelection || currentSelection.type === 'object' || currentSelection.type === 'edge') {
      // No selection or a whole object/edge is selected, so ask for a reference plane
      setPlaneModalState({
        isOpen: true,
        onConfirm: (plane: 'XY' | 'XZ' | 'YZ') => {
          setSketchPlane({
            type: 'reference',
            plane: plane,
            normal: plane === 'XY' ? [0, 0, 1] : plane === 'XZ' ? [0, 1, 0] : [1, 0, 0],
            center: [0, 0, 0]
          });
          setIsSketching(true);
          toast.success(`Sketch mode activated on ${plane} plane`);
        }
      });
    } else {
      toast.warning('Select a face or start a new sketch on a reference plane');
    }
  };

  const handleFinishSketch = async () => {
    if (sketchEntities.length === 0) {
      toast.warning('No sketch entities to finalize');
      return;
    }
    try {
      // For now, create a simple rectangle sketch from entities
      if (currentSelection?.type === 'face') {
        const result = await cadEngine.createBasicSketch('rectangle', { width: 10, height: 10 });
        if (result) {
          addObject({
            name: `face_sketch_${Date.now()}`,
            type: 'sketch',
            mesh: result.mesh,
            visible: true,
            layerId: 'default',
            properties: {
              color: '#22d3ee',
              opacity: 1,
              material: 'default',
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            },
            metadata: { 
              createdAt: new Date(), 
              updatedAt: new Date(), 
              creator: 'user', 
              replicadId: result.id 
            },
          });
          toast.success('Sketch created on face');
        }
      }
    } catch (err) {
      console.error('Failed to finish sketch:', err);
      toast.error('Failed to create sketch');
    }
    setSketchEntities([]);
    setIsSketching(false);
    setActiveSketchTool(null);
  };

  const addSketchEntity = (type: 'line' | 'circle' | 'rectangle', points: Array<[number, number]>, params?: Record<string, number>) => {
    const entity = {
      id: `${type}_${Date.now()}`,
      type,
      points,
      params
    };
    setSketchEntities(prev => [...prev, entity]);
  };

  const handleCreatePrimitive = async (type: 'box' | 'cylinder' | 'sphere' | 'cone') => {
    // Set the active tool to the primitive type so user can click to place it
    setActiveTool(type);
    toast.success(`Click on the canvas to place ${type}`);
  };

  return (
    <>
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        placeholder={modalState.placeholder}
        inputType={modalState.inputType}
      />

      <ExtrudeModal
        isOpen={extrudeModalState.isOpen}
        onClose={() => setExtrudeModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={extrudeModalState.onConfirm}
        title="Extrude Sketch"
      />

      <PlaneSelectionModal
        isOpen={planeModalState.isOpen}
        onClose={() => setPlaneModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={planeModalState.onConfirm}
      />
      
      {isSketchMode && (
        <SketchMode 
          onExit={exitSketchMode}
          selectedFaceId={selectedFaceId}
          onCreateSketch={handleCreateSketch}
          openModal={openModal}
        />
      )}
      
      {isSketching && (
        <div className={styles.container} data-theme={theme}>
          <div className={styles.sketchToolbar}>
            <div className={styles.sketchHeader}>
              <h3>Sketch Mode</h3>
              <span>{sketchEntities.length} entities</span>
            </div>
            
            <ToolSection title="2D Tools">
              <div className={styles.compactToolRow}>
                <ToolButton 
                  tool="sketch" 
                  icon={<div style={{ width: 14, height: 2, backgroundColor: 'currentColor' }} />} 
                  label="Line" 
                  isActive={activeSketchTool === 'line'}
                  onClick={() => setActiveSketchTool('line')}
                />
                <ToolButton 
                  tool="sketch" 
                  icon={<Circle size={14} />} 
                  label="Circle" 
                  isActive={activeSketchTool === 'circle'}
                  onClick={() => {
                    setActiveSketchTool('circle');
                    addSketchEntity('circle', [[0, 0]], { radius: 5 });
                  }}
                />
                <ToolButton 
                  tool="sketch" 
                  icon={<Square size={14} />} 
                  label="Rect" 
                  isActive={activeSketchTool === 'rectangle'}
                  onClick={() => {
                    setActiveSketchTool('rectangle');
                    addSketchEntity('rectangle', [[0, 0], [10, 10]], { width: 10, height: 10 });
                  }}
                />
              </div>
            </ToolSection>

            <ToolSection title="Actions">
              <button 
                className={styles.finishButton}
                onClick={handleFinishSketch}
                disabled={sketchEntities.length === 0}
              >
                <Check size={16} />
                Finish Sketch
              </button>
              <button 
                className={styles.cancelButton}
                onClick={() => {
                  setSketchEntities([]);
                  setIsSketching(false);
                  setActiveSketchTool(null);
                }}
              >
                <X size={16} />
                Cancel
              </button>
            </ToolSection>
          </div>
        </div>
      )}
      
      <div className={styles.container} data-theme={theme}>
        {/* Selection Tools */}
        <ToolSection title="Navigate">
          <ToolButton
            tool="select"
            icon={<MousePointer size={20} />}
            label="Select"
            isActive={activeTool === 'select'}
            onClick={() => handleToolSelect('select')}
          />
          <ToolButton
            tool="pan"
            icon={<Move size={20} />}
            label="Pan"
            isActive={activeTool === 'pan'}
            onClick={() => handleToolSelect('pan')}
          />
          <ToolButton
            tool="rotate"
            icon={<RotateCcw size={20} />}
            label="Rotate View"
            isActive={activeTool === 'rotate'}
            onClick={() => handleToolSelect('rotate')}
          />
          <ToolButton
            tool="zoom"
            icon={<ZoomIn size={20} />}
            label="Zoom"
            isActive={activeTool === 'zoom'}
            onClick={() => handleToolSelect('zoom')}
          />
        </ToolSection>

        {/* Primitive Tools - Removed cone as requested */}
        <ToolSection title="Create">
          <ToolButton
            tool="box"
            icon={<Square size={20} />}
            label="Box"
            isActive={activeTool === 'box'}
            onClick={() => handleCreatePrimitive('box')}
          />
          <ToolButton
            tool="cylinder"
            icon={<Cylinder size={20} />}
            label="Cylinder"
            isActive={activeTool === 'cylinder'}
            onClick={() => handleCreatePrimitive('cylinder')}
          />
          <ToolButton
            tool="sphere"
            icon={<Circle size={20} />}
            label="Sphere"
            isActive={activeTool === 'sphere'}
            onClick={() => handleCreatePrimitive('sphere')}
          />
          <ToolButton
            tool="cone"
            icon={<Triangle size={20} />}
            label="Cone"
            isActive={activeTool === 'cone'}
            onClick={() => handleCreatePrimitive('cone')}
          />
        </ToolSection>

        {/* Sketch Tools */}
        <ToolSection title="Sketch">
          <ToolButton
            tool="sketch"
            icon={<Pencil size={20} />}
            label="Sketch"
            isActive={activeTool === 'sketch'}
            onClick={() => handleToolSelect('sketch')}
          />
          <ToolButton
            tool="extrude"
            icon={<CornerUpRight size={20} />}
            label="Extrude"
            isActive={activeTool === 'extrude'}
            onClick={() => {
              handleToolSelect('extrude');
              performExtrude();
            }}
            disabled={!hasValidSketchSelected}
          />
          <ToolButton
            tool="revolve"
            icon={<CornerDownLeft size={20} />}
            label="Revolve"
            isActive={activeTool === 'revolve'}
            onClick={() => {
              handleToolSelect('revolve');
              performRevolve();
            }}
            disabled={!hasValidSketchSelected}
          />
          <ToolButton 
            tool="sketch" 
            icon={<Edit3 size={16} />} 
            label="Start Sketch" 
            isActive={false}
            onClick={handleStartSketch}
            disabled={currentSelection?.type === 'edge' || currentSelection?.type === 'object'}
          />
        </ToolSection>

        {/* Modify Tools */}
        <ToolSection title="Modify">
          <ToolButton
            tool="fillet"
            icon={<Circle size={20} />}
            label="Fillet"
            isActive={activeTool === 'fillet'}
            onClick={() => {
              handleToolSelect('fillet');
              performFilletChamfer('fillet');
            }}
            disabled={!hasValidSolidsSelected}
          />
          <ToolButton
            tool="chamfer"
            icon={<Edit3 size={20} />}
            label="Chamfer"
            isActive={activeTool === 'chamfer'}
            onClick={() => {
              handleToolSelect('chamfer');
              performFilletChamfer('chamfer');
            }}
            disabled={!hasValidSolidsSelected}
          />
          <ToolButton
            tool="shell"
            icon={<Layers size={20} />}
            label="Shell"
            isActive={activeTool === 'shell'}
            onClick={() => {
              handleToolSelect('shell');
              performShell();
            }}
            disabled={!hasValidSolidsSelected}
          />
        </ToolSection>

        {/* Boolean Tools */}
        <ToolSection title="Boolean">
          <ToolButton
            tool="union"
            icon={<Plus size={20} />}
            label="Union"
            isActive={activeTool === 'union'}
            onClick={() => {
              handleToolSelect('union');
              performBoolean('union');
            }}
            disabled={!hasTwoSolidsSelected}
          />
          <ToolButton
            tool="subtract"
            icon={<Minus size={20} />}
            label="Subtract"
            isActive={activeTool === 'subtract'}
            onClick={() => {
              handleToolSelect('subtract');
              performBoolean('subtract');
            }}
            disabled={!hasTwoSolidsSelected}
          />
          <ToolButton
            tool="intersect"
            icon={<Circle size={20} />}
            label="Intersect"
            isActive={activeTool === 'intersect'}
            onClick={() => {
              handleToolSelect('intersect');
              performBoolean('intersect');
            }}
            disabled={!hasTwoSolidsSelected}
          />
        </ToolSection>
      </div>
    </>
  );
} 