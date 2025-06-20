# C3D CAD Editor – Implementation Plan

This document captures the near-term roadmap for turning the current viewer into a fully-functional CAD editor.

---

## 0. Status summary  
✔ Replicad engine loads (WASM copied + `locateFile` patch).  
✔ Primitive buttons add solids that render in the viewport.  
🟡 No interactive editing yet.

---

## 1. Core interaction layer

1. **Selection & Highlighting**  
   • Add ray-caster in `CADViewport` – on `pointerDown` cast against visible meshes.  
   • Store hit object ID in `selectedObjectsAtom`.  
   • Visual feedback: change material color or add an outline (e.g. `@react-three/drei` `Outline`).

2. **Transform gizmos**  
   • Integrate drei's `TransformControls`.  
   • Controls attach when a single object is selected.  
   • On change → update `position/rotation/scale` via `updateObjectAtom`.  
   • Record operations in `cadHistoryAtom` (type `move | rotate | scale`).

---

## 2. Sketch mode & feature tools

1. **2-D drawing mode**  
   • New tool state `draw` inside `ToolPalette`.  
   • While active, capture clicks in 2-D overlay → build poly-line stored in **draftSketchAtom**.  
   • Provide "Finish Sketch" → convert to Replicad drawing → `cadEngine.extrudeDrawing` etc.

2. **Extrude / Revolve**  
   • Once a closed draft is finished prompt for height / angle.  
   • Call `cadEngine.extrudeDrawing` or `revolveDrawing` and add resulting solid.

3. **Boolean operations**  
   • Require 2 solid selections.  
   • `Union`, `Subtract`, `Intersect` buttons call `cadEngine.*` and replace original objects with result.

4. **Modify – Fillet / Chamfer**  
   • If single solid selected → show radius input dialog.  
   • Use simple EdgeFinder presets for MVP (e.g. `inDirection('Z')`).  
   • Later add real edge picking (see Phase-3).

---

## 3. Advanced picking (Phase-3)

1. **Edge / Face hover**  
   • Use Replicad viewer helpers to extract faces, convert to three.js meshes for hit-testing.  
   • Highlight hovered edge / face with different color.

2. **Finder builder UI**  
   • Visual filters UI to let user specify `inPlane`, `ofSurfaceType`, etc.

---

## 4. History & Undo/Redo

1. Push every mutating operation onto `cadHistoryAtom`.  
2. Implement two stacks (`undo`, `redo`).  
3. Provide toolbar buttons and `Ctrl-Z / Ctrl-Y` shortcuts.

---

## 5. Export & File management

1. Dialog in `FileManager` → call `cadEngine.exportShape` for selected or all.  
2. Support STL, STEP, OBJ with quality presets.

3. Project save/load (JSON of scene atoms).  
   • Save: serialize `cadSceneAtom`.  
   • Load: rebuild scene (re-create `CADObject`s and meshes from params).

---

## 6. Collaboration & AI (later phases)

1. Web-socket based multi-user editing layered on top of atom updates.
2. AI assistant mapping natural language → calls to `CADUtils`.

---

## Milestones & estimates

| Phase | Tasks | ETA |
| ----- | ----- | --- |
| 1 | Selection + gizmos | **1 week** |
| 2 | Sketch mode, Extrude/Revolve, Booleans, Fillet/Chamfer | **2–3 weeks** |
| 3 | Edge/Face picking + advanced filters | **1 week** |
| 4 | Undo/Redo, Export, Save/Load | **1 week** |
| 5 | Collaboration & AI MVP | **ongoing** |

---

*Last updated: {{DATE}}* 