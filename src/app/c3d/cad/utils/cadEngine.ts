import { setOC } from 'replicad';
import { exportSTL, exportSTEP } from 'replicad';
import { saveAs } from 'file-saver';

export interface CADShape {
  shape: unknown;
  name?: string;
  color?: string;
  opacity?: number;
}

export class CADEngine {
  private initialized = false;
  private replicad: Record<string, unknown> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Import replicad and opencascade
      const replicadModule = await import('replicad');
      const opencascadeModule = await import('replicad-opencascadejs');
      
      // Initialize OpenCascade
      const opencascade = opencascadeModule.default;
      const OC = await opencascade({
        locateFile: (file: string) => {
          if (file.endsWith('.wasm')) {
            return '/replicad_single.wasm';
          }
          return file;
        }
      });

      // Set the OpenCascade instance for replicad
      setOC(OC);
      
      this.replicad = replicadModule as Record<string, unknown>;
      this.initialized = true;
      
      console.log('CAD Engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CAD Engine:', error);
      throw new Error(`CAD Engine initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeCode(code: string): Promise<CADShape[]> {
    if (!this.initialized || !this.replicad) {
      throw new Error('CAD Engine not initialized');
    }

    try {
      // Create a safe execution context
      const fullContext = {
        replicad: this.replicad,
        console: {
          log: (...args: unknown[]) => console.log('[CAD]', ...args),
          error: (...args: unknown[]) => console.error('[CAD]', ...args),
          warn: (...args: unknown[]) => console.warn('[CAD]', ...args)
        },
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Date
      };

      // Wrap the code to handle different return types
      const wrappedCode = `
        ${code}
        
        // Execute main function if it exists
        if (typeof main === 'function') {
          const result = main();
          return result;
        } else {
          throw new Error('No main function found. Please define a main() function that returns your CAD shapes.');
        }
      `;

      // Create a function with the context
      const func = new Function(
        ...Object.keys(fullContext),
        wrappedCode
      );

      // Execute the function
      const result = func(...Object.values(fullContext));
      
      // Normalize the result to an array of CADShape objects
      return this.normalizeResult(result);
      
    } catch (error) {
      console.error('Code execution error:', error);
      throw new Error(`Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private normalizeResult(result: unknown): CADShape[] {
    if (!result) {
      return [];
    }

    // If result is an array
    if (Array.isArray(result)) {
      return result.map((item, index) => {
        if (typeof item === 'object' && item && 'shape' in item) {
          // Already a CADShape-like object
          return {
            shape: (item as { shape: unknown }).shape,
            name: (item as { name?: string }).name || `Shape ${index + 1}`,
            color: (item as { color?: string }).color || '#667eea',
            opacity: (item as { opacity?: number }).opacity ?? 1
          };
        } else {
          // Raw shape object
          return {
            shape: item,
            name: `Shape ${index + 1}`,
            color: '#667eea',
            opacity: 1
          };
        }
      });
    } else {
      // Single shape
      if (typeof result === 'object' && result && 'shape' in result) {
        return [{
          shape: (result as { shape: unknown }).shape,
          name: (result as { name?: string }).name || 'Shape 1',
          color: (result as { color?: string }).color || '#667eea',
          opacity: (result as { opacity?: number }).opacity ?? 1
        }];
      } else {
        return [{
          shape: result,
          name: 'Shape 1',
          color: '#667eea',
          opacity: 1
        }];
      }
    }
  }

  async exportShapes(shapes: CADShape[], format: 'stl' | 'step'): Promise<void> {
    if (!this.initialized || shapes.length === 0) {
      throw new Error('No shapes to export');
    }

    try {
      // If multiple shapes, combine them
      let shapeToExport = shapes[0].shape;
      
      if (shapes.length > 1) {
        // Fuse all shapes together
        for (let i = 1; i < shapes.length; i++) {
          shapeToExport = shapeToExport.fuse(shapes[i].shape);
        }
      }

      let blob: Blob;
      let filename: string;

      if (format === 'stl') {
        const stlData = exportSTL(shapeToExport);
        blob = new Blob([stlData], { type: 'application/octet-stream' });
        filename = 'model.stl';
      } else {
        const stepData = exportSTEP(shapeToExport);
        blob = new Blob([stepData], { type: 'application/octet-stream' });
        filename = 'model.step';
      }

      saveAs(blob, filename);
    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
} 