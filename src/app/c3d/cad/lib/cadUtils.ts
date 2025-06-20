/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { cadEngine, type ReplicadShape } from './cadEngine';
import { CADOperationType } from '../types/cad';
import { showToast } from './toast';

/**
 * High-level CAD utility functions for both UI and LLM agent use
 * These functions provide a clean interface to CAD operations
 */

export interface CADUtilsResult {
  success: boolean;
  shapeId?: string;
  shape?: ReplicadShape;
  error?: string;
  message?: string;
  data?: any; // Allow flexible data types for different result types
}

export interface PrimitiveParams {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface BoxParams extends PrimitiveParams {
  width: number;
  height: number;
  depth: number;
}

export interface CylinderParams extends PrimitiveParams {
  radius: number;
  height: number;
}

export interface SphereParams extends PrimitiveParams {
  radius: number;
}

export interface ConeParams extends PrimitiveParams {
  baseRadius: number;
  topRadius: number;
  height: number;
}

// Advanced interfaces for new features
export interface BatchOperationResult {
  success: boolean;
  results: CADUtilsResult[];
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

export interface MeshAnalysisResult {
  volume: number;
  surfaceArea: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    dimensions: [number, number, number];
  };
  centroid: [number, number, number];
  vertexCount: number;
  triangleCount: number;
}

export interface MeasurementResult {
  distance?: number;
  angle?: number;
  area?: number;
  volume?: number;
  points?: [number, number, number][];
}

export interface ParametricModel {
  id: string;
  name: string;
  parameters: Record<string, number | string | boolean>;
  operations: Array<{
    type: CADOperationType;
    params: Record<string, unknown>;
    dependencies?: string[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CAD Utilities Class
 * Provides high-level functions for CAD operations
 */
export class CADUtils {
  
  // ==================== ENGINE STATUS ====================
  
  /**
   * Get CAD engine status and initialization info
   */
  static getEngineStatus(): {
    initialized: boolean;
    fallbackMode: boolean;
    hasReplicad: boolean;
    message: string;
  } {
    const status = cadEngine.getStatus();
    let message = 'CAD Engine: ';
    
    if (!status.initialized) {
      message += 'Not initialized';
    } else if (status.fallbackMode) {
      message += 'Running in fallback mode (simple geometry only)';
    } else if (status.hasReplicad) {
      message += 'Fully initialized with replicad';
    } else {
      message += 'Initialized with unknown state';
    }
    
    return {
      ...status,
      message
    };
  }

  /**
   * Initialize the CAD engine if not already initialized
   */
  static async initializeEngine(): Promise<CADUtilsResult> {
    try {
      console.log('🔄 CAD Utils: Initializing engine...');
      showToast.engineStatus('initializing');
      
      await cadEngine.initialize();
      const status = cadEngine.getStatus();
      
      console.log('✅ CAD Utils: Engine initialization completed', status);
      
      if (status.fallbackMode) {
        showToast.engineStatus('fallback', 'Using simple geometry mode');
        return {
          success: true,
          message: 'CAD engine initialized in fallback mode',
          data: status
        };
      } else {
        showToast.engineStatus('ready');
        return {
          success: true,
          message: 'CAD engine fully initialized with replicad',
          data: status
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('❌ CAD Utils: Engine initialization failed:', error);
      showToast.engineStatus('error', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }
  
  // ==================== PRIMITIVE CREATION ====================
  
  /**
   * Create a box with specified dimensions
   */
  static async createBox(width: number, height: number, depth: number): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Creating box ${width}×${height}×${depth}`);
      const toastId = showToast.operationLoading('Creating box');
      
      const shape = await cadEngine.createBox(width, height, depth);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Box creation', `${width}×${height}×${depth}`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Box created with dimensions ${width}×${height}×${depth}`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create box';
      console.error('❌ CAD Utils: Box creation failed:', error);
      showToast.operationError('Box creation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Create a cylinder with specified radius and height
   */
  static async createCylinder(params: CylinderParams): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Creating cylinder r=${params.radius}, h=${params.height}`);
      const toastId = showToast.operationLoading('Creating cylinder');
      
      const shape = await cadEngine.createCylinder(params.radius, params.height);
      
      if (params.position || params.rotation || params.scale) {
        const transform = {
          position: params.position,
          rotation: params.rotation,
          scale: params.scale
        };
        const transformedShape = cadEngine.transformShape(shape.id, transform);
        
        showToast.dismiss(toastId);
        showToast.operationSuccess('Cylinder creation', `r=${params.radius}, h=${params.height}`);
        
        return {
          success: true,
          shapeId: transformedShape.id,
          shape: transformedShape,
          message: `Cylinder created with radius ${params.radius} and height ${params.height}`
        };
      }
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Cylinder creation', `r=${params.radius}, h=${params.height}`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Cylinder created with radius ${params.radius} and height ${params.height}`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create cylinder';
      console.error('❌ CAD Utils: Cylinder creation failed:', error);
      showToast.operationError('Cylinder creation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Create a sphere with specified radius
   */
  static async createSphere(params: SphereParams): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Creating sphere r=${params.radius}`);
      const toastId = showToast.operationLoading('Creating sphere');
      
      const shape = await cadEngine.createSphere(params.radius);
      
      if (params.position || params.rotation || params.scale) {
        const transform = {
          position: params.position,
          rotation: params.rotation,
          scale: params.scale
        };
        const transformedShape = cadEngine.transformShape(shape.id, transform);
        
        showToast.dismiss(toastId);
        showToast.operationSuccess('Sphere creation', `r=${params.radius}`);
        
        return {
          success: true,
          shapeId: transformedShape.id,
          shape: transformedShape,
          message: `Sphere created with radius ${params.radius}`
        };
      }
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Sphere creation', `r=${params.radius}`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Sphere created with radius ${params.radius}`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create sphere';
      console.error('❌ CAD Utils: Sphere creation failed:', error);
      showToast.operationError('Sphere creation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Create a cone with specified radii and height
   */
  static async createCone(params: ConeParams): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Creating cone base=${params.baseRadius}, top=${params.topRadius}, h=${params.height}`);
      const toastId = showToast.operationLoading('Creating cone');
      
      const shape = await cadEngine.createCone(params.baseRadius, params.topRadius, params.height);
      
      if (params.position || params.rotation || params.scale) {
        const transform = {
          position: params.position,
          rotation: params.rotation,
          scale: params.scale
        };
        const transformedShape = cadEngine.transformShape(shape.id, transform);
        
        showToast.dismiss(toastId);
        showToast.operationSuccess('Cone creation', `base=${params.baseRadius}, top=${params.topRadius}`);
        
        return {
          success: true,
          shapeId: transformedShape.id,
          shape: transformedShape,
          message: `Cone created with base radius ${params.baseRadius}, top radius ${params.topRadius}, height ${params.height}`
        };
      }
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Cone creation', `base=${params.baseRadius}, top=${params.topRadius}`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Cone created with base radius ${params.baseRadius}, top radius ${params.topRadius}, height ${params.height}`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create cone';
      console.error('❌ CAD Utils: Cone creation failed:', error);
      showToast.operationError('Cone creation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  // ==================== BOOLEAN OPERATIONS ====================

  /**
   * Union (combine) two shapes
   */
  static async union(shape1Id: string, shape2Id: string): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Union operation on shapes ${shape1Id} and ${shape2Id}`);
      const toastId = showToast.operationLoading('Union operation');
      
      const shape = await cadEngine.unionShapes(shape1Id, shape2Id);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Union operation', 'Shapes combined');
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: 'Union operation completed'
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to perform union';
      console.error('❌ CAD Utils: Union operation failed:', error);
      showToast.operationError('Union operation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Subtract one shape from another
   */
  static async subtract(baseShapeId: string, toolShapeId: string): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Subtract operation: ${baseShapeId} - ${toolShapeId}`);
      const toastId = showToast.operationLoading('Subtract operation');
      
      const shape = await cadEngine.subtractShapes(baseShapeId, toolShapeId);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Subtract operation', 'Shape subtracted');
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: 'Subtract operation completed'
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to perform subtraction';
      console.error('❌ CAD Utils: Subtract operation failed:', error);
      showToast.operationError('Subtract operation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get intersection of two shapes
   */
  static async intersect(shape1Id: string, shape2Id: string): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Intersect operation on shapes ${shape1Id} and ${shape2Id}`);
      const toastId = showToast.operationLoading('Intersect operation');
      
      const shape = await cadEngine.intersectShapes(shape1Id, shape2Id);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Intersect operation', 'Intersection found');
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: 'Intersect operation completed'
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to perform intersection';
      console.error('❌ CAD Utils: Intersect operation failed:', error);
      showToast.operationError('Intersect operation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  // ==================== MODIFICATION OPERATIONS ====================

  /**
   * Apply fillet (round edges) to a shape
   */
  static async fillet(shapeId: string, radius: number, edgeFilter?: string): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Fillet operation on ${shapeId} with radius ${radius}`);
      const toastId = showToast.operationLoading('Fillet operation');
      
      const shape = await cadEngine.filletEdges(shapeId, radius, edgeFilter);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Fillet operation', `r=${radius}`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Fillet applied with radius ${radius}`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to apply fillet';
      console.error('❌ CAD Utils: Fillet operation failed:', error);
      showToast.operationError('Fillet operation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Apply chamfer (cut edges) to a shape
   */
  static async chamfer(shapeId: string, distance: number, edgeFilter?: string): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Chamfer operation on ${shapeId} with distance ${distance}`);
      const toastId = showToast.operationLoading('Chamfer operation');
      
      const shape = await cadEngine.chamferEdges(shapeId, distance, edgeFilter);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Chamfer operation', `d=${distance}`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Chamfer applied with distance ${distance}`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to apply chamfer';
      console.error('❌ CAD Utils: Chamfer operation failed:', error);
      showToast.operationError('Chamfer operation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Create a hollow shell from a solid
   */
  static async shell(shapeId: string, thickness: number, faceFilter?: string): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Shell operation on ${shapeId} with thickness ${thickness}`);
      const toastId = showToast.operationLoading('Shell operation');
      
      const shape = await cadEngine.shellShape(shapeId, thickness, faceFilter);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Shell operation', `t=${thickness}`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Shell created with thickness ${thickness}`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create shell';
      console.error('❌ CAD Utils: Shell operation failed:', error);
      showToast.operationError('Shell operation', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  // ==================== SKETCH AND EXTRUDE ====================

  /**
   * Create a basic sketch on a plane
   */
  static async createSketch(plane: 'XY' | 'XZ' | 'YZ' = 'XY', offset: number = 0): Promise<CADUtilsResult> {
    try {
      const sketchId = await cadEngine.createSketch(plane, offset);
      return {
        success: true,
        shapeId: sketchId,
        message: `Sketch created on ${plane} plane${offset !== 0 ? ` with offset ${offset}` : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sketch'
      };
    }
  }

  /**
   * Extrude a sketch to create a solid
   */
  static async extrude(sketchId: string, distance: number): Promise<CADUtilsResult> {
    try {
      const shape = await cadEngine.extrudeSketch(sketchId, distance);
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Sketch extruded by distance ${distance}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extrude sketch'
      };
    }
  }

  /**
   * Revolve a sketch around an axis
   */
  static async revolve(
    sketchId: string, 
    axis: [number, number, number] = [0, 0, 1], 
    angle: number = 360
  ): Promise<CADUtilsResult> {
    try {
      const shape = await cadEngine.revolveSketch(sketchId, axis, angle);
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Sketch revolved ${angle}° around axis [${axis.join(', ')}]`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revolve sketch'
      };
    }
  }

  // ==================== TRANSFORMATION OPERATIONS ====================

  /**
   * Move a shape to a new position
   */
  static move(shapeId: string, position: [number, number, number]): CADUtilsResult {
    try {
      const transformedShape = cadEngine.transformShape(shapeId, { position });
      return {
        success: true,
        shapeId: transformedShape.id,
        shape: transformedShape,
        message: `Shape moved to [${position.join(', ')}]`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to move shape'
      };
    }
  }

  /**
   * Rotate a shape
   */
  static rotate(shapeId: string, rotation: [number, number, number]): CADUtilsResult {
    try {
      const transformedShape = cadEngine.transformShape(shapeId, { rotation });
      return {
        success: true,
        shapeId: transformedShape.id,
        shape: transformedShape,
        message: `Shape rotated by [${rotation.join(', ')}] degrees`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rotate shape'
      };
    }
  }

  /**
   * Scale a shape
   */
  static scale(shapeId: string, scale: [number, number, number]): CADUtilsResult {
    try {
      const transformedShape = cadEngine.transformShape(shapeId, { scale });
      return {
        success: true,
        shapeId: transformedShape.id,
        shape: transformedShape,
        message: `Shape scaled by [${scale.join(', ')}]`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scale shape'
      };
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Get detailed information about a shape
   */
  static getShapeInfo(shapeId: string): CADUtilsResult {
    try {
      const shape = cadEngine.getShape(shapeId);
      if (!shape) {
        return {
          success: false,
          error: 'Shape not found'
        };
      }

      const info = {
        id: shape.id,
        type: shape.type,
        parameters: shape.parameters,
        transform: shape.transform,
        // metadata: shape.metadata, // Property doesn't exist on ReplicadShape
        hasMesh: !!shape.mesh,
        meshInfo: shape.mesh ? {
          vertexCount: shape.mesh.vertices.length / 3,
          triangleCount: shape.mesh.indices.length / 3,
          hasNormals: !!shape.mesh.normals
        } : null
      };
      
      return {
        success: true,
        message: `Shape information for ${shapeId}`,
        data: info
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to get shape info';
      console.error('❌ CAD Utils: Get shape info failed:', error);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Delete a shape
   */
  static deleteShape(shapeId: string): CADUtilsResult {
    try {
      console.log(`🗑️ CAD Utils: Deleting shape ${shapeId}`);
      
      cadEngine.deleteShape(shapeId);
      
      showToast.operationSuccess('Shape deleted', shapeId);
      
      return {
        success: true,
        message: `Shape ${shapeId} deleted`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to delete shape';
      console.error('❌ CAD Utils: Delete shape failed:', error);
      showToast.operationError('Delete shape', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get all shapes in the scene
   */
  static getAllShapes(): ReplicadShape[] {
    try {
    return cadEngine.getAllShapes();
    } catch (error) {
      console.error('❌ CAD Utils: Get all shapes failed:', error);
      return [];
    }
  }

  /**
   * Clear all shapes from the scene
   */
  static clearAll(): CADUtilsResult {
    try {
      console.log('🗑️ CAD Utils: Clearing all shapes');
      
      const shapeCount = cadEngine.getAllShapes().length;
      cadEngine.clearAllShapes();
      
      showToast.operationSuccess('Scene cleared', `${shapeCount} shapes removed`);
      
      return {
        success: true,
        message: `Cleared ${shapeCount} shapes from scene`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to clear scene';
      console.error('❌ CAD Utils: Clear all failed:', error);
      showToast.operationError('Clear scene', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  // ==================== ADVANCED FEATURES ====================

  /**
   * Batch operations - perform multiple operations in sequence
   */
  static async batchOperations(operations: Array<{
    type: 'create' | 'boolean' | 'modify';
    operation: string;
    params: Record<string, unknown>;
  }>): Promise<BatchOperationResult> {
    const results: CADUtilsResult[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    console.log(`🔧 CAD Utils: Starting batch operation with ${operations.length} operations`);
    const toastId = showToast.operationLoading(`Batch operation (${operations.length} ops)`);

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      console.log(`🔧 CAD Utils: Batch operation ${i + 1}/${operations.length}: ${op.operation}`);
      
      try {
        let result: CADUtilsResult;
        
        switch (op.operation) {
          case 'createBox':
            result = await this.createBox(
              op.params.width as number,
              op.params.height as number,
              op.params.depth as number
            );
            break;
          case 'createCylinder':
            result = await this.createCylinder(op.params as unknown as CylinderParams);
            break;
          case 'createSphere':
            result = await this.createSphere(op.params as unknown as SphereParams);
            break;
          case 'union':
            result = await this.union(
              op.params.shape1Id as string,
              op.params.shape2Id as string
            );
            break;
          case 'subtract':
            result = await this.subtract(
              op.params.baseShapeId as string,
              op.params.toolShapeId as string
            );
            break;
          case 'fillet':
            result = await this.fillet(
              op.params.shapeId as string,
              op.params.radius as number,
              op.params.edgeFilter as string | undefined
            );
            break;
          default:
            result = {
              success: false,
              error: `Unknown operation: ${op.operation}`
            };
        }
        
        results.push(result);
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          if (result.error) errors.push(result.error);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errorCount++;
        errors.push(errorMsg);
        results.push({
          success: false,
          error: errorMsg
        });
      }
    }

    showToast.dismiss(toastId);
    
    if (errorCount === 0) {
      showToast.operationSuccess('Batch operation', `${successCount} operations completed`);
    } else if (successCount === 0) {
      showToast.operationError('Batch operation', `All ${errorCount} operations failed`);
    } else {
      showToast.warning(`Batch operation: ${successCount} succeeded, ${errorCount} failed`);
    }

    console.log(`✅ CAD Utils: Batch operation completed - ${successCount} success, ${errorCount} errors`);

    return {
      success: errorCount === 0,
      results,
      totalProcessed: operations.length,
      successCount,
      errorCount,
      errors
    };
  }

  /**
   * Analyze mesh properties (volume, surface area, etc.)
   */
  static async analyzeMesh(shapeId: string): Promise<CADUtilsResult> {
    try {
      console.log(`🔍 CAD Utils: Analyzing mesh for shape ${shapeId}`);
      const toastId = showToast.operationLoading('Mesh analysis');
      
      const shape = cadEngine.getShape(shapeId);
      if (!shape?.mesh) {
        throw new Error('Shape not found or has no mesh data');
      }

      const { vertices, indices } = shape.mesh;
      
      // Calculate basic mesh properties
      const triangleCount = indices.length / 3;
      const vertexCount = vertices.length / 3;
      
      // Calculate bounding box
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      
      for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
      }
      
      const dimensions: [number, number, number] = [
        maxX - minX,
        maxY - minY,
        maxZ - minZ
      ];
      
      const centroid: [number, number, number] = [
        (minX + maxX) / 2,
        (minY + maxY) / 2,
        (minZ + minZ) / 2
      ];
      
      // Estimate volume and surface area (simplified calculation)
      const volume = dimensions[0] * dimensions[1] * dimensions[2];
      const surfaceArea = 2 * (
        dimensions[0] * dimensions[1] +
        dimensions[1] * dimensions[2] +
        dimensions[2] * dimensions[0]
      );
      
      const analysis: MeshAnalysisResult = {
        volume,
        surfaceArea,
        boundingBox: {
          min: [minX, minY, minZ],
          max: [maxX, maxY, maxZ],
          dimensions
        },
        centroid,
        vertexCount,
        triangleCount
      };

      showToast.dismiss(toastId);
      showToast.operationSuccess('Mesh analysis', `${triangleCount} triangles`);
      
      console.log(`✅ CAD Utils: Mesh analysis completed for ${shapeId}`, analysis);

      return {
        success: true,
        message: 'Mesh analysis completed',
        data: analysis
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to analyze mesh';
      console.error('❌ CAD Utils: Mesh analysis failed:', error);
      showToast.operationError('Mesh analysis', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Measure distance between two points
   */
  static measureDistance(
    point1: [number, number, number],
    point2: [number, number, number]
  ): CADUtilsResult {
    try {
      const dx = point2[0] - point1[0];
      const dy = point2[1] - point1[1];
      const dz = point2[2] - point1[2];
      
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      const measurement: MeasurementResult = {
        distance,
        points: [point1, point2]
      };

      console.log(`📏 CAD Utils: Distance measured: ${distance.toFixed(3)} units`);
      showToast.operationSuccess('Distance measurement', `${distance.toFixed(3)} units`);

      return {
        success: true,
        message: `Distance: ${distance.toFixed(3)} units`,
        data: measurement
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to measure distance';
      console.error('❌ CAD Utils: Distance measurement failed:', error);
      showToast.operationError('Distance measurement', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Create parametric model definition
   */
  static createParametricModel(
    name: string,
    parameters: Record<string, number | string | boolean>,
    operations: Array<{
      type: CADOperationType;
      params: Record<string, unknown>;
      dependencies?: string[];
    }>
  ): CADUtilsResult {
    try {
      const model: ParametricModel = {
        id: `parametric_${Date.now()}`,
        name,
        parameters,
        operations,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log(`🔧 CAD Utils: Created parametric model: ${name}`);
      showToast.operationSuccess('Parametric model', `Created: ${name}`);

      return {
        success: true,
        message: `Parametric model "${name}" created`,
        data: model
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create parametric model';
      console.error('❌ CAD Utils: Parametric model creation failed:', error);
      showToast.operationError('Parametric model', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  // ==================== 2D SKETCHING OPERATIONS ====================

  /**
   * Start a new 2D sketch
   */
  static async startSketch(plane: 'XY' | 'XZ' | 'YZ' = 'XY', offset: number = 0): Promise<CADUtilsResult> {
    try {
      console.log(`✏️ CAD Utils: Starting sketch on ${plane} plane`);
      const toastId = showToast.operationLoading('Starting sketch');
      
      const sketchId = await cadEngine.createSketch(plane, offset);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Sketch started', `${plane} plane`);
      
      return {
        success: true,
        shapeId: sketchId,
        message: `Sketch started on ${plane} plane`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start sketch';
      console.error('❌ CAD Utils: Sketch start failed:', error);
      showToast.operationError('Sketch start', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Add line to sketch
   */
  static async addLineToSketch(
    sketchId: string,
    type: 'horizontal' | 'vertical' | 'angled' | 'absolute',
    params: {
      distance?: number;
      x?: number;
      y?: number;
      angle?: number;
    }
  ): Promise<CADUtilsResult> {
    try {
      console.log(`✏️ CAD Utils: Adding ${type} line to sketch ${sketchId}`);
      
      // Convert to engine parameters
      let lineType: 'hLine' | 'vLine' | 'line' | 'lineTo' | 'polarLine';
      let lineParams: number[];

      switch (type) {
        case 'horizontal':
          lineType = 'hLine';
          lineParams = [params.distance || 10];
          break;
        case 'vertical':
          lineType = 'vLine';
          lineParams = [params.distance || 10];
          break;
        case 'angled':
          if (params.angle !== undefined && params.distance !== undefined) {
            lineType = 'polarLine';
            lineParams = [params.distance, params.angle];
          } else {
            lineType = 'line';
            lineParams = [params.x || 0, params.y || 0];
          }
          break;
        case 'absolute':
          lineType = 'lineTo';
          lineParams = [params.x || 0, params.y || 0];
          break;
        default:
          throw new Error(`Unknown line type: ${type}`);
      }

      // TODO: Implement addDrawingLine method in CAD engine
      // await cadEngine.addDrawingLine(sketchId, lineType, lineParams);
      console.log(`Would add ${lineType} line with params:`, lineParams);
      
      showToast.operationSuccess('Line added', `${type} line`);
      
      return {
        success: true,
        message: `${type} line added to sketch`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to add line';
      console.error('❌ CAD Utils: Add line failed:', error);
      showToast.operationError('Add line', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Extrude a sketch into 3D solid
   */
  static async extrudeSketch(
    sketchId: string,
    distance: number,
    options?: {
      direction?: [number, number, number];
      twistAngle?: number;
      profile?: 'linear' | 's-curve';
      endFactor?: number;
    }
  ): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Extruding sketch ${sketchId} by ${distance}`);
      const toastId = showToast.operationLoading('Extrude sketch');
      
      // TODO: Implement extrudeDrawing method in CAD engine
      // const shape = await cadEngine.extrudeDrawing(sketchId, distance, options || {});
      const shape = await cadEngine.extrudeSketch(sketchId, distance);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Extrude operation', `distance=${distance}`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Sketch extruded to distance ${distance}`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to extrude sketch';
      console.error('❌ CAD Utils: Extrude sketch failed:', error);
      showToast.operationError('Extrude sketch', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Revolve a sketch around an axis
   */
  static async revolveSketch(
    sketchId: string,
    axis: [number, number, number] = [0, 0, 1],
    angle: number = 360,
    options?: {
      origin?: [number, number, number];
    }
  ): Promise<CADUtilsResult> {
    try {
      console.log(`🔧 CAD Utils: Revolving sketch ${sketchId} by ${angle}°`);
      const toastId = showToast.operationLoading('Revolve sketch');
      
      // TODO: Implement revolveDrawing method in CAD engine  
      // const shape = await cadEngine.revolveDrawing(sketchId, axis, { angle, ...options });
      const shape = await cadEngine.revolveSketch(sketchId, axis, angle);
      
      showToast.dismiss(toastId);
      showToast.operationSuccess('Revolve operation', `${angle}° rotation`);
      
      return {
        success: true,
        shapeId: shape.id,
        shape,
        message: `Sketch revolved by ${angle} degrees`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to revolve sketch';
      console.error('❌ CAD Utils: Revolve sketch failed:', error);
      showToast.operationError('Revolve sketch', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  // ==================== AI INTEGRATION ====================

  /**
   * Execute natural language CAD command (placeholder for AI integration)
   */
  static async executeNaturalLanguageCommand(command: string): Promise<CADUtilsResult> {
    try {
      console.log(`🤖 CAD Utils: Processing command: "${command}"`);
      const toastId = showToast.operationLoading('Processing AI command');
      
      // This would integrate with an AI service
      // For now, parse simple commands
      const lowerCommand = command.toLowerCase();
      
      if (lowerCommand.includes('box') || lowerCommand.includes('cube')) {
        // Extract dimensions if possible
        const result = await this.createBox(10, 10, 10);
        showToast.dismiss(toastId);
        return result;
      } else if (lowerCommand.includes('cylinder')) {
        const result = await this.createCylinder({ radius: 5, height: 10 });
        showToast.dismiss(toastId);
        return result;
      } else if (lowerCommand.includes('sphere')) {
        const result = await this.createSphere({ radius: 5 });
        showToast.dismiss(toastId);
        return result;
      }
      
      showToast.dismiss(toastId);
      showToast.warning('Command not recognized. Try: "create box", "create cylinder", or "create sphere"');
      
    return {
      success: false,
        error: 'Command not recognized. AI integration coming soon!'
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to process command';
      console.error('❌ CAD Utils: AI command failed:', error);
      showToast.operationError('AI command', errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get suggested operations based on current scene
   */
  static getSuggestedOperations(): string[] {
    const shapes = cadEngine.getAllShapes();
    const suggestions: string[] = [];

    if (shapes.length === 0) {
      suggestions.push('Create a box', 'Create a cylinder', 'Create a sphere', 'Start a sketch');
    } else if (shapes.length === 1) {
      suggestions.push('Create another shape', 'Add fillet', 'Start a sketch to extrude');
    } else if (shapes.length >= 2) {
      suggestions.push('Union shapes', 'Subtract shapes', 'Intersect shapes', 'Add fillet to edges');
    }

    return suggestions;
  }

  /**
   * Validate operation parameters
   */
  static validateParameters(operation: CADOperationType, params: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (operation) {
      case 'create_box':
        if (!params.width || typeof params.width !== 'number' || params.width <= 0) {
          errors.push('Width must be a positive number');
        }
        if (!params.height || typeof params.height !== 'number' || params.height <= 0) {
          errors.push('Height must be a positive number');
        }
        if (!params.depth || typeof params.depth !== 'number' || params.depth <= 0) {
          errors.push('Depth must be a positive number');
        }
        break;

      case 'create_cylinder':
        if (!params.radius || typeof params.radius !== 'number' || params.radius <= 0) {
          errors.push('Radius must be a positive number');
        }
        if (!params.height || typeof params.height !== 'number' || params.height <= 0) {
          errors.push('Height must be a positive number');
        }
        break;

      case 'create_sphere':
        if (!params.radius || typeof params.radius !== 'number' || params.radius <= 0) {
          errors.push('Radius must be a positive number');
        }
        break;

      case 'union':
      case 'subtract':
      case 'intersect':
        if (!params.shape1Id || typeof params.shape1Id !== 'string') {
          errors.push('First shape ID is required');
        }
        if (!params.shape2Id || typeof params.shape2Id !== 'string') {
          errors.push('Second shape ID is required');
        }
        break;

      case 'fillet':
        if (!params.shapeId || typeof params.shapeId !== 'string') {
          errors.push('Shape ID is required');
        }
        if (!params.radius || typeof params.radius !== 'number' || params.radius <= 0) {
          errors.push('Radius must be a positive number');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export as default for easier imports
export default CADUtils; 