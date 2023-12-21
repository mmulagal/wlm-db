import opentelemetry from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import pkg from '@prisma/instrumentation';
import getLogger from './logger';
import { WLMDB, SIGNOZ_ENDPOINT } from './consts';

const { PrismaInstrumentation } = pkg;
const logger = getLogger();
// import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const traceExporter = new OTLPTraceExporter({ url: SIGNOZ_ENDPOINT });
const sdk = new opentelemetry.NodeSDK({
    traceExporter,
    instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation(), new PrismaInstrumentation()],
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: WLMDB
    })
});

(async function initiateTracer() {
    try {
        sdk.start();
        logger.info('Tracing initialized');
        process.on('SIGTERM', async () => {
            try {
                await sdk.shutdown();
                logger.info('Tracing terminated');
            } catch (error) {
                logger.error('Error terminating tracing', error);
            } finally {
                process.exit(0);
            }
        });
    } catch (err) {
        logger.error('Error initializing tracing', err);
    }
})();
