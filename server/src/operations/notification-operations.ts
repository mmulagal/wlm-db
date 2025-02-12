import createError from 'http-errors';
import config from 'config';
import { EmailResponseType } from '../routes/types/notification.types';
import { sendEmail } from './aws/ses-operations';
import getLogger from '../utils/logger';
import { EMAIL_RATE_LIMIT_TYPE, EMAIL_TYPES, HttpErrorCodes, MAX_EMAIL_ATTACHMENT_SIZE } from '../utils/consts';
import { isRateLimited, isValidEmail } from '../utils/utils';

const logger = getLogger();

export default async function processEmailRequest(
    accountId: string,
    fileBuffer: Buffer | null,
    fileName: string,
    fields: { [key: string]: string }
) {
    logger.info('Processing email request', { accountId, fileName, fields });

    let response: EmailResponseType = { message: '' };
    const { userEmail } = fields;

    const cacheKey = accountId + userEmail;
    if (isRateLimited(EMAIL_RATE_LIMIT_TYPE, cacheKey, 5, '1d')) {
        throw createError(HttpErrorCodes.TOO_MANY_REQUESTS, 'Too many requests');
    }

    if (fields.emailType && fields.emailType === EMAIL_TYPES.SAVINGS_CALCULATIONS) {
        const { storageType } = fields;

        if (!fileBuffer) {
            throw createError(HttpErrorCodes.BAD_REQUEST, 'Attachment file not found in the request');
        }
        switch (true) {
            case !fileName || !fileName.endsWith('.pdf'):
                throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid file name in the request');
            case fileBuffer.length / 1024 > MAX_EMAIL_ATTACHMENT_SIZE:
                throw createError(HttpErrorCodes.BAD_REQUEST, 'Attachment file size exceeds the limit');
            case !userEmail || !isValidEmail(userEmail):
                throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid user email in the request');
            case !storageType:
                throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid storage type in the request');
            default:
        }

        response = await sendSavingsCalculationEmail(accountId, fileBuffer, fileName, userEmail, storageType);
    }

    return response;
}

async function sendSavingsCalculationEmail(
    accountId: string,
    fileBuffer: Buffer,
    fileName: string,
    userEmail: string,
    storageType: string
): Promise<EmailResponseType> {
    logger.info('Sending savings calculation email', { accountId, fileName, userEmail, storageType });
    const successMsg = { message: 'Email sent successfully' };

    if (process.env.NODE_ENV !== 'demo') {
        return successMsg;
    }

    const storageDesc: { [key: string]: string } = {
        ebs: 'Amazon EBS',
        fsxw: 'FSx for ONTAP',
        onprem: 'On-premises storage'
    };
    const desc = storageDesc[storageType];
    const emailSubject = 'Calculation report was sent to you by email';
    const emailBody = `The attached report details the Total Cost of Ownership (TCO) savings comparing your database workloads to SQL Server using ${desc} file systems. The details in the report include calculations, cost estimations and recommendations to help you compare your storage environment with FSx for ONTAP and decide whether FSx for ONTAP is more cost efficient for your organization.`;
    fileName = fileName.replace('.pdf', `_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`); // // fileName_dd-mm-yyyy.pdf

    await sendEmail(config.get<string>('notification.senderEmail'), [userEmail], emailSubject, emailBody, [
        {
            filename: fileName,
            content: fileBuffer,
            contentType: 'application/pdf'
        }
    ]);

    return successMsg;
}
