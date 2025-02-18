import { spawn } from 'child_process';
import getLogger from './logger';

let PrismaClient: typeof import('@prisma/client').PrismaClient;

// added both condition to work for local & demo simulator
if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
    PrismaClient = (await import('../../__mocks__/@prisma/client')).PrismaClient;
} else {
    PrismaClient = (await import('@prisma/client')).PrismaClient;
}

const logger = getLogger();

const prisma = { client: new PrismaClient() };
async function initializeDatabase() {
    prisma.client = new PrismaClient();
}

// Function to sanitize user input
function sanitizeInput(input: string): string {
    return input.replace(/(["'$`\\])/g, '\\$1');
}

// Function to validate user input
function validateInput(input: string): boolean {
    return /^[a-zA-Z0-9_/.\s]+$/.test(input);
}

async function execute(command: string, args: string[], timeout?: number, cwd?: string) {
    logger.info('Executing command:', { command, args, timeout, cwd });

    if (!validateInput(command) || !args.every(validateInput)) {
        throw new Error('Invalid command input');
    }

    return new Promise((resolve, reject) => {
        const child = spawn(command, args.map(sanitizeInput), { cwd, timeout });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', data => {
            stdout += data;
        });

        child.stderr.on('data', data => {
            stderr += data;
        });

        child.on('close', code => {
            if (code !== 0) {
                logger.error('Failed to execute shell commands', { code, stderr });
                reject(new Error(`Command to spawn failed with exit code ${code}`));
                return;
            }
            resolve(stdout);
        });

        child.on('error', error => {
            logger.error('Spawn failed to execute shell commands', error);
            reject(error);
        });
    });
}

export { prisma, execute, initializeDatabase };
