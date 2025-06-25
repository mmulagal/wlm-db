import { promises, existsSync, readFileSync } from 'fs';
import YAML from 'yaml';
import getLogger from '../../utils/logger';
import { DiagramDefinition, Resources } from './diagram-type';
import { execute } from '../../utils/prisma-utils';
import { DatabaseHostSummaryForMultiInstanceResponseType } from '../../routes/types/database-hosts.types';
import { AWSDAC_MODULE_DIR } from '../../utils/consts';

const logger = getLogger();

function generateDiagramDefinition(
    nodeTopology: DatabaseHostSummaryForMultiInstanceResponseType['nodeTopology'],
    dbInstanceSummary: DatabaseHostSummaryForMultiInstanceResponseType['databaseInstancesSummary']
): DiagramDefinition {
    const { awsAccount, region, vpcId, vpcName, keyPairName, activeDirectoryDetails } = nodeTopology || {};

    const baseDiagram: DiagramDefinition = {
        Diagram: {
            DefinitionFiles: [
                {
                    Type: 'URL',
                    Url: 'https://raw.githubusercontent.com/awslabs/diagram-as-code/main/definitions/definition-for-aws-icons-light.yaml'
                }
            ],
            Resources: {
                Canvas: {
                    Type: 'AWS::Diagram::Canvas',
                    Children: ['AWSCloud']
                },
                AWSCloud: {
                    Type: 'AWS::Diagram::Cloud',
                    Preset: 'AWSCloudNoLogo',
                    Title: awsAccount ? `AWS Account Id: ${awsAccount}` : 'AWS Cloud',
                    Children: ['Region']
                },
                Region: {
                    Type: 'AWS::Region',
                    Title: region,
                    Children: ['VPC']
                },
                VPC: {
                    Type: 'AWS::EC2::VPC',
                    Title: vpcName || vpcId ? `${vpcName}\n${vpcId}` : 'VPC',
                    Direction: 'vertical',
                    Children: ['AuthStack', 'AZStack']
                },
                AuthStack: {
                    Type: 'AWS::Diagram::HorizontalStack',
                    Children: ['KeyPair', 'ActiveDirectory']
                },
                KeyPair: {
                    Type: 'AWS::Diagram::Resource',
                    Preset: 'Add-on',
                    Title: keyPairName ? `KeyPair: ${keyPairName}` : 'Key Pair'
                },
                ActiveDirectory: {
                    Type: 'AWS::DirectoryService::MicrosoftAD',
                    Title: activeDirectoryDetails
                        ? `AD: ${activeDirectoryDetails.name}\n${activeDirectoryDetails.address}`
                        : 'Active Directory'
                }
            },
            Links: []
        }
    };

    const { fileSystemDeploymentMode, fileSystemName, fileSystemId } =
        dbInstanceSummary?.[0]?.databaseInstanceTopology || {};
    const isFSxMultiAZ = fileSystemDeploymentMode?.toLowerCase().includes('multi');

    const extendedResources: Resources = {};
    const azStackChildren: string[] = [];

    if (isFSxMultiAZ) {
        baseDiagram.Diagram.Resources.VPC.Children = ['AuthStack', 'AZStack', 'FSxStack'];

        extendedResources.FSxStack = {
            Type: 'AWS::EC2::AvailabilityZone',
            Title: fileSystemDeploymentMode,
            Children: ['FSx']
        };

        extendedResources.FSx = {
            Type: 'AWS::FSx',
            Preset: 'Amazon FSx for NetApp ONTAP',
            Title: fileSystemId || fileSystemName ? `${fileSystemName}\n${fileSystemId}` : 'FSx'
        };
    }

    const totalInstances = nodeTopology?.ec2Details?.length ?? 0;
    nodeTopology?.ec2Details?.forEach(({ availabilityZone, subnetId, name, id, ebsVolumeId }, i) => {
        const idx = i + 1;
        const azName = `AZ${idx}`;
        const subnetName = `Subnet${idx}`;
        const ec2InstanceName = `EC2Instance${idx}`;
        const fsxName = `FSx${idx}`;
        const sqlServerName = `SQLServer${idx}`;
        const ebsName = `EBS${idx}`;

        azStackChildren.push(azName);

        extendedResources[azName] = {
            Type: 'AWS::EC2::AvailabilityZone',
            Title: availabilityZone ?? azName,
            Children: [subnetName]
        };

        extendedResources[subnetName] = {
            Type: 'AWS::EC2::Subnet',
            Preset: 'PrivateSubnet',
            Title: subnetId ?? subnetName,
            Children: isFSxMultiAZ ? [ec2InstanceName] : [fsxName, ec2InstanceName]
        };

        if (!isFSxMultiAZ) {
            extendedResources[fsxName] = {
                Type: 'AWS::FSx',
                Preset: 'Amazon FSx for NetApp ONTAP',
                Title: fileSystemName || fileSystemId ? `${fileSystemName}\n${fileSystemId}` : 'FSx'
            };
        }

        extendedResources[ec2InstanceName] = {
            Type: 'AWS::EC2::Instance',
            Direction: 'vertical',
            Title: `${name}\n${id}`,
            Children: [ebsName, sqlServerName]
        };

        extendedResources[sqlServerName] = {
            Type: 'AWS::Diagram::Resource',
            Preset: 'SQL Server instance',
            Icon: `${AWSDAC_MODULE_DIR}/MSSQLServer.png`,
            Title: `SQL Server Instance ${idx}`
        };

        extendedResources[ebsName] = {
            Type: 'AWS::Diagram::Resource',
            Preset: 'Amazon Elastic Block Store (Amazon EBS)',
            Title: ebsVolumeId ? `EBS\n${ebsVolumeId}` : ebsName
        };

        baseDiagram.Diagram.Links.push({
            Source: sqlServerName,
            SourcePosition: 'S',
            Target: isFSxMultiAZ ? 'FSxStack' : fsxName,
            TargetPosition: i < totalInstances / 2 ? 'NW' : 'NE'
        });
    });

    extendedResources.AZStack = {
        Type: 'AWS::Diagram::HorizontalStack',
        Children: azStackChildren
    };

    baseDiagram.Diagram.Resources = {
        ...baseDiagram.Diagram.Resources,
        ...extendedResources
    };

    return baseDiagram;
}

