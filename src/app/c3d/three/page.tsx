"use client"

import Button from "@/components/button/button";
import styles from "./three.module.css";
import { RenderScene } from "@/components/three/CanvasRenderer";
import { useState, useRef } from "react";
import { SceneProvider } from "@/components/three/context/SceneContext";
import { presets } from "@/components/three/presets";
import { SceneConfig } from "@/components/three/types/scene";

export default function ThreePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const assetUrlRef = useRef<HTMLInputElement>(null);
  const [currentPreset, setCurrentPreset] = useState<string>("morphingSpheres");
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(presets[currentPreset]);
  const [inputCentered, setInputCentered] = useState<boolean>(false);
  const [showAssetInput, setShowAssetInput] = useState<boolean>(false);

  const handlePresetChange = (preset: string) => {
    setCurrentPreset(preset);
    setSceneConfig(presets[preset]);
  };

  const handleCapture = (blob: Blob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      console.log('Screenshot captured:', base64data.slice(0, 50) + '...');
    };
    reader.readAsDataURL(blob);
  };

  const handleSubmit = () => {
    const prompt = inputRef.current?.value;
    if (!prompt) return;

    // Here you would send the prompt to your AI service
    // For now, we'll just log it
    console.log('Prompt:', prompt);

    // Clear input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleAddAsset = () => {
    const assetUrl = assetUrlRef.current?.value;
    if (!assetUrl) return;

    // Determine asset type based on URL extension
    const extension = assetUrl.split('.').pop()?.toLowerCase();
    let assetType: 'image' | 'hdri' | 'glb' | 'gltf' = 'image';
    
    if (extension === 'hdr' || extension === 'exr') {
      assetType = 'hdri';
    } else if (extension === 'glb') {
      assetType = 'glb';
    } else if (extension === 'gltf') {
      assetType = 'gltf';
    }

    // Add asset to scene config
    const newAsset = {
      type: assetType,
      url: assetUrl,
      name: `Asset ${(sceneConfig.assets?.length || 0) + 1}`
    };

    setSceneConfig(prev => ({
      ...prev,
      assets: [...(prev.assets || []), newAsset]
    }));

    // Clear input
    if (assetUrlRef.current) {
      assetUrlRef.current.value = '';
    }
  };

  const toggleInputPosition = () => {
    setInputCentered(!inputCentered);
  };

  const getPresetCategories = () => {
    const categories: { [key: string]: string[] } = {
      'Hero Examples': [],
      'Classic': [],
      'Advanced': []
    };

    Object.keys(presets).forEach(key => {
      if (['morphingSpheres', 'floatingIslands', 'crystalCavern', 'techShowcase', 'organicFlow'].includes(key)) {
        categories['Hero Examples'].push(key);
      } else if (['neonWaves', 'cosmicDust'].includes(key)) {
        categories['Classic'].push(key);
      } else {
        categories['Advanced'].push(key);
      }
    });

    return categories;
  };

  const categories = getPresetCategories();

  return (
    <SceneProvider>
      <main className={styles.main}>
        <div className={styles.content}>
          <RenderScene sceneConfig={sceneConfig} onCapture={handleCapture} />
        </div>
        <div className={`${styles.inputContainer} ${inputCentered ? styles.centered : ''}`}>
          <div className={styles.input}>
            <input 
              ref={inputRef}
              placeholder="Describe your scene..."
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          
          {showAssetInput && (
            <div className={styles.assetInput}>
              <input 
                ref={assetUrlRef}
                placeholder="Enter asset URL (images, HDR, GLB/GLTF)..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddAsset()}
              />
              <Button text="Add Asset" onClick={handleAddAsset} />
            </div>
          )}

          <div className={styles.buttons}>
            <div className={styles.left}>
              <Button text="Generate" onClick={handleSubmit} />
              <Button 
                text={showAssetInput ? "Hide Assets" : "Add Assets"} 
                onClick={() => setShowAssetInput(!showAssetInput)} 
              />
              <Button 
                text={inputCentered ? "Move Left" : "Center Input"} 
                onClick={toggleInputPosition} 
              />
            </div>
            
            <div className={styles.right}>
              <div className={styles.presetSection}>
                <label>Scene Presets:</label>
                <div className={styles.presetCategories}>
                  {Object.entries(categories).map(([categoryName, presetKeys]) => (
                    <div key={categoryName} className={styles.presetCategory}>
                      <span className={styles.categoryLabel}>{categoryName}</span>
                      <select 
                        value={presetKeys.includes(currentPreset) ? currentPreset : ''}
                        onChange={(e) => e.target.value && handlePresetChange(e.target.value)}
                      >
                        <option value="">Select {categoryName}...</option>
                        {presetKeys.map(key => (
                          <option key={key} value={key}>
                            {presets[key].name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {sceneConfig.assets && sceneConfig.assets.length > 0 && (
            <div className={styles.assetsList}>
              <h4>Added Assets:</h4>
              <div className={styles.assets}>
                {sceneConfig.assets.map((asset, index) => (
                  <div key={index} className={styles.asset}>
                    <span className={styles.assetType}>{asset.type.toUpperCase()}</span>
                    <span className={styles.assetName}>{asset.name}</span>
                    <button 
                      className={styles.removeAsset}
                      onClick={() => {
                        setSceneConfig(prev => ({
                          ...prev,
                          assets: prev.assets?.filter((_, i) => i !== index)
                        }));
                      }}
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
