import * as THREE from 'three';

export interface MeshData {
  vertices: Float32Array;
  indices: number[];
  normals?: Float32Array;
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