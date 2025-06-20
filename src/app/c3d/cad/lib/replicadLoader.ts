/* eslint-disable @typescript-eslint/no-explicit-any */
// This module handles the initialization of replicad with OpenCascade.js
// Following the pattern from replicad documentation

type ReplicadModule = any; // External library type from replicad

let replicadInitialized = false;
let replicadModule: ReplicadModule = null;
let initializationPromise: Promise<ReplicadModule> | null = null;

export const initializeReplicad = async (): Promise<ReplicadModule> => {
  if (replicadInitialized && replicadModule) {
    return replicadModule;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = performInitialization();
  return initializationPromise;
};

const performInitialization = async (): Promise<ReplicadModule> => {
  console.log('🔄 Replicad Loader: Starting initialization...');

  try {
    // Dynamic imports
    const [replicad, opencascade] = await Promise.all([
      import('replicad'),
      import('replicad-opencascadejs')
    ]);

    console.log('📦 Replicad Loader: Modules loaded, initializing OpenCascade...');

    // Initialize OpenCascade without config first (as per the error)
    const OC = await opencascade.default();

    console.log('🔗 Replicad Loader: Setting up replicad with OpenCascade...');
    
    // Set the OpenCascade instance in replicad
    replicad.setOC(OC);
    
    replicadModule = replicad;
    replicadInitialized = true;
    
    console.log('✅ Replicad Loader: Initialization complete!');
    return replicadModule;

  } catch (error) {
    console.error('❌ Replicad Loader: Initialization failed:', error);
    initializationPromise = null; // Reset so we can try again
    throw error;
  }
};

export const getReplicad = (): ReplicadModule => {
  if (!replicadInitialized || !replicadModule) {
    throw new Error('Replicad not initialized. Call initializeReplicad() first.');
  }
  return replicadModule;
};

export const isReplicadReady = (): boolean => {
  return replicadInitialized && replicadModule !== null;
}; 