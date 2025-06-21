/* eslint-disable @typescript-eslint/no-explicit-any */

import { CADEngine } from './cadEngine';

export interface SketchPoint {
  x: number;
  y: number;
}

export interface SketchOperation {
  type: 'line' | 'circle' | 'rectangle' | 'arc' | 'moveTo';
  points: SketchPoint[];
  params?: any;
}

export interface ActiveSketch {
  id: string;
  operations: SketchOperation[];
  currentPoint: SketchPoint;
  closed: boolean;
  plane: 'XY' | 'XZ' | 'YZ';
  planeOffset: number;
  faceId?: string; // If sketching on a face
}

export class SketchEngine {
  private cadEngine: CADEngine;
  private activeSketch: ActiveSketch | null = null;
  private initialized = false;
  
  constructor(cadEngine: CADEngine) {
    this.cadEngine = cadEngine;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.cadEngine.initialize();
    this.initialized = true;
  }

  // Start a new sketch on a plane
  async startSketch(plane: 'XY' | 'XZ' | 'YZ' = 'XY', planeOffset: number = 0): Promise<string> {
    await this.initialize();
    
    const sketchId = `sketch_${Date.now()}`;
    this.activeSketch = {
      id: sketchId,
      operations: [],
      currentPoint: { x: 0, y: 0 },
      closed: false,
      plane,
      planeOffset
    };
    
    return sketchId;
  }

  // Start sketching on a selected face
  async startSketchOnFace(faceId: string): Promise<string> {
    await this.initialize();
    
    const sketchId = `sketch_${Date.now()}`;
    this.activeSketch = {
      id: sketchId,
      operations: [],
      currentPoint: { x: 0, y: 0 },
      closed: false,
      plane: 'XY', // Will be determined by face normal
      planeOffset: 0,
      faceId
    };
    
    return sketchId;
  }

  // Add a line to the current sketch
  addLine(endPoint: SketchPoint): void {
    if (!this.activeSketch) {
      throw new Error('No active sketch');
    }

    this.activeSketch.operations.push({
      type: 'line',
      points: [this.activeSketch.currentPoint, endPoint]
    });
    
    this.activeSketch.currentPoint = endPoint;
  }

  // Add a circle to the current sketch
  addCircle(center: SketchPoint, radius: number): void {
    if (!this.activeSketch) {
      throw new Error('No active sketch');
    }

    this.activeSketch.operations.push({
      type: 'circle',
      points: [center],
      params: { radius }
    });
  }

  // Add a rectangle to the current sketch
  addRectangle(corner1: SketchPoint, corner2: SketchPoint): void {
    if (!this.activeSketch) {
      throw new Error('No active sketch');
    }

    this.activeSketch.operations.push({
      type: 'rectangle',
      points: [corner1, corner2]
    });
  }

  // Move the current point without drawing
  moveTo(point: SketchPoint): void {
    if (!this.activeSketch) {
      throw new Error('No active sketch');
    }

    this.activeSketch.operations.push({
      type: 'moveTo',
      points: [point]
    });
    
    this.activeSketch.currentPoint = point;
  }

  // Close the current sketch and create a ReplicAD drawing
  async finishSketch(): Promise<any> {
    if (!this.activeSketch) {
      throw new Error('No active sketch');
    }

    await this.initialize();

    try {
      // Get ReplicAD instance from CAD engine
      const replicad = (this.cadEngine as any).replicad;
      if (!replicad) {
        throw new Error('ReplicAD not initialized');
      }

      const { draw, drawCircle, drawRoundedRectangle } = replicad;

      // Create the drawing based on operations
      let result;

      // Handle single shapes first
      const singleCircle = this.activeSketch.operations.find(op => op.type === 'circle');
      const singleRectangle = this.activeSketch.operations.find(op => op.type === 'rectangle');

      if (singleCircle && this.activeSketch.operations.length === 1) {
        // Single circle
        const radius = singleCircle.params.radius;
        const center = singleCircle.points[0];
        result = drawCircle(radius);
        
        // Apply translation if not centered at origin
        if (center.x !== 0 || center.y !== 0) {
          result = result.translate(center.x, center.y);
        }
      } else if (singleRectangle && this.activeSketch.operations.length === 1) {
        // Single rectangle
        const corner1 = singleRectangle.points[0];
        const corner2 = singleRectangle.points[1];
        const width = Math.abs(corner2.x - corner1.x);
        const height = Math.abs(corner2.y - corner1.y);
        const centerX = (corner1.x + corner2.x) / 2;
        const centerY = (corner1.y + corner2.y) / 2;
        
        result = drawRoundedRectangle(width, height, 0)
          .translate(centerX, centerY);
      } else {
        // Complex drawing with multiple operations
        let drawing = draw();
        let hasDrawn = false;

        for (const operation of this.activeSketch.operations) {
          switch (operation.type) {
            case 'moveTo':
              if (!hasDrawn) {
                drawing = draw([operation.points[0].x, operation.points[0].y]);
                hasDrawn = true;
              } else {
                // For subsequent moves, we need to handle this differently
                // ReplicAD doesn't support moveTo in the middle of a drawing
                console.warn('MoveTo in middle of drawing not fully supported');
              }
              break;
              
            case 'line':
              if (!hasDrawn) {
                drawing = draw([operation.points[0].x, operation.points[0].y]);
                hasDrawn = true;
              }
              drawing = drawing.lineTo([operation.points[1].x, operation.points[1].y]);
              break;
          }
        }

        // Close the drawing if it's a closed profile
        if (hasDrawn && this.shouldAutoClose()) {
          drawing = drawing.close();
        }

        result = drawing;
      }

      // Sketch the drawing on the specified plane
      const sketch = result.sketchOnPlane(this.activeSketch.plane, this.activeSketch.planeOffset);

      // Reset active sketch
      const sketchId = this.activeSketch.id;
      const plane = this.activeSketch.plane;
      this.activeSketch = null;

      return {
        id: sketchId,
        replicadSketch: sketch,
        drawing: result,
        plane
      };

    } catch (error) {
      console.error('Failed to finish sketch:', error);
      throw error;
    }
  }

