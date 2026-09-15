import { connect as amqpConnect, type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import {
    AMQP_HOST,
    AMQP_PORT,
    AMQP_PREFETCH,
    AMQP_RECONNECT_INTERVAL,
    AMQP_SCHEMA,
    AMQP_USER,
    AMQP_RECONNECT_MAX_DELAY,
    AMQP_RECONNECT_BACKOFF
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { SECRETS } from '../../utils/consts';
import { sleep } from '../../utils/utils';

const logger = getLogger();

interface BrokerState {
    connection: ChannelModel | null;
    channel: Channel | null;
    subscriptions: Map<string, MessageHandler>;
    reconnectDelay: number;
    reconnecting: boolean;
    shuttingDown: boolean;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
}

const state: BrokerState = {
    connection: null,
    channel: null,
    subscriptions: new Map(),
    reconnectDelay: AMQP_RECONNECT_INTERVAL,
    reconnecting: false,
    shuttingDown: false,
    reconnectTimer: null
};

/**
 * Handler called for each message on a subscribed queue.
 * Call `ack()` to acknowledge successful processing.
 * Call `nack()` to reject without requeue (sends to DLQ if configured).
 */
type MessageHandler = (content: Buffer, ack: () => void, nack: () => void) => void | Promise<void>;

function buildAmqpUrl(): string {
    const user = encodeURIComponent(AMQP_USER);
    const password = encodeURIComponent(SECRETS.AMQP_PASSWORD || '');
    return `${AMQP_SCHEMA}://${user}:${password}@${AMQP_HOST}:${AMQP_PORT}`;
}

function isAuthFailure(err: unknown): boolean {
    return err instanceof Error && /ACCESS.REFUSED|403|authentication/i.test(err.message);
}

/**
 * Adapts a `MessageHandler` to the raw amqplib callback signature.
 * Extracts `content`, `ack`, and `nack` from the raw message so handlers
 * never touch amqplib internals directly. Any throw or rejection from the
 * handler automatically nacks the message, preventing it from getting stuck.
 */
function wrapHandler(queue: string, ch: Channel, handler: MessageHandler) {
    return async (msg: ConsumeMessage | null): Promise<void> => {
        if (!msg) {
            logger.warn('AMQP: consumer cancelled by broker', { queue });
            return;
        }
        const { content } = msg;
        logger.debug('AMQP: message received', { queue, bytes: content.byteLength });
        const ack = () => ch.ack(msg);
        const nack = () => ch.nack(msg, false, false);
        try {
            await handler(content, ack, nack);
        } catch (err) {
            logger.error('AMQP: handler failed, nacking message', { queue, err });
            nack();
        }
    };
}

const onConnectionError = (err: Error) => logger.error('AMQP: connection error', { err });
const onChannelError = (err: Error) => logger.error('AMQP: channel error', { err });
const onConnectionClose = () => {
    logger.warn('AMQP: connection close event');
    scheduleReconnect('connection');
};
const onChannelClose = () => {
    logger.warn('AMQP: channel close event');
    scheduleReconnect('channel');
};

function clearReconnectTimer(): void {
    if (state.reconnectTimer) {
        logger.info('AMQP: clearing pending reconnect timer');
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
    }
}

/**
 * Captures local refs before clearing state so listeners can be detached even
 * if a close handler raced us. Close handlers must not null `state` themselves.
 */
async function teardown(reason = 'unspecified'): Promise<void> {
    const { channel, connection } = state;
    if (!channel && !connection) {
        return;
    }
    logger.info('AMQP: teardown start', {
        reason,
        hasChannel: Boolean(channel),
        hasConnection: Boolean(connection)
    });
    state.channel = null;
    state.connection = null;

    if (channel) {
        channel.removeListener('error', onChannelError);
        channel.removeListener('close', onChannelClose);
        try {
            logger.info('AMQP: teardown — closing channel', { reason });
            await channel.close();
            logger.info('AMQP: teardown — channel closed', { reason });
        } catch (err) {
            // Already-dead channels reject with IllegalOperationError; nothing left to close.
            logger.info('AMQP: teardown — channel close skipped', {
                reason,
                err: err instanceof Error ? err.message : err
            });
        }
    }

    if (connection) {
        connection.removeListener('error', onConnectionError);
        connection.removeListener('close', onConnectionClose);
        try {
            logger.info('AMQP: teardown — closing connection', { reason });
            await connection.close();
            logger.info('AMQP: teardown — connection closed', { reason });
        } catch (err) {
            logger.info('AMQP: teardown — connection close skipped', {
                reason,
                err: err instanceof Error ? err.message : err
            });
        }
    }

    logger.info('AMQP: teardown done', { reason });
}

/**
 * One connect attempt: teardown leftovers, open a connection and channel, then
 * re-register consumers. Connection `close` is attached only after success so
 * a failed `createChannel` does not start a second reconnect chain.
 */
async function establishConnection(): Promise<void> {
    let stage = 'teardown';
    try {
        await teardown('establishConnection');

        stage = 'amqpConnect';
        logger.info('AMQP: connecting', { host: AMQP_HOST, port: AMQP_PORT });
        const conn = await amqpConnect(buildAmqpUrl(), { clientProperties: { connection_name: 'wlm-db' } });
        conn.on('error', onConnectionError);
        state.connection = conn;
        logger.info('AMQP: connection opened', { host: AMQP_HOST, port: AMQP_PORT });

        stage = 'createChannel';
        const ch = await conn.createChannel();
        ch.prefetch(AMQP_PREFETCH);
        ch.on('error', onChannelError);
        ch.on('close', onChannelClose);
        state.channel = ch;
        logger.info('AMQP: channel ready', { prefetch: AMQP_PREFETCH });

        stage = 'resubscribe';
        for (const [queue, handler] of [...state.subscriptions]) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await ch.consume(queue, wrapHandler(queue, ch, handler));
                logger.info('AMQP: resubscribed', { queue });
            } catch (err) {
                state.subscriptions.delete(queue);
                logger.error('AMQP: resubscribe failed, dropping subscription', { queue, err });
            }
        }

        stage = 'ready';
        state.reconnectDelay = AMQP_RECONNECT_INTERVAL;
        conn.on('close', onConnectionClose);
        state.reconnecting = false;
        logger.info('AMQP: connected', { host: AMQP_HOST, subscriptionCount: state.subscriptions.size });
    } catch (err) {
        logger.error('AMQP: establishConnection failed', { stage, err });
        throw err;
    }
}

