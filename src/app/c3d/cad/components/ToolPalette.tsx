/* eslint-disable */
'use client';

import { useAtom, useAtomValue } from 'jotai';
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
  Minus
} from 'lucide-react';
import { activeToolAtom, addObjectAtom, selectedObjectsAtom, removeObjectAtom, cadObjectsAtom } from '../stores/cadStore';
import { CADTool } from '../types/cad';
import { cadEngine } from '../lib/cadEngine';
import { useTheme } from '../hooks/useTheme';
import styles from './ToolPalette.module.css';
import { toast } from 'sonner';

interface ToolButtonProps {
  tool: CADTool;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ToolButton({ tool, icon, label, isActive, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`${styles.toolButton} ${isActive ? styles.active : ''}`}
      title={label}
    >
      {icon}
    </button>
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

export default function ToolPalette() {
  const [activeTool, setActiveTool] = useAtom(activeToolAtom);
  const [, addObject] = useAtom(addObjectAtom);
  const [selectedIds] = useAtom(selectedObjectsAtom);
  const [, removeObject] = useAtom(removeObjectAtom);
  const objects = useAtomValue(cadObjectsAtom);
  const { theme } = useTheme();

  const handleToolSelect = (tool: CADTool) => {
    setActiveTool(tool);
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

  const performFilletChamfer = async (mode: 'fillet' | 'chamfer') => {
    if (selectedIds.length !== 1) {
      toast.warning(`Select a single solid first`);
      return;
    }
    const cadId = selectedIds[0];
    const shapeId = objects[cadId]?.metadata?.replicadId || cadId;
    const valStr = prompt(`${mode} radius/distance:`);
    if (!valStr) return;
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) {
      toast.error('Invalid number');
      return;
    }
    try {
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
          onClick={() => handleToolSelect('extrude')}
        />
        <ToolButton
          tool="revolve"
          icon={<Circle size={20} />}
          label="Revolve"
          isActive={activeTool === 'revolve'}
          onClick={() => handleToolSelect('revolve')}
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
    </div>
  );
} 