/* eslint-disable */
'use client';

import { useAtom } from 'jotai';
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
import { activeToolAtom, addObjectAtom, addOperationAtom } from '../stores/cadStore';
import { CADTool } from '../types/cad';
import { cadEngine } from '../lib/cadEngine';
import { useTheme } from '../hooks/useTheme';
import styles from './ToolPalette.module.css';

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
  const [, addOperation] = useAtom(addOperationAtom);
  const { theme } = useTheme();

  const handleToolSelect = (tool: CADTool) => {
    setActiveTool(tool);
  };

  const handleCreatePrimitive = async (type: 'box' | 'cylinder' | 'sphere' | 'cone') => {
    try {
      let shape;
      switch (type) {
        case 'box':
          shape = await cadEngine.createBox(2, 2, 2);
          break;
        case 'cylinder':
          shape = await cadEngine.createCylinder(1, 2);
          break;
        case 'sphere':
          shape = await cadEngine.createSphere(1);
          break;
        case 'cone':
          shape = await cadEngine.createCone(1, 0.5, 2);
          break;
      }

      if (shape) {
        const objectId = addObject({
          name: `${type}_${Date.now()}`,
          type: 'solid',
          visible: true,
          layerId: 'default',
          properties: {
            color: '#ffffff',
            opacity: 1,
            material: 'default',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: shape.parameters,
          },
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            creator: 'user',
          },
        });

        addOperation({
          type: `create_${type}` as 'create_box' | 'create_cylinder' | 'create_sphere' | 'create_cone',
          params: shape.parameters,
          targetObjectId: objectId,
          undoable: true,
        });
      }
    } catch (error) {
      console.error(`Failed to create ${type}:`, error);
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
          onClick={() => {
            handleToolSelect('box');
            handleCreatePrimitive('box');
          }}
        />
        <ToolButton
          tool="cylinder"
          icon={<Cylinder size={20} />}
          label="Cylinder"
          isActive={activeTool === 'cylinder'}
          onClick={() => {
            handleToolSelect('cylinder');
            handleCreatePrimitive('cylinder');
          }}
        />
                  <ToolButton
          tool="sphere"
          icon={<Circle size={20} />}
          label="Sphere"
          isActive={activeTool === 'sphere'}
          onClick={() => {
            handleToolSelect('sphere');
            handleCreatePrimitive('sphere');
          }}
        />
        <ToolButton
          tool="cone"
          icon={<Triangle size={20} />}
          label="Cone"
          isActive={activeTool === 'cone'}
          onClick={() => {
            handleToolSelect('cone');
            handleCreatePrimitive('cone');
          }}
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
          onClick={() => handleToolSelect('fillet')}
        />
        <ToolButton
          tool="chamfer"
          icon={<Triangle size={20} />}
          label="Chamfer"
          isActive={activeTool === 'chamfer'}
          onClick={() => handleToolSelect('chamfer')}
        />
      </ToolSection>

      {/* Boolean Tools */}
      <ToolSection title="Boolean">
        <ToolButton
          tool="union"
          icon={<Plus size={20} />}
          label="Union"
          isActive={activeTool === 'union'}
          onClick={() => handleToolSelect('union')}
        />
        <ToolButton
          tool="subtract"
          icon={<Minus size={20} />}
          label="Subtract"
          isActive={activeTool === 'subtract'}
          onClick={() => handleToolSelect('subtract')}
        />
        <ToolButton
          tool="intersect"
          icon={<Circle size={20} />}
          label="Intersect"
          isActive={activeTool === 'intersect'}
          onClick={() => handleToolSelect('intersect')}
        />
      </ToolSection>
    </div>
  );
} 