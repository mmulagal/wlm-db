import { exec } from 'child_process';
import { PrismaClient } from '@prisma/client';
import getLogger from './logger';

const logger = getLogger();

const prisma = { client: new PrismaClient() };
async function initializeDatabase() {
    prisma.client = new PrismaClient();

    prisma.client.$use(async (params, next) => {
        const before = Date.now();

        const result = await next(params);

        const after = Date.now();

        logger.debug(`Query ${params.model}.${params.action} took ${after - before}ms`);

        return result;
    });
}

async function execute(command: string, timeout?: number, cwd?: string) {
    logger.info('Executing command:', { command, timeout, cwd });

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