/**
 * Dedupes connection+channel close events, tears down the old sockets, then
 * schedules a delayed reconnect. Logs only when this call actually owns the
 * reconnect (skipped closes are warn-level so they show at the default log
 * level).
 */
function scheduleReconnect(reason: string): void {
    if (state.shuttingDown) {
        logger.warn('AMQP: close ignored, shutting down', { reason });
        return;
    }
    if (state.reconnecting) {
        logger.warn('AMQP: reconnect already in progress, ignoring close', { reason });
        return;
    }
    state.reconnecting = true;
    logger.warn('AMQP: closed — scheduling reconnect', { reason, delayMs: state.reconnectDelay });

    teardown('scheduleReconnect')
        .then(() => {
            if (state.shuttingDown) {
                logger.warn('AMQP: abort reconnect, shutting down after teardown', { reason });
                state.reconnecting = false;
                return;
            }

            clearReconnectTimer();
            const delayMs = state.reconnectDelay;
            logger.info('AMQP: reconnect timer armed', { reason, delayMs });
            state.reconnectTimer = setTimeout(() => {
                state.reconnectTimer = null;
                logger.info('AMQP: reconnect timer fired', { reason });
                establishConnection()
                    .then(() => {
                        logger.info('AMQP: reconnect succeeded', { reason });
                    })
                    .catch(err => {
                        state.reconnecting = false;
                        if (isAuthFailure(err)) {
                            logger.error('AMQP: auth failure — not retrying', { err });
                            return;
                        }
                        logger.error('AMQP: reconnect attempt failed, will retry', {
                            err,
                            delayMs: state.reconnectDelay
                        });
                        state.reconnectDelay = Math.min(
                            state.reconnectDelay * AMQP_RECONNECT_BACKOFF,
                            AMQP_RECONNECT_MAX_DELAY
                        );
                        scheduleReconnect('retry');
                    });
            }, delayMs);
        })
        .catch(err => {
            logger.error('AMQP: teardown before reconnect failed', { err, reason });
            state.reconnecting = false;
            scheduleReconnect('teardown-failed');
        });
}

