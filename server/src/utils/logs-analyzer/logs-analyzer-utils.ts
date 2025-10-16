import getLogger from '../logger';

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
function mapSeverityLevel(level?: number): 'warning' | 'severe' | 'critical' | undefined {
    if (level) {
        if (level === 16) {
            return 'warning';
        }
        if (level >= 17 && level <= 19) {
            return 'severe';
        }
        if (level >= 20 && level <= 24) {
            return 'critical';
        }
    }
    return undefined;
}

export { parseConcatenatedJSON, mapSeverityLevel };
