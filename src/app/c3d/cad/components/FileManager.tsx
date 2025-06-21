'use client';

import { useAtom } from 'jotai';
import { useState, useRef } from 'react';
import { Download, Upload, Save, FolderOpen, X } from 'lucide-react';
import { saveAs } from 'file-saver';
import { selectedObjectsDataAtom } from '../stores/cadStore';
import { cadEngine } from '../lib/cadEngine';
import { ExportOptions } from '../types/cad';
import { useTheme } from '../hooks/useTheme';
import styles from './FileManager.module.css';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [format, setFormat] = useState<'stl' | 'obj' | 'step'>('stl');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [units, setUnits] = useState<'mm' | 'cm' | 'm' | 'in' | 'ft'>('mm');
  const [includeHidden, setIncludeHidden] = useState(false);
  const { theme } = useTheme();

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({ format, quality, units, includeHidden });
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} data-theme={theme}>
        <div className={styles.header}>
          <h3 className={styles.title}>Export Options</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={16} />
          </button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.section}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'stl' | 'obj' | 'step')}
                className={styles.select}
              >
                <option value="stl">STL - Stereolithography</option>
                <option value="obj">OBJ - Wavefront Object</option>
                <option value="step">STEP - Standard for Exchange of Product Data</option>
              </select>
            </div>

            {(format === 'stl' || format === 'obj') && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Quality</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as 'low' | 'medium' | 'high')}
                  className={styles.select}
                >
                  <option value="low">Low (Fast)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Detailed)</option>
                </select>
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label}>Units</label>
              <select
                value={units}
                onChange={(e) => setUnits(e.target.value as 'mm' | 'cm' | 'm' | 'in' | 'ft')}
                className={styles.select}
              >
                <option value="mm">Millimeters</option>
                <option value="cm">Centimeters</option>
                <option value="m">Meters</option>
                <option value="in">Inches</option>
                <option value="ft">Feet</option>
              </select>
            </div>

            <div className={styles.toggle}>
              <input
                type="checkbox"
                checked={includeHidden}
                onChange={(e) => setIncludeHidden(e.target.checked)}
                className={styles.toggleSwitch}
              />
              <label className={styles.label}>Include hidden objects</label>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            onClick={onClose}
            className={`${styles.button} ${styles.secondary}`}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className={`${styles.button} ${styles.primary}`}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FileManager() {
  const [selectedObjects] = useAtom(selectedObjectsDataAtom);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (options: ExportOptions) => {
    if (selectedObjects.length === 0) {
      alert('No objects selected for export');
      return;
    }

    try {
      const objectToExport = selectedObjects[0];
      
      const shape = await cadEngine.executeOperation({
        id: 'temp',
        type: 'create_box',
        params: objectToExport.properties.dimensions || { width: 1, height: 1, depth: 1 },
        timestamp: new Date(),
        undoable: false
      });

      if (shape) {
        const blob = await cadEngine.exportShape(shape, options);
        const filename = `${objectToExport.name}.${options.format}`;
        saveAs(blob, filename);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error as Error).message);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Importing file:', file.name);
    alert('Import functionality not yet implemented');
    
    event.target.value = '';
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleImport}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            backgroundColor: '#374151',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          title="Import File"
        >
          <Upload size={16} />
          <span>Import</span>
        </button>

        <button
          onClick={() => setShowExportDialog(true)}
          disabled={selectedObjects.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            backgroundColor: selectedObjects.length > 0 ? '#374151' : '#1f2937',
            color: selectedObjects.length > 0 ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: selectedObjects.length > 0 ? 'pointer' : 'not-allowed'
          }}
          title="Export Selected Objects"
        >
          <Download size={16} />
          <span>Export</span>
        </button>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#4b5563' }} />

        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            backgroundColor: '#374151',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          title="Save Project"
        >
          <Save size={16} />
        </button>

        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            backgroundColor: '#374151',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          title="Open Project"
        >
          <FolderOpen size={16} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".step,.stp,.stl,.obj"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
      />
    </>
  );
} 