import { ACCOUNT_ID, EMAIL_TYPES, MAX_EMAIL_ATTACHMENT_SIZE } from '../../src/utils/consts';
import processEmailRequest, { sendSavingsCalculationEmail } from '../../src/operations/notification-operations';

describe('Process email request operations', () => {
    const accountId = ACCOUNT_ID;
    const fileBuffer = Buffer.from('some file content');
    const fileName = 'test.pdf';
    const fields = { userEmail: 'test@example.com', storageType: 'ebs', hostName: 'sql01' };
    const emailType = EMAIL_TYPES.SAVINGS_CALCULATIONS;

    beforeAll(() => {
        process.env.NODE_ENV = 'demo';
    });

    it('should process email request successfully', async () => {
        const response = await processEmailRequest(accountId, fileBuffer, fileName, fields, emailType);

        expect(response).toEqual({ message: 'Email sent successfully' });
    });

    it('should throw error if file content is empty', async () => {
        await expect(processEmailRequest(accountId, null, fileName, fields, emailType)).rejects.toThrow(
            /Attachment file not found in the request/
        );
    });

    it('should throw error if file name does not contain .pdf', async () => {
        await expect(processEmailRequest(accountId, fileBuffer, 'faultyFileName', fields, emailType)).rejects.toThrow(
            /Invalid file extension found, expected .pdf/
        );
    });

    it('should throw error if fileContent is larger than the limit', async () => {
        await expect(
            processEmailRequest(
                accountId,
                Buffer.alloc(MAX_EMAIL_ATTACHMENT_SIZE * 1024 + 1),
                fileName,
                fields,
                emailType
            )
        ).rejects.toThrow(/Attachment file size exceeds the limit/);
    });

    it('should throw error if userEmail is invalid', async () => {
        await expect(
            processEmailRequest(
                accountId,
                fileBuffer,
                fileName,
                { userEmail: 'invalidEmial', storageType: 'ebs' },
                emailType
            )
        ).rejects.toThrow(/Invalid user email in the request/);
    });

    it('should throw error if emailType is invalid', async () => {
        await expect(
            processEmailRequest(
                accountId,
                fileBuffer,
                fileName,
                { userEmail: 'example@email.com', storageType: 'ebs' },
                'somethingInvalid'
            )
        ).rejects.toThrow(/Invalid emailType/);
    });

    it('should throw error if storageType is not present', async () => {
        await expect(
            processEmailRequest(accountId, fileBuffer, fileName, { userEmail: 'example@email.com' }, 'somethingInvalid')
        ).rejects.toThrow(/Invalid emailType/);
    });
});

describe('Send savings calculation email operations', () => {
    it('should send savings calculation email successfully', async () => {
        const response = await sendSavingsCalculationEmail(
            ACCOUNT_ID,
            Buffer.from('some file content'),
            'test.pdf',
            'example@email.com',
            'ebs',
            'sql01'
        );
        expect(response).toEqual({ message: 'Email sent successfully' });
    });
});
