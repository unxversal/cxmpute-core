// handles start/stop the node, the fetching/refreshing of the stats, and cleanup// source/scripts/manageNode.ts
import ollama from 'ollama';
import {
    requestServicesFromOrchestrator,
    sendStartCallbackToOrchestrator,
    notifyOrchestratorEnd,
    // notifyOrchestratorRerun, // If needed later
} from '../lib/api.js';
import { startLocalServer, stopLocalServer } from '../server/index.js';
import type { UserSessionData, DeviceDiagnostics } from '../lib/interfaces.js';

// Model lists from your Tauri app's utils.ts (or get from orchestrator if dynamic)
// These might be better defined in a shared constants file or received from orchestrator
export const embeddingModelsList: string[] = [
    'nomic-embed-text',
    'mxbai-embed-large',
    'all-minilm'
];
export const chatCompletionModelsList: string[] = [
    'llama3.2:1b',
    'llama3.2:3b', 
    'llama3.1:8b',
    'deepseek-r1:7b',
    'qwen2.5:7b',
    'mistral:7b',
    'codellama:7b'
];

interface StartNodeResult {
    success: boolean;
    url?: string; // ngrok URL
    message?: string;
}

// interface StopNodeParams {
//     providerId: string;
//     providerAk: string;
//     deviceId: string;
// }

// To keep track of models pulled by this session for cleanup
let pulledModelsThisSession: string[] = [];

export async function startNode(
    session: UserSessionData,
    diagnostics: DeviceDiagnostics,
    statusCallback: (message: string) => void
): Promise<StartNodeResult> {
    pulledModelsThisSession = []; // Reset for new session
    statusCallback("Requesting service configuration from orchestrator...");
    try {
        const orchestratorStartPayload = {
            provisionId: session.deviceId,
            providerAk: session.providerAk,
            availableResources: diagnostics,
        };
        const orchestratorResponse = await requestServicesFromOrchestrator(orchestratorStartPayload);
        statusCallback(`Orchestrator assigned services: ${orchestratorResponse.services.join(', ')}`);

        const servicesToRunOnSidecar: any[] = []; // Will be 'ollama', 'embeddings', 'tts', 'scrape'
        const modelsToPull: { name: string, type: 'llm' | 'embedding' }[] = [];

        // Determine which core services and specific models to enable/pull
        // This logic mimics Tauri App.tsx
        const filteredServices = orchestratorResponse.services.filter(serviceName => {
            // Handle embedding services like "/embeddings:nomic-embed-text"
            if (serviceName.startsWith('/embeddings:')) {
                const modelName = serviceName.split(':')[1];
                if (!modelName) {
                    return false;
                }
                if (embeddingModelsList.includes(modelName)) {
                    modelsToPull.push({ name: modelName, type: 'embedding' });
                if (!servicesToRunOnSidecar.includes('embeddings')) servicesToRunOnSidecar.push('embeddings');
                return true;
                } else {
                    return false;
                }
            }
            
            // Handle direct LLM model names like "deepseek-r1:7b"
            else if (chatCompletionModelsList.includes(serviceName)) {
                modelsToPull.push({ name: serviceName, type: 'llm' });
                if (!servicesToRunOnSidecar.includes('ollama')) servicesToRunOnSidecar.push('ollama');
                return true;
            }
            
            // Handle other services
            else {
                const cleanedServiceName = serviceName.startsWith('/') ? serviceName.substring(1) : serviceName;
                
                if (['tts', 'scrape'].includes(cleanedServiceName)) {
                if (!servicesToRunOnSidecar.includes(cleanedServiceName)) servicesToRunOnSidecar.push(cleanedServiceName);
                return true;
            }
            else if (cleanedServiceName === 'ollama' && !servicesToRunOnSidecar.includes('ollama')) {
                servicesToRunOnSidecar.push('ollama');
                return true;
            }
            else if (cleanedServiceName === 'embeddings' && !servicesToRunOnSidecar.includes('embeddings')) {
                servicesToRunOnSidecar.push('embeddings');
                return true;
                }
            }

            return false;
        });

        // Pull necessary Ollama models
        for (const model of modelsToPull) {
            statusCallback(`Pulling ${model.type} model: ${model.name}... (this may take a while)`);
            try {
                // Check if model already exists locally
                let modelExists = false;
                try {
                    await ollama.show({model: model.name});
                    modelExists = true;
                    statusCallback(`Model ${model.name} already exists locally.`);
                } catch (e) {
                    // Model doesn't exist locally, will pull
                }

                if (!modelExists) {
                    const pullStream = await ollama.pull({ model: model.name, stream: true });
                    for await (const part of pullStream) {
                        let progressMessage = `Pulling ${model.name}: ${part.status}`;
                        if (part.digest) {
                             progressMessage += ` ${part.completed && part.total ? Math.round((part.completed / part.total) * 100) + '%' : ''}`;
                        }
                        statusCallback(progressMessage);
                    }
                    statusCallback(`Successfully pulled model: ${model.name}`);
                }
                pulledModelsThisSession.push(model.name);
            } catch (error: any) {
                statusCallback(`Failed to pull model ${model.name}: ${error.message}`);
            }
        }

        const servicesForSidecar = servicesToRunOnSidecar.map(s => s.startsWith('/') ? s.substring(1) : s);
        statusCallback("Starting local services...");
        const serverResult = await startLocalServer({
            enabledServices: servicesForSidecar as any, // Cast as server/index.ts expects specific types
            // port: customPort, // if you want to specify a port
        });
        statusCallback(`Local services running. Public URL: ${serverResult.url}`);

        // Callback to orchestrator
        statusCallback("Notifying orchestrator of successful start...");
        await sendStartCallbackToOrchestrator({
            provisionId: session.deviceId,
            providerAk: session.providerAk,
            startedServices: filteredServices, // Send the original filtered list orchestrator decided on
            providedUrl: serverResult.url,
            // Removed llmModels and embeddingsModels as server doesn't expect them
        });
        statusCallback("Node is online and connected to Cxmpute Cloud!");

        return { success: true, url: serverResult.url };

    } catch (error: any) {
        console.error("[startNode] Error during node start sequence:", error);
        statusCallback(`Node start failed: ${error.message}`);
        // Attempt to clean up any partially started services or pulled models if necessary
        await stopNodeIfNeeded(session); // Call a more generic stop
        return { success: false, message: error.message };
    }
}


// Renamed to reflect it might be called even if startNode partially failed
async function stopNodeIfNeeded(session: UserSessionData | null): Promise<void> {
    // Stop local server
    try {
        await stopLocalServer();
    } catch (serverStopError) {
        // Continue with cleanup even if server stop fails
    }

    // Delete models pulled during this session
    if (pulledModelsThisSession.length > 0) {
        for (const modelName of pulledModelsThisSession) {
            try {
                await ollama.delete({ model: modelName });
            } catch (deleteError: any) {
                // Continue with other models if one fails to delete
            }
        }
        pulledModelsThisSession = []; // Clear the list
    }

    // Notify orchestrator if session is available (meaning we got far enough to have a deviceId)
    if (session?.deviceId && session?.providerAk) {
        try {
            await notifyOrchestratorEnd({
                provisionId: session.deviceId,
                providerAk: session.providerAk,
            });
        } catch (orchestratorError: any) {
            // Failed to notify orchestrator, but continue with shutdown
        }
    }
}


export async function stopNode(session: UserSessionData | null): Promise<{ success: boolean; message?: string }> {
    try {
        await stopNodeIfNeeded(session);
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}