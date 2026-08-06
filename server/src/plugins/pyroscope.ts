import Pyroscope from '@pyroscope/nodejs';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { PYROSCOPE_SERVER_ADDRESS, WLMDB } from '../utils/consts';
import getLogger from '../utils/logger';

const logger = getLogger();

const pyroscopePlugin: FastifyPluginAsync = async fastify => {
    if (!PYROSCOPE_SERVER_ADDRESS) {
        logger.info('Pyroscope profiling disabled (PYROSCOPE_SERVER_ADDRESS not set)');
        return;
    }

    try {
        Pyroscope.init({
            serverAddress: PYROSCOPE_SERVER_ADDRESS,
            appName: WLMDB,
            wall: { collectCpuTime: true },
            tags: {
                service: WLMDB,
                pod: process.env.POD_NAME || process.env.HOSTNAME || 'unknown',
                namespace: process.env.POD_NAMESPACE || 'unknown'
            }
        });

        Pyroscope.startHeapProfiling();
        Pyroscope.start();
        logger.info(`Pyroscope heap and CPU profiling initialized against ${PYROSCOPE_SERVER_ADDRESS}`);

        fastify.addHook('onClose', async () => {
            try {
                await Pyroscope.stopHeapProfiling();
                await Pyroscope.stop();
                logger.info('Pyroscope profiling stopped');
            } catch (err) {
                logger.error('Failed to stop Pyroscope profiling', err);
            }
        });
    } catch (err) {
        logger.error('Failed to initialize Pyroscope profiling', err);
    }
};

export default fp(pyroscopePlugin, { name: 'pyroscope' });
