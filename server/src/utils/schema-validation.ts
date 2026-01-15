import { Compile } from 'typebox/compile';
// import { createAuditGroupSchema } from '../routes/schemas/audit-schema.js';
import getLogger from './logger.js';

const logger = getLogger();

// TODO: TS - Fix Any
export default function validateSchema(data: any, schema: any) {
    logger.debug('Validating schema:', data);
    const compiledSchema = Compile(schema);
    const isValid = compiledSchema.Check(data);

    if (!isValid) {
        logger.error('Schema Validation error:', [...compiledSchema.Errors(data)]);
        throw new Error('Audit schema validation failed');
    }
}
