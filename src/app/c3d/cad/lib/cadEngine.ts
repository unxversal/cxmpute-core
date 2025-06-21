import { CADOperation, ExportOptions } from '../types/cad';
import { SketchEngine } from './sketchEngine';

interface ReplicadShape {
  id: string;
  type: 'solid' | 'sketch' | 'wire' | 'face';
  mesh?: {
    vertices: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: Record<string, any>;
  transform?: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  };
}

export class CADEngine {
  private shapes: Map<string, ReplicadShape> = new Map();
  // Stores the heavyweight Replicad objects (Solid, Sketch…) keyed by shape id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private replicadObjects: Map<string, any> = new Map();
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private replicad: any = null; // External replicad library module
  // Fallback mode removed – Replicad is now a hard requirement
  private fallbackMode = false; // Kept for type-safety; always false
  private sketchEngine: SketchEngine;
  
  constructor() {
    this.sketchEngine = new SketchEngine(this);
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Prevent multiple simultaneous initialization attempts
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }
  
  private async _initialize(): Promise<void> {
    // Ensure we are in the browser – Replicad needs WebAssembly
    if (typeof window === 'undefined') {
      throw new Error('CADEngine initialisation must run in a browser environment');
    }

    console.log('🔄 CAD Engine: Starting initialization…');

    // Dynamically import Replicad & its loader
    const { initializeReplicad } = await import('./replicadLoader');
    this.replicad = await initializeReplicad();

    if (!this.replicad) {
      throw new Error('Unable to load Replicad – Aborting');
    }

    this.initialized = true;
    console.log('🎉 CAD Engine initialized with Replicad');
  }

  // ==================== PRIMITIVE CREATION ====================

