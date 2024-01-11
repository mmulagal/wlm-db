import { isEmpty, uniqBy } from 'lodash-es';
import { getAdsList } from '../../operations/aws/directory-service-operations';
import { getAmiList, getInstanceTypes, getKeyPairsList, getVpcsList } from '../../operations/aws/ec2-operations';
import { getFSxOntapRegionsList } from '../../operations/aws/ssm-operations';
import getLogger from '../../utils/logger';
import {
    AZ_1,
    AZ_2,
    VPC_CIDR,
    VPC_ID,
    DOMAIN_DNS,
    AD_SCENARIO_TYPE,
    DNS_IP,
    AWS_MANAGED_AD,
    USER_MANAGED_AD,
    NEW,
    EXISTING,
    KEY_LABEL_MAP,
    PRIVATE_SUBNET_1,
    PRIVATE_SUBNET_2,
    ROUTE_TABLE_1,
    ROUTE_TABLE_2,
    STANDALONE,
    FCI,
    FSX_USERNAME,
    PROD,
    DEV,
    CUSTOM
} from './consts';
import { getCredentials } from '../../operations/cloud-manager/credentials-operations';
import { getFSxFileSystemsList } from '../../operations/aws/fsx-operations';

const logger = getLogger();

async function validateCredentials(credentialsId: string, key: string) {
    logger.debug('Validate Credentials', { credentialsId });
    const CREDENTIAL_PATH = '/credentials';
    const credentials = (await getCredentials('aws_assume_role')) || [];

    if (isEmpty(credentials)) {
        return {
            key,
            status: 'error',
            message: 'No credentials found, please add and try again',
            allowedValues: [],
            link: {
                text: 'Credentials',
                path: CREDENTIAL_PATH,
                description: 'To add a new credentials, visit'
            }
        };
    }

    if (!credentialsId) {
        return {
            key,
            status: 'error',
            link: {
                text: 'Credentials',
                path: CREDENTIAL_PATH,
                description: 'To add a new credentials, visit'
            },
            message: 'Select a credential to proceed further',
            allowedValues: credentials.map(credential => ({
                label: credential.name,
                value: credential.credentialsId
            }))
        };
    }

    const credentialsMatched = credentials?.find(reg => reg.credentialsId === credentialsId);
    if (!credentialsMatched) {
        return {
            key,
            status: 'error',
            link: {
                text: 'Credentials',
                path: CREDENTIAL_PATH,
                description: 'To add a new credentials, visit'
            },
            message:
                'The credential that you provided is not valid. Please select a set of credentials from the list below.',
            allowedValues: credentials.map(cred => ({ label: cred.name, value: cred.credentialsId }))
        };
    }

    return {
        key,
        value: credentialsMatched.credentialsId
    };
}

async function validateRegion(credentialsId: string, value: string, key: string) {
    logger.debug('Validate Region', { credentialsId, value });
    const { regions } = (await getFSxOntapRegionsList(credentialsId)) || [];

    if (isEmpty(regions)) {
        return {
            key,
            status: 'error',
            message: 'No regions found, please try again',
            allowedValues: []
        };
    }

    if (!value) {
        return {
            key,
            status: 'error',
            message: 'Select an AWS region for the database.',
            allowedValues: regions.map(reg => ({ label: reg.regionName, value: reg.regionCode }))
        };
    }

    const regionsMatched = regions?.filter(
        reg => reg.regionName?.toLowerCase()?.includes(value?.toLowerCase()) || reg.regionCode === value
    );
    // // console.log(regionsMatched);
    if (regionsMatched.length !== 1) {
        return {
            key,
            status: 'error',
            message: `${
                regionsMatched.length > 1
                    ? 'I found multiple regions that match what you provided.'
                    : 'The region that you provided is not valid.'
            } Please try again.`,
            allowedValues: regionsMatched.length
                ? regionsMatched.map(reg => ({ label: reg.regionName, value: reg.regionCode }))
                : regions.map(reg => ({ label: reg.regionName, value: reg.regionCode }))
        };
    }

    return {
        key,
        value: regionsMatched[0]?.regionCode
    };
}

