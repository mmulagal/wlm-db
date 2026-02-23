import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
    selectDefaultSecurityGroup,
    selectDefaultInstanceType,
    selectDefaultEncryption,
    selectDefaultLicense,
    selectDefaultCollation,
    selectFsxThroughput,
    selectFsxIops,
    selectFsxKmsKey
} from './MSSqlUtils';
import { GENERAL } from '../../../utils/appConstants';
import { DEAFULT_INSTANCE_VALUE, FORM_OPTIONS } from '../../../utils/consts';

vi.mock('../../../store/store.ts', () => ({
    default: {
        getState: vi.fn(() => ({
            mssqlForm: {
                throughput: null,
                provisionedIOPS: { IOPSValue: null }
            }
        }))
    }
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatSize: vi.fn((value, unit) => `${value}${unit}`),
    generateOptionType: vi.fn((value, label, label2, disabled, extra, data) => ({
        value,
        label: label || value,
        label2,
        isDisabled: disabled,
        data
    })),
    isFsxnExisting: vi.fn(type => type === 'EXISTING')
}));

describe('MSSqlUtils', () => {
    let mockDispatch: any;

    beforeEach(() => {
        mockDispatch = vi.fn();
        vi.clearAllMocks();
    });

    describe('selectDefaultSecurityGroup', () => {
        it('dispatches setSelectedSecurityGroup with GENERATED_SECURITY_GROUP', () => {
            selectDefaultSecurityGroup(mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setSelectedSecurityGroup') })
            );
        });

        it('dispatches setSelectedExistingSecurityGroup with empty string', () => {
            selectDefaultSecurityGroup(mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setSelectedExistingSecurityGroup') })
            );
        });
    });

    describe('selectDefaultInstanceType', () => {
        it('dispatches setInstanceType when instanceTypeData has instances', () => {
            const instanceTypeData = {
                instanceTypes: [
                    {
                        instanceType: DEAFULT_INSTANCE_VALUE,
                        vCpus: 4,
                        ramInMib: 16384,
                        iopsInMbps: 1000
                    }
                ]
            };
            selectDefaultInstanceType(instanceTypeData, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setInstanceType') })
            );
        });

        it('handles no instanceTypeData gracefully', () => {
            selectDefaultInstanceType(null, mockDispatch);
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        it('uses first instance if default not found', () => {
            const instanceTypeData = {
                instanceTypes: [
                    {
                        instanceType: 'm5.large',
                        vCpus: 2,
                        ramInMib: 8192,
                        iopsInMbps: 500
                    }
                ]
            };
            selectDefaultInstanceType(instanceTypeData, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setInstanceType') })
            );
        });
    });

    describe('selectDefaultEncryption', () => {
        it('dispatches setEncryptionRow when kmsData has items', () => {
            const kmsData = [{ keyId: 'key-1', alias: 'alias-1' }];
            selectDefaultEncryption(kmsData, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setEncryptionRow') })
            );
        });

        it('handles empty kmsData gracefully', () => {
            selectDefaultEncryption([], mockDispatch);
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        it('handles null kmsData gracefully', () => {
            selectDefaultEncryption(null, mockDispatch);
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });

    describe('selectDefaultLicense', () => {
        it('dispatches setSelectedLicenseType and setSelectedLicenseId when amiData has AMIs', () => {
            const amiData = {
                amis: [
                    {
                        imageId: 'ami-123',
                        name: 'SQL Server 2019',
                        architecture: 'x86_64',
                        ebsVolumeSize: 100
                    }
                ]
            };
            selectDefaultLicense(amiData, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setSelectedLicenseType') })
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setSelectedLicenseId') })
            );
        });

        it('handles no amiData gracefully', () => {
            selectDefaultLicense(null, mockDispatch);
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        it('handles empty amis array gracefully', () => {
            selectDefaultLicense({ amis: [] }, mockDispatch);
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });

    describe('selectDefaultCollation', () => {
        it('dispatches setSqlServerCollation with default collation', () => {
            const collationData = {
                collationList: [
                    { name: 'SQL_Latin1_General_CP1_CI_AS', description: 'Default collation' },
                    { name: 'SQL_Latin1_General_CP1_CS_AS', description: 'Case sensitive' }
                ],
                defaultCollation: 'SQL_Latin1_General_CP1_CI_AS'
            };
            selectDefaultCollation(collationData, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setSqlServerCollation') })
            );
        });

        it('uses first collation if default not found', () => {
            const collationData = {
                collationList: [{ name: 'SQL_Latin1_General_CP1_CI_AS', description: 'Default collation' }],
                defaultCollation: 'NonExistent'
            };
            selectDefaultCollation(collationData, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setSqlServerCollation') })
            );
        });

        it('dispatches null when no collationList', () => {
            selectDefaultCollation(null, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setSqlServerCollation') })
            );
        });
    });

    describe('selectFsxThroughput', () => {
        it('handles existing FSxN with throughput <= 512', () => {
            const selectedExistingFsxnName = { data: { throughput: 256 } };
            selectFsxThroughput('EXISTING', selectedExistingFsxnName, '128', mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setThroughputValue') })
            );
        });

        it('handles existing FSxN with throughput > 512', () => {
            const selectedExistingFsxnName = { data: { throughput: 1024 } };
            selectFsxThroughput('EXISTING', selectedExistingFsxnName, '128', mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setThroughputValue') })
            );
        });

        it('sets default value for new FSxN', () => {
            selectFsxThroughput('NEW', null, '128', mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setThroughputValue') })
            );
        });
    });

    describe('selectFsxIops', () => {
        it('sets user provisioned IOPS for existing FSxN', () => {
            const selectedExistingFsxnName = { data: { iops: 3000 } };
            selectFsxIops('EXISTING', selectedExistingFsxnName, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setProvisionedType') })
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setProvisionedIOPSValue') })
            );
        });

        it('sets automatic IOPS for new FSxN', () => {
            selectFsxIops('NEW', null, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setProvisionedType') })
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setProvisionedIOPSValue') })
            );
        });
    });

    describe('selectFsxKmsKey', () => {
        it('sets encryption from other account for existing FSxN', () => {
            const selectedExistingFsxnName = { data: { kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/abc-123' } };
            selectFsxKmsKey('EXISTING', selectedExistingFsxnName, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setEncryptionType') })
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setEncryptionARN') })
            );
        });

        it('sets encryption from account for new FSxN', () => {
            selectFsxKmsKey('NEW', null, mockDispatch);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setEncryptionType') })
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('setEncryptionARN') })
            );
        });
    });
});
