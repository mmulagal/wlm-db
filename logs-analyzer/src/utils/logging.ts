import log4js from 'log4js';
import { readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// Configure log4js
log4js.configure({
    appenders: {
        app: { type: 'file', filename: 'logs/application.log', maxLogSize: 10485760, backups: 3 } // 10MB max size, keep 3 backups
    },
    categories: {
        default: { appenders: ['app'], level: 'info' }
    }
});

const logger = log4js.getLogger();

// Purge old logs from the Logs directory
const logsDirectory = join(process.cwd(), 'logs-analyzer', 'Logs');
const maxLogAgeDays = 30; // Retain logs for 30 days

if (existsSync(logsDirectory)) {
    const files = readdirSync(logsDirectory);
    const now = Date.now();

    files.forEach(file => {
        const filePath = join(logsDirectory, file);
        const stats = statSync(filePath);
        const fileAgeDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

        if (fileAgeDays > maxLogAgeDays) {
            unlinkSync(filePath);
            logger.info(`Deleted old log file: ${file}`);
        }
    });
}

export default logger;
