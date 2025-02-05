import { SendEmailCommand, SendEmailCommandInput, SendEmailCommandOutput, SESClient } from '@aws-sdk/client-ses';
import getLogger from '../../utils/logger';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';

const logger = getLogger();
const getSES = async (region: string, credentialsId?: string) => {
    logger.debug('Getting SES client: ', region, credentialsId);
    if (!credentialsId) {
        return new SESClient({ region });
    }

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new SESClient({ credentials, region });
};

const sendEmail = async (region: string, input: SendEmailCommandInput): Promise<SendEmailCommandOutput> => {
    const ses = new SESClient(region);
    const resp = await ses.send(new SendEmailCommand(input));
    logger.debug('Send Email command response', resp);

    return resp;
};

export { sendEmail, getSES };
