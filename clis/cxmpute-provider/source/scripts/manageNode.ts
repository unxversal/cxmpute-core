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
    console.log("[startNode] Starting node with session:", session, "diagnostics:", diagnostics);
    pulledModelsThisSession = []; // Reset for new session
    statusCallback("Requesting service configuration from orchestrator...");
    try {
        const orchestratorStartPayload = {
            provisionId: session.deviceId,
            providerAk: session.providerAk,
            availableResources: diagnostics,
        };
        console.log("[startNode] Sending orchestratorStartPayload:", orchestratorStartPayload);
        const orchestratorResponse = await requestServicesFromOrchestrator(orchestratorStartPayload);
        console.log("[startNode] Received orchestratorResponse:", orchestratorResponse);
        statusCallback(`Orchestrator assigned services: ${orchestratorResponse.services.join(', ')}`);

        const servicesToRunOnSidecar: any[] = []; // Will be 'ollama', 'embeddings', 'tts', 'scrape'
        const modelsToPull: { name: string, type: 'llm' | 'embedding' }[] = [];

        // Determine which core services and specific models to enable/pull
        // This logic mimics Tauri App.tsx
        const filteredServices = orchestratorResponse.services.filter(serviceName => {
            console.log("[startNode] Processing serviceName:", serviceName);

            // Handle embedding services like "/embeddings:nomic-embed-text"
            if (serviceName.startsWith('/embeddings:')) {
                const modelName = serviceName.split(':')[1];
                if (!modelName) {
                    console.warn(`[startNode] Invalid embedding service format: ${serviceName}`);
                    return false;
                }
                console.log("[startNode] Identified embedding service with model:", modelName);
                if (embeddingModelsList.includes(modelName)) {
                    modelsToPull.push({ name: modelName, type: 'embedding' });
                if (!servicesToRunOnSidecar.includes('embeddings')) servicesToRunOnSidecar.push('embeddings');
                return true;
                } else {
                    console.warn(`[startNode] Embedding model ${modelName} not in supported list`);
                    return false;
                }
            }
            
            // Handle direct LLM model names like "deepseek-r1:7b"
            else if (chatCompletionModelsList.includes(serviceName)) {
                console.log("[startNode] Identified chatCompletion model:", serviceName);
                modelsToPull.push({ name: serviceName, type: 'llm' });
                if (!servicesToRunOnSidecar.includes('ollama')) servicesToRunOnSidecar.push('ollama');
                return true;
            }
            
            // Handle other services
            else {
                const cleanedServiceName = serviceName.startsWith('/') ? serviceName.substring(1) : serviceName;
                
                if (['tts', 'scrape'].includes(cleanedServiceName)) {
                console.log("[startNode] Identified core service:", cleanedServiceName);
                if (!servicesToRunOnSidecar.includes(cleanedServiceName)) servicesToRunOnSidecar.push(cleanedServiceName);
                return true;
            }
            else if (cleanedServiceName === 'ollama' && !servicesToRunOnSidecar.includes('ollama')) {
                console.log("[startNode] Identified generic ollama service");
                servicesToRunOnSidecar.push('ollama');
                return true;
            }
            else if (cleanedServiceName === 'embeddings' && !servicesToRunOnSidecar.includes('embeddings')) {
                console.log("[startNode] Identified generic embeddings service");
                servicesToRunOnSidecar.push('embeddings');
                return true;
                }
            }

            console.warn(`[startNode] Service ${serviceName} from orchestrator is not recognized or not supported by CLI.`);
            return false;
        });

        console.log("[startNode] servicesToRunOnSidecar:", servicesToRunOnSidecar);
        console.log("[startNode] modelsToPull:", modelsToPull);
        console.log("[startNode] filteredServices:", filteredServices);

        // Pull necessary Ollama models
        for (const model of modelsToPull) {
            statusCallback(`Pulling ${model.type} model: ${model.name}... (this may take a while)`);
            try {
                // Check if model already exists locally
                let modelExists = false;
                try {
                    console.log(`[startNode] Checking if model exists locally: ${model.name}`);
                    await ollama.show({model: model.name});
                    modelExists = true;
                    statusCallback(`Model ${model.name} already exists locally.`);
                } catch (e) {
                    console.log(`[startNode] Model ${model.name} does not exist locally, will pull.`);
                }

                if (!modelExists) {
                    console.log(`[startNode] Pulling model: ${model.name}`);
                    const pullStream = await ollama.pull({ model: model.name, stream: true });
                    for await (const part of pullStream) {
                        let progressMessage = `Pulling ${model.name}: ${part.status}`;
                        if (part.digest) {
                             progressMessage += ` ${part.completed && part.total ? Math.round((part.completed / part.total) * 100) + '%' : ''}`;
                        }
                        statusCallback(progressMessage);
                        console.log(`[startNode] ${progressMessage}`);
                    }
                    statusCallback(`Successfully pulled model: ${model.name}`);
                    console.log(`[startNode] Successfully pulled model: ${model.name}`);
                }
                pulledModelsThisSession.push(model.name);
                console.log(`[startNode] Added model to pulledModelsThisSession: ${model.name}`);
            } catch (error: any) {
                statusCallback(`Failed to pull model ${model.name}: ${error.message}`);
                console.error(`[startNode] Failed to pull model ${model.name}:`, error);
            }
        }

        const servicesForSidecar = servicesToRunOnSidecar.map(s => s.startsWith('/') ? s.substring(1) : s);
        console.log("[startNode] Starting local services with:", servicesForSidecar);
        statusCallback("Starting local services...");
        const serverResult = await startLocalServer({
            enabledServices: servicesForSidecar as any, // Cast as server/index.ts expects specific types
            // port: customPort, // if you want to specify a port
        });
        console.log("[startNode] Local services started. serverResult:", serverResult);
        statusCallback(`Local services running. Public URL: ${serverResult.url}`);

        // Callback to orchestrator
        statusCallback("Notifying orchestrator of successful start...");
        console.log("[startNode] Notifying orchestrator of successful start...");
        await sendStartCallbackToOrchestrator({
            provisionId: session.deviceId,
            providerAk: session.providerAk,
            startedServices: filteredServices, // Send the original filtered list orchestrator decided on
            providedUrl: serverResult.url,
            // Removed llmModels and embeddingsModels as server doesn't expect them
        });
        statusCallback("Node is online and connected to Cxmpute Cloud!");
        console.log("[startNode] Node is online and connected to Cxmpute Cloud!");

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
        console.error("Error stopping local server during cleanup:", serverStopError);
    }

    // Delete models pulled during this session
    if (pulledModelsThisSession.length > 0) {
        // statusCallback is not available here, log to console
        console.log("Cleaning up pulled Ollama models...");
        for (const modelName of pulledModelsThisSession) {
            try {
                await ollama.delete({ model: modelName });
                console.log(`Deleted model: ${modelName}`);
            } catch (deleteError: any) {
                console.warn(`Failed to delete model ${modelName}: ${deleteError.message}`);
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
            console.log("Successfully notified orchestrator of node shutdown.");
        } catch (orchestratorError: any) {
            console.error("Failed to notify orchestrator of node end:", orchestratorError.message);
        }
    }
}


export async function stopNode(session: UserSessionData | null): Promise<{ success: boolean; message?: string }> {
    // statusCallback("Stopping Cxmpute Node..."); // Not available here, App.tsx handles this message
    try {
        await stopNodeIfNeeded(session);
        // statusCallback("Node stopped successfully.");
        return { success: true };
    } catch (error: any) {
        console.error("Error during node stop sequence:", error);
        // statusCallback(`Node stop failed: ${error.message}`);
        return { success: false, message: error.message };
    }
}