"use client"

import Button from "@/components/button/button";
import styles from "./three.module.css";
import { RenderScene } from "@/components/three/CanvasRenderer";
import { useState, useRef, ChangeEvent, KeyboardEvent } from "react";
import { SceneProvider } from "@/components/three/context/SceneContext";
import { presets } from "@/components/three/presets";
import { SceneConfig, AssetConfig } from "@/components/three/types/scene";

type InputPosition = 'left' | 'center' | 'right';

export default function ThreePage() {
  const promptInputRef = useRef<HTMLInputElement>(null);
  const assetUrlInputRef = useRef<HTMLInputElement>(null);
  const assetNameInputRef = useRef<HTMLInputElement>(null);
  
  const initialPresetKey = Object.keys(presets)[0] || "rotatingBoxes";
  const [currentPresetKey, setCurrentPresetKey] = useState<string>(initialPresetKey);
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(presets[initialPresetKey]);
  
  const [inputPosition, setInputPosition] = useState<InputPosition>('left');
  const [showAssetInputArea, setShowAssetInputArea] = useState<boolean>(false);

  const handlePresetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newPresetKey = event.target.value;
    if (presets[newPresetKey]) {
      setCurrentPresetKey(newPresetKey);
      setSceneConfig(presets[newPresetKey]);
    }
  };

  const handleCapture = (blob: Blob) => {
    // Screenshot capture functionality
    console.log('Screenshot captured (blob):', blob);
    // Future: Download or save the blob
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sceneConfig.name || 'scene'}_capture.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateSubmit = () => {
    const prompt = promptInputRef.current?.value;
    if (!prompt) return;

    console.log('User prompt submitted:', prompt);
    // Future: Send to AI service to generate new SceneConfig
    
    // Example: Simple keyword-based preset selection for demonstration
    const lowercasePrompt = prompt.toLowerCase();
    if (lowercasePrompt.includes("sphere") && presets.floatingSphere) {
      setCurrentPresetKey("floatingSphere");
      setSceneConfig(presets.floatingSphere);
    } else if (lowercasePrompt.includes("neon") && presets.neonWaves) {
      setCurrentPresetKey("neonWaves");
      setSceneConfig(presets.neonWaves);
    } else if (lowercasePrompt.includes("cosmic") && presets.cosmicDust) {
      setCurrentPresetKey("cosmicDust");
      setSceneConfig(presets.cosmicDust);
    } else if (lowercasePrompt.includes("glass") && presets.glassBox) {
      setCurrentPresetKey("glassBox");
      setSceneConfig(presets.glassBox);
    }

    if (promptInputRef.current) {
      promptInputRef.current.value = '';
    }
  };

  const handleAddAsset = () => {
    const assetUrl = assetUrlInputRef.current?.value;
    const assetName = assetNameInputRef.current?.value;
    if (!assetUrl) return;

    // Determine asset type based on URL extension
    const extension = assetUrl.split('.').pop()?.toLowerCase();
    let assetType: AssetConfig['type'] = 'image'; // Default
    
    if (extension === 'hdr' || extension === 'exr') {
      assetType = 'hdri';
    } else if (extension === 'glb') {
      assetType = 'glb';
    } else if (extension === 'gltf') {
      assetType = 'gltf';
    }

    // Extract name from URL if not provided
    const defaultName = assetUrl.substring(assetUrl.lastIndexOf('/') + 1).split('?')[0];
    
    const newAsset: AssetConfig = {
      type: assetType,
      url: assetUrl,
      name: assetName || defaultName || `Asset ${(sceneConfig.assets?.length || 0) + 1}`
    };

    setSceneConfig(prev => ({
      ...prev,
      assets: [...(prev.assets || []), newAsset]
    }));

    // Clear inputs
    if (assetUrlInputRef.current) {
      assetUrlInputRef.current.value = '';
    }
    if (assetNameInputRef.current) {
      assetNameInputRef.current.value = '';
    }
  };
  
  const handleRemoveAsset = (indexToRemove: number) => {
    setSceneConfig(prev => ({
      ...prev,
      assets: prev.assets?.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handlePromptKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGenerateSubmit();
    }
  };

  const handleAssetUrlKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddAsset();
    }
  };

  const cycleInputPosition = () => {
    const positions: InputPosition[] = ['left', 'center', 'right'];
    const currentIndex = positions.indexOf(inputPosition);
    const nextIndex = (currentIndex + 1) % positions.length;
    setInputPosition(positions[nextIndex]);
  };

  const getPositionText = () => {
    switch (inputPosition) {
      case 'left': return 'Move Center';
      case 'center': return 'Move Right';
      case 'right': return 'Move Left';
      default: return 'Move Center';
    }
  };

  const getInputContainerClass = () => {
    switch (inputPosition) {
      case 'center': return `${styles.inputContainer} ${styles.centered}`;
      case 'right': return `${styles.inputContainer} ${styles.rightAligned}`;
      default: return styles.inputContainer;
    }
  };

  return (
    <SceneProvider>
      <main className={styles.main}>
        <div className={styles.content}>
          <RenderScene sceneConfig={sceneConfig} onCapture={handleCapture} />
        </div>
        
        <div className={getInputContainerClass()}>
          <div className={styles.input}>
            <input 
              ref={promptInputRef}
              placeholder="Describe your 3D scene..."
              onKeyDown={handlePromptKeyDown}
            />
          </div>
          
          {showAssetInputArea && (
            <div className={styles.assetInput}>
              <input 
                ref={assetUrlInputRef}
                placeholder="Enter asset URL (image, HDRI, GLB/GLTF)..."
                onKeyDown={handleAssetUrlKeyDown}
              />
              <input 
                ref={assetNameInputRef}
                placeholder="Asset name (optional)..."
              />
              <Button text="Add Asset" onClick={handleAddAsset} />
            </div>
          )}

          <div className={styles.buttons}>
            <div className={styles.left}>
              <Button text="Generate" onClick={handleGenerateSubmit} />
              <Button 
                text={showAssetInputArea ? "Hide Assets" : "Add Assets"} 
                onClick={() => setShowAssetInputArea(!showAssetInputArea)} 
              />
              <Button 
                text={getPositionText()} 
                onClick={cycleInputPosition} 
              />
            </div>
            
            <div className={styles.right}>
              <div className={styles.presetSection}>
                <label>Scene Presets:</label>
                <select 
                  value={currentPresetKey}
                  onChange={handlePresetChange}
                >
                  {Object.keys(presets).map(key => (
                    <option key={key} value={key}>
                      {presets[key].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {sceneConfig.assets && sceneConfig.assets.length > 0 && (
            <div className={styles.assetsList}>
              <h4>Loaded Assets:</h4>
              <div className={styles.assets}>
                {sceneConfig.assets.map((asset, index) => (
                  <div key={index} className={styles.asset}>
                    <span className={styles.assetType}>{asset.type.toUpperCase()}</span>
                    <span className={styles.assetName} title={asset.url}>{asset.name}</span>
                    <button 
                      className={styles.removeAsset}
                      onClick={() => handleRemoveAsset(index)}
                      title={`Remove ${asset.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </SceneProvider>
  );
}
