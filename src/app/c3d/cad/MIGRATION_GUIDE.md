# CAD Engine Migration Guide: From Web Workers to replicad-threejs-helper

## Problem Summary

The original CAD implementation used:
- Web Workers with `new Function()` calls
- Manual mesh conversion in workers
- `eval()` and dynamic code execution

This caused **Content Security Policy (CSP) violations** even with `'unsafe-eval'` directive.

## Solution: Migration to replicad-threejs-helper + Sandpack

### Key Changes Made

#### 1. ✅ Removed Web Worker Architecture
- **Before**: `CADWorkerClient` + `cad.worker.ts`
- **After**: Direct imports and execution in main thread

#### 2. ✅ Integrated replicad-threejs-helper
- **Before**: Manual mesh conversion with complex geometry building
- **After**: `syncGeometries()` from `replicad-threejs-helper`

#### 3. ✅ Added Sandpack for Code Editing
- **Before**: Monaco Editor with direct code execution
- **After**: Sandpack provides isolated environment for code editing

#### 4. ✅ Eliminated CSP Violations
- **Before**: `new Function()` calls triggered CSP errors
- **After**: Direct module imports, no dynamic code execution

## Implementation Details

### New Architecture

```typescript
// Old approach (CSP violating):
const func = new Function(...Object.keys(context), code);
const result = func(...Object.values(context));

// New approach (CSP compliant):
import { syncGeometries } from 'replicad-threejs-helper';
const geometries = syncGeometries(meshedShapes, []);
```

### Key Files Modified

1. **CADClientPage.tsx** - Complete rewrite using replicad-threejs-helper
2. **page.module.css** - Added new layout styles for Sandpack integration
3. **Removed Files**:
   - `utils/cad.worker.ts`
   - `utils/cadWorkerClient.ts`
   - `utils/cadEngine.ts` (replaced with direct imports)

### Dependencies Used

```json
{
  "replicad": "^0.19.0",
  "replicad-threejs-helper": "^0.19.0", // ⭐ Key addition
  "@codesandbox/sandpack-react": "^2.20.0", // ⭐ For code editing
  "@react-three/fiber": "^9.1.2",
  "three": "^0.177.0"
}
```

## Benefits Achieved

### 🚫 CSP Issues Eliminated
- No more `new Function()` calls
- No more `eval()` usage
- No more dynamic code execution

### ⚡ Simplified Architecture
- Removed complex worker communication
- Direct module imports
- Cleaner error handling

### 🛠️ Better Developer Experience
- Sandpack provides isolated code editing
- Real-time syntax highlighting
- Proper TypeScript support

### 🔧 Easier Maintenance
- Less complex codebase
- Standard Three.js integration via helper
- No custom mesh conversion logic

## Usage Examples

### Basic Shape Creation

```typescript
import { drawCircle } from 'replicad';
import { syncGeometries } from 'replicad-threejs-helper';

// Create shape
const cylinder = drawCircle(20).sketchOnPlane().extrude(50);

// Mesh with replicad
const meshed = [{
  name: 'Cylinder',
  faces: cylinder.mesh({ tolerance: 0.05, angularTolerance: 30 }),
  edges: cylinder.meshEdges(),
}];

// Convert to Three.js BufferGeometry
const geometries = syncGeometries(meshed, []);
```

### Multiple Shapes

```typescript
const shapes = [
  drawCircle(20).sketchOnPlane().extrude(50),
  drawRoundedRectangle(40, 30, 5).sketchOnPlane().extrude(10)
];

const meshedShapes = shapes.map((shape, index) => ({
  name: `Shape ${index + 1}`,
  faces: shape.mesh({ tolerance: 0.05, angularTolerance: 30 }),
  edges: shape.meshEdges(),
}));

const geometries = syncGeometries(meshedShapes, []);
```

## Remaining Work

### 1. Fix Type Issues

Some TypeScript errors remain due to:
- `replicad-threejs-helper` type definitions
- Sandpack option compatibility

**Solution**: Add proper type definitions or use type assertions where needed.

### 2. Implement Dynamic Code Execution

Currently shows static examples. To enable dynamic code execution:

**Option A: Iframe Communication**
```typescript
// Send code to Sandpack iframe
iframe.contentWindow.postMessage({ type: 'execute', code }, '*');

// Listen for results
window.addEventListener('message', (event) => {
  if (event.data.type === 'result') {
    const geometries = event.data.geometries;
    // Update viewer
  }
});
```

**Option B: Server-Side Execution**
```typescript
// Send code to backend API
const response = await fetch('/api/execute-cad', {
  method: 'POST',
  body: JSON.stringify({ code }),
});
const { geometries } = await response.json();
```

### 3. Export Functionality

Implement STL/STEP export using replicad's native export functions:

```typescript
import { exportSTL, exportSTEP } from 'replicad';

// Recreate shape from geometry and export
const stlData = exportSTL(originalShape);
const blob = new Blob([stlData], { type: 'application/octet-stream' });
saveAs(blob, 'model.stl');
```

## Testing the Migration

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to** `/c3d/cad`

3. **Verify**:
   - ✅ No CSP errors in browser console
   - ✅ Shapes render correctly in Three.js viewer
   - ✅ Sandpack editor loads without errors
   - ✅ Example code executes and shows geometry

## Performance Considerations

### Before (Worker-based)
- Heavy worker communication overhead
- Complex serialization of geometry data
- Memory issues with large meshes

### After (replicad-threejs-helper)
- Direct Three.js BufferGeometry creation
- Optimized mesh conversion
- Better memory management
- Faster rendering

## Next Steps

1. **Complete Type Fixes**: Resolve remaining TypeScript errors
2. **Add Real Code Execution**: Implement iframe communication or server-side execution
3. **Export Implementation**: Add STL/STEP export functionality
4. **Performance Optimization**: Add mesh simplification for large models
5. **Error Handling**: Improve error messages and recovery

## Conclusion

The migration successfully eliminates CSP issues while providing a better development experience. The new architecture is simpler, more maintainable, and provides better performance. The use of `replicad-threejs-helper` ensures proper Three.js integration without the complexity of manual mesh conversion. 