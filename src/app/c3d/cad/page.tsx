'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { Toaster } from 'sonner';
import { Loader, HelpCircle, X, Keyboard, Mouse, Grid } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useCADInitialization } from './hooks/useCADInitialization';
import styles from './page.module.css';

// Dynamically import Three.js components to avoid SSR issues
const CADViewport = dynamic(() => import('./components/CADViewport'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Loader className={styles.spinner} size={24} />
      <span>Loading 3D Viewport...</span>
    </div>
  )
});

const ToolPalette = dynamic(() => import('./components/ToolPalette'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Loader className={styles.spinner} size={20} />
      <span>Loading Tools...</span>
    </div>
  )
});

const PropertyPanel = dynamic(() => import('./components/PropertyPanel'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Loader className={styles.spinner} size={20} />
      <span>Loading Properties...</span>
    </div>
  )
});

const LayerManager = dynamic(() => import('./components/LayerManager'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Loader className={styles.spinner} size={20} />
      <span>Loading Layers...</span>
    </div>
  )
});

const FileManager = dynamic(() => import('./components/FileManager'), {
  ssr: false,
  loading: () => <div></div>
});

// Help Modal Component
function HelpModal({ isOpen, onClose, theme }: { isOpen: boolean; onClose: () => void; theme: string }) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} data-theme={theme}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <Keyboard size={20} />
            Keyboard Shortcuts & Controls
          </h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalContent}>
          <div className={styles.shortcutSection}>
            <h3><Mouse size={16} /> Mouse Controls</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>Left Mouse + Drag</span>
                <span>Pan view</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Right Mouse + Drag</span>
                <span>Rotate view</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Middle Mouse / Scroll</span>
                <span>Zoom in/out</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Click Object</span>
                <span>Select object (drag to move)</span>
              </div>
            </div>
          </div>
          
          <div className={styles.shortcutSection}>
            <h3><Keyboard size={16} /> Keyboard Shortcuts</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>Esc</span>
                <span>Deselect all</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Delete</span>
                <span>Delete selected objects</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Ctrl/Cmd + Z</span>
                <span>Undo</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Ctrl/Cmd + Y</span>
                <span>Redo</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>G</span>
                <span>Toggle grid</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Tab</span>
                <span>Cycle through tools</span>
              </div>
            </div>
          </div>

          <div className={styles.shortcutSection}>
            <h3><Grid size={16} /> Tool Shortcuts</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>B</span>
                <span>Box tool</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>C</span>
                <span>Cylinder tool</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>S</span>
                <span>Sphere tool</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>V</span>
                <span>Select tool</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>P</span>
                <span>Pan tool</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>R</span>
                <span>Rotate tool</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CADEditorPage() {
  const { theme, toggleTheme } = useTheme();
  const { isInitializing, isInitialized, error, isFallbackMode } = useCADInitialization();
  const [showHelp, setShowHelp] = useState(false);

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
          <Suspense fallback={
            <div className={styles.loading}>
              <Loader className={styles.spinner} size={20} />
              <span>Loading Tools...</span>
            </div>
          }>
            <ToolPalette />
          </Suspense>
        </div>

        {/* Center Area - 3D Viewport */}
        <div className={styles.centerArea}>
          <div className={styles.viewport}>
            <Suspense fallback={
              <div className={styles.loading}>
                <Loader className={styles.spinner} size={24} />
                <span>Loading 3D Viewport...</span>
              </div>
            }>
              <CADViewport />
            </Suspense>
          </div>
        </div>

        {/* Right Sidebar - Properties and Layers */}
        <div className={styles.rightSidebar}>
          {/* Layer Manager */}
          <div className={styles.layerSection}>
            <Suspense fallback={
              <div className={styles.loading}>
                <Loader className={styles.spinner} size={20} />
                <span>Loading Layers...</span>
              </div>
            }>
              <LayerManager />
            </Suspense>
          </div>
          
          {/* Property Panel */}
          <div className={styles.propertySection}>
            <Suspense fallback={
              <div className={styles.loading}>
                <Loader className={styles.spinner} size={20} />
                <span>Loading Properties...</span>
              </div>
            }>
              <PropertyPanel />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <div className={styles.statusItem}>
            <Grid size={12} />
            <span>Grid: On</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusDot}></span>
            <span>Snap: On</span>
          </div>
          <div className={styles.statusItem}>
            <span>Units: mm</span>
          </div>
        </div>
        <div className={styles.statusRight}>
          <div className={styles.statusItem}>
            <span>Objects: 0</span>
          </div>
          <div className={styles.statusItem}>
            <span>Selected: 0</span>
          </div>
          <div className={styles.statusItem}>
            <span>CAD Engine:</span>
            <div className={styles.engineStatus}>
              {isInitializing && <Loader className={styles.statusSpinner} size={12} />}
              {error && <span className={styles.statusError}>Error</span>}
              {isFallbackMode && <span className={styles.statusWarning}>Fallback Mode</span>}
              {isInitialized && !error && !isFallbackMode && <span className={styles.statusReady}>Ready</span>}
              {!isInitializing && !isInitialized && !error && <span className={styles.statusIdle}>Not Started</span>}
            </div>
          </div>
          <button 
            className={styles.helpButton}
            onClick={() => setShowHelp(true)}
            title="Keyboard Shortcuts (? key)"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>
      
      {/* Toast Notifications */}
      <Toaster 
        theme={theme}
        position="bottom-right"
        closeButton
        richColors
      />

      {/* Help Modal */}
      <HelpModal 
        isOpen={showHelp} 
        onClose={() => setShowHelp(false)} 
        theme={theme} 
      />
    </div>
  );
} 