import getLogger from '../logger';
import { MSSQL_SEVERITY_RANGE, SEVERITIES } from './logs-analyzer-consts';

const logger = getLogger();

function parseConcatenatedJSON(input: string): object[] {
    logger.debug('Parsing concatenated JSON objects');
    try {
        // Split the input into separate JSON objects using a regex
        const jsonObjects = input.split(/(?<=})\s*(?={)/);

        // Parse each JSON object and return the results as an array
        return jsonObjects.map(jsonString => JSON.parse(jsonString));
    } catch (error) {
        logger.error('Error parsing concatenated JSON:', error);
        throw error;
    }
}

// Map SQL Server severity level (16-24) to high-level category used by UI
function mapSeverityLevel(level: number) {
    if (
        level >= MSSQL_SEVERITY_RANGE[SEVERITIES.IMPORTANT].start &&
        level <= MSSQL_SEVERITY_RANGE[SEVERITIES.IMPORTANT].end
    ) {
        return SEVERITIES.IMPORTANT;
    }
    if (
        level >= MSSQL_SEVERITY_RANGE[SEVERITIES.SEVERE].start &&
        level <= MSSQL_SEVERITY_RANGE[SEVERITIES.SEVERE].end
    ) {
        return SEVERITIES.SEVERE;
    }
    if (
        level >= MSSQL_SEVERITY_RANGE[SEVERITIES.CRITICAL].start &&
        level <= MSSQL_SEVERITY_RANGE[SEVERITIES.CRITICAL].end
    ) {
        return SEVERITIES.CRITICAL;
    }
}

export { parseConcatenatedJSON, mapSeverityLevel };
