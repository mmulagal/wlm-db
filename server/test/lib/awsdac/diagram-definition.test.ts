import { describe, it, expect } from 'vitest';
import { generateDiagramDefinition } from '../../../src/lib/awsdac/diagram-definition';
import { AWSDAC_MODULE_DIR } from '../../../src/utils/consts';

const sampleNodeTopology = {
    awsAccount: '464262061435',
    region: 'Asia Pacific (Singapore)',
    vpcId: 'vpc-046f7e26255458373',
    vpcName: 'wlmdb-vpc',
    vpcCidr: '10.0.0.0/16',
    keyPairName: 'occm_qa',
    ec2Details: [
        {
            id: 'i-00bfe4991a8a72e00',
            ebsVolumeId: 'vol-070241c07a636f3c5',
            name: 'sqlnode-52971',
            nodeStatus: 'running',
            instanceType: 'm5.large',
            availabilityZone: 'ap-southeast-1a',
            subnetId: 'subnet-03302cffd47acd237'
        }
    ],
    activeDirectoryDetails: {
        name: 'wlmqaauto.com',
        address: '10.0.138.118,10.0.24.11'
    }
};

const sampleDatabaseInstancesSummary = [
    {
        databaseInstanceId: '1ADA3542-80EF-47C1-B263-9045AC170428',
        databaseInstanceName: 'mssqlserver',
        status: 'Up',
        nodeTopology: { ...sampleNodeTopology },
        databaseInstanceTopology: {
            serverType: 'MSSQL',
            serverInstallationMode: 'Standalone',
            fileSystemType: 'FSx for ONTAP',
            fileSystemId: 'fs-07b3de451d72ccf35',
            fileSystemName: 'wlmdb-fsx-1750376879816',
            fileSystemDeploymentMode: 'SINGLE_AZ_1',
            fileSystemStatus: 'AVAILABLE',
            fileSystemStorageCapacity: 1024,
            fileSystemThroughputCapacity: 128,
            fileSystemStorageType: 'SSD'
        },
        performance: {},
        sqlServerDeploymentType: 'Standalone'
    }
];

describe('generateDiagramDefinition with sample JSON input', () => {
    it('should generate the expected DiagramDefinition', () => {
        const diagram = generateDiagramDefinition(sampleNodeTopology, sampleDatabaseInstancesSummary);

        // AWS Cloud and Region
        expect(diagram.Diagram.Resources.AWSCloud.Title).toBe('AWS Account Id: 464262061435');
        expect(diagram.Diagram.Resources.Region.Title).toBe('Asia Pacific (Singapore)');

        // VPC should include the VPC name and id in the title
        expect(diagram.Diagram.Resources.VPC.Title).toContain('wlmdb-vpc');
        expect(diagram.Diagram.Resources.VPC.Title).toContain('vpc-046f7e26255458373');

        // For SINGLE_AZ, VPC children should not include FSxStack
        expect(diagram.Diagram.Resources.VPC.Children).toEqual(['AuthStack', 'AZStack']);

        // AZStack should include one availability zone (AZ1)
        expect(diagram.Diagram.Resources.AZStack.Children).toEqual(['AZ1']);

        // Check AZ1 resource
        const az1 = diagram.Diagram.Resources.AZ1;
        expect(az1).toBeDefined();
        expect(az1.Type).toBe('AWS::EC2::AvailabilityZone');
        expect(az1.Title).toBe('ap-southeast-1a');
        expect(az1.Children).toEqual(['Subnet1']);

        // Check Subnet1 resource; for non multi-AZ, it should have both FSx1 and EC2Instance1
        const subnet1 = diagram.Diagram.Resources.Subnet1;
        expect(subnet1).toBeDefined();
        expect(subnet1.Type).toBe('AWS::EC2::Subnet');
        expect(subnet1.Preset).toBe('PrivateSubnet');
        expect(subnet1.Title).toBe('subnet-03302cffd47acd237');
        expect(subnet1.Children).toEqual(['FSx1', 'EC2Instance1']);

        // FSx resource for instance in a non multi-AZ FSx deployment should be under FSx1 key
        const fsx1 = diagram.Diagram.Resources.FSx1;
        expect(fsx1).toBeDefined();
        expect(fsx1.Type).toBe('AWS::FSx');
        expect(fsx1.Preset).toBe('Amazon FSx for NetApp ONTAP');
        expect(fsx1.Title).toBe('wlmdb-fsx-1750376879816\nfs-07b3de451d72ccf35');

        // EC2Instance1 resource
        const ec2Instance1 = diagram.Diagram.Resources.EC2Instance1;
        expect(ec2Instance1).toBeDefined();
        expect(ec2Instance1.Type).toBe('AWS::EC2::Instance');
        expect(ec2Instance1.Direction).toBe('vertical');
        expect(ec2Instance1.Title).toBe('sqlnode-52971\ni-00bfe4991a8a72e00');
        expect(ec2Instance1.Children).toEqual(['EBS1', 'SQLServer1']);

        // SQLServer1 resource
        const sqlServer1 = diagram.Diagram.Resources.SQLServer1;
        expect(sqlServer1).toBeDefined();
        expect(sqlServer1.Type).toBe('AWS::Diagram::Resource');
        expect(sqlServer1.Preset).toBe('SQL Server instance');
        expect(sqlServer1.Icon).toBe(`${AWSDAC_MODULE_DIR}/MSSQLServer.png`);
        expect(sqlServer1.Title).toBe('SQL Server Instance 1');

        // EBS1 resource
        const ebs1 = diagram.Diagram.Resources.EBS1;
        expect(ebs1).toBeDefined();
        expect(ebs1.Type).toBe('AWS::Diagram::Resource');
        expect(ebs1.Preset).toBe('Amazon Elastic Block Store (Amazon EBS)');
        expect(ebs1.Title).toBe('EBS\nvol-070241c07a636f3c5');
        expect(diagram.Diagram.Links).toHaveLength(1);
        expect(diagram.Diagram.Links[0]).toEqual({
            Source: 'SQLServer1',
            SourcePosition: 'S',
            Target: 'FSx1',
            TargetPosition: 'NW'
        });
    });
});
