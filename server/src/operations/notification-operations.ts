import createError from 'http-errors';
import config from 'config';
import { EmailResponseType } from '../routes/types/notification.types';
import { sendEmail } from './aws/ses-operations';
import getLogger from '../utils/logger';
import {
    DATABASE_LABEL,
    EMAIL_RATE_LIMIT_TYPE,
    EMAIL_TYPES,
    HttpErrorCodes,
    MAX_EMAIL_ATTACHMENT_SIZE,
    STORAGE_LABEL
} from '../utils/consts';
import { IS_DEMO_FLOW, isRateLimited, isValidEmail } from '../utils/utils';

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
        !IS_DEMO_FLOW &&
        isRateLimited(EMAIL_RATE_LIMIT_TYPE, cacheKey, config.get('notification.max-emails-per-day'), '1d')
    ) {
        throw createError(HttpErrorCodes.TOO_MANY_REQUESTS, 'Too many requests');
    }

    if (emailType && emailType === EMAIL_TYPES.SAVINGS_CALCULATIONS) {
        const { storageType, hostName, databaseType } = fields;

        if (!fileBuffer) {
            throw createError(HttpErrorCodes.BAD_REQUEST, 'Attachment file not found in the request');
        }
        switch (true) {
            case !fileName || !fileName.endsWith('.pdf'):
                throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid file extension found, expected .pdf');
            case fileBuffer.length / 1024 > MAX_EMAIL_ATTACHMENT_SIZE:
                throw createError(HttpErrorCodes.BAD_REQUEST, 'Attachment file size exceeds the limit');
            case !userEmail || !isValidEmail(userEmail):
                throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid user email in the request');
            case !storageType:
                throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid storage type in the request');
            default:
        }

        response = await sendSavingsCalculationEmail(
            accountId,
            fileBuffer,
            fileName,
            userEmail,
            storageType,
            hostName,
            databaseType
        );
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
    storageType: string,
    hostName?: string,
    databaseType?: string
): Promise<EmailResponseType> {
    logger.info('Sending savings calculation email', { accountId, fileName, userEmail, storageType, databaseType });
    const successMsg = { message: 'Email sent successfully' };

    if (IS_DEMO_FLOW) {
        return successMsg;
    }

    const desc = STORAGE_LABEL[storageType];
    const dbLabel = DATABASE_LABEL[databaseType ?? 'MSSQL'] ?? 'Microsoft SQL Server';
    const emailSubject = hostName
        ? `Savings Calculator Report is Ready for ${dbLabel} on host: ${hostName}`
        : `Savings Calculator Report is Ready for ${dbLabel}`;
    const emailBody = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                </style>
            </head>
            <body padding="20px">
                <p>Hi there,</p>
                <p>
                    Here's the savings calculator report that provides a comparison of your current ${dbLabel}
                    environment using ${desc} storage and the potential savings you could achieve by
                    switching to Amazon FSx for NetApp ONTAP.
                </p>
                <p>Key highlights from the report include:</p>
                <ul>
                    <li>
                        In-depth cost calculations that break down the expenses associated with each storage option.
                    </li>
                    <li>Estimated savings you could realize by migrating to Amazon FSx for NetApp ONTAP.</li>
                    <li>
                        Practical recommendations to guide you towards the most economical and efficient storage
                        solution for your needs.
                    </li>
                </ul>
                <p>
                    Our goal is to help you make the best decision for your organization's financial and
                    operational success. Please take a moment to review the findings and see how they can
                    positively impact your bottom line.
                </p>
                <p>Thanks</p>
            </body>
        </html>
    `;
    fileName = fileName.replace('.pdf', `_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`); // fileName_dd-mm-yyyy.pdf

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
