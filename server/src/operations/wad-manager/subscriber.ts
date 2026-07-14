import { connect, subscribeExternalQueue } from '../../lib/amqp/broker';
import getLogger from '../../utils/logger';
import {
    FixRequestMessage,
    ScanRequestMessage,
    TaskStatus,
    WAD_FIX_REQUESTS_QUEUE,
    WAD_SCAN_REQUESTS_QUEUE,
    WAD_SERVICE_ID
} from '../../utils/wad-consts';
import { handleFixRequest, handleScanRequest } from './handlers';
import { publishFixStatus, publishScanStatus } from './publishers';

const logger = getLogger();

async function onScanMessage(content: Buffer, ack: () => void, nack: () => void): Promise<void> {
    logger.debug('WAD: scan message received', { bytes: content.byteLength });

    let req: ScanRequestMessage;
    try {
        req = JSON.parse(content.toString()) as ScanRequestMessage;
    } catch (err) {
        logger.error('WAD: malformed scan request', { err });
        nack();
        return;
    }

    const { taskId, requestId, accountId } = req;
    logger.info('WAD: scan request received', { taskId, requestId, accountId });

    publishScanStatus({
        taskId,
        requestId,
        accountId,
        serviceId: WAD_SERVICE_ID,
        updatedAt: Date.now(),
        status: TaskStatus.IN_PROGRESS
    });
    ack();
    logger.debug('WAD: scan request acked', { taskId });

    await handleScanRequest(req);
    logger.debug('WAD: scan request handled', { taskId });
}

async function onFixMessage(content: Buffer, ack: () => void, nack: () => void): Promise<void> {
    logger.debug('WAD: fix message received', { bytes: content.byteLength });

    let req: FixRequestMessage;
    try {
        req = JSON.parse(content.toString()) as FixRequestMessage;
    } catch (err) {
        logger.error('WAD: malformed fix request', { err });
        nack();
        return;
    }

    const {
        taskId,
        requestId,
        accountId,
        configurationId,
        parentResource: { id: parentResourceId }
    } = req;
    logger.info('WAD: fix request received', { taskId, requestId, accountId, configurationId, parentResourceId });

    publishFixStatus({
        taskId,
        requestId,
        accountId,
        serviceId: WAD_SERVICE_ID,
        configurationId,
        parentResourceId,
        updatedAt: Date.now(),
        status: TaskStatus.IN_PROGRESS
    });
    ack();
    logger.debug('WAD: fix request acked', { taskId, configurationId });

    await handleFixRequest(req);
    logger.debug('WAD: fix request handled', { taskId, configurationId });
}

/**
 * Opens the AMQP connection and subscribes to the WAD scan and fix request queues.
 * Connection parameters are read from AMQP_* environment variables.
 * Reconnect and re-subscribe on broker restart is handled inside lib/amqp/broker.ts.
 */
async function startWadSubscriber(): Promise<void> {
    await connect();
    logger.info('WAD: AMQP connected', { serviceId: WAD_SERVICE_ID });

    await subscribeExternalQueue(WAD_SCAN_REQUESTS_QUEUE, onScanMessage);
    await subscribeExternalQueue(WAD_FIX_REQUESTS_QUEUE, onFixMessage);

    logger.info('WAD: subscriber ready', { scanQueue: WAD_SCAN_REQUESTS_QUEUE, fixQueue: WAD_FIX_REQUESTS_QUEUE });
}

export { startWadSubscriber };
