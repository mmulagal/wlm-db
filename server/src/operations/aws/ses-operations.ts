import { createTransport } from 'nodemailer';
import { Attachment } from 'nodemailer/lib/mailer';
import * as aws from '@aws-sdk/client-ses';
import { getSES } from '../../lib/aws/ses';
import getLogger from '../../utils/logger';

const logger = getLogger();

const sendEmail = async (from: string, to: string[], subject: string, content: string, attachments?: Attachment[]) => {
    logger.info('Sending email', from, to, subject);

    const sesClient = await getSES();
    const transporter = createTransport({
        SES: { ses: sesClient, aws }
    });

    await transporter.sendMail({
        from,
        to,
        subject,
        html: content,
        attachments
    });
};

export { sendEmail };
