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
    fields: { [key: string]: string },
    emailType: string
) {
    logger.info('Processing email request', { accountId, fileName, fields });

    let response: EmailResponseType = { message: '' };
    const { userEmail } = fields;

    const cacheKey = accountId + userEmail;

    if (
        !(process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') &&
        isRateLimited(EMAIL_RATE_LIMIT_TYPE, cacheKey, config.get('notification.max-emails-per-day'), '1d')
    ) {
        throw createError(HttpErrorCodes.TOO_MANY_REQUESTS, 'Too many requests');
    }

    if (emailType && emailType === EMAIL_TYPES.SAVINGS_CALCULATIONS) {
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
    } else {
        response.message = 'Invalid emailType';
        throw createError(HttpErrorCodes.BAD_REQUEST, response);
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

    if (process.env.NODE_ENV === 'demo') {
        return successMsg;
    }

    const storageDesc: { [key: string]: string } = {
        ebs: 'Amazon EBS',
        fsxw: 'Amazon FSx for Windows',
        onprem: 'On-premises'
    };
    const desc = storageDesc[storageType];
    const emailSubject = 'Your TCO Calculation Report is Ready';
    const emailBody = `Attached, you will find the detailed report of your Total Cost of Ownership (TCO) analysis.
    The report provides a comprehensive comparison of potential cost savings for your existing Microsoft SQL Server environment using ${desc} as storage, in comparison to using Amazon FSx for ONTAP as storage. It includes detailed calculations, cost estimations, and recommendations to help you make an informed decision about the most cost-effective storage solution for your organization.`;
    fileName = fileName.replace('.pdf', `_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`); // // fileName_dd-mm-yyyy.pdf

    await sendEmail(config.get<string>('notification.sender-email'), [userEmail], emailSubject, emailBody, [
        {
            filename: fileName,
            content: fileBuffer,
            contentType: 'application/pdf'
        }
    ]);

    return successMsg;
}

export { sendSavingsCalculationEmail };
