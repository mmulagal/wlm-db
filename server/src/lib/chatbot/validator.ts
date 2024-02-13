import { isEmpty, uniqBy } from 'lodash-es';
import randomize from 'randomatic';
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
    CUSTOM,
    M5_2XL,
    FCI_ABBREVIATION,
    MULTI_AZ_SMALL,
    SINGLE_AZ_SMALL,
    M5_XL,
    SQL_SERVER_NAME,
    ENCRYPTION_KEY,
    THROUGHPUT,
    FSX_ADMIN
} from './consts';
import { getCredentials } from '../../operations/cloud-manager/credentials-operations';
import { getFSxFileSystemsList } from '../../operations/aws/fsx-operations';
import { VPC } from '../../utils/common-types';

const logger = getLogger();

async function validateCredentials(credentialsId: string, key: string) {
    logger.debug('Validate Credentials', { credentialsId });
    const CREDENTIAL_PATH = '/credentials';
    const credentials = (await getCredentials('aws_assume_role')) || [];

    const errorObj = {
        key,
        status: 'error',
        link: {
            text: 'Credentials',
            path: CREDENTIAL_PATH,
            description: 'To add a new credentials, visit'
        },
        allowedValues: credentials?.map(credential => ({
            label: credential.name,
            value: credential.credentialsId
        })),
        data: credentials
    };

    if (isEmpty(credentials)) {
        return {
            ...errorObj,
            message: 'No credentials found, please add and try again'
        };
    }

    if (!credentialsId) {
        return {
            ...errorObj,
            message: 'Select AWS credentials to use for the deployment'
        };
    }

    const credentialsMatched = credentials?.find(reg => reg.credentialsId === credentialsId);
    if (!credentialsMatched) {
        return {
            ...errorObj,
            message:
                'The credential that you provided is not valid. Please select a set of credentials from the list below.'
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

    const errorObj = {
        key,
        status: 'error',
        allowedValues: regions.map(reg => ({ label: reg.regionName, value: reg.regionCode })),
        data: regions
    };

    if (isEmpty(regions)) {
        return {
            ...errorObj,
            message: 'No regions found, please try again'
        };
    }

    if (!value) {
        return {
            ...errorObj,
            message: 'Select a region'
        };
    }

    const regionsMatched = regions?.filter(
        reg => reg.regionName?.toLowerCase()?.includes(value?.toLowerCase()) || reg.regionCode === value
    );
    // // console.log(regionsMatched);
    if (regionsMatched.length !== 1) {
        return {
            ...errorObj,
            message: `${
                regionsMatched.length > 1
                    ? 'I found multiple regions that match what you provided.'
                    : 'The region that you provided is not valid.'
            } Please try again.`,
            ...(regionsMatched.length && {
                allowedValues: regionsMatched.map(reg => ({ label: reg.regionName, value: reg.regionCode }))
            })
        };
    }

    return {
        key,
        value: regionsMatched[0]?.regionCode
    };
}

async function validateVpcId(
    credentialsId: string,
    sqlDeploymentMode: string,
    region: string,
    vpcId: string,
    az1: string,
    az2: string,
    subnet1: string,
    subnet2: string,
    key: string
) {
    logger.debug('Validate VpcConfig', { credentialsId, region, vpcId, az1, az2, key });

    let { vpcs } = await getVpcsList(credentialsId, region, 'subnet');

    if (sqlDeploymentMode === FCI) {
        vpcs = filterValidVpcs(vpcs);
        if (vpcs.length === 0) {
            return {
                key,
                status: 'error',
                allowedValues: []
            };
        }
    }

    const allowedVpcs = vpcs?.map(vpc => ({ label: vpc.name || vpc.id, value: vpc.id }));

    const errorObj = {
        key,
        status: 'error',
        allowedValues: allowedVpcs,
        data: vpcs
    };

    if (isEmpty(vpcs)) {
        return {
            ...errorObj,
            message: 'No vpcs found, please try again'
        };
    }

    if (!vpcId) {
        return {
            ...errorObj,
            message: key === VPC_ID ? 'Select a VPC' : 'Select a VPC CIDR for the database.'
        };
    }

    const isValidVpc = vpcs?.find(vpc => vpc.id === vpcId);
    if (!isValidVpc) {
        return {
            ...errorObj,
            message: 'The VPC that you provided is not correct. Please choose a different VPC.'
        };
    }

    const azs = uniqBy(
        isValidVpc.subnets?.map(({ availabilityZone }) => ({ label: availabilityZone, value: availabilityZone })),
        'value'
    );

    errorObj.allowedValues = azs;

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
                    ...errorObj,
                    message: 'Select an Availability Zone for the primary SQL node 1'
                };
            }
            const subnets = vpcs?.map(vpc => vpc?.subnets);
            const isValidAZ = subnets?.flat().find(subnet => subnet?.availabilityZone === az1);
            logger.debug('isValidAZ', isValidAZ);
            if (!isValidAZ) {
                return {
                    ...errorObj,
                    message:
                        'The availability zone that you provided is not correct. Please choose a different availability zone.'
                };
            }
            return {
                key,
                value: az1
            };
        }
        case AZ_2: {
            errorObj.allowedValues = azs.filter(az => az.value !== az1);

            if (!az2) {
                return {
                    ...errorObj,
                    message: 'Select an Availability Zone for the primary SQL node 2'
                };
            }

            if (az1 === az2) {
                return {
                    key,
                    status: 'error',
                    message: 'Please select a different availability zone for the primary SQL node 2'
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
                        'The availability zone that you provided is not valid. Please choose a valid availability zone.'
                };
            }

            return {
                key,
                value: az2
            };
        }
        case PRIVATE_SUBNET_1:
        case PRIVATE_SUBNET_2: {
            errorObj.allowedValues = uniqBy(
                isValidVpc.subnets
                    ?.filter(({ availabilityZone }) =>
                        key === PRIVATE_SUBNET_1 ? availabilityZone === az1 : availabilityZone === az2
                    )
                    ?.map(({ id, name }) => ({
                        label: name,
                        value: id
                    })),
                'value'
            );

            if ((key === PRIVATE_SUBNET_1 && !subnet1) || (key === PRIVATE_SUBNET_2 && !subnet2)) {
                return {
                    ...errorObj,
                    message: `Select a subnet for AZ ${key === PRIVATE_SUBNET_1 ? 'node 1' : 'node 2'}`
                };
            }

            const isValidSubnet = isValidVpc.subnets
                ?.filter(({ availabilityZone }) =>
                    key === PRIVATE_SUBNET_1 ? availabilityZone === az1 : availabilityZone === az2
                )
                ?.find(({ id }) => (key === PRIVATE_SUBNET_1 ? id === subnet1 : id === subnet2));

            if (!isValidSubnet) {
                return {
                    ...errorObj,
                    message: 'The subnet that you provided is not valid, Please choose a valid subnet.'
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

    const errorObj = {
        key,
        status: 'error',
        allowedValues: keys?.map(({ name }) => ({ label: name, value: name })),
        data: keys
    };

    if (!keyName) {
        return {
            ...errorObj,
            message: 'Select a key pair'
        };
    }

    const isValidKey = keys?.find(({ name, id }) => name === keyName || id === keyName);

    if (!isValidKey) {
        return {
            ...errorObj,
            message: 'The key pair that you provided is not valid. Please select a valid key pair.'
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

    // setting up the first value from the array list as the default ami selected
    return {
        key,
        value: filteredAmis[0]?.imageId
    };
}

function validateAdScenarioType(type: string, key: string) {
    if (type === 'AWS_MANAGED_AD' || type === 'USER_MANAGED_AD') {
        return {
            key,
            value: type
        };
    }

    return {
        key,
        status: 'error',
        message: 'Select a domain type',
        allowedValues: [
            { label: 'Add new domain', value: USER_MANAGED_AD },
            { label: 'Select an existing domain', value: AWS_MANAGED_AD }
        ]
    };
}

async function validateInstanceType(credentialsId: string, region: string, workloadInstanceType: string, key: string) {
    logger.debug('Validate Instance Type', { credentialsId, region, workloadInstanceType });
    const { instanceTypes } = await getInstanceTypes(credentialsId, region);

    const errorObj = {
        key,
        status: 'error',
        allowedValues: instanceTypes.map(({ instanceType }) => ({
            label: instanceType,
            value: instanceType
        })),
        data: instanceTypes
    };

    if (!workloadInstanceType) {
        return {
            ...errorObj,
            message: 'Select an EC2 instance type.'
        };
    }

    const isValidType = instanceTypes?.find(({ instanceType }) => instanceType === workloadInstanceType);
    if (!isValidType) {
        return {
            ...errorObj,
            message: 'The instance type that you provided is not correct. Please select a valid EC2 instance type.'
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
    const errorObj = {
        key,
        status: 'error',
        allowedValues: filesystems?.map(({ name, fileSystemId }) => ({
            label: `${name ? `${name} | ` : ''}${fileSystemId}`,
            value: fileSystemId
        })),
        data: filesystems
    };
    if (!fsxId) {
        return {
            ...errorObj,
            message: 'Select a file system'
        };
    }
    const isValidFsx = filesystems?.find(filesystem => filesystem?.fileSystemId === fsxId);
    if (!isValidFsx) {
        return {
            ...errorObj,
            message: 'The fsx information that you provided is not correct. Please provide a valid fsx information.'
        };
    }

    if (key === ENCRYPTION_KEY) {
        return {
            key,
            value: isValidFsx?.kmsKeyId
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
    adType: string,
    key: string
) {
    logger.debug('Validate Domain DNS', { credentialsId, region, domainDnsname, adType, key });
    const { directories } = await getAdsList(credentialsId, region);
    if (!domainDnsname && adType === USER_MANAGED_AD) {
        return { key, status: 'error', message: 'Enter a domain name', type: 'text' };
    }
    if (!domainDnsname && adType === AWS_MANAGED_AD) {
        return {
            key,
            status: 'error',
            message: 'Select a domain',
            allowedValues: uniqBy(
                directories.map(({ domainName }) => ({
                    label: domainName,
                    value: domainName
                })),
                'value'
            ),
            data: directories
        };
    }
    const errorResponse = { status: 'error', message: 'Enter the DNS IP address', type: 'text' };
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
    // setting default value for sqlServerName if not provided from ui
    if (key === SQL_SERVER_NAME && !text) {
        text = `sqldatabase${randomize('a0', 4)}`;
    }

    const errorObj = {
        key,
        status: 'error',
        message: `${KEY_LABEL_MAP[key as keyof typeof KEY_LABEL_MAP]}`,
        type: key.toLowerCase().includes('password') ? 'password' : 'text'
    };

    if (key === FSX_USERNAME) {
        if (fsxType === NEW) {
            return { key, value: FSX_ADMIN };
        }

        if (!text) {
            return {
                ...errorObj,
                default: FSX_ADMIN
            };
        }
    }

    if (!text) {
        return errorObj;
    }

    return { key, value: text };
}

function validateDbSize(size: number, key: string) {
    logger.debug('Validate DB Size', { size });
    if (!size || typeof size !== 'number' || (size < 120 && size >= 133120)) {
        return {
            key,
            status: 'error',
            message:
                'Enter a data drive size\nSpecify the SQL data drive size only in GiB. The provisioning for log drive, tempdb and other FSx for ONTAP file system volumes (including LUNs), will be performed according to NetApp best practices for SQL configuration.',
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
    return { key, value: THROUGHPUT };
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

    const errorObj = {
        key,
        status: 'error',
        allowedValues: secGrp.map(({ id, securityGroupName }) => ({
            label: securityGroupName,
            value: id
        }))
    };

    if (!securityGroup) {
        return {
            ...errorObj,
            message: 'Select an AWS security group.'
        };
    }

    const isValid = secGrp?.find(({ id }) => securityGroup === id);
    if (!isValid) {
        return {
            ...errorObj,
            message: 'The security group that you provided is not correct. Please provide a valid security group.'
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
            message: 'Select a database deployment model',
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
            message: 'Select an FSx for ONTAP file system',
            allowedValues: [
                { label: 'Create a new file system', value: NEW },
                { label: 'Select an existing file system', value: EXISTING }
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
        message: 'Select a configuration model',
        allowedValues: [
            {
                label: 'Production model',
                value: PROD,
                data: [
                    { label: 'SQL Deployment model', value: FCI_ABBREVIATION },
                    { label: 'Deployment model', value: MULTI_AZ_SMALL },
                    { label: 'Database size', value: '500 GiB' },
                    { label: 'Instance type', value: M5_2XL }
                ]
            },
            {
                label: 'Dev/Test model',
                value: DEV,
                data: [
                    { label: 'SQL Deployment model', value: 'Standalone' },
                    { label: 'Deployment model', value: SINGLE_AZ_SMALL },
                    { label: 'Database size', value: '120 GiB' },
                    { label: 'Instance type', value: M5_XL }
                ]
            },
            { label: 'Deploy on your own', value: CUSTOM }
        ],
        type: 'card'
    };
}

function filterValidVpcs(vpcs: Array<VPC>) {
    logger.debug('FILTER VPCS>>>', vpcs);
    return vpcs.filter(vpc => {
        const azs = uniqBy(vpc.subnets, 'availabilityZone');
        if (azs.length <= 1) {
            return false;
        }

        const routeTables = uniqBy(vpc.subnets, 'routeTableId');

        if (routeTables.length <= 1) {
            return false;
        }

        return true;
    });
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
