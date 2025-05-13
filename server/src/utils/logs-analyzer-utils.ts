import getLogger from './logger';

const logger = getLogger();

export function parseConcatenatedJSON(input: string): object[] {
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
