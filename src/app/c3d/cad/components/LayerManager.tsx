'use client';

import { useAtom } from 'jotai';
import { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, Edit2, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Box, Circle, Square } from 'lucide-react';
import { 
  orderedLayersAtom,
  activeLayerIdAtom, 
  addLayerAtom, 
  removeLayerAtom,
  moveLayerAtom,
  updateLayerAtom,
  layerObjectsAtom,
  selectedObjectsAtom
} from '../stores/cadStore';
import { CADLayer, CADObject } from '../types/cad';
import { useTheme } from '../hooks/useTheme';
import { toast } from 'sonner';
import styles from './LayerManager.module.css';

interface LayerItemProps {
  layer: CADLayer;
  isActive: boolean;
  objectCount: number;
  objects: CADObject[];
  onActivate: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function LayerItem({ 
  layer, 
  isActive, 
  objectCount,
  objects,
  onActivate, 
  onToggleVisibility, 
  onToggleLock, 
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}: LayerItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setSelectedObjects] = useAtom(selectedObjectsAtom);

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

  const handleObjectSelect = (objectId: string, objectName: string) => {
    setSelectedObjects([objectId]);
    toast.success(`Selected ${objectName}`);
  };

  const getObjectIcon = (object: CADObject) => {
    switch (object.type) {
      case 'solid':
        if (object.name.includes('box')) return <Box size={12} />;
        if (object.name.includes('cylinder')) return <Circle size={12} />;
        if (object.name.includes('sphere')) return <Circle size={12} />;
        return <Square size={12} />;
      default:
        return <Square size={12} />;
    }
  };

  return (
    <div className={styles.layerItemContainer}>
      <div 
        className={`${styles.layerItem} ${isActive ? styles.active : ''}`}
        onClick={onActivate}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={styles.expandButton}
          style={{ visibility: objectCount > 0 ? 'visible' : 'hidden' }}
        >
          {isExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>

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

        {/* Object Count (Clickable to expand) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (objectCount > 0) {
              setIsExpanded(!isExpanded);
            }
          }}
          className={`${styles.layerCount} ${objectCount > 0 ? styles.clickable : ''}`}
          disabled={objectCount === 0}
        >
          {objectCount}
        </button>

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
        <div className={styles.layerMoveButtons}>
          <button onClick={onMoveUp} disabled={isFirst} className={styles.iconButton}>
            <ArrowUp size={14} />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className={styles.iconButton}>
            <ArrowDown size={14} />
          </button>
        </div>
      </div>

      {/* Expandable Object List */}
      {isExpanded && objectCount > 0 && (
        <div className={styles.objectList}>
          {objects.map((object) => (
            <div
              key={object.id}
              className={styles.objectItem}
              onClick={() => handleObjectSelect(object.id, object.name)}
            >
              <div className={styles.objectIcon}>
                {getObjectIcon(object)}
              </div>
              <div className={styles.objectName}>
                {object.name}
              </div>
              <div className={styles.objectType}>
                {object.type}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LayerManager() {
  const [layers] = useAtom(orderedLayersAtom);
  const [activeLayerId, setActiveLayerId] = useAtom(activeLayerIdAtom);
  const [, addLayer] = useAtom(addLayerAtom);
  const [, removeLayer] = useAtom(removeLayerAtom);
  const [, moveLayer] = useAtom(moveLayerAtom);
  const [, updateLayer] = useAtom(updateLayerAtom);
  const [getLayerObjects] = useAtom(layerObjectsAtom);
  const { theme } = useTheme();

  const handleCreateLayer = () => {
    const layerCount = layers.length;
    addLayer({
      name: `Layer ${layerCount}`,
      visible: true,
      locked: false,
      color: '#ffffff',
      opacity: 1,
      objects: [],
    });
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layerId === 'default') return;
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
          {layers.map((layer, index) => {
            if (!layer) return null;
            const layerObjects = getLayerObjects(layer.id);
            const objectCount = layerObjects.length;
            
            return (
              <LayerItem
                key={layer.id}
                layer={layer}
                isActive={activeLayerId === layer.id}
                objectCount={objectCount}
                objects={layerObjects}
                onActivate={() => setActiveLayerId(layer.id)}
                onToggleVisibility={() => 
                  updateLayer({ layerId: layer.id, updates: { visible: !layer.visible } })
                }
                onToggleLock={() => 
                  updateLayer({ layerId: layer.id, updates: { locked: !layer.locked } })
                }
                onRename={(newName) => 
                  updateLayer({ layerId: layer.id, updates: { name: newName } })
                }
                onDelete={() => handleDeleteLayer(layer.id)}
                onMoveUp={() => moveLayer({ layerId: layer.id, direction: 'up' })}
                onMoveDown={() => moveLayer({ layerId: layer.id, direction: 'down' })}
                isFirst={index === 0}
                isLast={index === layers.length - 1}
              />
            );
          })}
        </div>
      </div>

      {/* Layer Actions */}
      <div className={styles.actions}>
        <div className={styles.actionButtons}>
          <button className={styles.actionButton} onClick={() => {
            layers.forEach(layer => {
              if (layer) updateLayer({ layerId: layer.id, updates: { visible: true } });
            });
          }}>
            Show All
          </button>
          <button className={styles.actionButton} onClick={() => {
            layers.forEach(layer => {
              if (layer) updateLayer({ layerId: layer.id, updates: { visible: false } });
            });
          }}>
            Hide All
          </button>
        </div>
      </div>
    </div>
  );
} 