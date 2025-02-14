import { exec } from 'child_process';
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

async function execute(command: string, timeout?: number, cwd?: string) {
    logger.info('Executing command:', { command, timeout, cwd });

    command = sanitizeInput(command);
    return new Promise(resolve => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        exec(command, { cwd, timeout }, (error: any, stdout: any, stderr: any) => {
            if (error) {
                logger.error('Failed to execute shell commands', error);
            }
            resolve(stdout || stderr);
        });
    });
}

export { prisma, execute, initializeDatabase };