function getTempFileName(requestId: string | undefined, type: 'input' | 'output'): string {
    return `/tmp/${requestId ?? (type === 'input' ? 'input' : 'output')}.${type === 'output' ? 'png' : 'yaml'}`;
}

async function deleteFile(fileName: string) {
    if (existsSync(fileName)) {
        await promises.unlink(fileName);
    }
}

async function execAwsdac(
    diagramDefn: DiagramDefinition,
    requestId: string | undefined
): Promise<{
    file?: NonSharedBuffer;
    error?: string;
}> {
    const inputFile = getTempFileName(requestId, 'input');
    const outputFile = getTempFileName(requestId, 'output');

    try {
        await promises.writeFile(inputFile, YAML.stringify(diagramDefn), 'utf8');
        logger.debug('Input file created', { inputFile });
    } catch (error) {
        logger.error('Error writing input file', { error });
        return { error: `Failed to create input config file: ${inputFile}` };
    }

    const cliCommand = `${AWSDAC_MODULE_DIR}/awsdac ${inputFile} -o ${outputFile}`;
    try {
        await execute(cliCommand);
    } catch (error) {
        logger.error('Error executing CLI command, cleaning inputFile', { error, command: cliCommand });
        await deleteFile(inputFile);
        return { error: 'Failed to execute awsdac cli command' };
    }

    if (!existsSync(outputFile)) {
        logger.error('Output file not found', { outputFileName: outputFile });
        await deleteFile(inputFile);
        return { error: `Failed to generate output file: ${outputFile}` };
    }
    const outputContent = readFileSync(outputFile);

    [inputFile, outputFile].forEach(async file => deleteFile(file));
    logger.debug('Temporary files deleted', { inputFileName: inputFile, outputFileName: outputFile });

    return { file: outputContent };
}

export { generateDiagramDefinition, execAwsdac };
