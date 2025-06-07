// source/lib/api.ts
import type { DeviceDiagnostics, DashboardStats } from './interfaces.js';

// Ensure your .env file has this or define it directly
const CXMPUTE_API_BASE_URL = process.env['CXMPUTE_API_URL'] || 'https://cxmpute.cloud/api';

interface RegisterDevicePayload {
    deviceDiagnostics: DeviceDiagnostics;
    providerId: string;
    providerAk: string;
    provisionId: string;
    location: {
        country: string;
        state: string;
        city: string;
    };
    username: string;
    deviceName: string;
    registrationSecret: string;
}

interface RegisterDeviceResponse {
    success: boolean;
    message?: string;
    deviceId?: string; // Expect the backend to return the generated deviceId
    // any other relevant fields from the backend
}

// Orchestrator API interfaces (from your Tauri app's App.tsx)
// interface RerunDiagnosticsPayload {
//     deviceDiagnostics: DeviceDiagnostics;
//     // location if it can be updated
// }
interface OrchestratorStartPayload {
    provisionId: string; // This is our deviceId
    providerAk: string;
    availableResources: DeviceDiagnostics;
    // llmModels?: string[]; // These were part of Tauri, might not be needed from CLI if orchestrator decides
    // embeddingsModels?: string[];
}
interface OrchestratorStartResponse {
    services: string[]; // Services to run on the sidecar/server
    // Potentially other parameters the orchestrator wants to send
}
interface OrchestratorCallbackPayload {
    provisionId: string;
    providerAk: string;
    startedServices: string[];
    providedUrl: string;
    // Removed llmModels and embeddingsModels - server doesn't expect them
}
interface OrchestratorEndPayload {
    provisionId: string;
    providerAk: string;
}


export async function registerDevice(payload: Omit<RegisterDevicePayload, 'registrationSecret'>): Promise<RegisterDeviceResponse> {
    // Try to get secret from embedded config first, fallback to env var
    let registrationSecret: string | undefined;
    
    try {
        // Try to import embedded config (will exist in built binaries)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const configModule = require('./config');
        registrationSecret = configModule.EMBEDDED_CONFIG?.providerSecret;
    } catch {
        // Fallback to environment variable for development
        registrationSecret = process.env['CXMPUTE_PROVIDER_SECRET'];
    }
    
    if (!registrationSecret) {
        return { 
            success: false, 
            message: "Missing provider credentials. This CLI requires proper authentication. Contact support@cxmpute.cloud for access." 
        };
    }

    // Validate secret format (basic check)
    if (registrationSecret.length < 32) {
        return {
            success: false,
            message: "Invalid provider credentials format. Please verify your installation."
        };
    }

    try {
        // Add secret to payload
        const securePayload: RegisterDevicePayload = {
            ...payload,
            registrationSecret
        };

        const response = await fetch(`${CXMPUTE_API_BASE_URL}/v1/providers/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(securePayload),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            // Provide helpful error messages for common authentication issues
            if (response.status === 401) {
                throw new Error("Invalid provider credentials. Please verify your CXMPUTE_PROVIDER_SECRET.");
            }
            throw new Error(errorData.message || `Registration failed with status: ${response.status}`);
        }

        const res = await response.json();
        return res as RegisterDeviceResponse;
    } catch (error: any) {
        return { success: false, message: error.message || "Network error during registration." };
    }
}

export async function fetchEarnings(providerId: string): Promise<DashboardStats> {
    try {
        const response = await fetch(`${CXMPUTE_API_BASE_URL}/providers/${providerId}/earnings`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${providerAk}` // If API key is passed as a bearer token
                // Or if it's a custom header:
                // 'X-Provider-AK': providerAk
            },
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message || `Failed to fetch earnings: ${response.status}`);
        }
        
        const data = await response.json() as { 
            total: number; 
            earnings: { day: string; amount: number }[]; 
            referralsCount: number 
        };

        // Transform to DashboardStats
        const today = new Date().toISOString().split('T')[0];
        const todaysEarningEntry = data.earnings.find(e => e.day === today);

        return {
            earningsTotal: data.total,
            earningsToday: todaysEarningEntry ? todaysEarningEntry.amount : 0,
            referralsCount: data.referralsCount || 0,
        };
    } catch (error: any) {
        console.error('Failed to fetch earnings:', error.message);
        // Return a default or error-indicating structure
        return { earningsToday: 0, earningsTotal: 0, referralsCount: 0 };
    }
}

// // --- Orchestrator API Calls ---

// export async function notifyOrchestratorRerun(providerId: string, deviceId: string, payload: RerunDiagnosticsPayload): Promise<void> {
//     // This API endpoint might not exist or might be different.
//     // This is based on the `/api/providers/${providerID}/${deviceID}/rerun` from Tauri.
//     // Adjust URL and method as per your actual orchestrator API.
//     // For now, this is a placeholder.
//     await new Promise(resolve => setTimeout(resolve, 300)); // Simulate call
//     // const response = await fetch(`${CXMPUTE_API_BASE_URL}/providers/${providerId}/${deviceId}/rerun`, {
//     //     method: 'POST',
//     //     headers: { 'Content-Type': 'application/json' },
//     //     body: JSON.stringify(payload),
//     // });
//     // if (!response.ok) throw new Error("Failed to notify orchestrator of rerun");
// }


export async function requestServicesFromOrchestrator(payload: OrchestratorStartPayload): Promise<OrchestratorStartResponse> {
    const response = await fetch(`${CXMPUTE_API_BASE_URL}/v1/providers/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Orchestrator start request failed: ${errText || response.statusText}`);
    }

    const res = await response.json();
    
    return res as OrchestratorStartResponse;
}

export async function sendStartCallbackToOrchestrator(payload: OrchestratorCallbackPayload): Promise<void> {
    const response = await fetch(`${CXMPUTE_API_BASE_URL}/v1/providers/start/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Orchestrator callback failed: ${errText || response.statusText}`);
    }
}

export async function notifyOrchestratorEnd(payload: OrchestratorEndPayload): Promise<void> {
    const response = await fetch(`${CXMPUTE_API_BASE_URL}/v1/providers/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Orchestrator end notification failed: ${errText || response.statusText}`);
    }
}