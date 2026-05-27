import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { sendEmail } from '../../../src/operations/aws/ses-operations';

const sesMock = mockClient(SESv2Client);

vi.mock('../../../src/lib/aws/ses', () => ({
    getSES: vi.fn().mockResolvedValue(new SESv2Client({ region: 'us-east-1' }))
}));

describe('ses-operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesMock.reset();
        sesMock.on(SendEmailCommand).resolves({
            MessageId: 'test-message-id-123'
        });
    });

    describe('sendEmail', () => {
        it('should send an email successfully', async () => {
            const from = 'sender@example.com';
            const to = ['recipient@example.com'];
            const subject = 'Test Subject';
            const content = '<p>Test HTML content</p>';

            await expect(sendEmail(from, to, subject, content)).resolves.not.toThrow();

            const calls = sesMock.commandCalls(SendEmailCommand);
            expect(calls.length).toBe(1);
            const { input } = calls[0].args[0];
            expect(input.FromEmailAddress).toMatch(/sender@example\.com/);
            expect(input.Destination?.ToAddresses).toEqual(to);
            // SESv2 RawMessage.Data is typed Uint8Array in the AWS SDK; Buffer is a Node subclass
            // of Uint8Array, so this assertion accepts either the nodemailer Buffer output today
            // or a plain Uint8Array if a future nodemailer release switches representations.
            expect(input.Content?.Raw?.Data).toBeInstanceOf(Uint8Array);
        });

        it('should send an email with attachments', async () => {
            const from = 'sender@example.com';
            const to = ['recipient@example.com'];
            const subject = 'Test with Attachment';
            const content = '<p>Test HTML content with attachment</p>';
            const attachments = [
                {
                    filename: 'test.txt',
                    content: 'Hello World'
                }
            ];

            await expect(sendEmail(from, to, subject, content, attachments)).resolves.not.toThrow();

            const calls = sesMock.commandCalls(SendEmailCommand);
            expect(calls.length).toBe(1);
            // SESv2 RawMessage.Data is typed Uint8Array in the AWS SDK. `Buffer.from(uint8array)`
            // accepts either a real Buffer (nodemailer's current output) or a plain Uint8Array
            // (possible after future nodemailer / AWS SDK upgrades) without a `.toString()` cast
            // on a raw Uint8Array — which would return a comma-separated byte list, not text.
            const rawData = calls[0].args[0].input.Content?.Raw?.Data;
            expect(rawData).toBeInstanceOf(Uint8Array);
            const raw = Buffer.from(rawData as Uint8Array).toString('utf8');
            expect(raw).toMatch(/test\.txt/);
        });

        it('should send an email to multiple recipients', async () => {
            const from = 'sender@example.com';
            const to = ['recipient1@example.com', 'recipient2@example.com'];
            const subject = 'Multi-recipient Test';
            const content = '<p>Multi-recipient email</p>';

            await expect(sendEmail(from, to, subject, content)).resolves.not.toThrow();

            const calls = sesMock.commandCalls(SendEmailCommand);
            expect(calls[0].args[0].input.Destination?.ToAddresses).toEqual(to);
        });

        it('should surface the SES error name and message when sending fails', async () => {
            sesMock.reset();
            const sesError = Object.assign(new Error('Email address is not verified.'), {
                name: 'MessageRejected'
            });
            sesMock.on(SendEmailCommand).rejects(sesError);

            const from = 'sender@example.com';
            const to = ['recipient@example.com'];
            const subject = 'Test Subject';
            const content = '<p>Test HTML content</p>';

            await expect(sendEmail(from, to, subject, content)).rejects.toThrow(
                /Failed to send email \(MessageRejected\)/
            );
        });

        it('should fall back to a generic identifier when the SES error has no name', async () => {
            sesMock.reset();
            const bareError = new Error('something went wrong');
            Object.assign(bareError, { name: '' });
            sesMock.on(SendEmailCommand).rejects(bareError);

            await expect(
                sendEmail('sender@example.com', ['recipient@example.com'], 'Subject', '<p>x</p>')
            ).rejects.toThrow(/Failed to send email \(UnknownSesError\)/);
        });
    });
});
