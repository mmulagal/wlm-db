import createError from 'http-errors';
import config from 'config';
import { EmailResponseType } from '../routes/types/notification.types';
import { sendEmail } from './aws/ses-operations';
import getLogger from '../utils/logger';
import { HttpErrorCodes } from '../utils/consts';
import { isValidEmail } from '../utils/utils';

const logger = getLogger();

export default async function processEmailRequest(
    accountId: string,
    fileBuffer: Buffer | null,
    fileName: string,
    fields: { [key: string]: string }
) {
    logger.info('Processing email request', { accountId, fileName, fields });
    let response: EmailResponseType = { message: '' };

    if (fields.emailType && fields.emailType === 'savings-calculations') {
        const { userEmail, storageType } = fields;

        if (!fileBuffer) {
            throw createError(HttpErrorCodes.BAD_REQUEST, 'Attachment file not found in the request');
        }
        if (!fileName || !fileName.endsWith('.pdf') || !userEmail || !isValidEmail(userEmail) || !storageType) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                'Missing required fields (fileName/userEmail/storageType) in the request'
            );
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
    // Check email sending limit | caching redis

    const storageDesc: { [key: string]: string } = {
        ebs: 'Amazon EBS',
        fsxw: 'FSx for ONTAP',
        onprem: 'On-premises storage'
    };
    const desc = storageDesc[storageType];
    const emailSubject = 'Calculation report was sent to you by email';
    const emailBody = `The attached report details the Total Cost of Ownership (TCO) savings comparing your database workloads to SQL Server using ${desc} file systems. The details in the report include calculations, cost estimations and recommendations to help you compare your storage environment with FSx for ONTAP and decide whether FSx for ONTAP is more cost efficient for your organization.`;
    // fileName_dd-mm-yyyy.pdf
    fileName = fileName.replace('.pdf', `_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`);

    await sendEmail(config.get<string>('notification.senderEmail'), [userEmail], emailSubject, emailBody, [
        {
            filename: fileName,
            content: fileBuffer,
            contentType: 'application/pdf'
        }
    ]);

    return { message: 'Email sent successfully' };
}
