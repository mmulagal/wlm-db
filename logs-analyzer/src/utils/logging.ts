import log4js from 'log4js';
import * as fs from 'fs';
import * as path from 'path';

// Configure log4js
log4js.configure({
    appenders: {
        out: { type: 'stdout' },
        app: { type: 'file', filename: 'logs/application.log', maxLogSize: 10485760, backups: 3 } // 10MB max size, keep 3 backups
    },
    categories: {
        default: { appenders: ['out', 'app'], level: 'info' }
    }
});

const logger = log4js.getLogger();

// Purge old logs from the Logs directory
const logsDirectory = path.join(process.cwd(), 'logs-analyzer', 'Logs');
const maxLogAgeDays = 30; // Retain logs for 30 days

if (fs.existsSync(logsDirectory)) {
    const files = fs.readdirSync(logsDirectory);
    const now = Date.now();

    files.forEach(file => {
        const filePath = path.join(logsDirectory, file);
        const stats = fs.statSync(filePath);
        const fileAgeDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

        if (fileAgeDays > maxLogAgeDays) {
            fs.unlinkSync(filePath);
            logger.info(`Deleted old log file: ${file}`);
        }
    });
}

export default logger;