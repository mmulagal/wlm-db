import { getSES } from '../../lib/aws/ses';
import * as aws from '@aws-sdk/client-ses';
import { createTransport } from 'nodemailer';
import getLogger from '../../utils/logger';
import { Attachment } from 'nodemailer/lib/mailer';

const logger = getLogger();

const sendEmail = async (from: string, to: string, subject: string, html: string, attachments?: Attachment[]) => {
    logger.info('Sending email', from, to, subject);
    const sesClient = await getSES('region', 'credentialsId');
    const transporter = createTransport({
        SES: { ses: sesClient, aws }
    });

    await transporter.sendMail({
        from,
        to,
        subject,
        html,
        attachments
    });
};

export { sendEmail };