async function validateVpcId(
    credentialsId: string,
    region: string,
    vpcId: string,
    az1: string,
    az2: string,
    subnet1: string,
    subnet2: string,
    key: string
) {
    logger.debug('Validate VpcConfig', { credentialsId, region, vpcId, az1, az2, key });

    const { vpcs } = await getVpcsList(credentialsId, region, 'subnet');

    if (isEmpty(vpcs)) {
        return {
            key,
            status: 'error',
            message: 'No vpcs found, please try again',
            allowedValues: []
        };
    }

    if (!vpcId) {
        return {
            key,
            status: 'error',
            message: key === VPC_ID ? 'Select a VPC for the database.' : 'Select a VPC CIDR for the database.',
            allowedValues: vpcs.map(vpc => ({ label: vpc.name || vpc.id, value: vpc.id }))
        };
    }

    const isValidVpc = vpcs?.find(vpc => vpc.id === vpcId);
    if (!isValidVpc) {
        return {
            key,
            status: 'error',
            message: 'The VPC that you provided is not correct. Please choose a different VPC.',
            allowedValues: vpcs.map(vpc => ({ label: vpc.name || vpc.id, value: vpc.id }))
        };
    }

    const azs = uniqBy(
        isValidVpc.subnets?.map(({ availabilityZone }) => ({ label: availabilityZone, value: availabilityZone })),
        'value'
    );

    switch (key) {
        case VPC_ID:
            return { key, value: isValidVpc.id };
        case VPC_CIDR:
            return {
                key,
                value: isValidVpc.cidrBlock?.[0].CidrBlock
            };
        case AZ_1: {
            if (!az1) {
                return {
                    key,
                    status: 'error',
                    message: 'Select an Availability Zone for the primary SQL node.',
                    allowedValues: azs
                };
            }
            const subnets = vpcs?.map(vpc => vpc?.subnets);
            const isValidAZ = subnets?.flat().find(subnet => subnet?.availabilityZone === az1);
            logger.debug('isValidAZ', isValidAZ);
            if (!isValidAZ) {
                return {
                    key,
                    status: 'error',
                    message:
                        'The availability zone that you provided is not correct. Please choose a different availability zone.',
                    allowedValues: azs
                };
            }
            return {
                key,
                value: az1
            };
        }
        case AZ_2: {
            const azs2 = azs.filter(az => az.value !== az1);
            if (!az2) {
                return {
                    key,
                    status: 'error',
                    message: 'Select an Availability Zone for the secondary SQL node.',
                    allowedValues: azs2
                };
            }

            if (az1 === az2) {
                return {
                    key,
                    status: 'error',
                    message: 'Please select a different availability zone for the secondary sql node',
                    allowedValues: azs2
                };
            }
            const subnets = vpcs?.map(vpc => vpc?.subnets);
            const isValidAZ = subnets?.flat().find(subnet => subnet?.availabilityZone === az2);
            logger.debug('isValidAZ', isValidAZ);
            if (!isValidAZ) {
                return {
                    key,
                    status: 'error',
                    message:
                        'The availability zone that you provided is not valid. Please choose a valid availability zone.',
                    allowedValues: azs2
                };
            }

            return {
                key,
                value: az2
            };
        }
        case PRIVATE_SUBNET_1:
        case PRIVATE_SUBNET_2: {
            if ((key === PRIVATE_SUBNET_1 && !subnet1) || (key === PRIVATE_SUBNET_2 && !subnet2)) {
                return {
                    key,
                    status: 'error',
                    message: `Select the ${key === PRIVATE_SUBNET_1 ? 'primary' : 'secondary'} subnet id`,
                    allowedValues: uniqBy(
                        isValidVpc.subnets
                            ?.filter(({ availabilityZone }) =>
                                key === PRIVATE_SUBNET_1 ? availabilityZone === az1 : availabilityZone === az2
                            )
                            ?.map(({ id, name }) => ({
                                label: name,
                                value: id
                            })),
                        'value'
                    )
                };
            }

            const isValidSubnet = isValidVpc.subnets
                ?.filter(({ availabilityZone }) =>
                    key === PRIVATE_SUBNET_1 ? availabilityZone === az1 : availabilityZone === az2
                )
                ?.find(({ id }) => (key === PRIVATE_SUBNET_1 ? id === subnet1 : id === subnet2));

            if (!isValidSubnet) {
                return {
                    key,
                    status: 'error',
                    message: 'The subnet that you provided is not valid, Please choose a valid subnet.',
                    allowedValues: uniqBy(
                        isValidVpc.subnets
                            ?.filter(({ availabilityZone }) =>
                                key === PRIVATE_SUBNET_1 ? availabilityZone === az1 : availabilityZone === az2
                            )
                            ?.map(({ id, name }) => ({
                                label: name,
                                value: id
                            })),
                        'value'
                    )
                };
            }

            return {
                key,
                value: key === PRIVATE_SUBNET_1 ? subnet1 : subnet2
            };
        }
        case ROUTE_TABLE_1: {
            return {
                key,
                value: isValidVpc.subnets?.find(({ id }) => id === subnet1)?.routeTableId
            };
        }
        case ROUTE_TABLE_2: {
            const routeTable1 = isValidVpc.subnets?.find(({ id }) => id === subnet1)?.routeTableId;
            const routeTable2 = isValidVpc.subnets?.find(({ id }) => id === subnet2)?.routeTableId;

            if (routeTable1 === routeTable2) {
                return {
                    key: PRIVATE_SUBNET_2,
                    status: 'error',
                    message:
                        'The subnets in the selected Availability Zone are sharing the same route table. A multi-zone FSx for ONTAP deployment requires different route tables for each subnet. Modify the route table configuration or select a different subnet and try again.',
                    allowedValues: uniqBy(
                        isValidVpc.subnets
                            ?.filter(({ availabilityZone }) => availabilityZone === az2)
                            ?.map(({ id, name }) => ({
                                label: name,
                                value: id
                            })),
                        'value'
                    )
                };
            }

            return {
                key,
                value: isValidVpc.subnets?.find(({ id }) => id === subnet2)?.routeTableId
            };
        }
        default:
            return {};
    }
}

