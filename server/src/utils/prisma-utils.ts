import { exec } from 'child_process';
import getLogger from './logger';

let PrismaClient: typeof import('@prisma/client').PrismaClient;
let prismaClientModule: any;

// Lazy load the appropriate PrismaClient based on environment
async function getPrismaClientModule() {
    if (prismaClientModule) {
        return prismaClientModule;
    }

    // added both condition to work for local & demo simulator
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        prismaClientModule = await import('../../__mocks__/@prisma/client');
    } else {
        prismaClientModule = await import('@prisma/client');
    }
    return prismaClientModule;
}

const logger = getLogger();

const prisma = { client: null as unknown as InstanceType<typeof PrismaClient> };

async function initializeDatabase() {
    // Delay instantiation until initializeDatabase is called (after secrets are loaded)
    if (!prisma.client) {
        const module = await getPrismaClientModule();
        PrismaClient = module.PrismaClient;
        prisma.client = new PrismaClient();
    }
}

// Function to validate user input
function validateInput(input: string): boolean {
    return /^[a-zA-Z0-9_./:\-\s]+$/.test(input);
}

async function execute(command: string, timeout?: number, cwd?: string) {
    logger.info('Executing command:', { command, timeout, cwd });

    if (!validateInput(command)) {
        throw new Error('Invalid command input');
    }

    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        exec(command, { cwd, timeout }, (error: any, stdout: any, stderr: any) => {
            const err = error ?? stderr;
            if (err) {
                logger.error('Failed to execute shell commands', err);
                return reject(err instanceof Error ? err : new Error(err));
            }
            resolve(stdout);
        });
    });
}

export { prisma, execute, initializeDatabase };
