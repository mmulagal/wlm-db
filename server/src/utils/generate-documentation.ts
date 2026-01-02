import fs from 'node:fs/promises';
import path from 'path';
import { groupBy, toPairs } from 'lodash-es';
import YAML from 'yaml';
import { app } from '../index';
import getLogger from './logger';

const logger = getLogger();

interface OpenApiSpec {
    paths: Record<string, Record<string, { summary?: string }>>;
}

function validateApiSummaries(spec: string): void {
    const { paths = {} } = YAML.parse(spec) as OpenApiSpec;

    const endpoints = Object.entries(paths).flatMap(([apiPath, methods]) =>
        Object.entries(methods)
            .filter(([, op]) => op?.summary)
            .map(([method, op]) => ({
                endpoint: `${method.toUpperCase()} ${apiPath}`,
                summary: op.summary!.toLowerCase()
            }))
    );

    const duplicates = toPairs(groupBy(endpoints, 'summary')).filter(([, items]) => items.length > 1);

    if (duplicates.length === 0) {
        logger.info('API summary validation passed');
        return;
    }

    logger.warn(`${'-'.repeat(100)}`);
    logger.warn('DUPLICATE API SUMMARIES DETECTED');
    logger.warn(`${'-'.repeat(100)}`);

    for (const [summary, items] of duplicates) {
        logger.warn(`Summary: "${summary}"`);
        items.forEach(({ endpoint }) => logger.warn(`  - ${endpoint}`));
    }

    logger.warn(`${'-'.repeat(100)}`);
    process.exit(1);
}

await app.ready();
const response = app.swagger({
    yaml: true
});
await fs.writeFile(path.join(process.cwd(), 'documentation.yaml'), response);
validateApiSummaries(response);
process.exit(0);
