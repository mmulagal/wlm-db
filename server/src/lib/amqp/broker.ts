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
}

const state: BrokerState = {
    connection: null,
    channel: null,
    subscriptions: new Map(),
    reconnectDelay: AMQP_RECONNECT_INTERVAL,
    reconnecting: false,
    shuttingDown: false
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

async function teardown() {
    const { channel, connection } = state;
    state.channel = null;
    state.connection = null;

    if (channel) {
        channel.removeAllListeners('error');
        channel.removeAllListeners('close');
        try {
            logger.debug('AMQP: teardown — closing channel');
            await channel.close();
        } catch (err) {
            logger.debug('AMQP: teardown — channel close failed', { err });
        }
    }

    if (connection) {
        connection.removeAllListeners('error');
        connection.removeAllListeners('close');
        try {
            logger.debug('AMQP: teardown — closing connection');
            await connection.close();
        } catch (err) {
            logger.debug('AMQP: teardown — connection close failed', { err });
        }
    }
}

/**
 * Guards against concurrent reconnect attempts and no-ops if the broker is
 * shutting down. On each attempt: opens a connection, creates a channel with
 * prefetch, and re-registers all known subscriptions. Connection and channel
 * close events call `connectLoop` directly, eliminating the mutual dependency
 * between a separate `establishConnection` and `scheduleReconnect`. Resets
 * `state.reconnecting` on exit.
 */
async function connectLoop(): Promise<void> {
    if (state.reconnecting || state.shuttingDown) {
        logger.debug('AMQP: connectLoop — skipped', {
            reconnecting: state.reconnecting,
            shuttingDown: state.shuttingDown
        });
        return;
    }
    state.reconnecting = true;
    try {
        while (!state.shuttingDown) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await teardown();

                logger.info('AMQP: connecting', { host: AMQP_HOST, port: AMQP_PORT });
                // eslint-disable-next-line no-await-in-loop
                const conn = await amqpConnect(buildAmqpUrl(), { clientProperties: { connection_name: 'wlm-db' } });
                conn.on('error', err => logger.error('AMQP: connection error', { err }));
                conn.on('close', () => {
                    logger.warn('AMQP: connection closed — scheduling reconnect');
                    state.connection = null;
                    state.channel = null;
                    connectLoop();
                });
                state.connection = conn;

                // eslint-disable-next-line no-await-in-loop
                const ch = await conn.createChannel();
                ch.prefetch(AMQP_PREFETCH);
                logger.debug('AMQP: channel prefetch set', { prefetch: AMQP_PREFETCH });
                ch.on('error', err => logger.error('AMQP: channel error', { err }));
                ch.on('close', () => {
                    logger.warn('AMQP: channel closed — scheduling reconnect');
                    state.channel = null;
                    connectLoop();
                });
                state.channel = ch;
                logger.debug('AMQP: channel ready', { prefetch: AMQP_PREFETCH });

                state.reconnectDelay = AMQP_RECONNECT_INTERVAL;
                logger.info('AMQP: connected', { host: AMQP_HOST });

                if (state.subscriptions.size > 0) {
                    logger.debug('AMQP: resubscribing', { count: state.subscriptions.size });
                    // eslint-disable-next-line no-await-in-loop
                    await Promise.all(
                        Array.from(state.subscriptions.entries()).map(async ([queue, handler]) => {
                            await ch.consume(queue, wrapHandler(queue, ch, handler));
                            logger.info('AMQP: resubscribed', { queue });
                        })
                    );
                }

                return;
            } catch (err) {
                if (err instanceof Error && /ACCESS.REFUSED|403|authentication/i.test(err.message)) {
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
        logger.info('AMQP: shutting down, giving up on reconnect');
    } finally {
        state.reconnecting = false;
    }
}

/**
 * Starts the broker: clears the shutdown flag and begins the connection loop.
 * Resolves once the first successful connection and channel are established.
 * Call `close()` to stop.
 */
async function connect(): Promise<void> {
    state.shuttingDown = false;
    await connectLoop();
}

async function close(): Promise<void> {
    logger.info('AMQP: closing');
    state.shuttingDown = true;
    try {
        logger.debug('AMQP: close — closing channel');
        await state.channel?.close();
    } catch (err) {
        logger.error('AMQP: error closing channel', { err });
    }
    try {
        logger.debug('AMQP: close — closing connection');
        await state.connection?.close();
    } catch (err) {
        logger.error('AMQP: error closing connection', { err });
    }
    state.channel = null;
    state.connection = null;
    logger.info('AMQP: closed');
}

/**
 * Registers a handler for the given queue and starts consuming messages.
 * Duplicate subscriptions to the same queue are silently ignored.
 * The handler is also stored so it can be automatically re-registered
 * on reconnect without any action from the caller.
 */
async function subscribeExternalQueue(queueName: string, handler: MessageHandler): Promise<void> {
    logger.debug('AMQP: subscribeExternalQueue', { queue: queueName });
    if (state.subscriptions.has(queueName)) {
        logger.warn('AMQP: already subscribed, ignoring duplicate subscribe', { queue: queueName });
        return;
    }
    if (!state.channel) {
        throw new Error('AMQP: no open channel');
    }
    state.subscriptions.set(queueName, handler);
    await state.channel.consume(queueName, wrapHandler(queueName, state.channel, handler));
    logger.info('AMQP: subscribed', { queue: queueName });
}

function publishDirect(queueName: string, content: Buffer): void {
    const { channel } = state;
    if (!channel) {
        logger.error('AMQP: publishDirect called with no open channel', { queue: queueName });
        return;
    }
    channel.sendToQueue(queueName, content, { persistent: true });
    logger.debug('AMQP: publishDirect — sent', { queue: queueName, bytes: content.byteLength });
}

export { connect, close, subscribeExternalQueue, publishDirect };
