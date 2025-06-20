/* eslint-disable */
'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useState, useRef } from 'react';
import { 
  MousePointer, 
  Move, 
  RotateCcw, 
  ZoomIn,
  Square, 
  Circle, 
  Triangle,
  Cylinder,
  Pencil,
  Plus,
  Minus,
  Layers,
  X,
  Minus as Line,
  MoreHorizontal as HorizontalLine,
  MoreVertical as VerticalLine,
  Zap,
  CheckCircle
} from 'lucide-react';
import { 
  activeToolAtom, 
  addObjectAtom, 
  selectedObjectsAtom, 
  removeObjectAtom, 
  cadObjectsAtom,
  isSketchingAtom,
  sketchModeAtom,
  startSketchAtom,
  addDrawingOperationAtom,
  finishSketchAtom,
  cancelSketchAtom
} from '../stores/cadStore';
import { CADTool } from '../types/cad';
import { cadEngine } from '../lib/cadEngine';
import { useTheme } from '../hooks/useTheme';
import styles from './ToolPalette.module.css';
import { toast } from 'sonner';

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

interface ToolButtonProps {
  tool: CADTool;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

// Tooltip component
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const tooltipTop = rect.top - 8; // 8px gap above the button
      let tooltipLeft = rect.left + rect.width / 2; // Center horizontally
      
      // Prevent tooltip from going off the left edge
      const tooltipWidth = content.length * 8 + 20; // Rough estimate
      if (tooltipLeft - tooltipWidth / 2 < 10) {
        tooltipLeft = tooltipWidth / 2 + 10;
      }
      
      setPosition({ top: tooltipTop, left: tooltipLeft });
      setIsVisible(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className={styles.tooltipContainer}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div 
          className={styles.tooltip}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

function ToolButton({ tool, icon, label, isActive, onClick }: ToolButtonProps) {
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
      'sketch': '',
      'extrude': 'E',
      'revolve': '',
      'fillet': '',
      'chamfer': '',
      'shell': '',
      'union': '',
      'subtract': '',
      'intersect': ''
    };
    
    const shortcut = shortcuts[tool];
    return shortcut ? `${label} (${shortcut})` : label;
  };

