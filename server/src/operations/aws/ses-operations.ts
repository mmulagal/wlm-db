import createError from 'http-errors';
import { createTransport } from 'nodemailer';
import { Attachment } from 'nodemailer/lib/mailer';

import { SendEmailCommand } from '@aws-sdk/client-sesv2';

import { HttpErrorCodes } from '../../utils/consts';
import getLogger from '../../utils/logger';

import { getSES } from '../../lib/aws/ses';

const logger = getLogger();

interface SesError extends Error {
    name: string;
    $metadata?: { httpStatusCode?: number; requestId?: string };
    Code?: string;
}

// Extract the domain portion of an address like `Name <user@example.com>` or `user@example.com`.
// Used for logging instead of the full address: the domain alone lets operators distinguish
// sender-identity failures from recipient issues without dumping user email addresses (PII) into
// CloudWatch.
const extractDomain = (address: string): string | undefined => {
    const match = address.match(/@([^>\s]+)/);
    return match?.[1];
};

// Mirrors the SES integration used by gg-skywalker's marketing/maintenance/testor services:
// nodemailer's SESv2 transport with `{ sesClient, SendEmailCommand }`. This is the documented
// public migration target in nodemailer 8.x — preferred over reaching into internal MIME
// builders so this code keeps working through future nodemailer upgrades.
const sendEmail = async (from: string, to: string[], subject: string, html: string, attachments?: Attachment[]) => {
    const fromDomain = extractDomain(from);
    const recipientCount = to.length;
    logger.info('Sending email', { fromDomain, recipientCount, subject, hasAttachments: !!attachments?.length });

    const sesClient = await getSES();
    const transporter = createTransport({
        SES: { sesClient, SendEmailCommand }
    } as Parameters<typeof createTransport>[0]);

    try {
        const info = await transporter.sendMail({ from, to, subject, html, attachments });
        logger.info('Email sent', { messageId: info.messageId, recipientCount });
        return info;
    } catch (error) {
        const sesError = error as SesError;
        logger.error('Failed to send SES email', {
            fromDomain,
            recipientCount,
            subject,
            sesErrorName: sesError.name,
            sesErrorCode: sesError.Code,
            httpStatusCode: sesError.$metadata?.httpStatusCode,
            requestId: sesError.$metadata?.requestId,
            error
        });
        // Surface only the stable AWS SDK v3 error identifier (e.g. MessageRejected,
        // AccessDeniedException) to the client. The raw `sesError.message` can leak internal
        // configuration — for AccessDenied it embeds the caller IAM principal ARN and the
        // resource ARN — so it stays in the server log only, where the full `error` object is
        // already captured above with stack, requestId, and httpStatusCode for operator triage.
        const identifier = sesError.name || 'UnknownSesError';
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Failed to send email (${identifier})`);
    }
};

export { sendEmail };