/**
 * Starts the broker: clears the shutdown flag and retries until the first
 * successful connection and channel are established. Call `close()` to stop.
 */
async function connect(): Promise<void> {
    state.shuttingDown = false;
    state.reconnecting = true;
    logger.info('AMQP: initial connect starting', { host: AMQP_HOST, port: AMQP_PORT });
    try {
        while (!state.shuttingDown) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await establishConnection();
                logger.info('AMQP: initial connect succeeded');
                return;
            } catch (err) {
                if (isAuthFailure(err)) {
                    logger.error('AMQP: auth failure — not retrying', { err });
                    throw err;
                }
                logger.error('AMQP: connect attempt failed, retrying', { err, delayMs: state.reconnectDelay });
                // eslint-disable-next-line no-await-in-loop
                await sleep(state.reconnectDelay);
                state.reconnectDelay = Math.min(
                    state.reconnectDelay * AMQP_RECONNECT_BACKOFF,
                    AMQP_RECONNECT_MAX_DELAY
                );
            }
        }
        logger.warn('AMQP: shutting down, giving up on reconnect');
    } finally {
        if (!state.channel) {
            state.reconnecting = false;
            logger.warn('AMQP: initial connect exiting without a channel');
        }
    }
}

async function close(): Promise<void> {
    logger.info('AMQP: closing');
    state.shuttingDown = true;
    clearReconnectTimer();
    try {
        await teardown('close');
    } catch (err) {
        logger.error('AMQP: error during close', { err });
    }
    logger.info('AMQP: closed');
}

/**
 * Registers a handler for the given queue and starts consuming messages.
 * Duplicate subscriptions to the same queue are silently ignored.
 * The handler is also stored so it can be automatically re-registered
 * on reconnect without any action from the caller.
 */
async function subscribeExternalQueue(queueName: string, handler: MessageHandler): Promise<void> {
    logger.info('AMQP: subscribeExternalQueue', { queue: queueName });
    if (state.subscriptions.has(queueName)) {
        logger.warn('AMQP: already subscribed, ignoring duplicate subscribe', { queue: queueName });
        return;
    }
    if (!state.channel) {
        logger.error('AMQP: subscribe failed, no open channel', { queue: queueName });
        throw new Error(`AMQP: no open channel for queue ${queueName}`);
    }
    state.subscriptions.set(queueName, handler);
    try {
        await state.channel.consume(queueName, wrapHandler(queueName, state.channel, handler));
    } catch (err) {
        state.subscriptions.delete(queueName);
        logger.error('AMQP: consume failed', { queue: queueName, err });
        throw err;
    }
    logger.info('AMQP: subscribed', { queue: queueName });
}

function publishDirect(queueName: string, content: Buffer): void {
    const { channel } = state;
    if (!channel) {
        logger.warn('AMQP: publishDirect skipped, no channel', {
            queue: queueName,
            bytes: content.byteLength,
            reconnecting: state.reconnecting,
            shuttingDown: state.shuttingDown
        });
        return;
    }
    channel.sendToQueue(queueName, content, { persistent: true });
    logger.debug('AMQP: publishDirect — sent', { queue: queueName, bytes: content.byteLength });
}

export { connect, close, subscribeExternalQueue, publishDirect };