async function validateKeyName(credentialsId: string, region: string, keyName: string, key: string) {
    logger.debug('Validate Key Name', { credentialsId, region, keyName });
    const { keyPairs: keys } = await getKeyPairsList(credentialsId, region);

    if (!keyName) {
        return {
            key,
            status: 'error',
            message: 'Select a key pair so that you can securely connect to your EC2 instance.',
            allowedValues: keys.map(({ name }) => ({ label: name, value: name }))
        };
    }

    const isValidKey = keys?.find(({ name, id }) => name === keyName || id === keyName);

    if (!isValidKey) {
        return {
            key,
            status: 'error',
            message: 'The key pair that you provided is not valid. Please select a valid key pair.',
            allowedValues: keys.map(({ name }) => ({ label: name, value: name }))
        };
    }
    return {
        key,
        value: isValidKey.name
    };
}

async function validateImageId(credentialsId: string, region: string, imageId: string, key: string) {
    logger.debug('Validate Image Id', {
        credentialsId,
        region,
        imageId,
        key
    });

    const { amis } = await getAmiList(credentialsId, region, 'windows', 'sql');

    const filteredAmis = amis?.filter(
        ({ name }) =>
            (name.includes('Windows_Server-2016') || name.includes('Windows_Server-2019')) &&
            (name.includes('SQL_2016') || name.includes('SQL_2019') || name.includes('SQL_2022')) &&
            (name.includes('Enterprise') || name.includes('Standard'))
    );
    if (!imageId) {
        return {
            key,
            status: 'error',
            message: 'Select an AWS AMI for the database.',
            allowedValues: filteredAmis.map(({ name, imageId: amiId, description }) => ({
                label: name,
                value: amiId,
                metadata: {
                    description
                }
            }))
        };
    }

    const isValidAmi = filteredAmis?.find(ami => ami.imageId === imageId);
    if (!isValidAmi) {
        return {
            key,
            status: 'error',
            message: 'The image id that you provided is not correct. Please select a valid image id.',
            allowedValues: filteredAmis.map(({ name, imageId: amiId, description }) => ({
                label: name,
                value: amiId,
                metadata: {
                    description
                }
            }))
        };
    }
    return {
        key,
        value: isValidAmi.imageId
    };
}

async function validateAdScenarioType(type: string, key: string) {
    if (type === 'AWS_MANAGED_AD' || type === 'USER_MANAGED_AD') {
        return {
            key,
            value: type
        };
    }

    return {
        key,
        status: 'error',
        message:
            'The active directory type that you provided is not correct. Please provide a valid active directory type',
        allowedValues: [
            { label: 'AWS_MANAGED_AD', value: 'AWS_MANAGED_AD' },
            { label: 'USER_MANAGED_AD', value: 'USER_MANAGED_AD' }
        ]
    };
}

