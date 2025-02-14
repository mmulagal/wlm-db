import { SendEmailCommand, SendEmailCommandInput, SendEmailCommandOutput, SESClient } from '@aws-sdk/client-ses';
import getLogger from '../../utils/logger';

const logger = getLogger();
const AWS_SES_REGION = 'us-east-1';

const getSES = async () => {
    logger.debug('Getting SES client');
    return new SESClient({ region: AWS_SES_REGION });
};

const sendEmail = async (region: string, input: SendEmailCommandInput): Promise<SendEmailCommandOutput> => {
    const ses = new SESClient(region);
    const resp = await ses.send(new SendEmailCommand(input));
    logger.debug('Send Email command response', resp);

    return resp;
};

export { sendEmail, getSES };
