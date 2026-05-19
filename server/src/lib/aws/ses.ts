import { SendEmailCommand, SendEmailCommandInput, SendEmailCommandOutput, SESv2Client } from '@aws-sdk/client-sesv2';
import getLogger from '../../utils/logger';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { GOV_ACCOUNT } from '../../utils/consts';

const logger = getLogger();
const AWS_SES_COMMERCIAL_REGION = 'us-east-1';
const AWS_SES_GOV_REGION = 'us-gov-west-1';

const getSES = async () => {
    const isGov = getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT);
    const region = isGov ? AWS_SES_GOV_REGION : AWS_SES_COMMERCIAL_REGION;
    logger.debug('Getting SES client', { region });
    return new SESv2Client({ region });
};

const sendEmail = async (region: string, input: SendEmailCommandInput): Promise<SendEmailCommandOutput> => {
    const ses = new SESv2Client(region);
    const resp = await ses.send(new SendEmailCommand(input));
    logger.debug('Send Email command response', resp);

    return resp;
};

export { sendEmail, getSES };
