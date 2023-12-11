import createError from 'http-errors';
import config from 'config';
import {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    DescribeSecurityGroupsCommand,
    DescribeSubnetsRequest,
    DescribeVpcsRequest,
    DescribeSecurityGroupsRequest,
    DescribeImagesCommand,
    DescribeImagesCommandInput,
    DescribeRegionsCommand,
    DescribeRegionsCommandInput,
    DescribeRegionsCommandOutput,
    paginateDescribeInstanceTypes,
    DescribeRouteTablesCommand,
    DescribeRouteTablesCommandInput,
    DescribeKeyPairsCommand,
    DescribeKeyPairsCommandOutput,
    DescribeRouteTablesCommandOutput,
    DescribeImagesCommandOutput,
    DescribeNetworkInterfacesCommandInput,
    DescribeNetworkInterfacesCommandOutput,
    DescribeNetworkInterfacesCommand,
    DescribeInstancesCommand,
    DescribeInstancesCommandInput,
    DescribeInstanceTypeOfferingsCommand,
    CreateTagsCommand,
    CreateTagsCommandOutput
} from '@aws-sdk/client-ec2';
// import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import { DEFAULT_AWS_REGION, HttpErrorCodes, TAG_STRUCTURE } from '../../utils/consts';

const logger = getLogger();
async function getEC2Client(region: string, credentialsId?: string) {
    logger.debug('Getting EC2 client:', region, credentialsId);
    if (!credentialsId) {
        return new EC2Client({ region });
    }
    // const {
    //     credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    // } = await getCredentialsDetails(credentialsId);
    // const credentials = { accessKeyId, secretAccessKey, sessionToken };
    const credentials = {
        accessKeyId: 'ASIAWYGBM3V5UBVPMIQV',
        secretAccessKey: 'LB5Ul9V7xAi19S7qzIkIWR7bYWtB4gSh1SdVaOfm',
        sessionToken:
            'IQoJb3JpZ2luX2VjEJ///////////wEaCXVzLWVhc3QtMSJHMEUCIG63DTQtHtqmyVz/uSI+VleRkHUfuF1rKlH9450Ob/QBAiEAm65bk4U4Nd5loyPomUa7+x3Tbmco5Mu4qbv7vhYSm/4qqwIIFxAAGgw0NjQyNjIwNjE0MzUiDAzrAvEhm5A+PsvuoyqIAv2SVK5xybaV+mosU7rvQv5B2AuYs52ZZlKlkXMoFegTLHzo6vykUG34X7Jd00TT967If7fU+c3BWNsvCnzYxCBQE8+x5DRO3nOyAgHc7e2OhqisHYeLAkbc/05W8tcMAA+Cdk4IpG48BICRf9l3MTeIY3VxZOfTIqCBaJfmUmKuY6gJpBxFuCtGWgyrcXYApiJb/UhFK02LF92qP/dQUF7EY7McIFfNDg60N/wAlefrFPc5HDTXjq5MuV5dqVxUIo0uHe9p05MqaCNP7tiNqJgEomrTOK24UuuOzmc5Kpmsb7SGV6/NwGhZHF0reuu+zWfYqbURJ0BAUWQnyt4wmWFOSpnSXcMI+jDTtNyrBjqdAZkum/P55zDHv1j2cNlawZPmnx+9tWOgTdrUqjz1uWSPFiId9gKME9Om1pCkhCABq7W4n1B2U7shgpTjeTgnsbmqRT1gBHSoG0E1k/xKkGWucNmcuHQk+G6tC/Lv4Ptq/TEeCiMsgH+wEH4kDWEfbb1alURG01cZ4wI8ff9/ks5Ziy+8tTOWTl2FXV1Uul0nl7MEtDLaUmV+uFgAKTg='
    };

    return new EC2Client({ credentials, region });
}

async function describeVpc(credentialsId: string, region: string, params: DescribeVpcsRequest) {
    logger.info('Describe VPC', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeVpcsCommand(params));
    logger.debug('descibeVpcs response:', resp);

    return resp;
}

async function describeSubnets(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    logger.info('Describe Subnets', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeSubnetsCommand(params));
    logger.debug('descibeSubnets response:', resp);

    return resp;
}

async function describeSecurityGroups(credentialsId: string, region: string, params: DescribeSecurityGroupsRequest) {
    logger.info('Describe Security Groups', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeSecurityGroupsCommand(params));
    logger.debug('descibeSecurityGroupss response:', resp);

    return resp;
}

