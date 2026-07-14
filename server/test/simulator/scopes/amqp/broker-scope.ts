import { vi } from 'vitest';

type MessageHandler = (content: Buffer, ack: () => void, nack: () => void) => void | Promise<void>;

const subscriptions = new Map<string, MessageHandler>();
const published: { queue: string; content: Buffer }[] = [];

vi.mock('../../../../src/lib/amqp/broker', () => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    subscribeExternalQueue: vi.fn().mockImplementation(async (queue: string, handler: MessageHandler) => {
        subscriptions.set(queue, handler);
    }),
    publishDirect: vi.fn().mockImplementation((queue: string, content: Buffer) => {
        published.push({ queue, content });
    })
}));

function resetBroker(): void {
    subscriptions.clear();
    published.length = 0;
    vi.clearAllMocks();
}

function getPublishedMessages(queue: string): Buffer[] {
    return published.filter(p => p.queue === queue).map(p => p.content);
}

function getSubscribedHandler(queue: string): MessageHandler | undefined {
    return subscriptions.get(queue);
}

export { resetBroker, getPublishedMessages, getSubscribedHandler };
