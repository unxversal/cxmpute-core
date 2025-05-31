// source/lib/interfaces.ts
export interface DiagnosticsType {
    osType: "macOS" | "Windows" | "Linux";
    gpu?: {
        name: string;
        memory: number; // Memory in MB
        type: "integrated" | "dedicated";
        supportsCUDA: boolean;
    };
    cpu?: {
        name: string;
        cores: number;
        threads: number;
        architecture: string;
    };
    memory: {
        total: number; // Total memory in MB
        used: number; // Used memory in MB (can be 0 if not easily available)
        free: number; // Free memory in MB
    };
    storage: {
        total: number; // Total storage in MB (can be 0 if not easily available)
        used: number; // Used storage in MB (can be 0 if not easily available)
        free: number; // Free storage in MB
    };
    os: {
        name: string;
        version: string;
        architecture: string;
    };
}

export interface DeviceDiagnostics {
    compute: DiagnosticsType;
    type: "nogpu" | "gpu";
}

export interface UserSessionData {
    providerId: string;
    deviceId: string;
    username: string;
    providerAk: string;
    location: {
        country: string;
        state: string;
        city: string;
    };
    deviceName: string; // Added this field
    // installedSoftware?: { ollama?: boolean }; // Optional: if you track this
}

export interface DashboardStats {
    earningsToday: number;
    earningsTotal: number;
    referralsCount: number;
}