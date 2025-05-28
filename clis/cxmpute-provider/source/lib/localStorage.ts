// source/lib/localStorage.ts
import { LocalStorage } from 'node-localstorage';
import type { DeviceDiagnostics, UserSessionData, DashboardStats } from './interfaces.js';
import os from 'os';
import path from 'path';
import fs from 'fs';

const storageDir = path.join(os.homedir(), '.cxmpute-provider-cli');

let localStorageInstance: LocalStorage;

export function initLocalStorage() {
    if (!localStorageInstance) {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
        localStorageInstance = new LocalStorage(storageDir);
    }
}

const USER_SESSION_KEY = 'userSession';
export function getUserSession(): UserSessionData | null {
    initLocalStorage();
    const data = localStorageInstance.getItem(USER_SESSION_KEY);
    console.log("getUserSession", data);
    return data ? JSON.parse(data) : null;
}
export function setUserSession(session: UserSessionData): void {
    initLocalStorage();
    localStorageInstance.setItem(USER_SESSION_KEY, JSON.stringify(session));
}
export function clearUserSession(): void {
    initLocalStorage();
    localStorageInstance.removeItem(USER_SESSION_KEY);
}

const DIAGNOSTICS_KEY = 'deviceDiagnostics';
export function getDiagnosticsData(): DeviceDiagnostics | null {
    initLocalStorage();
    const data = localStorageInstance.getItem(DIAGNOSTICS_KEY);
    console.log("getDiagnosticsData", data);
    return data ? JSON.parse(data) : null;
}
export function setDiagnosticsData(diagnostics: DeviceDiagnostics): void {
    initLocalStorage();
    localStorageInstance.setItem(DIAGNOSTICS_KEY, JSON.stringify(diagnostics));
    console.log("setDiagnosticsData", diagnostics);
}

const DASHBOARD_STATS_KEY = 'dashboardStats';
export function getDashboardStats(): DashboardStats | null {
    initLocalStorage();
    const data = localStorageInstance.getItem(DASHBOARD_STATS_KEY);
    console.log("getDashboardStats", data);
    return data ? JSON.parse(data) : null;
}
export function setDashboardStats(stats: DashboardStats): void {
    initLocalStorage();
    localStorageInstance.setItem(DASHBOARD_STATS_KEY, JSON.stringify(stats));
    console.log("setDashboardStats", stats);
}