  // Check if the sketch should be auto-closed
  private shouldAutoClose(): boolean {
    if (!this.activeSketch || this.activeSketch.operations.length < 3) {
      return false;
    }

    // Check if the last point is close to the first point
    const firstOp = this.activeSketch.operations.find(op => op.type === 'line' || op.type === 'moveTo');
    if (!firstOp) return false;

    const firstPoint = firstOp.points[0];
    const lastPoint = this.activeSketch.currentPoint;
    
    const distance = Math.sqrt(
      Math.pow(lastPoint.x - firstPoint.x, 2) + 
      Math.pow(lastPoint.y - firstPoint.y, 2)
    );
    
    return distance < 0.1; // Close enough to be considered closed
  }

  // Get the current sketch state
  getCurrentSketch(): ActiveSketch | null {
    return this.activeSketch;
  }

  // Cancel the current sketch
  cancelSketch(): void {
    this.activeSketch = null;
  }

  // Create a simple sketch using ReplicAD's pre-built functions
  async createSimpleSketch(
    type: 'circle' | 'rectangle' | 'roundedRectangle',
    params: any,
    plane: 'XY' | 'XZ' | 'YZ' = 'XY',
    planeOffset: number = 0
  ): Promise<any> {
    await this.initialize();

    const replicad = (this.cadEngine as any).replicad;
    if (!replicad) {
      throw new Error('ReplicAD not initialized');
    }

    const { drawCircle, drawRoundedRectangle } = replicad;

    let drawing;
    switch (type) {
      case 'circle':
        drawing = drawCircle(params.radius);
        break;
      case 'rectangle':
      case 'roundedRectangle':
        const radius = type === 'roundedRectangle' ? (params.radius || 0) : 0;
        drawing = drawRoundedRectangle(params.width, params.height, radius);
        break;
      default:
        throw new Error(`Unsupported sketch type: ${type}`);
    }

    const sketch = drawing.sketchOnPlane(plane, planeOffset);

    return {
      id: `sketch_${Date.now()}`,
      replicadSketch: sketch,
      drawing,
      plane,
      type
    };
  }

  // Create a drawing from points (for programmatic creation)
  async createDrawingFromPoints(
    points: SketchPoint[],
    closed: boolean = true,
    plane: 'XY' | 'XZ' | 'YZ' = 'XY',
    planeOffset: number = 0
  ): Promise<any> {
    if (points.length < 2) {
      throw new Error('Need at least 2 points to create a drawing');
    }

    await this.initialize();

    const replicad = (this.cadEngine as any).replicad;
    if (!replicad) {
      throw new Error('ReplicAD not initialized');
    }

    const { draw } = replicad;

    // Start drawing from first point
    let drawing = draw([points[0].x, points[0].y]);

    // Add lines to subsequent points
    for (let i = 1; i < points.length; i++) {
      drawing = drawing.lineTo([points[i].x, points[i].y]);
    }

    // Close if requested
    if (closed) {
      drawing = drawing.close();
    }

    const sketch = drawing.sketchOnPlane(plane, planeOffset);

    return {
      id: `sketch_${Date.now()}`,
      replicadSketch: sketch,
      drawing,
      plane,
      points,
      closed
    };
  }
} 