import opentelemetry from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import getLogger from './logger';
import { SIGNOZ_ENDPOINT, APP_NAME } from './consts';

const logger = getLogger();
// import {diag, DiagConsoleLogger, DiagLogLevel} from '@opentelemetry/api';
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const traceExporter = new OTLPTraceExporter({ url: SIGNOZ_ENDPOINT });
const sdk = new opentelemetry.NodeSDK({
    traceExporter: traceExporter,
    instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation()],
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: APP_NAME
    })
});

export async function initiateTracer() {
    try {
        await sdk.start();
        logger.log('Tracing initialized');
        process.on('SIGTERM', async () => {
            try {
                await sdk.shutdown();
                logger.log('Tracing terminated');
            } catch (error) {
                logger.log('Error terminating tracing', error);
            } finally {
                process.exit(0);
            }
        });
    } catch (err) {
        logger.log('Error initializing tracing', err);
    }
}
