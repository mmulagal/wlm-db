import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { sendEmail } from '../../../src/operations/aws/ses-operations';

// Mock the SES client before importing the operations
const sesMock = mockClient(SESv2Client);

// Mock the getSES function to return our mocked client
vi.mock('../../../src/lib/aws/ses', () => ({
    getSES: vi.fn().mockResolvedValue(new SESv2Client({ region: 'us-east-1' }))
}));

describe('ses-operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesMock.reset();
        // Mock SendEmailCommand - nodemailer uses this command via the transporter
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

            // Verify the mock was called
            const calls = sesMock.calls();
            expect(calls.length).toBeGreaterThan(0);
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
        });

        it('should send an email to multiple recipients', async () => {
            const from = 'sender@example.com';
            const to = ['recipient1@example.com', 'recipient2@example.com'];
            const subject = 'Multi-recipient Test';
            const content = '<p>Multi-recipient email</p>';

            await expect(sendEmail(from, to, subject, content)).resolves.not.toThrow();
        });

        it('should throw error when SES fails', async () => {
            sesMock.reset();
            sesMock.on(SendEmailCommand).rejects(new Error('SES Error'));

            const from = 'sender@example.com';
            const to = ['recipient@example.com'];
            const subject = 'Test Subject';
            const content = '<p>Test HTML content</p>';

            await expect(sendEmail(from, to, subject, content)).rejects.toThrow('Something went wrong');
        });
    });
});
