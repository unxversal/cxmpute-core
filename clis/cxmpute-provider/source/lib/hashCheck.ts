import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

/**
 * Calculates SHA-256 of the provided file (hex string).
 */
function sha256File(filePath: string): string {
    const buf = readFileSync(filePath);
    return createHash('sha256').update(buf).digest('hex');
}

/**
 * Verifies integrity of the currently executing CLI bundle.
 * Exits the process with code 1 if verification fails.
 */
export function verifyIntegrity(): void {
    try {
        // Resolve path of the root CLI file (dist/cli.js when running from build)
        const currentFile = fileURLToPath(import.meta.url);

        // dist/cli.js lives two directories up from lib/hashCheck.js (../..)
        const rootCliPath = path.resolve(path.dirname(currentFile), '..', 'cli.js');

        const calculated = sha256File(rootCliPath);

        // Use createRequire to synchronously load the generated config file generated during build
        const requireFunc = createRequire(import.meta.url);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { EMBEDDED_CONFIG } = requireFunc('./config.js') as { EMBEDDED_CONFIG: { expectedHash?: string } };
        const expected = EMBEDDED_CONFIG.expectedHash;

        // Skip check in dev builds where hash hasn't been embedded yet
        if (!expected || expected.startsWith('__')) {
            return;
        }

        if (calculated !== expected) {
            console.error('✖ Integrity check failed – the CLI build appears to be modified.');
            console.error(`Expected: ${expected}\nActual:   ${calculated}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('✖ Integrity verification error:', (error as Error).message);
        process.exit(1);
    }
} 