async function validateInstanceType(credentialsId: string, region: string, workloadInstanceType: string, key: string) {
    logger.debug('Validate Instance Type', { credentialsId, region, workloadInstanceType });
    const { instanceTypes } = await getInstanceTypes(credentialsId, region);
    if (!workloadInstanceType) {
        return {
            key,
            status: 'error',
            message: 'Select an EC2 instance type.',
            allowedValues: instanceTypes.map(({ instanceType }) => ({
                label: instanceType,
                value: instanceType
            }))
        };
    }

    const isValidType = instanceTypes?.find(({ instanceType }) => instanceType === workloadInstanceType);
    if (!isValidType) {
        return {
            key,
            status: 'error',
            message: 'The instance type that you provided is not correct. Please select a valid EC2 instance type.',
            allowedValues: instanceTypes.map(({ instanceType }) => ({
                label: instanceType,
                value: instanceType
            }))
        };
    }
    return {
        key,
        value: isValidType.instanceType
    };
}

async function validateFsx(credentialsId: string, region: string, vpcId: string, fsxId: string, key: string) {
    logger.info('Validate FSX', credentialsId, region, fsxId);
    const { filesystems } = await getFSxFileSystemsList(credentialsId, region, vpcId);
    if (!fsxId) {
        return {
            key,
            status: 'error',
            message: 'Select a FSxN name.',
            allowedValues: filesystems.map(({ name, fileSystemId }) => ({
                label: `${name ? `${name} | ` : ''}${fileSystemId}`,
                value: fileSystemId
            }))
        };
    }
    const isValidFsx = filesystems?.find(filesystem => filesystem?.fileSystemId === fsxId);
    if (!isValidFsx) {
        return {
            key,
            status: 'error',
            message: 'The fsx information that you provided is not correct. Please provide a valid fsx information.',
            allowedValues: filesystems?.map(({ name, fileSystemId }) => ({
                label: name,
                value: fileSystemId
            }))
        };
    }

    return {
        key,
        value: isValidFsx.fileSystemId
    };
}
async function validateCloudWatch(key: string, enableCloudWatch?: boolean) {
    logger.info(' Validate Cloud Watch', { enableCloudWatch, key });
    if (typeof enableCloudWatch !== 'boolean') {
        return {
            key,
            status: 'error',
            message: 'Do you want to enable CloudWatch monitoring',
            allowedValues: [
                { label: 'Yes', value: true },
                { label: 'No', value: false }
            ]
        };
    }
    return {
        key,
        value: enableCloudWatch
    };
}

async function validateTags(key: string, tags?: Array<{ key: string; value: string }>) {
    logger.info(' Validate Cloud Watch', { tags, key });
    if (!tags) {
        return {
            key,
            status: 'error',
            message: 'Add upto 40 tags',
            type: 'tags'
        };
    }
    return {
        key,
        value: tags
    };
}

async function validateDomain(
    credentialsId: string,
    region: string,
    domainDnsname: string,
    dnsIp: string,
    key: string
) {
    logger.debug('Validate Domain DNS', { credentialsId, region, domainDnsname, key });
    const { directories } = await getAdsList(credentialsId, region);
    if (!domainDnsname) {
        return {
            key,
            status: 'error',
            message: 'Select the domain DNS name.',
            allowCreate: true,
            allowedValues: uniqBy(
                directories.map(({ domainName }) => ({
                    label: domainName,
                    value: domainName
                })),
                'value'
            )
        };
    }
    const errorResponse = { status: 'error', message: 'Enter the value of domain ip address', type: 'text' };
    const isAWSManagedDomain = directories?.find(({ domainName }) => domainName === domainDnsname);
    switch (key) {
        case DOMAIN_DNS:
            return { key, value: domainDnsname };
        case AD_SCENARIO_TYPE:
            return { key, value: isAWSManagedDomain ? AWS_MANAGED_AD : USER_MANAGED_AD };
        case DNS_IP:
            return isAWSManagedDomain
                ? { key, value: isAWSManagedDomain?.dnsIpAddress?.join(',') }
                : dnsIp
                ? { key, value: dnsIp }
                : { key, ...errorResponse };
        default:
            return {};
    }
}

