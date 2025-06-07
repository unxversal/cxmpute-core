// runs initial diagnostics and stores with node-localstorage// source/scripts/runDiagnostics.ts
import os from 'os';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import type { DeviceDiagnostics, DiagnosticsType } from '../lib/interfaces.js';
import { setDiagnosticsData, getDiagnosticsData } from '../lib/localStorage.js';

const exec = promisify(execCallback);

async function getMacOSInfo(): Promise<Partial<DiagnosticsType>> {
    try {
        const { stdout: memBytes } = await exec('sysctl -n hw.memsize');
        const totalMemoryMB = Math.round(parseInt(memBytes.trim(), 10) / 1048576);

        let gpuMemoryMB: number | null = null;
        try {
            const { stdout: gpuInfo } = await exec("system_profiler SPDisplaysDataType | grep -i 'VRAM (Total)' | head -n 1 | awk '{print $3}'");
            // Sometimes it's "VRAM (Total): 4 GB", sometimes "VRAM (dynamic,max): 1536 MB"
            // This parsing is a bit fragile.
            const gpuMatch = gpuInfo.match(/(\d+)\s*(MB|GB)/i);
            if (gpuMatch && gpuMatch[1] && gpuMatch[2]) {
                const val = parseInt(gpuMatch[1], 10);
                gpuMemoryMB = gpuMatch[2].toUpperCase() === 'GB' ? val * 1024 : val;
            }
             if (gpuMemoryMB === null) { // Fallback for different VRAM reporting
                const { stdout: gpuInfo2 } = await exec("system_profiler SPDisplaysDataType | grep -i 'VRAM (MB):' | head -n 1 | awk '{print $NF}'");
                const parsedGpu = parseInt(gpuInfo2.trim(), 10);
                if (!isNaN(parsedGpu)) gpuMemoryMB = parsedGpu;
            }
        } catch (e) {
            // console.warn("Could not determine GPU VRAM on macOS:", e);
            gpuMemoryMB = null; // Default to null if command fails
        }


        const { stdout: storageInfo } = await exec("df -m / | tail -1 | awk '{print $4}'");
        const freeStorageMB = parseInt(storageInfo.trim(), 10);

        const { stdout: osName } = await exec('sw_vers -productName');
        const { stdout: osVersion } = await exec('sw_vers -productVersion');

        return {
            osType: "macOS",
            memory: { total: totalMemoryMB, used: 0, free: totalMemoryMB }, // used can be hard to get easily
            storage: { total: 0, used: 0, free: freeStorageMB }, // total/used can be hard
            os: { name: osName.trim(), version: osVersion.trim(), architecture: os.arch() },
            ...(gpuMemoryMB !== null && {
                gpu: {
                    name: "Apple GPU", // Generic, more specific detection is harder
                    memory: gpuMemoryMB,
                    type: "integrated", // Usually true for Apple Silicon, could be dedicated for Intel Macs
                    supportsCUDA: false, // Apple doesn't support CUDA
                },
            }),
        };
    } catch (error) {
        console.error("Error getting macOS info:", error);
        throw new Error("Failed to get macOS diagnostics.");
    }
}

async function getLinuxInfo(): Promise<Partial<DiagnosticsType>> {
    try {
        const { stdout: memInfo } = await exec("grep MemTotal /proc/meminfo | awk '{print $2}'");
        const totalMemoryMB = Math.round(parseInt(memInfo.trim(), 10) / 1024);

        let gpuMemoryMB: number | null = null;
        // Getting GPU VRAM on Linux reliably via CLI without specific drivers/tools (nvidia-smi, rocm-smi) is hard.
        // This is a common place for 'null'.
        // For NVIDIA:
        try {
            const { stdout: nvidiaSmi } = await exec("nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits");
            gpuMemoryMB = parseInt(nvidiaSmi.trim(), 10);
        } catch (e) {
            // nvidia-smi not found or failed
        }
        // For AMD (less standard, might need lspci and other tools to infer):
        // if (gpuMemoryMB === null) { /* try other methods */ }


        const { stdout: storageInfo } = await exec("df -m / | tail -1 | awk '{print $4}'");
        const freeStorageMB = parseInt(storageInfo.trim(), 10);

        let osName = "Linux";
        let osVersion = "";
        try {
            const { stdout: osRelease } = await exec("grep PRETTY_NAME /etc/os-release | cut -d= -f2 | tr -d '\"'");
            osName = osRelease.trim();
        } catch (e) {
             try { // Fallback for other Linux distros
                const { stdout: lsbRelease } = await exec("lsb_release -ds");
                osName = lsbRelease.trim();
            } catch (e2) { /* console.warn("Could not determine Linux distribution name."); */ }
        }
        try {
            const {stdout: kernelVer } = await exec("uname -r");
            osVersion = kernelVer.trim();
        } catch(e) { /* console.warn("Could not determine Linux kernel version."); */ }


        return {
            osType: "Linux",
            memory: { total: totalMemoryMB, used: 0, free: totalMemoryMB },
            storage: { total: 0, used: 0, free: freeStorageMB },
            os: { name: osName, version: osVersion, architecture: os.arch() },
            ...(gpuMemoryMB !== null && {
                gpu: {
                    name: "Unknown GPU", // Needs more specific detection
                    memory: gpuMemoryMB,
                    type: "dedicated", // Assumption, could be integrated
                    supportsCUDA: true, // Potentially, if NVIDIA
                },
            }),
        };
    } catch (error) {
        console.error("Error getting Linux info:", error);
        throw new Error("Failed to get Linux diagnostics.");
    }
}

