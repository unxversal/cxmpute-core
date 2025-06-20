'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Toaster } from 'sonner';
import { useTheme } from './hooks/useTheme';
import { useCADInitialization } from './hooks/useCADInitialization';
import styles from './page.module.css';

// Dynamically import Three.js components to avoid SSR issues
const CADViewport = dynamic(() => import('./components/CADViewport'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading 3D Viewport...</div>
});

const ToolPalette = dynamic(() => import('./components/ToolPalette'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading Tools...</div>
});

const PropertyPanel = dynamic(() => import('./components/PropertyPanel'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading Properties...</div>
});

const LayerManager = dynamic(() => import('./components/LayerManager'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading Layers...</div>
});

const FileManager = dynamic(() => import('./components/FileManager'), {
  ssr: false,
  loading: () => <div></div>
});

export default function CADEditorPage() {
  const { theme, toggleTheme } = useTheme();
  const { isInitializing, isInitialized, error, isFallbackMode } = useCADInitialization();

  return (
    <div className={styles.container} data-theme={theme}>
      {/* Menu Bar */}
      <div className={styles.menuBar}>
        <div className={styles.menuLeft}>
          <h1 className={styles.title}>C3D CAD Editor</h1>
          <nav className={styles.nav}>
            <button className={styles.navButton}>File</button>
            <button className={styles.navButton}>Edit</button>
            <button className={styles.navButton}>View</button>
            <button className={styles.navButton}>Tools</button>
            <button className={styles.navButton}>AI</button>
            <button className={styles.navButton}>Help</button>
          </nav>
        </div>
        
        <div className={styles.menuRight}>
          <button className={styles.themeToggle} onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <Suspense fallback={<div></div>}>
            <FileManager />
          </Suspense>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Left Sidebar - Tool Palette */}
        <div className={styles.leftSidebar}>
          <Suspense fallback={<div className={styles.loading}>Loading Tools...</div>}>
            <ToolPalette />
          </Suspense>
        </div>

        {/* Center Area - 3D Viewport */}
        <div className={styles.centerArea}>
          <div className={styles.viewport}>
            <Suspense fallback={<div className={styles.loading}>Loading 3D Viewport...</div>}>
              <CADViewport />
            </Suspense>
          </div>
        </div>

        {/* Right Sidebar - Properties and Layers */}
        <div className={styles.rightSidebar}>
          {/* Layer Manager */}
          <div className={styles.layerSection}>
            <Suspense fallback={<div className={styles.loading}>Loading Layers...</div>}>
              <LayerManager />
            </Suspense>
          </div>
          
          {/* Property Panel */}
          <div className={styles.propertySection}>
            <Suspense fallback={<div className={styles.loading}>Loading Properties...</div>}>
              <PropertyPanel />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span>Grid: On</span>
          <span>Snap: On</span>
          <span>Units: mm</span>
        </div>
        <div className={styles.statusRight}>
          <span>Objects: 0</span>
          <span>Selected: 0</span>
          <span>
            CAD Engine: {
              isInitializing ? '⏳ Initializing...' :
              error ? '❌ Error' :
              isFallbackMode ? '⚠️ Fallback Mode' :
              isInitialized ? '✅ Ready' : '⏸️ Not Started'
            }
          </span>
        </div>
      </div>
      
      {/* Toast Notifications */}
      <Toaster 
        theme={theme}
        position="bottom-right"
        closeButton
        richColors
      />
    </div>
  );
} 