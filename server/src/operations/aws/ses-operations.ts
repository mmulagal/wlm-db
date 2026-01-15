import { createTransport } from 'nodemailer';
import createError from 'http-errors';
import { Attachment } from 'nodemailer/lib/mailer';
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { getSES } from '../../lib/aws/ses';
import getLogger from '../../utils/logger';
import { HttpErrorCodes } from '../../utils/consts';

const logger = getLogger();

const sendEmail = async (from: string, to: string[], subject: string, content: string, attachments?: Attachment[]) => {
    logger.info('Sending email', from, to, subject);

    const sesClient = await getSES();
    const transporter = createTransport({
        SES: { sesClient, SendEmailCommand }
    } as Parameters<typeof createTransport>[0]);

    try {
        await transporter.sendMail({
            from,
            to,
            subject,
            html: content,
            attachments
        });
    } catch (error) {
        logger.error('Error sending SES email', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Something went wrong');
    }
};

export { sendEmail };
