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
export const embeddingModelsList: string[] = [ /* ... your list ... */ ];
export const chatCompletionModelsList: string[] = [ /* ... your list ... */ ];

interface StartNodeResult {
    success: boolean;
    url?: string; // Tunnelmole URL
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
            // Example: if 'ollama' service is assigned, it implies chat models.
            // If a specific model name (e.g., 'nomic-embed-text') is assigned, that's an embedding model.
            // Adjust this logic based on how your orchestrator actually assigns services vs. models.
            // For now, assuming orchestrator sends model names directly if they are services,
            // or a generic service type like 'ollama' (for chat) or 'embeddings' (for general embedding service).

            // This filtering is simplified. Your orchestrator might return:
            // services: ["chat", "embeddings-nomic-embed-text", "tts"]
            // OR services: ["ollama", "embeddings"], models: { llm: ["llama3"], embedding: ["nomic-embed-text"] }
            // The current server/index.ts expects 'ollama', 'embeddings', 'tts', 'scrape'.

            if (embeddingModelsList.includes(serviceName)) {
                modelsToPull.push({ name: serviceName, type: 'embedding' });
                if (!servicesToRunOnSidecar.includes('embeddings')) servicesToRunOnSidecar.push('embeddings');
                return true; // Keep it in filteredServices for callback
            } else if (chatCompletionModelsList.includes(serviceName)) {
                modelsToPull.push({ name: serviceName, type: 'llm' });
                if (!servicesToRunOnSidecar.includes('ollama')) servicesToRunOnSidecar.push('ollama');
                return true; // Keep it in filteredServices for callback
            } else if (['tts', 'scrape'].includes(serviceName)) {
                if (!servicesToRunOnSidecar.includes(serviceName)) servicesToRunOnSidecar.push(serviceName);
                return true;
            }
            // Add more sophisticated logic if orchestrator sends 'ollama' as a service name
            // and then you need to pick default chat models or specific ones.
            // For now, if 'ollama' is in orchestratorResponse.services, we add it.
            else if (serviceName === 'ollama' && !servicesToRunOnSidecar.includes('ollama')) {
                 servicesToRunOnSidecar.push('ollama');
                 // If 'ollama' service implies pulling some default chat models, add them to modelsToPull here.
                 // e.g., modelsToPull.push({name: 'llama3', type: 'llm'});
                 return true;
            }
             else if (serviceName === 'embeddings' && !servicesToRunOnSidecar.includes('embeddings')) {
                 servicesToRunOnSidecar.push('embeddings');
                 // Similar for default embedding models if 'embeddings' is generic
                 return true;
            }


            // console.warn(`Service ${serviceName} from orchestrator is not recognized or not supported by CLI.`);
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
                    // Model does not exist, proceed to pull
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
                // Decide if this is a critical failure or if the node can start with missing models
                // For now, we'll let it proceed, but it might affect service availability.
                // throw new Error(`Failed to pull model ${model.name}: ${error.message}`);
            }
        }

        statusCallback("Starting local services...");
        const serverResult = await startLocalServer({
            enabledServices: servicesToRunOnSidecar as any, // Cast as server/index.ts expects specific types
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
            llmModels: modelsToPull.filter(m => m.type === 'llm').map(m => m.name),
            embeddingsModels: modelsToPull.filter(m => m.type === 'embedding').map(m => m.name),
        });
        statusCallback("Node is online and connected to Cxmpute Cloud!");

        return { success: true, url: serverResult.url };

    } catch (error: any) {
        console.error("Error during node start sequence:", error);
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