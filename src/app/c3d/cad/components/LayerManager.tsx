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
        className="p-1 hover:bg-gray-600 rounded"
      >
        {layer.visible ? (
          <Eye size={14} className="text-gray-300" />
        ) : (
          <EyeOff size={14} className="text-gray-500" />
        )}
      </button>

      {/* Lock Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
        className="p-1 hover:bg-gray-600 rounded"
      >
        {layer.locked ? (
          <Lock size={14} className="text-gray-500" />
        ) : (
          <Unlock size={14} className="text-gray-300" />
        )}
      </button>

      {/* Color Indicator */}
      <div 
        className="w-3 h-3 rounded border border-gray-600"
        style={{ backgroundColor: layer.color }}
      />

      {/* Layer Name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyPress}
            className="w-full bg-gray-700 text-white text-sm px-1 py-0 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
        ) : (
          <div className="text-sm text-white truncate">
            {layer.name}
          </div>
        )}
      </div>

      {/* Object Count */}
      <div className="text-xs text-gray-400">
        {objectCount}
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-1 hover:bg-gray-600 rounded"
        >
          <Edit2 size={12} className="text-gray-400" />
        </button>
        {layer.id !== 'default' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-gray-600 rounded"
          >
            <Trash2 size={12} className="text-red-400" />
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
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Layers</h3>
          <button
            onClick={handleCreateLayer}
            className="p-1 hover:bg-gray-700 rounded"
            title="Add Layer"
          >
            <Plus size={16} className="text-gray-300" />
          </button>
        </div>
      </div>

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
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
      <div className="p-3 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
            Show All
          </button>
          <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
            Hide All
          </button>
        </div>
      </div>
    </div>
  );
} 