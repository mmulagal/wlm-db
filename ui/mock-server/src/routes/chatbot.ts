import { BASE_URL, delay, generateResponse } from '../utils/appUtils';

const router = require('express').Router();

router.post(`${BASE_URL}/v1/chatbot/prompt`, async (req: any, res: any) => {
    await delay(3000);
    const prompt = req.body.prompt.toString();
    const msgArr = prompt.split(':');
    const lastMsg = msgArr[msgArr.length - 2];
    if (lastMsg && lastMsg.includes('mssql')) {
        generateResponse(res, 200, {
            errors: [
                {
                    key: 'region',
                    status: 'error',
                    message:
                        'I would need the region information to proceed further, please select a region of your choice',
                    allowedValues: [
                        {
                            label: 'Africa (Cape Town)',
                            value: 'af-south-1'
                        },
                        {
                            label: 'Asia Pacific (Hyderabad)',
                            value: 'ap-south-2'
                        },
                        {
                            label: 'Asia Pacific (Singapore)',
                            value: 'ap-southeast-1'
                        },
                        {
                            label: 'Asia Pacific (Sydney)',
                            value: 'ap-southeast-2'
                        },
                        {
                            label: 'Europe (Stockholm)',
                            value: 'eu-north-1'
                        },
                        {
                            label: 'Europe (Paris)',
                            value: 'eu-west-3'
                        },
                        {
                            label: 'Israel (Tel Aviv)',
                            value: 'il-central-1'
                        },
                        {
                            label: 'US East (Ohio)',
                            value: 'us-east-2'
                        },
                        {
                            label: 'AWS GovCloud (US-West)',
                            value: 'us-gov-west-1'
                        },
                        {
                            label: 'US West (Oregon)',
                            value: 'us-west-2'
                        },
                        {
                            label: 'Asia Pacific (Hong Kong)',
                            value: 'ap-east-1'
                        },
                        {
                            label: 'Asia Pacific (Tokyo)',
                            value: 'ap-northeast-1'
                        },
                        {
                            label: 'Asia Pacific (Seoul)',
                            value: 'ap-northeast-2'
                        },
                        {
                            label: 'Asia Pacific (Jakarta)',
                            value: 'ap-southeast-3'
                        },
                        {
                            label: 'Europe (Frankfurt)',
                            value: 'eu-central-1'
                        },
                        {
                            label: 'Europe (Zurich)',
                            value: 'eu-central-2'
                        },
                        {
                            label: 'Europe (Spain)',
                            value: 'eu-south-2'
                        },
                        {
                            label: 'Europe (London)',
                            value: 'eu-west-2'
                        },
                        {
                            label: 'Middle East (Bahrain)',
                            value: 'me-south-1'
                        },
                        {
                            label: 'South America (Sao Paulo)',
                            value: 'sa-east-1'
                        },
                        {
                            label: 'Asia Pacific (Mumbai)',
                            value: 'ap-south-1'
                        },
                        {
                            label: 'Asia Pacific (Melbourne)',
                            value: 'ap-southeast-4'
                        },
                        {
                            label: 'Canada (Central)',
                            value: 'ca-central-1'
                        },
                        {
                            label: 'Europe (Milan)',
                            value: 'eu-south-1'
                        },
                        {
                            label: 'Europe (Ireland)',
                            value: 'eu-west-1'
                        },
                        {
                            label: 'Middle East (UAE)',
                            value: 'me-central-1'
                        },
                        {
                            label: 'US East (N. Virginia)',
                            value: 'us-east-1'
                        },
                        {
                            label: 'AWS GovCloud (US-East)',
                            value: 'us-gov-east-1'
                        },
                        {
                            label: 'US West (N. California)',
                            value: 'us-west-1'
                        }
                    ]
                },
                {
                    key: 'fsxDeploymentType',
                    status: 'error',
                    message: 'Please select the FSx deployment type',
                    allowedValues: [
                        {
                            label: 'SINGLE_AZ_1',
                            value: 'SINGLE_AZ_1'
                        },
                        {
                            label: 'MULTI_AZ_1',
                            value: 'MULTI_AZ_1'
                        }
                    ]
                }
            ],
            intent: {
                complete: false,
                type: 'DeployMsSql',
                params: {}
            }
        });
    } else {
        generateResponse(res, 200, {
            message: 'Sorry, I could not find anything related to your query, please try again'
        });
    }
});

export default router;
