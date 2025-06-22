# C3D CAD Tool

A modern, minimalist in-browser CAD tool built with React, Three.js, and Replicad.

## How Code Execution Works

### Auto-run vs Manual Run
- **Auto-run**: Code executes automatically 500ms after you stop typing
- **Manual run**: Click the "▶ Run" button or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux)
- **Execution feedback**: Real-time notifications via toast messages

### Keyboard Shortcuts
- `Cmd+Enter` / `Ctrl+Enter`: Run code immediately (bypasses auto-run delay)

### Execution Process
1. Code is passed to the CAD engine singleton
2. Replicad library is loaded into a sandboxed execution context
3. Your code runs with access to the `replicad` object
4. Generated shapes are converted to Three.js meshes
5. 3D viewer updates with the new geometry

## Viewer Controls

The buttons over the CAD viewer provide essential navigation and utility functions:

| Button | Icon | Function | Description |
|--------|------|----------|-------------|
| Reset View | 🏠 | Reset camera position | Returns camera to default isometric view (50, 50, 50) |
| Fit to View | 📐 | Frame all objects | Automatically adjusts camera to fit all shapes in view |
| Wireframe | 🔗 | Toggle wireframe mode | Switches between solid and wireframe rendering |
| Screenshot | 📸 | Capture image | Downloads a PNG screenshot of the current view |

## Export Options
- **Export STL**: For 3D printing (coming soon)
- **Export STEP**: For CAD interoperability (coming soon)

## Notifications & Debugging

The tool uses Sonner for elegant toast notifications:

- **Success**: Green toasts for successful code execution
- **Error**: Red toasts for compilation/runtime errors  
- **Info**: Blue toasts for feature updates and export status
- **Loading**: Gray toasts during initialization

## Code Examples

### Basic Cylinder with Hole
```javascript
const { draw, drawCircle } = replicad;

const main = () => {
  // Create a cylinder
  const cylinder = drawCircle(20)
    .sketchOnPlane()
    .extrude(50);
  
  // Create a hole
  const hole = drawCircle(8)
    .sketchOnPlane()
    .extrude(60)
    .translateZ(-5);
  
  // Cut the hole from the cylinder
  return cylinder.cut(hole);
};
```

### Multiple Shapes
```javascript
const { draw, drawCircle, drawRectangle } = replicad;

const main = () => {
  const cylinder = drawCircle(10).sketchOnPlane().extrude(20);
  const box = drawRectangle(15, 15).sketchOnPlane().extrude(10).translateZ(25);
  
  return [cylinder, box]; // Return array for multiple shapes
};
```

## Color Scheme

The interface uses a minimalist dark theme:
- **Background**: Pure black (#000000)
- **Panels**: Dark gray (#0a0a0a) 
- **Borders**: Subtle gray (#1a1a1a)
- **Text**: White (#ffffff) with light gray (#cccccc) for secondary text
- **3D Objects**: Purple (#8844ff) for visibility against dark background

## Technical Architecture

- **Frontend**: React 18 with TypeScript
- **3D Rendering**: Three.js with custom WebGL renderer
- **Code Editor**: Monaco Editor with custom dark theme
- **CAD Engine**: Replicad with OpenCascade.js WASM backend
- **Notifications**: Sonner toast system
- **Styling**: CSS Modules for component isolation

## Performance Features

- **Debounced execution**: Prevents excessive re-rendering during typing
- **Singleton engine**: CAD engine initialized once and reused
- **Optimized rendering**: 60fps viewport with efficient mesh updates
- **Progressive loading**: Engine initializes asynchronously with user feedback

## AI Integration

The tool exposes a global function for AI agents:
```javascript
window.setCADCode(newCode) // Programmatically set and execute code
```

This allows AI assistants to directly manipulate the CAD tool through the browser console or embedded scripts. 