function validateText(text: string, key: string, fsxType?: string) {
    if (!text) {
        return {
            key,
            status: 'error',
            message: `Enter a value for ${KEY_LABEL_MAP[key as keyof typeof KEY_LABEL_MAP]}`,
            type: key.toLowerCase().includes('password') ? 'password' : 'text',
            ...(key === FSX_USERNAME && fsxType === NEW && { disable: true, default: 'fsxadmin' })
        };
    }
    return { key, value: text };
}

function validateDbSize(size: number, key: string) {
    logger.debug('Validate DB Size', { size });
    if (!size || typeof size !== 'number' || (size < 120 && size >= 133120)) {
        return {
            key,
            status: 'error',
            message: 'Enter a value for data drive size(GiB) between 120 to 133120',
            type: 'number'
        };
    }

    return {
        key,
        value: size
    };
}

function validateThroughPut(iops: number, key: string) {
    logger.debug('Validate ThroughPut', { iops });
    const ThroughPut = [];
    for (let i = 0; i <= 5; i++) {
        ThroughPut.push({ label: `${128 * 2 ** i} Mbps`, value: 128 * 2 ** i });
    }
    if (!iops) {
        return {
            key,
            status: 'error',
            message: 'Select a throughput capacity.',
            allowedValues: ThroughPut
        };
    }

    const isValid = ThroughPut.find(({ value }) => value === iops);
    if (!isValid) {
        return {
            key,
            status: 'error',
            message:
                'The throughput capacity value that you provided is not correct. Please provide a valid throughput capacity.',
            allowedValues: ThroughPut
        };
    }
    return { key, value: isValid.value };
}

async function validateSecurityGroup(
    credentialsId: string,
    region: string,
    vpcId: string,
    securityGroup: string,
    key: string
) {
    logger.debug('Validate Security Group', { credentialsId, region, securityGroup });
    const { vpcs } = await getVpcsList(credentialsId, region, 'securityGroup');

    const vpc = vpcs.find(({ id }) => id === vpcId);
    const secGrp = vpc?.securityGroups || [];

    if (!securityGroup) {
        return {
            key,
            status: 'error',
            message: 'Select an AWS security group.',
            allowedValues: secGrp.map(({ id, securityGroupName }) => ({
                label: securityGroupName,
                value: id
            }))
        };
    }

    const isValid = secGrp?.find(({ id }) => securityGroup === id);
    if (!isValid) {
        return {
            key,
            status: 'error',
            message: 'The security group that you provided is not correct. Please provide a valid security group.',
            allowedValues: secGrp.map(({ id, securityGroupName }) => ({
                label: securityGroupName,
                value: id
            }))
        };
    }
    return {
        key,
        value: isValid.id
    };
}

async function validateSqlDeploymentType(deploymentType: string, key: string) {
    logger.debug('Validate sql deployment mode', { deploymentType });
    if (![STANDALONE, FCI].includes(deploymentType)) {
        return {
            key,
            status: 'error',
            message: 'Select database deployment model.',
            allowedValues: [
                { label: 'Single Instance', value: STANDALONE },
                { label: 'Failover Cluster Instance (FCI)', value: FCI }
            ]
        };
    }
    return { key, value: deploymentType };
}

function checkFsxType(type: string, key: string) {
    if (type?.toUpperCase() !== NEW && type?.toUpperCase() !== EXISTING) {
        return {
            key,
            status: 'error',
            message: 'Select a FSx type.',
            allowedValues: [
                { label: 'New', value: NEW },
                { label: 'Existing', value: EXISTING }
            ]
        };
    }
    return {
        key,
        value: type.toUpperCase()
    };
}

function validateDeploymentEnv(key: string, value: string) {
    if ([PROD, DEV, CUSTOM].includes(value)) {
        return {
            key,
            value
        };
    }

    return {
        key,
        status: 'error',
        message: 'Select a deployment environment',
        allowedValues: [
            { label: 'Production', value: PROD },
            { label: 'Develpoment', value: DEV },
            { label: 'Custom', value: CUSTOM }
        ]
    };
}

export {
    validateRegion,
    validateVpcId,
    validateKeyName,
    validateImageId,
    validateInstanceType,
    validateDomain,
    validateText,
    validateDbSize,
    validateThroughPut,
    validateSecurityGroup,
    validateSqlDeploymentType,
    validateCredentials,
    validateAdScenarioType,
    checkFsxType,
    validateFsx,
    validateCloudWatch,
    validateTags,
    validateDeploymentEnv
};
