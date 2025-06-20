'use client';

import { useAtom } from 'jotai';
import { useState } from 'react';
import { ChevronRight, CheckCircle, Circle, Palette } from 'lucide-react';
import { selectedObjectsDataAtom, updateObjectAtom } from '../stores/cadStore';
import { CADObject } from '../types/cad';
import { useTheme } from '../hooks/useTheme';
import styles from './PropertyPanel.module.css';

interface PropertyInputProps {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number';
  step?: number;
}

function PropertyInput({ label, value, onChange, type = 'text', step }: PropertyInputProps) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        step={step}
        className={styles.input}
      />
    </div>
  );
}

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`${styles.toggleButton} ${checked ? styles.checked : ''}`}
      >
        <div className={styles.toggleIcon}>
          {checked ? <CheckCircle size={18} /> : <Circle size={18} />}
        </div>
        <span className={styles.toggleLabel}>{checked ? 'Visible' : 'Hidden'}</span>
      </button>
    </div>
  );
}

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function SliderInput({ label, value, onChange, min = -10, max = 10, step = 0.1 }: SliderInputProps) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>{label}</label>
      <div className={styles.sliderInputContainer}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={styles.slider}
        />
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          className={styles.numberInput}
        />
      </div>
    </div>
  );
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>{label}</label>
      <div className={styles.colorPickerContainer}>
        <Palette size={16} className={styles.colorPickerIcon} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={styles.colorInput}
        />
        <span className={styles.colorValue}>{value}</span>
      </div>
    </div>
  );
}

interface Vector3InputProps {
  label: string;
  value: [number, number, number];
  onChange: (value: [number, number, number]) => void;
}

function Vector3Input({ label, value, onChange }: Vector3InputProps) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>{label}</label>
      <div className={styles.vectorGroup}>
        <SliderInput label="X" value={value[0]} onChange={(v) => onChange([v, value[1], value[2]])} />
        <SliderInput label="Y" value={value[1]} onChange={(v) => onChange([value[0], v, value[2]])} />
        <SliderInput label="Z" value={value[2]} onChange={(v) => onChange([value[0], value[1], v])} />
      </div>
    </div>
  );
}

interface PropertySectionProps {
  title: string;
  children: React.ReactNode;
  collapsed?: boolean;
}

function PropertySection({ title, children, collapsed = false }: PropertySectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  return (
    <div className={styles.section}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={styles.sectionHeader}
      >
        <div className={styles.sectionTitle}>
          <ChevronRight className={`${styles.sectionIcon} ${isCollapsed ? styles.collapsed : ''}`} size={16} />
          {title}
        </div>
      </button>
      {!isCollapsed && (
        <div className={`${styles.sectionContent} ${isCollapsed ? styles.collapsed : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function PropertyPanel() {
  const [selectedObjects] = useAtom(selectedObjectsDataAtom);
  const [, updateObject] = useAtom(updateObjectAtom);
  const { theme } = useTheme();

  if (selectedObjects.length === 0) {
    return (
      <div className={styles.container} data-theme={theme}>
        <div className={styles.header}>
          <h3 className={styles.title}>Properties</h3>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateText}>No objects selected</div>
          <div className={styles.emptyStateSubtext}>Select an object to view its properties</div>
        </div>
      </div>
    );
  }

  const selectedObject = selectedObjects[0]; // For now, show properties of first selected object
  const { properties } = selectedObject;

  const handlePropertyUpdate = (updates: Partial<CADObject>) => {
    updateObject(selectedObject.id, updates);
  };

  return (
    <div className={styles.container} data-theme={theme}>
      <div className={styles.header}>
        <h3 className={styles.title}>Properties</h3>
        <div className={styles.emptyStateSubtext}>
          {selectedObjects.length} object{selectedObjects.length > 1 ? 's' : ''} selected
        </div>
      </div>
      <div className={styles.content}>

      {/* Object Info */}
      <PropertySection title="Object">
        <PropertyInput
          label="Name"
          value={selectedObject.name}
          onChange={(value) => handlePropertyUpdate({ name: value as string })}
        />
        <div className={styles.formGroup}>
          <label className={styles.label}>Type</label>
          <div className={styles.input}>
            {selectedObject.type}
          </div>
        </div>
        <ToggleSwitch
          label="Visibility"
          checked={selectedObject.visible}
          onChange={(visible) => handlePropertyUpdate({ visible })}
        />
      </PropertySection>

      {/* Transform */}
      <PropertySection title="Transform">
        <Vector3Input
          label="Position"
          value={properties.position}
          onChange={(value) => handlePropertyUpdate({ 
            properties: { ...properties, position: value } 
          })}
        />
        <Vector3Input
          label="Rotation"
          value={properties.rotation}
          onChange={(value) => handlePropertyUpdate({ 
            properties: { ...properties, rotation: value } 
          })}
        />
        <Vector3Input
          label="Scale"
          value={properties.scale}
          onChange={(value) => handlePropertyUpdate({ 
            properties: { ...properties, scale: value } 
          })}
        />
      </PropertySection>

      {/* Appearance */}
      <PropertySection title="Appearance">
        <ColorPicker
          label="Color"
          value={properties.color}
          onChange={(value) => handlePropertyUpdate({ 
            properties: { ...properties, color: value } 
          })}
        />
        <PropertyInput
          label="Opacity"
          value={properties.opacity}
          onChange={(value) => handlePropertyUpdate({ 
            properties: { ...properties, opacity: value as number } 
          })}
          type="number"
          step={0.1}
        />
        <PropertyInput
          label="Material"
          value={properties.material}
          onChange={(value) => handlePropertyUpdate({ 
            properties: { ...properties, material: value as string } 
          })}
        />
      </PropertySection>

      {/* Dimensions */}
      {properties.dimensions && (
        <PropertySection title="Dimensions">
          {Object.entries(properties.dimensions).map(([key, value]) => (
            <SliderInput
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              value={value as number}
              onChange={(newValue) => handlePropertyUpdate({ 
                properties: { 
                  ...properties, 
                  dimensions: { 
                    ...properties.dimensions, 
                    [key]: newValue
                  } 
                } 
              })}
              min={0}
              max={50}
              step={0.1}
            />
          ))}
        </PropertySection>
      )}

      {/* Metadata */}
      <PropertySection title="Metadata" collapsed={true}>
        <div className={styles.emptyStateSubtext}>
          <div>Created: {selectedObject.metadata.createdAt.toLocaleString()}</div>
          <div>Updated: {selectedObject.metadata.updatedAt.toLocaleString()}</div>
          <div>Creator: {selectedObject.metadata.creator}</div>
        </div>
      </PropertySection>
      </div>
    </div>
  );
} 