async function getWindowsInfo(): Promise<Partial<DiagnosticsType>> {
    try {
        // PowerShell is generally more reliable and provides structured data
        const psTotalMem = "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory";
        const { stdout: memBytesStr } = await exec(`powershell -Command "${psTotalMem}"`);
        const totalMemoryMB = Math.round(parseInt(memBytesStr.trim(), 10) / (1024 * 1024));

        let gpuMemoryMB: number | null = null;
        try {
            // This gets the sum of dedicated VRAM for all GPUs. If multiple, might need adjustment.
            const psGpuMem = "(Get-CimInstance Win32_VideoController | Measure-Object -Property AdapterRAM -Sum).Sum";
            const { stdout: gpuBytesStr } = await exec(`powershell -Command "${psGpuMem}"`);
            if (gpuBytesStr && gpuBytesStr.trim() !== "") {
                 gpuMemoryMB = Math.round(parseInt(gpuBytesStr.trim(), 10) / (1024 * 1024));
            }
        } catch (e) {
            // console.warn("Could not determine GPU VRAM on Windows via PowerShell Sum:", e);
            // Fallback to WMI if PowerShell method fails or for more detail
            try {
                const { stdout: wmicGpu } = await exec("wmic path win32_VideoController get AdapterRAM | findstr /r /v \"^$\" | more +1");
                const firstGpuRam = wmicGpu.trim().split(/\s*\r?\n/)[0]; // Get first line of numbers
                if (firstGpuRam) {
                    gpuMemoryMB = Math.round(parseInt(firstGpuRam.trim(), 10) / (1024 * 1024));
                }
            } catch (e2) {
                // console.warn("Could not determine GPU VRAM on Windows via WMIC:", e2);
            }
        }


        const psFreeDisk = "(Get-PSDrive C).Free";
        const { stdout: freeBytesStr } = await exec(`powershell -Command "${psFreeDisk}"`);
        const freeStorageMB = Math.round(parseInt(freeBytesStr.trim(), 10) / (1024 * 1024));

        const psOsInfo = "(Get-CimInstance Win32_OperatingSystem).Caption";
        const { stdout: osName } = await exec(`powershell -Command "${psOsInfo}"`);
        const psOsVer = "(Get-CimInstance Win32_OperatingSystem).Version";
        const { stdout: osVersion } = await exec(`powershell -Command "${psOsVer}"`);


        return {
            osType: "Windows",
            memory: { total: totalMemoryMB, used: 0, free: totalMemoryMB },
            storage: { total: 0, used: 0, free: freeStorageMB },
            os: { name: osName.trim(), version: osVersion.trim(), architecture: os.arch() },
            ...(gpuMemoryMB !== null && {
                gpu: {
                    name: "Unknown GPU",
                    memory: gpuMemoryMB,
                    type: "dedicated", // Assumption
                    supportsCUDA: true, // Potentially, if NVIDIA
                },
            }),
        };
    } catch (error) {
        console.error("Error getting Windows info:", error);
        throw new Error("Failed to get Windows diagnostics.");
    }
}


export async function runDiagnosticsScript(): Promise<DeviceDiagnostics> {
    const cachedDiagnostics = getDiagnosticsData();
    if (cachedDiagnostics) {
        // console.log("CLI: Using cached diagnostics.");
        return cachedDiagnostics;
    }
    // console.log("CLI: Running fresh diagnostics...");

    let platformInfo: Partial<DiagnosticsType> = {};
    const currentPlatform = os.platform();

    if (currentPlatform === 'darwin') { // macOS
        platformInfo = await getMacOSInfo();
    } else if (currentPlatform === 'linux') {
        platformInfo = await getLinuxInfo();
    } else if (currentPlatform === 'win32') { // Windows
        platformInfo = await getWindowsInfo();
    } else {
        throw new Error(`Unsupported platform: ${currentPlatform}`);
    }

    // Ensure all required fields have fallbacks if not set by platform-specific functions
    const fullDiagnostics: DeviceDiagnostics = {
        compute: {
            osType: platformInfo.osType || (currentPlatform === 'darwin' ? "macOS" : currentPlatform === 'win32' ? "Windows" : "Linux"),
            memory: platformInfo.memory || { total: 0, used: 0, free: 0 },
            storage: platformInfo.storage || { total: 0, used: 0, free: 0 },
            os: platformInfo.os || { name: "Unknown", version: "Unknown", architecture: os.arch() },
            cpu: platformInfo.cpu || { name: os.cpus()[0]?.model || "Unknown CPU", cores: os.cpus().length, threads: os.cpus().length, architecture: os.arch() }, // Basic CPU info
            gpu: platformInfo.gpu, // Will be undefined if not determined
        },
        type: platformInfo.gpu && platformInfo.gpu.memory > 0 ? "gpu" : "nogpu",
    };

    setDiagnosticsData(fullDiagnostics);
            // Diagnostics complete and cached
    return fullDiagnostics;
}

// Helper to be used by Dashboard or App.tsx if needed (moved from App.tsx placeholder)
export function determineVRAMTierString(vramMB: number | undefined | null): string {
    if (vramMB === null || vramMB === undefined) return "Unknown Tier (No VRAM info)";
    if (vramMB < 1024) return "Basic (Tier 0 - <1GB VRAM)"; // Adding a tier for very low VRAM
    if (vramMB < 4096) return "Tide Pool (Tier 1 - 1-4GB VRAM)";
    if (vramMB < 8192) return "Blue Surf (Tier 2 - 4-8GB VRAM)";
    if (vramMB < 22528) return "Open Ocean (Tier 3 - 8-22GB VRAM)";
    return "Mariana Depth (Tier 4 - 22GB+ VRAM)";
}