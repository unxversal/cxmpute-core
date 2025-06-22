# C3D CAD Studio

A modern, browser-based CAD tool powered by Replicad and OpenCascade. Create 3D models using JavaScript code with real-time preview.

## Features

- **Code-Based Modeling**: Create 3D shapes using JavaScript and the Replicad API
- **Real-Time Preview**: See your changes instantly in the 3D viewer
- **Monaco Editor**: Full-featured code editor with syntax highlighting and IntelliSense
- **Dark Theme**: Modern, minimalist dark theme for comfortable coding
- **Export Options**: Export your models as STL or STEP files
- **AI Integration**: API endpoint for AI agents to generate and modify CAD code

## Getting Started

1. Navigate to `/c3d/cad` in your browser
2. Start writing Replicad code in the editor on the right
3. Your 3D model will appear in the viewer on the left

## Example Code

Here's a simple example to get you started:

```javascript
const { drawCircle, drawRectangle } = replicad;

const main = () => {
  // Create a cylinder
  const cylinder = drawCircle(20).sketchOnPlane().extrude(40);
  
  // Create a rectangular hole
  const hole = drawRectangle(30, 10).sketchOnPlane().extrude(50);
  
  // Cut the hole from the cylinder
  const result = cylinder.cut(hole);
  
  return result;
};
```

## API Reference

The tool exposes all Replicad functions. Here are the most commonly used:

### Drawing Functions
- `draw()` - Start a 2D drawing
- `drawCircle(radius)` - Create a circle
- `drawRectangle(width, height)` - Create a rectangle
- `drawRoundedRectangle(width, height, radius)` - Create a rounded rectangle

### 3D Operations
- `.sketchOnPlane(plane?, offset?)` - Place 2D drawing on a 3D plane
- `.extrude(distance)` - Add thickness to create a 3D shape
- `.revolve()` - Revolve around an axis
- `.loftWith(otherShape)` - Create smooth transition between shapes

### Boolean Operations
- `.cut(other)` - Subtract one shape from another
- `.fuse(other)` - Combine shapes together
- `.intersect(other)` - Keep only the intersection

### Modifications
- `.fillet(radius)` - Round edges
- `.chamfer(distance)` - Bevel edges
- `.translate(x, y, z)` - Move shape
- `.rotate(angle, origin, axis)` - Rotate shape

## AI Integration

The CAD tool provides an API endpoint for AI agents to set code:

### Endpoint: `POST /api/cad/set-code`

```json
{
  "code": "const { drawCircle } = replicad;\n\nconst main = () => {\n  return drawCircle(10).sketchOnPlane().extrude(5);\n};"
}
```

### Frontend Integration

AI agents can also directly call the frontend function:

```javascript
window.setCADCode(`
const { makeCylinder, makeSphere } = replicad;

const main = () => {
  const cylinder = makeCylinder(15, 30);
  const sphere = makeSphere(20).translate([0, 0, 25]);
  return cylinder.fuse(sphere);
};
`);
```

## Controls

### 3D Viewer
- **Mouse drag**: Rotate view
- **Mouse wheel**: Zoom in/out
- **Right click + drag**: Pan view
- **Reset button (🏠)**: Reset camera to default position
- **Wireframe button (📐)**: Toggle wireframe view

### Code Editor
- **Ctrl/Cmd + S**: The code auto-saves and executes
- **Ctrl/Cmd + /**: Toggle comment
- **Ctrl/Cmd + F**: Find and replace
- **Auto-completion**: Press Ctrl/Cmd + Space for suggestions

## Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Force code execution
- `Ctrl/Cmd + Shift + E`: Export as STL
- `Ctrl/Cmd + Shift + S`: Export as STEP
- `F11`: Toggle fullscreen

## Troubleshooting

### Common Errors

1. **"No main function found"**: Make sure your code defines a `main()` function that returns a shape
2. **"Kernel Error"**: Usually caused by invalid geometry operations. Check your boolean operations and fillet radii
3. **"Shape not visible"**: Make sure your shape is positioned near the origin and has reasonable dimensions

### Performance Tips

- Use simpler shapes for better performance
- Avoid overly complex boolean operations
- Keep fillet radii reasonable relative to shape size
- Use `console.log()` to debug shape properties

## Browser Compatibility

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Supported but file loading may be limited
- **Safari**: Basic support

## Technical Details

- Built with React, Three.js, and Monaco Editor
- Uses Replicad library with OpenCascade.js kernel
- WebAssembly for high-performance 3D operations
- Client-side rendering for real-time feedback

## Contributing

To add new features or fix bugs:

1. The main page component is in `page.tsx`
2. Editor logic is in `components/MonacoEditor.tsx`
3. 3D viewer is in `components/CADViewer.tsx`
4. CAD engine wrapper is in `utils/cadEngine.ts`
5. Shape conversion utilities are in `utils/shapeConverter.ts`

## License

This CAD tool is part of the Cxmpute Core platform. See the main project license for details. 