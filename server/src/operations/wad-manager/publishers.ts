import { publishDirect } from '../../lib/amqp/broker';
import getLogger from '../../utils/logger';
import {
    FixResultMessage,
    FixStatusMessage,
    ScanStatusMessage,
    WAD_FIX_RESULTS_QUEUE,
    WAD_FIX_STATUS_QUEUE,
    WAD_SCAN_RESULTS_QUEUE,
    WAD_SCAN_STATUS_QUEUE,
    WadScanResultRecord
} from '../../utils/wad-consts';

const logger = getLogger();

function publish(queue: string, msg: unknown): void {
    try {
        const json = JSON.stringify(msg);
        logger.debug('WAD: publishing message', { queue, sizeBytes: Buffer.byteLength(json, 'utf8') });
        publishDirect(queue, Buffer.from(json));
    } catch (err) {
        logger.error('WAD: failed to publish', { queue, err: err instanceof Error ? err.message : String(err) });
    }
}

function publishScanStatus(msg: ScanStatusMessage): void {
    publish(WAD_SCAN_STATUS_QUEUE, msg);
    logger.info('WAD: published scan status', { taskId: msg.taskId, status: msg.status, accountId: msg.accountId });
}

function publishScanResult(msg: WadScanResultRecord): void {
    publish(WAD_SCAN_RESULTS_QUEUE, msg);
    logger.info('WAD: published scan result', {
        taskId: msg.taskId,
        accountId: msg.accountId,
        configurationId: msg.configurationId,
        resultCount: msg.resources.length,
        resources: JSON.stringify(msg.resources, null, 2) // Will be removed
    });
}

function publishFixStatus(msg: FixStatusMessage): void {
    publish(WAD_FIX_STATUS_QUEUE, msg);
    logger.info('WAD: published fix status', {
        taskId: msg.taskId,
        accountId: msg.accountId,
        configurationId: msg.configurationId,
        status: msg.status
    });
}

function publishFixResult(msg: FixResultMessage): void {
    publish(WAD_FIX_RESULTS_QUEUE, msg);
    logger.info('WAD: published fix result', {
        taskId: msg.taskId,
        accountId: msg.accountId,
        configurationId: msg.configurationId,
        parentResourceId: msg.parentResourceId,
        resultCount: msg.resourceResults.length
    });
}

export { publishScanStatus, publishScanResult, publishFixStatus, publishFixResult };
