import { CADOperation, ExportOptions } from '../types/cad';
import { SketchEngine } from './sketchEngine';

interface ReplicadShape {
  id: string;
  type: 'solid' | 'sketch' | 'wire' | 'face';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replicadSolid?: any; // Actual replicad solid/shape - external library type
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
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private replicad: any = null; // External replicad library module
  private fallbackMode = false;
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
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        console.error('❌ CAD Engine: Not in browser environment');
        throw new Error('CAD Engine requires browser environment');
      }
      
      console.log('🔄 CAD Engine: Starting initialization...');
      console.log('🌐 CAD Engine: Browser environment confirmed');
      
      // Use the replicad loader
      const { initializeReplicad } = await import('./replicadLoader');
      this.replicad = await initializeReplicad();
      
      this.initialized = true;
      this.fallbackMode = false;
      
      console.log('🎉 CAD Engine: Full initialization completed successfully!');
      console.log('📊 CAD Engine Status:', {
        initialized: this.initialized,
        fallbackMode: this.fallbackMode,
        hasReplicad: !!this.replicad
      });
    } catch (error) {
      console.warn('⚠️  CAD Engine: Full initialization failed, enabling fallback mode');
      console.error('💥 CAD Engine Error Details:', error);
      
      // Enable fallback mode - use simple geometries
      this.fallbackMode = true;
      this.initialized = true;
      
      console.log('🔄 CAD Engine: Fallback mode enabled');
      console.log('📊 CAD Engine Status (Fallback):', {
        initialized: this.initialized,
        fallbackMode: this.fallbackMode,
        hasReplicad: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== PRIMITIVE CREATION ====================

  async createBox(width: number, height: number, depth: number): Promise<ReplicadShape> {
    await this.initialize();
    
    if (this.fallbackMode || !this.replicad) {
      return this.createSimpleBox(width, height, depth);
    }
    
    try {
      const { makeBaseBox } = this.replicad;
      const solid = makeBaseBox(width, height, depth);
      
      const shape: ReplicadShape = {
        id: `box_${Date.now()}`,
        type: 'solid',
        replicadSolid: solid,
        mesh: await this.convertToMesh(solid),
        parameters: { width, height, depth }
      };

      this.shapes.set(shape.id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to create box with replicad:', error);
      // Fallback to simple geometry
      return this.createSimpleBox(width, height, depth);
    }
  }

  async createCylinder(radius: number, height: number): Promise<ReplicadShape> {
    await this.initialize();
    
    if (this.fallbackMode || !this.replicad) {
      return this.createSimpleCylinder(radius, height);
    }
    
    try {
      const { makeCylinder } = this.replicad;
      const solid = makeCylinder(radius, height);
      
      const shape: ReplicadShape = {
        id: `cylinder_${Date.now()}`,
        type: 'solid',
        replicadSolid: solid,
        mesh: await this.convertToMesh(solid),
        parameters: { radius, height }
      };

      this.shapes.set(shape.id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to create cylinder with replicad:', error);
      return this.createSimpleCylinder(radius, height);
    }
  }

  async createSphere(radius: number): Promise<ReplicadShape> {
    await this.initialize();
    
    if (this.fallbackMode || !this.replicad) {
      return this.createSimpleSphere(radius);
    }
    
    try {
      const { makeSphere } = this.replicad;
      const solid = makeSphere(radius);
      
      const shape: ReplicadShape = {
        id: `sphere_${Date.now()}`,
        type: 'solid',
        replicadSolid: solid,
        mesh: await this.convertToMesh(solid),
        parameters: { radius }
      };

      this.shapes.set(shape.id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to create sphere with replicad:', error);
      return this.createSimpleSphere(radius);
    }
  }

  async createCone(radius1: number, radius2: number, height: number): Promise<ReplicadShape> {
    await this.initialize();
    
    if (this.fallbackMode || !this.replicad) {
      return this.createSimpleCone(radius1, radius2, height);
    }
    
    try {
      const { drawCircle } = this.replicad;
      // Create cone using replicad - loft between two circles
      const baseCircle = drawCircle(radius1).sketchOnPlane("XY", 0);
      const topCircle = drawCircle(radius2).sketchOnPlane("XY", height);
      
      const solid = baseCircle.loftWith([topCircle]);
      
      const shape: ReplicadShape = {
        id: `cone_${Date.now()}`,
        type: 'solid',
        replicadSolid: solid,
        mesh: await this.convertToMesh(solid),
        parameters: { radius1, radius2, height }
      };

      this.shapes.set(shape.id, shape);
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
    const shape: ReplicadShape = {
      id: sketchId,
      type: 'sketch',
      replicadSolid: sketcher,
      parameters: { plane, offset }
    };

    this.shapes.set(sketchId, shape);
    return sketchId;
  }

  async extrudeSketch(sketchId: string, distance: number): Promise<ReplicadShape> {
    await this.initialize();
    
    const sketch = this.shapes.get(sketchId);
    if (!sketch || sketch.type !== 'sketch') {
      throw new Error('Invalid sketch for extrusion');
    }

    try {
      const solid = sketch.replicadSolid.extrude(distance);
      
      const shape: ReplicadShape = {
        id: `extrude_${Date.now()}`,
        type: 'solid',
        replicadSolid: solid,
        mesh: await this.convertToMesh(solid),
        parameters: { distance, originalSketch: sketchId }
      };

      this.shapes.set(shape.id, shape);
      return shape;
    } catch (error) {
      console.error('Failed to extrude sketch:', error);
      throw error;
    }
  }

  async revolveSketch(sketchId: string, axis: [number, number, number] = [0, 0, 1], angle: number = 360): Promise<ReplicadShape> {
    await this.initialize();
    
    const sketch = this.shapes.get(sketchId);
    if (!sketch || sketch.type !== 'sketch') {
      throw new Error('Invalid sketch for revolution');
    }

    try {
      const solid = sketch.replicadSolid.revolve(axis, { angle: angle * Math.PI / 180 });
      
      const shape: ReplicadShape = {
        id: `revolve_${Date.now()}`,
        type: 'solid',
        replicadSolid: solid,
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
    
    const shape1 = this.shapes.get(shape1Id);
    const shape2 = this.shapes.get(shape2Id);
    
    if (!shape1?.replicadSolid || !shape2?.replicadSolid) {
      throw new Error('Invalid shapes for union operation');
    }

    try {
      const result = shape1.replicadSolid.fuse(shape2.replicadSolid);
      
      const shape: ReplicadShape = {
        id: `union_${Date.now()}`,
        type: 'solid',
        replicadSolid: result,
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
    
    const baseShape = this.shapes.get(baseShapeId);
    const toolShape = this.shapes.get(toolShapeId);
    
    if (!baseShape?.replicadSolid || !toolShape?.replicadSolid) {
      throw new Error('Invalid shapes for subtraction operation');
    }

    try {
      const result = baseShape.replicadSolid.cut(toolShape.replicadSolid);
      
      const shape: ReplicadShape = {
        id: `subtract_${Date.now()}`,
        type: 'solid',
        replicadSolid: result,
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
    
    const shape1 = this.shapes.get(shape1Id);
    const shape2 = this.shapes.get(shape2Id);
    
    if (!shape1?.replicadSolid || !shape2?.replicadSolid) {
      throw new Error('Invalid shapes for intersection operation');
    }

    try {
      const result = shape1.replicadSolid.intersect(shape2.replicadSolid);
      
      const shape: ReplicadShape = {
        id: `intersect_${Date.now()}`,
        type: 'solid',
        replicadSolid: result,
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
    
    const shape = this.shapes.get(shapeId);
    if (!shape?.replicadSolid) {
      throw new Error('Invalid shape for fillet operation');
    }

    try {
      let result;
      if (edgeFilter) {
        // Apply fillet with edge filter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = shape.replicadSolid.fillet(radius, (e: any) => e.inDirection(edgeFilter));
      } else {
        // Apply fillet to all edges
        result = shape.replicadSolid.fillet(radius);
      }
      
      const newShape: ReplicadShape = {
        id: `fillet_${Date.now()}`,
        type: 'solid',
        replicadSolid: result,
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
    
    const shape = this.shapes.get(shapeId);
    if (!shape?.replicadSolid) {
      throw new Error('Invalid shape for chamfer operation');
    }

    try {
      let result;
      if (edgeFilter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = shape.replicadSolid.chamfer(distance, (e: any) => e.inDirection(edgeFilter));
      } else {
        result = shape.replicadSolid.chamfer(distance);
      }
      
      const newShape: ReplicadShape = {
        id: `chamfer_${Date.now()}`,
        type: 'solid',
        replicadSolid: result,
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
    
    const shape = this.shapes.get(shapeId);
    if (!shape?.replicadSolid) {
      throw new Error('Invalid shape for shell operation');
    }

    try {
      let result;
      if (faceFilter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = shape.replicadSolid.shell(thickness, (f: any) => f.inPlane(faceFilter));
      } else {
        result = shape.replicadSolid.shell(thickness);
      }
      
      const newShape: ReplicadShape = {
        id: `shell_${Date.now()}`,
        type: 'solid',
        replicadSolid: result,
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

    let transformedSolid = shape.replicadSolid;

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
      replicadSolid: transformedSolid,
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
    if (!shape.replicadSolid) {
      throw new Error('No replicad solid available for STEP export');
    }

    try {
      const stepContent = shape.replicadSolid.toSTEP();
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

  private createSimpleBox(width: number, height: number, depth: number): ReplicadShape {
    const vertices = new Float32Array([
      // Front face
      -width/2, -height/2,  depth/2,
       width/2, -height/2,  depth/2,
       width/2,  height/2,  depth/2,
      -width/2,  height/2,  depth/2,
      
      // Back face
      -width/2, -height/2, -depth/2,
      -width/2,  height/2, -depth/2,
       width/2,  height/2, -depth/2,
       width/2, -height/2, -depth/2,
    ]);

    const indices = new Uint32Array([
      0,  1,  2,    0,  2,  3,    // front
      4,  5,  6,    4,  6,  7,    // back
      5,  0,  3,    5,  3,  6,    // top
      1,  4,  7,    1,  7,  2,    // bottom
      0,  5,  4,    0,  4,  1,    // right
      2,  7,  6,    2,  6,  3     // left
    ]);

    return {
      id: `box_${Date.now()}`,
      type: 'solid',
      mesh: { vertices, indices },
      parameters: { width, height, depth }
    };
  }

  private createSimpleCylinder(radius: number, height: number, segments = 32): ReplicadShape {
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Create cylinder vertices
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      // Bottom vertex
      vertices.push(x, -height/2, z);
      // Top vertex
      vertices.push(x, height/2, z);
    }
    
    // Create indices for sides
    for (let i = 0; i < segments; i++) {
      const i1 = i * 2;
      const i2 = ((i + 1) % segments) * 2;
      
      // Side faces
      indices.push(i1, i2, i1 + 1);
      indices.push(i2, i2 + 1, i1 + 1);
    }

    return {
      id: `cylinder_${Date.now()}`,
      type: 'solid',
      mesh: { 
        vertices: new Float32Array(vertices), 
        indices: new Uint32Array(indices)
      },
      parameters: { radius, height, segments }
    };
  }

  private createSimpleSphere(radius: number, widthSegments = 32, heightSegments = 16): ReplicadShape {
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Create sphere vertices
    for (let lat = 0; lat <= heightSegments; lat++) {
      const theta = lat * Math.PI / heightSegments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      
      for (let lon = 0; lon <= widthSegments; lon++) {
        const phi = lon * 2 * Math.PI / widthSegments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        
        const x = cosPhi * sinTheta * radius;
        const y = cosTheta * radius;
        const z = sinPhi * sinTheta * radius;
        
        vertices.push(x, y, z);
      }
    }
    
    // Create indices
    for (let lat = 0; lat < heightSegments; lat++) {
      for (let lon = 0; lon < widthSegments; lon++) {
        const first = (lat * (widthSegments + 1)) + lon;
        const second = first + widthSegments + 1;
        
        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    return {
      id: `sphere_${Date.now()}`,
      type: 'solid',
      mesh: { 
        vertices: new Float32Array(vertices), 
        indices: new Uint32Array(indices)
      },
      parameters: { radius, widthSegments, heightSegments }
    };
  }

  private createSimpleCone(radius1: number, radius2: number, height: number, segments = 32): ReplicadShape {
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Create cone vertices
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x1 = Math.cos(angle) * radius1;
      const z1 = Math.sin(angle) * radius1;
      const x2 = Math.cos(angle) * radius2;
      const z2 = Math.sin(angle) * radius2;
      
      // Bottom vertex
      vertices.push(x1, 0, z1);
      // Top vertex
      vertices.push(x2, height, z2);
    }
    
    // Create indices for sides
    for (let i = 0; i < segments; i++) {
      const i1 = i * 2;
      const i2 = ((i + 1) % segments) * 2;
      
      // Side faces
      indices.push(i1, i2, i1 + 1);
      indices.push(i2, i2 + 1, i1 + 1);
    }

    return {
      id: `cone_${Date.now()}`,
      type: 'solid',
      mesh: { 
        vertices: new Float32Array(vertices), 
        indices: new Uint32Array(indices)
      },
      parameters: { radius1, radius2, height, segments }
    };
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
    type: 'circle' | 'rectangle',
    params: { radius?: number; width?: number; height?: number },
    plane: 'XY' | 'XZ' | 'YZ' = 'XY'
  ): Promise<ReplicadShape> {
    const result = await this.sketchEngine.createSimpleSketch(type, params, plane);
    
    const shape: ReplicadShape = {
      id: result.id,
      type: 'sketch',
      replicadSolid: result.replicadSketch,
      parameters: { type, params, plane }
    };

    this.shapes.set(shape.id, shape);
    return shape;
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

    if (this.fallbackMode || !this.replicad) {
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
        replicadSolid: solid,
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
}

// Singleton instance
export const cadEngine = new CADEngine(); 
export type { ReplicadShape }; 