  return (
    <Tooltip content={getTooltip(label, tool)}>
      <button
        onClick={onClick}
        className={`${styles.toolButton} ${isActive ? styles.active : ''}`}
      >
        {icon}
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

// Sketch Toolbar Component
function SketchToolbar() {
  const [isSketchingValue] = useAtom(isSketchingAtom);
  const [sketchMode] = useAtom(sketchModeAtom);
  const [, addOperation] = useAtom(addDrawingOperationAtom);
  const [, finishSketch] = useAtom(finishSketchAtom);
  const [, cancelSketch] = useAtom(cancelSketchAtom);
  const { theme } = useTheme();

  if (!isSketchingValue) return null;

  const handleAddLine = async (type: 'hLine' | 'vLine' | 'line') => {
    try {
      const distance = parseFloat(prompt(`Enter ${type === 'hLine' ? 'horizontal' : type === 'vLine' ? 'vertical' : 'diagonal'} line distance:`) || '10');
      if (type === 'line') {
        const dx = parseFloat(prompt('Enter X offset:') || '10');
        const dy = parseFloat(prompt('Enter Y offset:') || '0');
        await addOperation({ type: 'line', params: [dx, dy] });
      } else {
        await addOperation({ type, params: [distance] });
      }
      toast.success(`${type} line added`);
    } catch (error) {
      toast.error(`Failed to add line: ${error}`);
    }
  };

  const handleAddArc = async () => {
    try {
      const dx = parseFloat(prompt('Enter arc end X:') || '20');
      const dy = parseFloat(prompt('Enter arc end Y:') || '10');
      const sagitta = parseFloat(prompt('Enter arc sagitta (curve amount):') || '5');
      await addOperation({ type: 'sagittaArc', params: [dx, dy, sagitta] });
      toast.success('Arc added');
    } catch (error) {
      toast.error(`Failed to add arc: ${error}`);
    }
  };

  const handleFinishSketch = async () => {
    try {
      const extrudeDistance = parseFloat(prompt('Enter extrude distance (mm):') || '10');
      await finishSketch(extrudeDistance);
      toast.success('Sketch completed and extruded');
    } catch (error) {
      toast.error(`Failed to finish sketch: ${error}`);
    }
  };

  return (
    <div className={styles.sketchToolbar} data-theme={theme}>
      <div className={styles.sketchHeader}>
        <h3>Sketch Mode ({sketchMode})</h3>
        <button onClick={cancelSketch} className={styles.cancelButton}>
          <X size={16} />
        </button>
      </div>
      
      <div className={styles.sketchTools}>
        <div className={styles.sketchSection}>
          <span className={styles.sketchSectionTitle}>Lines</span>
          <div className={styles.sketchButtonGroup}>
            <button onClick={() => handleAddLine('hLine')} className={styles.sketchButton}>
              <HorizontalLine size={16} />
              <span>H-Line</span>
            </button>
            <button onClick={() => handleAddLine('vLine')} className={styles.sketchButton}>
              <VerticalLine size={16} />
              <span>V-Line</span>
            </button>
            <button onClick={() => handleAddLine('line')} className={styles.sketchButton}>
              <Line size={16} />
              <span>Line</span>
            </button>
          </div>
        </div>

        <div className={styles.sketchSection}>
          <span className={styles.sketchSectionTitle}>Curves</span>
          <div className={styles.sketchButtonGroup}>
            <button onClick={handleAddArc} className={styles.sketchButton}>
              <Zap size={16} />
              <span>Arc</span>
            </button>
          </div>
        </div>

        <div className={styles.sketchActions}>
          <button onClick={handleFinishSketch} className={styles.finishButton}>
            <CheckCircle size={16} />
            <span>Finish & Extrude</span>
          </button>
        </div>
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
  const [, startSketch] = useAtom(startSketchAtom);
  const { theme } = useTheme();

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

  const openModal = (title: string, placeholder: string, inputType: 'text' | 'number' = 'number') => {
    return new Promise<string>((resolve, reject) => {
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

  const handleToolSelect = async (tool: CADTool) => {
    setActiveTool(tool);
    
    // Start sketching when sketch tool is selected
    if (tool === 'sketch') {
      try {
        await startSketch({ mode: 'line' });
        toast.success('Sketch mode started - use toolbar to add elements');
      } catch (error) {
        toast.error(`Failed to start sketch: ${error}`);
      }
    }
  };

  const performBoolean = async (op: 'union' | 'subtract' | 'intersect') => {
    if (selectedIds.length !== 2) {
      toast.warning('Select exactly two solids first');
      return;
    }
    const [aId, bId] = selectedIds;
    const shapeIdA = objects[aId]?.metadata?.replicadId || aId;
    const shapeIdB = objects[bId]?.metadata?.replicadId || bId;
    try {
      let result;
      switch (op) {
        case 'union':
          result = await cadEngine.unionShapes(shapeIdA, shapeIdB);
          break;
        case 'subtract':
          result = await cadEngine.subtractShapes(shapeIdA, shapeIdB);
          break;
        case 'intersect':
          result = await cadEngine.intersectShapes(shapeIdA, shapeIdB);
          break;
      }
      if (result) {
        // remove originals
        removeObject(aId);
        removeObject(bId);
        // add new object
        addObject({
          name: `${op}_${Date.now()}`,
          type: 'solid',
          solid: result.replicadSolid,
          mesh: result.mesh,
          visible: true,
          layerId: 'default',
          properties: {
            color: '#10b981', // emerald
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: result.parameters,
          },
          metadata: { createdAt: new Date(), updatedAt: new Date(), creator: 'user', replicadId: result.id },
        });
        toast.success(`${op} complete`);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${op}`);
    }
  };

  const performExtrude = async () => {
    if (selectedIds.length !== 1) {
      toast.warning('Select a single sketch first');
      return;
    }
    const cadId = selectedIds[0];
    const obj = objects[cadId];
    if (obj?.type !== 'sketch') {
      toast.warning('Selected object must be a sketch');
      return;
    }
    try {
      const distance = await openModal('Extrude Distance', 'Enter distance (mm)');
      const dist = parseFloat(distance);
      if (isNaN(dist) || dist <= 0) {
        toast.error('Invalid distance');
        return;
      }
      
      const shapeId = obj.metadata?.replicadId || cadId;
      const result = await cadEngine.extrudeSketch(shapeId, dist);
      if (result) {
        removeObject(cadId);
        addObject({
          name: `extruded_${Date.now()}`,
          type: 'solid',
          solid: result.replicadSolid,
          mesh: result.mesh,
          visible: true,
          layerId: 'default',
          properties: {
            color: '#10b981',
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: result.parameters,
          },
          metadata: { createdAt: new Date(), updatedAt: new Date(), creator: 'user', replicadId: result.id },
        });
        toast.success('Extrude complete');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to extrude');
    }
  };

  const performRevolve = async () => {
    if (selectedIds.length !== 1) {
      toast.warning('Select a single sketch first');
      return;
    }
    const cadId = selectedIds[0];
    const obj = objects[cadId];
    if (obj?.type !== 'sketch') {
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
          solid: result.replicadSolid,
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
          metadata: { createdAt: new Date(), updatedAt: new Date(), creator: 'user', replicadId: result.id },
        });
        toast.success('Revolve complete');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to revolve');
    }
  };

  const performShell = async () => {
    if (selectedIds.length !== 1) {
      toast.warning('Select a single solid first');
      return;
    }
    const cadId = selectedIds[0];
    const obj = objects[cadId];
    if (obj?.type !== 'solid') {
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
          solid: result.replicadSolid,
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
          metadata: { createdAt: new Date(), updatedAt: new Date(), creator: 'user', replicadId: result.id },
        });
        toast.success('Shell complete');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to shell');
    }
  };

  const performFilletChamfer = async (mode: 'fillet' | 'chamfer') => {
    if (selectedIds.length !== 1) {
      toast.warning(`Select a single solid first`);
      return;
    }
    const cadId = selectedIds[0];
    const shapeId = objects[cadId]?.metadata?.replicadId || cadId;
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
      
      let res;
      if (mode === 'fillet') res = await cadEngine.filletEdges(shapeId, val);
      else res = await cadEngine.chamferEdges(shapeId, val);
      if (res) {
        removeObject(cadId);
        addObject({
          name: `${mode}_${Date.now()}`,
          type: 'solid',
          solid: res.replicadSolid,
          mesh: res.mesh,
          visible: true,
          layerId: 'default',
          properties: {
            color: '#eab308',
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: res.parameters,
          },
          metadata: { createdAt: new Date(), updatedAt: new Date(), creator: 'user', replicadId: res.id },
        });
        toast.success(`${mode} applied`);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Failed to ${mode}`);
    }
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
      <div className={styles.container} data-theme={theme}>
      {/* Selection Tools */}
      <ToolSection title="Select">
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

      {/* Primitive Tools */}
      <ToolSection title="Primitives">
        <ToolButton
          tool="box"
          icon={<Square size={20} />}
          label="Box"
          isActive={activeTool === 'box'}
          onClick={() => handleToolSelect('box')}
        />
        <ToolButton
          tool="cylinder"
          icon={<Cylinder size={20} />}
          label="Cylinder"
          isActive={activeTool === 'cylinder'}
          onClick={() => handleToolSelect('cylinder')}
        />
        <ToolButton
          tool="sphere"
          icon={<Circle size={20} />}
          label="Sphere"
          isActive={activeTool === 'sphere'}
          onClick={() => handleToolSelect('sphere')}
        />
        <ToolButton
          tool="cone"
          icon={<Triangle size={20} />}
          label="Cone"
          isActive={activeTool === 'cone'}
          onClick={() => handleToolSelect('cone')}
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
          icon={<Square size={20} />}
          label="Extrude"
          isActive={activeTool === 'extrude'}
          onClick={() => {
            handleToolSelect('extrude');
            performExtrude();
          }}
        />
        <ToolButton
          tool="revolve"
          icon={<Circle size={20} />}
          label="Revolve"
          isActive={activeTool === 'revolve'}
          onClick={() => {
            handleToolSelect('revolve');
            performRevolve();
          }}
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
        />
        <ToolButton
          tool="chamfer"
          icon={<Triangle size={20} />}
          label="Chamfer"
          isActive={activeTool === 'chamfer'}
          onClick={() => {
            handleToolSelect('chamfer');
            performFilletChamfer('chamfer');
          }}
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
        />
      </ToolSection>

      {/* Sketch Toolbar - appears when sketching */}
      <SketchToolbar />
    </div>
    </>
  );
} 