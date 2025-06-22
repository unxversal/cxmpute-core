import * as THREE from 'three';

export interface MeshData {
  vertices: Float32Array;
  indices: number[];
  normals?: Float32Array;
}

export interface ReplicadShape {
  mesh?: () => {
    vertices?: number[][];
    faces?: number[][];
    normals?: number[][];
  };
  triangulation?: () => {
    vertices?: number[][];
    triangles?: number[][];
  };
  tessellate?: (tolerance?: number) => {
    vertices?: number[][];
    triangles?: number[][];
  };
}

/**
 * Convert a replicad shape to Three.js mesh data
 * This is a placeholder implementation - in a real app you'd need to 
 * extract mesh data from the replicad shape using its mesh() method
 */
export function convertShapeToMesh(shape: unknown): MeshData | null {
  if (!shape) return null;

  try {
    // This is a placeholder - real implementation would use replicad's mesh() method
    // For now, create a simple box geometry as placeholder
    const size = 2;
    const vertices = new Float32Array([
      // Front face
      -size, -size, size,  size, -size, size,  size, size, size,  -size, size, size,
      // Back face
      -size, -size, -size,  -size, size, -size,  size, size, -size,  size, -size, -size,
      // Top face
      -size, size, -size,  -size, size, size,  size, size, size,  size, size, -size,
      // Bottom face
      -size, -size, -size,  size, -size, -size,  size, -size, size,  -size, -size, size,
      // Right face
      size, -size, -size,  size, size, -size,  size, size, size,  size, -size, size,
      // Left face
      -size, -size, -size,  -size, -size, size,  -size, size, size,  -size, size, -size
    ]);

    const indices = [
      0, 1, 2,   0, 2, 3,    // front
      4, 5, 6,   4, 6, 7,    // back
      8, 9, 10,  8, 10, 11,  // top
      12, 13, 14, 12, 14, 15, // bottom
      16, 17, 18, 16, 18, 19, // right
      20, 21, 22, 20, 22, 23  // left
    ];

    return {
      vertices,
      indices,
    };
  } catch (error) {
    console.error('Failed to convert shape to mesh:', error);
    return null;
  }
}

/**
 * Create a Three.js BufferGeometry from mesh data
 */
export function createGeometryFromMeshData(meshData: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  
  geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
  geometry.setIndex(meshData.indices);
  
  if (meshData.normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  
  return geometry;
}

/**
 * Get bounding box of mesh data for auto-fitting camera
 */
export function getMeshBounds(meshData: MeshData): THREE.Box3 {
  const geometry = createGeometryFromMeshData(meshData);
  geometry.computeBoundingBox();
  return geometry.boundingBox || new THREE.Box3();
}

/**
 * Convert a Replicad shape to a Three.js BufferGeometry
 * Based on Replicad documentation for mesh extraction
 */
export function convertReplicadShapeToGeometry(shape: unknown): THREE.BufferGeometry {
  try {
    const replicadShape = shape as ReplicadShape;
    
    // Method 1: Try using the mesh() method (most common)
    if (replicadShape && typeof replicadShape.mesh === 'function') {
      try {
        const meshData = replicadShape.mesh();
        
        if (meshData && meshData.vertices && meshData.faces) {
          const geometry = new THREE.BufferGeometry();
          
          // Convert vertices array to Float32Array
          const vertexCount = meshData.vertices.length;
          const vertices = new Float32Array(vertexCount * 3);
          
          for (let i = 0; i < vertexCount; i++) {
            const vertex = meshData.vertices[i];
            vertices[i * 3] = vertex[0];
            vertices[i * 3 + 1] = vertex[1];
            vertices[i * 3 + 2] = vertex[2];
          }
          
          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
          
          // Convert faces array to indices
          if (meshData.faces && meshData.faces.length > 0) {
            const indexCount = meshData.faces.length * 3;
            const indices = new Uint32Array(indexCount);
            
            for (let i = 0; i < meshData.faces.length; i++) {
              const face = meshData.faces[i];
              indices[i * 3] = face[0];
              indices[i * 3 + 1] = face[1];
              indices[i * 3 + 2] = face[2];
            }
            
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          }
          
          // Add normals if available
          if (meshData.normals && meshData.normals.length > 0) {
            const normalCount = meshData.normals.length;
            const normals = new Float32Array(normalCount * 3);
            
            for (let i = 0; i < normalCount; i++) {
              const normal = meshData.normals[i];
              normals[i * 3] = normal[0];
              normals[i * 3 + 1] = normal[1];
              normals[i * 3 + 2] = normal[2];
            }
            
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
          } else {
            // Compute normals if not provided
            geometry.computeVertexNormals();
          }
          
          return geometry;
        }
      } catch (error) {
        console.warn('Error using mesh() method:', error);
      }
    }
    
    // Method 2: Try using tessellate() method
    if (replicadShape && typeof replicadShape.tessellate === 'function') {
      try {
        const tessellation = replicadShape.tessellate(0.1); // Default tolerance
        
        if (tessellation && tessellation.vertices && tessellation.triangles) {
          const geometry = new THREE.BufferGeometry();
          
          // Flatten vertices array
          const vertices = new Float32Array(tessellation.vertices.flat());
          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
          
          // Flatten triangles array
          const indices = new Uint32Array(tessellation.triangles.flat());
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          
          geometry.computeVertexNormals();
          return geometry;
        }
      } catch (error) {
        console.warn('Error using tessellate() method:', error);
      }
    }
    
    // Method 3: Try using triangulation() method
    if (replicadShape && typeof replicadShape.triangulation === 'function') {
      try {
        const triangulation = replicadShape.triangulation();
        
        if (triangulation && triangulation.vertices && triangulation.triangles) {
          const geometry = new THREE.BufferGeometry();
          
          // Flatten vertices array
          const vertices = new Float32Array(triangulation.vertices.flat());
          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
          
          // Flatten triangles array
          const indices = new Uint32Array(triangulation.triangles.flat());
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          
          geometry.computeVertexNormals();
          return geometry;
        }
      } catch (error) {
        console.warn('Error using triangulation() method:', error);
      }
    }
    
    // Fallback: Return a placeholder geometry
    console.warn('Could not convert Replicad shape to geometry - no valid mesh data found');
    return createPlaceholderGeometry();
    
  } catch (error) {
    console.error('Error converting Replicad shape to geometry:', error);
    return createPlaceholderGeometry();
  }
}

/**
 * Create a placeholder geometry when shape conversion fails
 */
function createPlaceholderGeometry(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(10, 10, 10);
}

/**
 * Normalize shape data for consistent handling
 */
export interface NormalizedShapeData {
  shape: unknown;
  name: string;
  color: string;
  opacity: number;
}

export function normalizeShapeData(shapeItem: unknown, index: number): NormalizedShapeData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapeData = shapeItem as any;
  
  return {
    shape: shapeData?.shape || shapeItem,
    name: shapeData?.name || `Shape ${index + 1}`,
    color: shapeData?.color || '#667eea',
    opacity: shapeData?.opacity ?? 0.8
  };
} 