  async createBox(width: number, height: number, depth: number): Promise<ReplicadShape> {
    await this.initialize();
    
    if (!this.replicad) {
      throw new Error('Replicad not initialised');
    }
    
    try {
      const { makeBaseBox } = this.replicad;
      const solid = makeBaseBox(width, height, depth);
      
      const id = `box_${Date.now()}`;
      this.replicadObjects.set(id, solid);

      const shape: ReplicadShape = {
        id,
        type: 'solid',
        mesh: await this.convertToMesh(solid),
        parameters: { width, height, depth }
      };

      this.shapes.set(id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to create box with replicad:', error);
      // Fallback to simple geometry
      return this.createSimpleBox(width, height, depth);
    }
  }

  async createCylinder(radius: number, height: number): Promise<ReplicadShape> {
    await this.initialize();
    
    if (!this.replicad) {
      throw new Error('Replicad not initialised');
    }
    
    try {
      const { makeCylinder } = this.replicad;
      const solid = makeCylinder(radius, height);
      
      const id = `cylinder_${Date.now()}`;
      this.replicadObjects.set(id, solid);

      const shape: ReplicadShape = {
        id,
        type: 'solid',
        mesh: await this.convertToMesh(solid),
        parameters: { radius, height }
      };

      this.shapes.set(id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to create cylinder with replicad:', error);
      return this.createSimpleCylinder(radius, height);
    }
  }

  async createSphere(radius: number): Promise<ReplicadShape> {
    await this.initialize();
    
    if (!this.replicad) {
      throw new Error('Replicad not initialised');
    }
    
    try {
      const { makeSphere } = this.replicad;
      const solid = makeSphere(radius);
      
      const id = `sphere_${Date.now()}`;
      this.replicadObjects.set(id, solid);

      const shape: ReplicadShape = {
        id,
        type: 'solid',
        mesh: await this.convertToMesh(solid),
        parameters: { radius }
      };

      this.shapes.set(id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to create sphere with replicad:', error);
      return this.createSimpleSphere(radius);
    }
  }

  async createCone(radius1: number, radius2: number, height: number): Promise<ReplicadShape> {
    await this.initialize();
    
    if (!this.replicad) {
      throw new Error('Replicad not initialised');
    }
    
    try {
      const { drawCircle } = this.replicad;
      // Create cone using replicad - loft between two circles
      const baseCircle = drawCircle(radius1).sketchOnPlane("XY", 0);
      const topCircle = drawCircle(radius2).sketchOnPlane("XY", height);
      
      const solid = baseCircle.loftWith([topCircle]);
      
      const id = `cone_${Date.now()}`;
      this.replicadObjects.set(id, solid);

      const shape: ReplicadShape = {
        id,
        type: 'solid',
        mesh: await this.convertToMesh(solid),
        parameters: { radius1, radius2, height }
      };

      this.shapes.set(id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to create cone with replicad:', error);
      return this.createSimpleCone(radius1, radius2, height);
    }
  }

  // ==================== SKETCH OPERATIONS ====================

  async createSketch(plane: 'XY' | 'XZ' | 'YZ' = 'XY', offset: number = 0): Promise<string> {
    await this.initialize();
    
    const { Sketcher } = this.replicad;
    const sketcher = new Sketcher(plane, offset);
    
    const sketchId = `sketch_${Date.now()}`;
    this.replicadObjects.set(sketchId, sketcher);

    const shape: ReplicadShape = {
      id: sketchId,
      type: 'sketch',
      parameters: { plane, offset }
    };

    this.shapes.set(sketchId, shape);
    return sketchId;
  }

  async extrudeSketch(sketchId: string, distance: number): Promise<ReplicadShape> {
    await this.initialize();
    
    const sketchObj = this.replicadObjects.get(sketchId);
    if (!sketchObj) {
      throw new Error('Invalid sketch for extrusion');
    }

    try {
      const solid = sketchObj.extrude(distance);
      
      const id = `extrude_${Date.now()}`;
      this.replicadObjects.set(id, solid);

      const shape: ReplicadShape = {
        id,
        type: 'solid',
        mesh: await this.convertToMesh(solid),
        parameters: { distance, originalSketch: sketchId }
      };

      this.shapes.set(id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to extrude sketch:', error);
      throw error;
    }
  }

  async revolveSketch(sketchId: string, axis: [number, number, number] = [0, 0, 1], angle: number = 360): Promise<ReplicadShape> {
    await this.initialize();
    
    const sketchObj = this.replicadObjects.get(sketchId);
    if (!sketchObj) {
      throw new Error('Invalid sketch for revolution');
    }

    try {
      const solid = sketchObj.revolve(axis, { angle: angle * Math.PI / 180 });
      
      const shape: ReplicadShape = {
        id: `revolve_${Date.now()}`,
        type: 'solid',
        mesh: await this.convertToMesh(solid),
        parameters: { axis, angle, originalSketch: sketchId }
      };

      this.shapes.set(shape.id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to revolve sketch:', error);
      throw error;
    }
  }

  // ==================== BOOLEAN OPERATIONS ====================

  async unionShapes(shape1Id: string, shape2Id: string): Promise<ReplicadShape> {
    await this.initialize();
    
    const shape1Obj = this.replicadObjects.get(shape1Id);
    const shape2Obj = this.replicadObjects.get(shape2Id);
    
    if (!shape1Obj || !shape2Obj) {
      throw new Error('Invalid shapes for union operation');
    }

    try {
      const result = shape1Obj.fuse(shape2Obj);
      
      const shape: ReplicadShape = {
        id: `union_${Date.now()}`,
        type: 'solid',
        mesh: await this.convertToMesh(result),
        parameters: { operation: 'union', operands: [shape1Id, shape2Id] }
      };

      this.shapes.set(shape.id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to perform union:', error);
      throw error;
    }
  }

  async subtractShapes(baseShapeId: string, toolShapeId: string): Promise<ReplicadShape> {
    await this.initialize();
    
    const baseShapeObj = this.replicadObjects.get(baseShapeId);
    const toolShapeObj = this.replicadObjects.get(toolShapeId);
    
    if (!baseShapeObj || !toolShapeObj) {
      throw new Error('Invalid shapes for subtraction operation');
    }

    try {
      const result = baseShapeObj.cut(toolShapeObj);
      
      const shape: ReplicadShape = {
        id: `subtract_${Date.now()}`,
        type: 'solid',
        mesh: await this.convertToMesh(result),
        parameters: { operation: 'subtract', base: baseShapeId, tool: toolShapeId }
      };

      this.shapes.set(shape.id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to perform subtraction:', error);
      throw error;
    }
  }

  async intersectShapes(shape1Id: string, shape2Id: string): Promise<ReplicadShape> {
    await this.initialize();
    
    const shape1Obj = this.replicadObjects.get(shape1Id);
    const shape2Obj = this.replicadObjects.get(shape2Id);
    
    if (!shape1Obj || !shape2Obj) {
      throw new Error('Invalid shapes for intersection operation');
    }

    try {
      const result = shape1Obj.intersect(shape2Obj);
      
      const shape: ReplicadShape = {
        id: `intersect_${Date.now()}`,
        type: 'solid',
        mesh: await this.convertToMesh(result),
        parameters: { operation: 'intersect', operands: [shape1Id, shape2Id] }
      };

      this.shapes.set(shape.id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to perform intersection:', error);
      throw error;
    }
  }

  // ==================== MODIFICATION OPERATIONS ====================

  async filletEdges(shapeId: string, radius: number, edgeFilter?: string): Promise<ReplicadShape> {
    await this.initialize();
    
    const shapeObj = this.replicadObjects.get(shapeId);
    if (!shapeObj) {
      throw new Error('Invalid shape for fillet operation');
    }

    try {
      let result;
      if (edgeFilter) {
        // Apply fillet with edge filter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = shapeObj.fillet(radius, (e: any) => e.inDirection(edgeFilter));
      } else {
        // Apply fillet to all edges
        result = shapeObj.fillet(radius);
      }
      
      const newShape: ReplicadShape = {
        id: `fillet_${Date.now()}`,
        type: 'solid',
        mesh: await this.convertToMesh(result),
        parameters: { operation: 'fillet', radius, originalShape: shapeId, edgeFilter }
      };

      this.shapes.set(newShape.id, newShape);
      return newShape;
    } catch (error) {
      console.error('Failed to apply fillet:', error);
      throw error;
    }
  }

  async chamferEdges(shapeId: string, distance: number, edgeFilter?: string): Promise<ReplicadShape> {
    await this.initialize();
    
    const shapeObj = this.replicadObjects.get(shapeId);
    if (!shapeObj) {
      throw new Error('Invalid shape for chamfer operation');
    }

    try {
      let result;
      if (edgeFilter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = shapeObj.chamfer(distance, (e: any) => e.inDirection(edgeFilter));
      } else {
        result = shapeObj.chamfer(distance);
      }
      
      const newShape: ReplicadShape = {
        id: `chamfer_${Date.now()}`,
        type: 'solid',
        mesh: await this.convertToMesh(result),
        parameters: { operation: 'chamfer', distance, originalShape: shapeId, edgeFilter }
      };

      this.shapes.set(newShape.id, newShape);
      return newShape;
    } catch (error) {
      console.error('Failed to apply chamfer:', error);
      throw error;
    }
  }

  async shellShape(shapeId: string, thickness: number, faceFilter?: string): Promise<ReplicadShape> {
    await this.initialize();
    
    const shapeObj = this.replicadObjects.get(shapeId);
    if (!shapeObj) {
      throw new Error('Invalid shape for shell operation');
    }

    try {
      let result;
      if (faceFilter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = shapeObj.shell(thickness, (f: any) => f.inPlane(faceFilter));
      } else {
        result = shapeObj.shell(thickness);
      }
      
      const newShape: ReplicadShape = {
        id: `shell_${Date.now()}`,
        type: 'solid',
        mesh: await this.convertToMesh(result),
        parameters: { operation: 'shell', thickness, originalShape: shapeId, faceFilter }
      };

      this.shapes.set(newShape.id, newShape);
      return newShape;
    } catch (error) {
      console.error('Failed to apply shell:', error);
      throw error;
    }
  }

  // ==================== TRANSFORMATION OPERATIONS ====================

  transformShape(shapeId: string, transform: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  }): ReplicadShape {
    const shape = this.shapes.get(shapeId);
    if (!shape) {
      throw new Error('Shape not found');
    }

    let transformedSolid = this.replicadObjects.get(shapeId);

    if (transform.position) {
      transformedSolid = transformedSolid.translate(transform.position);
    }

    if (transform.rotation) {
      const [rx, ry, rz] = transform.rotation;
      if (rx !== 0) transformedSolid = transformedSolid.rotate(rx, [1, 0, 0], [0, 0, 0]);
      if (ry !== 0) transformedSolid = transformedSolid.rotate(ry, [0, 1, 0], [0, 0, 0]);
      if (rz !== 0) transformedSolid = transformedSolid.rotate(rz, [0, 0, 1], [0, 0, 0]);
    }

    if (transform.scale) {
      const [sx, sy, sz] = transform.scale;
      transformedSolid = transformedSolid.scale(sx, sy, sz);
    }

    const newShape: ReplicadShape = {
      id: `transform_${Date.now()}`,
      type: shape.type,
      mesh: shape.mesh, // Will be updated if needed
      parameters: { ...shape.parameters, transform },
      transform
    };

    this.shapes.set(newShape.id, newShape);
    return newShape;
  }

  // ==================== UTILITY FUNCTIONS ====================

  async executeOperation(operation: CADOperation): Promise<ReplicadShape | null> {
    await this.initialize();

    const { type, params } = operation;

    try {
      switch (type) {
        case 'create_box':
          return this.createBox(
            typeof params.width === 'number' ? params.width : 1,
            typeof params.height === 'number' ? params.height : 1,
            typeof params.depth === 'number' ? params.depth : 1
          );
        
        case 'create_cylinder':
          return this.createCylinder(
            typeof params.radius === 'number' ? params.radius : 0.5,
            typeof params.height === 'number' ? params.height : 1
          );
        
        case 'create_sphere':
          return this.createSphere(
            typeof params.radius === 'number' ? params.radius : 0.5
          );
        
        case 'extrude':
          if (typeof params.sketchId === 'string') {
            return this.extrudeSketch(
              params.sketchId,
              typeof params.distance === 'number' ? params.distance : 1
            );
          }
          break;
        
        case 'revolve':
          if (typeof params.sketchId === 'string') {
            // Parse axis from params or use default
            let axis: [number, number, number] = [0, 0, 1];
            const axisParam = params.axis as unknown;
            if (Array.isArray(axisParam) && axisParam.length === 3 && 
                axisParam.every(val => typeof val === 'number')) {
              axis = axisParam as [number, number, number];
            }
            return this.revolveSketch(
              params.sketchId,
              axis,
              typeof params.angle === 'number' ? params.angle : 360
            );
          }
          break;
        
        case 'union':
          if (typeof params.shape1Id === 'string' && typeof params.shape2Id === 'string') {
            return this.unionShapes(params.shape1Id, params.shape2Id);
          }
          break;
        
        case 'subtract':
          if (typeof params.baseShapeId === 'string' && typeof params.toolShapeId === 'string') {
            return this.subtractShapes(params.baseShapeId, params.toolShapeId);
          }
          break;
        
        case 'intersect':
          if (typeof params.shape1Id === 'string' && typeof params.shape2Id === 'string') {
            return this.intersectShapes(params.shape1Id, params.shape2Id);
          }
          break;
        
        case 'fillet':
          if (typeof params.shapeId === 'string') {
            return this.filletEdges(
              params.shapeId,
              typeof params.radius === 'number' ? params.radius : 1,
              typeof params.edgeFilter === 'string' ? params.edgeFilter : undefined
            );
          }
          break;
        
        case 'chamfer':
          if (typeof params.shapeId === 'string') {
            return this.chamferEdges(
              params.shapeId,
              typeof params.distance === 'number' ? params.distance : 1,
              typeof params.edgeFilter === 'string' ? params.edgeFilter : undefined
            );
          }
          break;
        
        default:
          console.warn(`Operation ${type} not yet implemented`);
          return null;
      }
    } catch (error) {
      console.error(`Failed to execute operation ${type}:`, error);
      throw error;
    }

    return null;
  }

  // ==================== EXPORT FUNCTIONALITY ====================

  async exportShape(shape: ReplicadShape, options: ExportOptions): Promise<Blob> {
    await this.initialize();

    switch (options.format) {
      case 'step':
        return this.exportToSTEP(shape);
      case 'stl':
        return this.exportToSTL(shape);
      case 'obj':
        return this.exportToOBJ(shape);
      default:
        throw new Error(`Export format ${options.format} not yet implemented`);
    }
  }

  private async exportToSTEP(shape: ReplicadShape): Promise<Blob> {
    if (!this.replicadObjects.get(shape.id)) {
      throw new Error('No replicad solid available for STEP export');
    }

    try {
      const stepContent = this.replicadObjects.get(shape.id).toSTEP();
      return new Blob([stepContent], { type: 'application/step' });
    } catch (error) {
      console.error('Failed to export to STEP:', error);
      throw error;
    }
  }

  private async exportToSTL(shape: ReplicadShape): Promise<Blob> {
    if (!shape.mesh) {
      throw new Error('Shape has no mesh data');
    }

    let stlContent = 'solid model\n';
    
    const { vertices, indices } = shape.mesh;
    
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;
      
      stlContent += '  facet normal 0.0 0.0 1.0\n';
      stlContent += '    outer loop\n';
      stlContent += `      vertex ${vertices[i1]} ${vertices[i1 + 1]} ${vertices[i1 + 2]}\n`;
      stlContent += `      vertex ${vertices[i2]} ${vertices[i2 + 1]} ${vertices[i2 + 2]}\n`;
      stlContent += `      vertex ${vertices[i3]} ${vertices[i3 + 1]} ${vertices[i3 + 2]}\n`;
      stlContent += '    endloop\n';
      stlContent += '  endfacet\n';
    }
    
    stlContent += 'endsolid model\n';
    
    return new Blob([stlContent], { type: 'application/sla' });
  }

  private async exportToOBJ(shape: ReplicadShape): Promise<Blob> {
    if (!shape.mesh) {
      throw new Error('Shape has no mesh data');
    }

    let objContent = `# ${shape.type} model\n`;
    
    const { vertices, indices } = shape.mesh;
    
    // Add vertices
    for (let i = 0; i < vertices.length; i += 3) {
      objContent += `v ${vertices[i]} ${vertices[i + 1]} ${vertices[i + 2]}\n`;
    }
    
    // Add faces
    for (let i = 0; i < indices.length; i += 3) {
      const face1 = indices[i] + 1; // OBJ indices are 1-based
      const face2 = indices[i + 1] + 1;
      const face3 = indices[i + 2] + 1;
      objContent += `f ${face1} ${face2} ${face3}\n`;
    }
    
    return new Blob([objContent], { type: 'text/plain' });
  }

  // ==================== MESH CONVERSION ====================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async convertToMesh(replicadSolid: any): Promise<{
    vertices: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
  }> {
    try {
      // Use replicad's mesh generation
      const mesh = replicadSolid.mesh({ tolerance: 0.1, angularTolerance: 0.1 });
      
      return {
        vertices: new Float32Array(mesh.vertices),
        indices: new Uint32Array(mesh.triangles),
        normals: mesh.normals ? new Float32Array(mesh.normals) : undefined
      };
    } catch (error) {
      console.error('Failed to convert to mesh:', error);
      // Return empty mesh as fallback
      return {
        vertices: new Float32Array([]),
        indices: new Uint32Array([])
      };
    }
  }

  // ==================== FALLBACK SIMPLE GEOMETRY ====================

  // Simple geometry helpers removed – Replicad is mandatory. Keeping stubs that throw for old callers.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createSimpleBox(_w: number, _h: number, _d: number): never {
    throw new Error('createSimpleBox() is no longer available – Replicad must be loaded');
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createSimpleCylinder(_r: number, _h: number): never {
    throw new Error('createSimpleCylinder() is no longer available – Replicad must be loaded');
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createSimpleSphere(_r: number): never {
    throw new Error('createSimpleSphere() is no longer available – Replicad must be loaded');
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createSimpleCone(_r1: number, _r2: number, _h: number): never {
    throw new Error('createSimpleCone() is no longer available – Replicad must be loaded');
  }

  // ==================== SHAPE MANAGEMENT ====================

  getShape(id: string): ReplicadShape | undefined {
    return this.shapes.get(id);
  }

  getAllShapes(): ReplicadShape[] {
    return Array.from(this.shapes.values());
  }

  deleteShape(id: string): boolean {
    return this.shapes.delete(id);
  }

  clearAllShapes(): void {
    this.shapes.clear();
  }

  // ==================== STATUS METHODS ====================

  isInitialized(): boolean {
    return this.initialized;
  }

  isUsingFallbackMode(): boolean {
    return this.fallbackMode;
  }

  getStatus(): { initialized: boolean; fallbackMode: boolean; hasReplicad: boolean } {
    return {
      initialized: this.initialized,
      fallbackMode: this.fallbackMode,
      hasReplicad: !!this.replicad
    };
  }

  // Get sketch engine for advanced sketch operations
  getSketchEngine(): SketchEngine {
    return this.sketchEngine;
  }

  // Create a basic sketch for quick prototyping
  async createBasicSketch(
    type: 'rectangle' | 'circle',
    params: { width?: number; height?: number; radius?: number }
  ): Promise<{ id: string; mesh: any } | null> {
    await this.initialize();
    
    if (!this.replicad) {
      throw new Error('Replicad not loaded');
    }

    try {
      const { drawRoundedRectangle, drawCircle } = this.replicad;
      const id = `sketch_${Date.now()}`;
      
      let shape;
      if (type === 'rectangle') {
        const width = params.width || 10;
        const height = params.height || 10;
        shape = drawRoundedRectangle(width, height, 0);
      } else if (type === 'circle') {
        const radius = params.radius || 5;
        shape = drawCircle(radius);
      } else {
        throw new Error(`Unsupported sketch type: ${type}`);
      }

      const sketched = shape.sketchOnPlane();
      const mesh = await this.convertToMesh(sketched);
      
      this.replicadObjects.set(id, sketched);
      
      return { id, mesh };
    } catch (error) {
      console.error('Failed to create basic sketch:', error);
      return null;
    }
  }

  // ==================== QUICK POLYGON EXTRUDE (sketch MVP) ====================

  /**
   * Convenience wrapper used by the draft-sketch UI: create an extruded solid
   * from a 2-D poly-line described by [x,y] points lying on the XY plane.
   */
  async createExtrudedPolygon(points: [number, number][], height: number): Promise<ReplicadShape> {
    if (points.length < 3) {
      throw new Error('Need at least 3 points to form a closed profile');
    }
    await this.initialize();

    if (!this.replicad) {
      // TODO: fallback simple extrusion (not critical for MVP)
      const width = 1, depth = 1;
      return this.createSimpleBox(width, height, depth);
    }

    try {
      const { draw } = this.replicad;
      const drawing = draw(points[0]);
      for (let i = 1; i < points.length; i++) {
        drawing.lineTo(points[i]);
      }
      drawing.close();
      const sketch = drawing.sketchOnPlane('XY');
      const solid = sketch.extrude(height);
      const shape: ReplicadShape = {
        id: `polyExtrude_${Date.now()}`,
        type: 'solid',
        mesh: await this.convertToMesh(solid),
        parameters: { points, height, type: 'polyExtrude' },
      };
      this.shapes.set(shape.id, shape);
      return shape;
    } catch (err) {
      console.error('Extruded polygon failed', err);
      throw err;
    }
  }

  /**
   * Return the underlying Replicad shape (Solid/Sketch…) for a given id.
   * Undefined if id not found or not yet created.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getReplicadShape(id: string): any | undefined {
    return this.replicadObjects.get(id);
  }

  /**
   * Best-effort helper: given an object id and a mesh faceIndex, return a Replicad FaceFinder
   * that matches the face.  For now we approximate by using containsPoint() with one vertex
   * of the triangle.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getReplicadFace(id: string, faceIndex: number): any | null {
    const solid = this.replicadObjects.get(id);
    if (!solid) return null;

    // Retrieve mesh vertices for that face
    const shapeEntry = this.shapes.get(id);
    if (!shapeEntry?.mesh) return null;

    const { vertices, indices } = shapeEntry.mesh;
    const triOffset = faceIndex * 3;
    if (triOffset + 2 >= indices.length) return null;

    const vIndex = indices[triOffset] * 3;
    const point: [number, number, number] = [
      vertices[vIndex],
      vertices[vIndex + 1],
      vertices[vIndex + 2],
    ];

    // Build finder that matches face containing the point
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { FaceFinder } = this.replicad as any;
    if (!FaceFinder) return null;
    return new FaceFinder().containsPoint(point);
  }

  /**
   * Map an object id and two vertex indices to an EdgeFinder based on point membership.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getReplicadEdge(id: string, v1: number, v2: number): any | null {
    const solid = this.replicadObjects.get(id);
    if (!solid) return null;
    const shapeEntry = this.shapes.get(id);
    if (!shapeEntry?.mesh) return null;
    const { vertices } = shapeEntry.mesh;
    const p1: [number, number, number] = [vertices[v1 * 3], vertices[v1 * 3 + 1], vertices[v1 * 3 + 2]];
    const p2: [number, number, number] = [vertices[v2 * 3], vertices[v2 * 3 + 1], vertices[v2 * 3 + 2]];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { EdgeFinder } = this.replicad as any;
    if (!EdgeFinder) return null;
    // Use containsPoint approximation on mid point
    const mid: [number, number, number] = [(p1[0]+p2[0])/2,(p1[1]+p2[1])/2,(p1[2]+p2[2])/2];
    return new EdgeFinder().containsPoint(mid);
  }

  // ==================== CODE EDITOR SUPPORT ====================

  async executeCode(code: string): Promise<{ success: boolean; error?: string }> {
    await this.initialize();
    
    try {
      // Clear current scene
      this.clearAllShapes();
      
      // Create a sandboxed environment with replicad functions
      const sandbox = {
        replicad: this.replicad,
        makeBox: this.replicad?.makeBox,
        makeCylinder: this.replicad?.makeCylinder,
        makeSphere: this.replicad?.makeSphere,
        drawCircle: this.replicad?.drawCircle,
        drawRectangle: this.replicad?.drawRectangle,
        drawRoundedRectangle: this.replicad?.drawRoundedRectangle,
        console: {
          log: (...args: any[]) => console.log('[Code Editor]', ...args),
          error: (...args: any[]) => console.error('[Code Editor]', ...args),
          warn: (...args: any[]) => console.warn('[Code Editor]', ...args),
        }
      };

      // Execute the code in a sandboxed context
      const wrappedCode = `
        (function() {
          const { replicad, makeBox, makeCylinder, makeSphere, drawCircle, drawRectangle, drawRoundedRectangle, console } = arguments[0];
          
          ${code}
          
          if (typeof main === 'function') {
            return main();
          } else if (typeof exports !== 'undefined' && exports.default) {
            return exports.default();
          } else {
            throw new Error('No main function found. Please export a main function or define main().');
          }
        })
      `;

      const func = new Function('return ' + wrappedCode)();
      const result = func(sandbox);

      if (result && typeof result === 'object' && result.mesh) {
        // Convert Replicad result to our shape format
        const shape: ReplicadShape = {
          id: `code_result_${Date.now()}`,
          type: 'solid',
          mesh: await this.convertToMesh(result),
          parameters: { source: 'code_editor', code }
        };

        this.shapes.set(shape.id, shape);
        this.replicadObjects.set(shape.id, result);
      }

      return { success: true };
    } catch (error) {
      console.error('Code execution failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async generateCode(): Promise<string | null> {
    const shapes = this.getAllShapes();
    
    if (shapes.length === 0) {
      return null;
    }

    let code = `// Generated from CAD scene
const { makeBox, makeCylinder, makeSphere, drawCircle, drawRectangle } = replicad;

const main = () => {
`;

    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      const varName = `shape${i + 1}`;
      
      // Generate code based on shape parameters
      if (shape.parameters.operation === 'create_box') {
        const { width, height, depth } = shape.parameters;
        code += `  const ${varName} = makeBox(${width}, ${height}, ${depth});\n`;
      } else if (shape.parameters.operation === 'create_cylinder') {
        const { radius, height } = shape.parameters;
        code += `  const ${varName} = makeCylinder(${radius}, ${height});\n`;
      } else if (shape.parameters.operation === 'create_sphere') {
        const { radius } = shape.parameters;
        code += `  const ${varName} = makeSphere(${radius});\n`;
      } else {
        // Generic shape
        code += `  // ${shape.id} - ${shape.type}\n`;
        code += `  const ${varName} = makeBox(10, 10, 10); // Placeholder\n`;
      }

      // Add transformations if present
      if (shape.transform) {
        if (shape.transform.position) {
          const [x, y, z] = shape.transform.position;
          code += `  ${varName} = ${varName}.translate([${x}, ${y}, ${z}]);\n`;
        }
        if (shape.transform.rotation) {
          const [rx, ry, rz] = shape.transform.rotation;
          if (rx !== 0) code += `  ${varName} = ${varName}.rotate(${rx}, [1, 0, 0]);\n`;
          if (ry !== 0) code += `  ${varName} = ${varName}.rotate(${ry}, [0, 1, 0]);\n`;
          if (rz !== 0) code += `  ${varName} = ${varName}.rotate(${rz}, [0, 0, 1]);\n`;
        }
      }
    }

    // Return the first shape or combine multiple shapes
    if (shapes.length === 1) {
      code += `\n  return shape1;\n`;
    } else {
      code += `\n  // Combine multiple shapes\n`;
      code += `  let result = shape1;\n`;
      for (let i = 1; i < shapes.length; i++) {
        code += `  result = result.fuse(shape${i + 1});\n`;
      }
      code += `  return result;\n`;
    }

    code += `};\n\nexport default main;`;

    return code;
  }
}

// Singleton instance
export const cadEngine = new CADEngine(); 
export type { ReplicadShape }; 