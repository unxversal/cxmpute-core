'use client';

import { useAtom } from 'jotai';
import { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, Edit2 } from 'lucide-react';
import { 
  cadLayersAtom, 
  activeLayerAtom, 
  addLayerAtom, 
  removeLayerAtom,
  layerObjectsAtom
} from '../stores/cadStore';
import { CADLayer } from '../types/cad';
import { useTheme } from '../hooks/useTheme';
import styles from './LayerManager.module.css';

interface LayerItemProps {
  layer: CADLayer;
  isActive: boolean;
  objectCount: number;
  onActivate: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

function LayerItem({ 
  layer, 
  isActive, 
  objectCount,
  onActivate, 
  onToggleVisibility, 
  onToggleLock, 
  onRename,
  onDelete 
}: LayerItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);

  const handleNameSubmit = () => {
    if (editName.trim() && editName !== layer.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(layer.name);
      setIsEditing(false);
    }
  };

  return (
    <div 
      className={`${styles.layerItem} ${isActive ? styles.active : ''}`}
      onClick={onActivate}
    >
      {/* Visibility Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className={styles.iconButton}
      >
        {layer.visible ? (
          <Eye size={14} />
        ) : (
          <EyeOff size={14} />
        )}
      </button>

      {/* Lock Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
        className={styles.iconButton}
      >
        {layer.locked ? (
          <Lock size={14} />
        ) : (
          <Unlock size={14} />
        )}
      </button>

      {/* Color Indicator */}
      <div 
        className={styles.layerColor}
        style={{ backgroundColor: layer.color }}
      />

      {/* Layer Name */}
      <div className={styles.layerNameContainer}>
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyPress}
            className={styles.layerNameInput}
            autoFocus
          />
        ) : (
          <div className={styles.layerName}>
            {layer.name}
          </div>
        )}
      </div>

      {/* Object Count */}
      <div className={styles.layerCount}>
        {objectCount}
      </div>

      {/* Actions */}
      <div className={styles.layerItemActions}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className={styles.iconButton}
        >
          <Edit2 size={12} />
        </button>
        {layer.id !== 'default' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={`${styles.iconButton} ${styles.deleteButton}`}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function LayerManager() {
  const [layers, setLayers] = useAtom(cadLayersAtom);
  const [activeLayer, setActiveLayer] = useAtom(activeLayerAtom);
  const [, addLayer] = useAtom(addLayerAtom);
  const [, removeLayer] = useAtom(removeLayerAtom);
  const [getLayerObjects] = useAtom(layerObjectsAtom);
  const { theme } = useTheme();

  const handleCreateLayer = () => {
    const layerCount = Object.keys(layers).length;
    addLayer({
      name: `Layer ${layerCount}`,
      visible: true,
      locked: false,
      color: '#ffffff',
      opacity: 1,
      objects: [],
    });
  };

  const handleLayerUpdate = (layerId: string, updates: Partial<CADLayer>) => {
    const updatedLayers = {
      ...layers,
      [layerId]: { ...layers[layerId], ...updates }
    };
    setLayers(updatedLayers);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layerId === 'default') return; // Can't delete default layer
    removeLayer(layerId);
  };

  return (
    <div className={styles.container} data-theme={theme}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <h3 className={styles.headerTitle}>Layers</h3>
          <button
            onClick={handleCreateLayer}
            className={styles.headerButton}
            title="Add Layer"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Layer List */}
      <div className={styles.layerList}>
        <div className={styles.layerListInner}>
          {Object.values(layers).map((layer) => {
            const objectCount = getLayerObjects(layer.id).length;
            return (
              <LayerItem
                key={layer.id}
                layer={layer}
                isActive={activeLayer?.id === layer.id}
                objectCount={objectCount}
                onActivate={() => setActiveLayer(layer.id)}
                onToggleVisibility={() => 
                  handleLayerUpdate(layer.id, { visible: !layer.visible })
                }
                onToggleLock={() => 
                  handleLayerUpdate(layer.id, { locked: !layer.locked })
                }
                onRename={(newName) => 
                  handleLayerUpdate(layer.id, { name: newName })
                }
                onDelete={() => handleDeleteLayer(layer.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Layer Actions */}
      <div className={styles.actions}>
        <div className={styles.actionButtons}>
          <button className={styles.actionButton} onClick={() => {
            // show all layers
            const updated = { ...layers };
            Object.keys(updated).forEach(id => updated[id].visible = true);
            setLayers(updated);
          }}>
            Show All
          </button>
          <button className={styles.actionButton} onClick={() => {
            const updated = { ...layers };
            Object.keys(updated).forEach(id => updated[id].visible = false);
            setLayers(updated);
          }}>
            Hide All
          </button>
        </div>
      </div>
    </div>
  );
} 