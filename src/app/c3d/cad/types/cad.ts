import { Solid, Sketch } from 'replicad';

export interface CADObject {
  id: string;
  name: string;
  type: 'solid' | 'sketch' | 'group';
  solid?: Solid;
  sketch?: Sketch;
  mesh?: {
    vertices: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
  };
  visible: boolean;
  layerId: string;
  properties: CADObjectProperties;
  children?: CADObject[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    creator: 'user' | 'ai';
    replicadId?: string;
  };
}

export interface CADObjectProperties {
  color: string;
  opacity: number;
  material: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    radius?: number;
    depth?: number;
    thickness?: number;
  };
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface CADLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  opacity: number;
  objects: string[]; // object IDs
}

export interface CADOperation {
  id: string;
  type: CADOperationType;
  params: Record<string, number | string | boolean | undefined>;
  targetObjectId?: string;
  timestamp: Date;
  undoable: boolean;
}

export type CADOperationType =
  | 'create_box'
  | 'create_cylinder'
  | 'create_sphere'
  | 'create_cone'
  | 'extrude'
  | 'revolve'
  | 'union'
  | 'subtract'
  | 'intersect'
  | 'fillet'
  | 'chamfer'
  | 'move'
  | 'rotate'
  | 'scale'
  | 'delete'
  | 'duplicate'
  | 'sketch_line'
  | 'sketch_circle'
  | 'sketch_rectangle'
  | 'sketch_arc';

export interface CADScene {
  objects: Record<string, CADObject>;
  layers: Record<string, CADLayer>;
  selectedObjectIds: string[];
  activeLayerId: string;
  viewportSettings: ViewportSettings;
}

export interface ViewportSettings {
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
  grid: {
    visible: boolean;
    size: number;
    divisions: number;
  };
  lighting: {
    ambient: number;
    directional: {
      intensity: number;
      position: [number, number, number];
    };
  };
}

export interface ToolState {
  activeTool: CADTool;
  isDrawing: boolean;
  snapToGrid: boolean;
  snapTolerance: number;
}

export type CADTool =
  | 'select'
  | 'pan'
  | 'rotate'
  | 'zoom'
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'sketch'
  | 'extrude'
  | 'revolve'
  | 'fillet'
  | 'chamfer'
  | 'shell'
  | 'union'
  | 'subtract'
  | 'intersect';

export interface SketchPoint {
  x: number;
  y: number;
  z?: number;
}

export interface SketchEntity {
  id: string;
  type: 'line' | 'circle' | 'arc' | 'rectangle';
  points: SketchPoint[];
  constraints?: SketchConstraint[];
}

export interface SketchConstraint {
  id: string;
  type: 'distance' | 'parallel' | 'perpendicular' | 'tangent' | 'coincident';
  entities: string[];
  value?: number;
}

export interface ExportOptions {
  format: 'step' | 'stl' | 'obj' | 'ply';
  quality: 'low' | 'medium' | 'high';
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  includeHidden: boolean;
} 