import { describe, it, expect } from 'vitest';

import { findAssessmentHostForInventoryKey, uniqueHostRow } from './InventoryUtilsV2';

describe('findAssessmentHostForInventoryKey', () => {
    const cred = 'cred-1';
    const region = 'us-east-1';
    const ec2Id = 'i-ec2-host';
    const managedHostId = 'managed-host-1';
    const inventoryKey = uniqueHostRow(ec2Id, cred, region);

    const inventoryHost = {
        ec2InstanceId: ec2Id,
        resourceId: managedHostId,
        credentialId: cred,
        regionId: region
    };

    it('matches by direct inventory key', () => {
        const assessmentHosts = [
            {
                databaseHostId: ec2Id,
                credentialId: cred,
                regionId: region,
                instancesAssessment: [{ databaseInstanceName: 'INST1' }]
            }
        ];
        expect(findAssessmentHostForInventoryKey(assessmentHosts, inventoryKey, inventoryHost)).toEqual(
            assessmentHosts[0]
        );
    });

    it('matches registered assessment host id against EC2-keyed inventory row', () => {
        const assessmentHosts = [
            {
                databaseHostId: 'i-ec2',
                credentialId: cred,
                regionId: region,
                isUnregistered: true,
                instancesAssessment: [{ databaseInstanceName: 'ALLALLOWED' }]
            },
            {
                databaseHostId: managedHostId,
                credentialId: cred,
                regionId: region,
                isUnregistered: false,
                isWad: false,
                instancesAssessment: [{ databaseInstanceName: 'ALLALLOWED' }]
            }
        ];
        expect(
            findAssessmentHostForInventoryKey(assessmentHosts, inventoryKey, inventoryHost, { registeredOnly: true })
        ).toEqual(assessmentHosts[1]);
    });

    it('prefers unregistered host by default when both exist', () => {
        const assessmentHosts = [
            {
                databaseHostId: ec2Id,
                credentialId: cred,
                regionId: region,
                isUnregistered: true,
                instancesAssessment: [{ databaseInstanceName: 'DOMAINLOGIN1' }]
            },
            {
                databaseHostId: managedHostId,
                credentialId: cred,
                regionId: region,
                isUnregistered: false,
                instancesAssessment: [{ databaseInstanceName: 'ALLALLOWED' }]
            }
        ];
        expect(findAssessmentHostForInventoryKey(assessmentHosts, inventoryKey, inventoryHost)).toEqual(
            assessmentHosts[0]
        );
    });
});