async function getAmis(
    credentialsId: string,
    region: string,
    params: DescribeImagesCommandInput
): Promise<DescribeImagesCommandOutput> {
    logger.info('Get AMIs', { credentialsId, region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeImagesCommand(params));
    logger.debug('DescribeImagesCommand response:', resp);

    return resp;
}

async function describeInstance(
    credentialsId: string,
    region: string,
    params: DescribeInstancesCommandInput
): Promise<DescribeImagesCommandOutput> {
    logger.info('Describe EC2 instance', { credentialsId, region, params });

    const client = await getEC2Client(region, credentialsId);
    const response = await client.send(new DescribeInstancesCommand(params));
    logger.info('Describe instance response:', response);

    return response;
}

async function describeRegions(
    input: DescribeRegionsCommandInput,
    credentialsId?: string
): Promise<DescribeRegionsCommandOutput> {
    logger.info('Describe AWS regions:', { credentialsId, input });

    const client = await getEC2Client(DEFAULT_AWS_REGION, credentialsId);
    const response = await client.send(new DescribeRegionsCommand(input));
    logger.debug('Describe AWS regions response:', response);

    return response;
}

async function describeInstanceTypes(credentialsId: string, region: string) {
    logger.info('Describe AWS instance types:', { credentialsId, region });

    const client = await getEC2Client(region, credentialsId);

    const vcpuFilter = config.get('ec2.vcpu-filter') as Array<string>;

    const paginator = paginateDescribeInstanceTypes(
        { client, pageSize: 100 },
        {
            Filters: [
                { Name: 'current-generation', Values: ['true'] },
                { Name: 'processor-info.supported-architecture', Values: ['x86_64'] },
                { Name: 'supported-usage-class', Values: ['on-demand'] },
                { Name: 'supported-virtualization-type', Values: ['hvm'] },
                { Name: 'vcpu-info.default-vcpus', Values: vcpuFilter },
                {
                    Name: 'memory-info.size-in-mib',
                    Values: [
                        (4 * 1024).toString(),
                        (8 * 1024).toString(),
                        (16 * 1024).toString(),
                        (32 * 1024).toString(),
                        (64 * 1024).toString(),
                        (128 * 1024).toString(),
                        (160 * 1024).toString(),
                        (256 * 1024).toString(),
                        (512 * 1024).toString()
                    ]
                },
                {
                    Name: 'instance-type',
                    Values: ['m5*', 'm6*', 'm7*', 'c5*', 'c6*', 'c7*', 'r4*', 'r5*', 'r6*']
                }
            ]
        }
    );
    const instanceTypes = [];

    for await (const page of paginator) {
        if (page.InstanceTypes?.length) {
            instanceTypes.push(...page.InstanceTypes);
        }
    }

    return instanceTypes;
}
async function describeRouteTable(
    credentialsId: string,
    region: string,
    params: DescribeRouteTablesCommandInput
): Promise<DescribeRouteTablesCommandOutput> {
    logger.info('Describe route table:', { region, params });

    const ec2 = await getEC2Client(region, credentialsId);

    const resp = await ec2.send(new DescribeRouteTablesCommand(params));
    logger.debug('describe route table response:', resp);

    return resp;
}

async function describeKeyPairs(
    credentialsId: string,
    region: string,
    input: DescribeRegionsCommandInput
): Promise<DescribeKeyPairsCommandOutput> {
    logger.info('Describe key-pair:', { credentialsId, region, input });

    const client = await getEC2Client(region, credentialsId);
    const response = await client.send(new DescribeKeyPairsCommand(input));
    logger.debug('Describe key-pairs response:', response);

    return response;
}

async function describeNetworkInterfaces(
    credentialsId: string,
    region: string,
    input: DescribeNetworkInterfacesCommandInput
): Promise<DescribeNetworkInterfacesCommandOutput> {
    logger.info('Describe network interfaces:', { credentialsId, region, input });

    const client = await getEC2Client(region, credentialsId);
    const response = await client.send(new DescribeNetworkInterfacesCommand(input));
    logger.debug('Describe network interfaces:', response);

    return response;
}

async function describeInstanceTypeOfferings(credentialsId: string, region: string, instanceType: string) {
    logger.info('Describe EC2 instance offerings:', { region, instanceType });

    const input = {
        DryRun: false,
        LocationType: 'region',
        Filters: [
            {
                Name: 'location',
                Values: [region]
            },
            {
                Name: 'instance-type',
                Values: [instanceType]
            }
        ]
    };

    const client = await getEC2Client(region, credentialsId);
    const command = new DescribeInstanceTypeOfferingsCommand(input);
    const response = await client.send(command);
    logger.info('EC2 instance type offerings response:', response);

    if (
        response.InstanceTypeOfferings?.length !== 1 ||
        response.InstanceTypeOfferings?.[0].InstanceType !== instanceType
    ) {
        logger.error('EC2 instance type offerings failure response:', response?.InstanceTypeOfferings);
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Instance type '${instanceType}' is not available in region '${region}'.`
        );
    }
    return response;
}

async function CreateEc2Tag(credentialsId: string, region: string, resourceId: string, tags: TAG_STRUCTURE[]) {
    logger.info('Adding tags to resource', credentialsId, region, resourceId, tags);

    const client = await getEC2Client(region, credentialsId);
    const ec2Params = {
        Resources: [resourceId],
        Tags: tags.map(tag => ({ Key: tag.Key, Value: tag.Value }))
    };
    try {
        const command = new CreateTagsCommand(ec2Params);
        const response: CreateTagsCommandOutput = await client.send(command);
        logger.info('Resource tagged successfully:', response);
    } catch (error) {
        logger.error('Error tagging resource:', error);
    }
}

export {
    getEC2Client,
    describeVpc,
    describeSubnets,
    describeSecurityGroups,
    getAmis,
    describeInstance,
    describeRegions,
    describeInstanceTypes,
    describeRouteTable,
    describeKeyPairs,
    describeNetworkInterfaces,
    describeInstanceTypeOfferings,
    CreateEc2Tag
};
