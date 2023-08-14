import getLogger from './logger.js';

const logger = getLogger();

// TODO: TS - Fix Any
export default function validateSchema(data: any, schema: any, allowUnknown = false) {
    logger.debug('Validating schema:', data);

    const result = schema.validate(data, { allowUnknown });

    if (result.error) {
        logger.error('Schema Validation error:', result.error);

        throw result.error;
    }
}
