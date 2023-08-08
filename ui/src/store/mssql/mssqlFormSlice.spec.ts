import mssqlFormSlice, {
    setCloudWatch,
    setDBCredentialsName,
    setDBCredentialsPassword,
    setDBName,
    setDBVersion,
    setEncryptionARN,
    setEncryptionRow,
    setEncryptionType,
    setExistingFsxnName,
    setFsxNExistingUserName,
    setFsxNName,
    setFsxNPassword,
    setFsxNType,
    setInstanceType,
    setProvisionedIOPSValue,
    setProvisionedType,
    setSelectedADDomainAddress,
    setSelectedADDomainName,
    setSelectedADPassword,
    setSelectedADUserName,
    setSelectedAzNode1,
    setSelectedAzNode2,
    setSelectedCredentials,
    setSelectedCustomAMI,
    setSelectedDBDeploymentModel,
    setSelectedDBEdition,
    setSelectedExistingSecurityGroup,
    setSelectedKeyPair,
    setSelectedLicenseId,
    setSelectedLicenseType,
    setSelectedOperatingSystem,
    setSelectedRegionData,
    setSelectedSecurityGroup,
    setSelectedSubnetNode1,
    setSelectedSubnetNode2,
    setSelectedVPC,
    setSNSARN,
    setSNSState,
    setStorageCapacity,
    setStorageUnit,
    setTags,
    setThroughputValue
} from './mssqlFormSlice';
import { createStore } from '@reduxjs/toolkit';

describe('mssqlFormSlice', () => {
    let store: any;

    beforeEach(() => {
        store = createStore(mssqlFormSlice.reducer);
    });

    // Test cases for each action
    describe('setSelectedADDomainName', () => {
        it('setSelectedADDomainName should create an action with the correct payload', () => {
            const domainName = 'example.com';

            store.dispatch(setDBName(domainName));

            expect(store.getState().dbName).toEqual('example.com');
        });

        it('should test setSelectedCredentials', () => {
            store.dispatch(setSelectedCredentials('account id'));
            expect(store.getState().awsAccount.selectedCredential).toEqual('account id');
        });

        it('should test setSelectedOperatingSystem', () => {
            store.dispatch(setSelectedOperatingSystem('win 2016'));
            expect(store.getState().operatingSystem).toEqual('win 2016');
        });

        it('should test setDBVersion', () => {
            store.dispatch(setDBVersion('win 2016'));
            expect(store.getState().dbVersion).toEqual('win 2016');
        });

        it('should test setSelectedSecurityGroup', () => {
            store.dispatch(setSelectedSecurityGroup('existing'));
            expect(store.getState().securityGroup.selectedSecurityType).toEqual('existing');
        });

        it('should test setSelectedExistingSecurityGroup', () => {
            store.dispatch(setSelectedExistingSecurityGroup('existing'));
            expect(store.getState().securityGroup.selectedExistingSecurityGroup).toEqual('existing');
        });

        it('should test setSelectedRegionData', () => {
            store.dispatch(setSelectedRegionData('existing'));
            expect(store.getState().regionAndVpc.selectedRegion).toEqual('existing');
        });

        it('should test setSelectedVPC', () => {
            store.dispatch(setSelectedVPC('existing'));
            expect(store.getState().regionAndVpc.selectedVPC).toEqual('existing');
        });

        it('should test AZ', () => {
            store.dispatch(setSelectedAzNode1('existing'));
            expect(store.getState().availabilityZones.selectedAzNode1).toEqual('existing');

            store.dispatch(setSelectedAzNode2('existing'));
            expect(store.getState().availabilityZones.selectedAzNode2).toEqual('existing');

            store.dispatch(setSelectedSubnetNode1('existing'));
            expect(store.getState().availabilityZones.selectedSubnetNode1).toEqual('existing');

            store.dispatch(setSelectedSubnetNode2('existing'));
            expect(store.getState().availabilityZones.selectedSubnetNode2).toEqual('existing');
        });

        it('should test setSelectedDBDeploymentModel', () => {
            store.dispatch(setSelectedDBDeploymentModel('existing'));
            expect(store.getState().dbDeploymentModel).toEqual('existing');
        });

        it('should test setSelectedDBEdition', () => {
            store.dispatch(setSelectedDBEdition('existing'));
            expect(store.getState().dbEdition).toEqual('existing');
        });

        it('should test License actions', () => {
            store.dispatch(setSelectedLicenseType('existing'));
            expect(store.getState().license.selectedLicenseType).toEqual('existing');

            store.dispatch(setSelectedLicenseId('123'));
            expect(store.getState().license.selectedLicenseId).toEqual('123');

            store.dispatch(setSelectedCustomAMI('existing'));
            expect(store.getState().license.selectedCustomAMI).toEqual('existing');
        });

        it('should test setTags', () => {
            store.dispatch(setTags('existing'));
            expect(store.getState().tags).toEqual('existing');
        });

        it('should test Encryption actions', () => {
            store.dispatch(setEncryptionType('existing'));
            expect(store.getState().encryption.encryptionType).toEqual('existing');

            store.dispatch(setEncryptionRow('existing'));
            expect(store.getState().encryption.selectedRow).toEqual('existing');

            store.dispatch(setEncryptionARN('existing'));
            expect(store.getState().encryption.encryptionArn).toEqual('existing');
        });

        it('should test cloudWatch', () => {
            store.dispatch(setCloudWatch('existing'));
            expect(store.getState().cloudWatch).toEqual('existing');
        });

        it('should test SNS actions', () => {
            store.dispatch(setSNSState('existing'));
            expect(store.getState().simpleNotification.snsState).toEqual('existing');

            store.dispatch(setSNSARN('existing'));
            expect(store.getState().simpleNotification.snsARN).toEqual('existing');
        });

        it('should test setThroughputValue', () => {
            store.dispatch(setThroughputValue('existing'));
            expect(store.getState().throughput).toEqual('existing');
        });

        it('should test Provisioned actions', () => {
            store.dispatch(setProvisionedType('existing'));
            expect(store.getState().provisionedIOPS.provisionedType).toEqual('existing');

            store.dispatch(setProvisionedIOPSValue('existing'));
            expect(store.getState().provisionedIOPS.IOPSValue).toEqual('existing');
        });

        it('should test Storage capacity actions', () => {
            store.dispatch(setStorageCapacity('existing'));
            expect(store.getState().storageCapacity.capacity).toEqual('existing');

            store.dispatch(setStorageUnit('existing'));
            expect(store.getState().storageCapacity.unit).toEqual('existing');
        });

        it('should test FSxN actions', () => {
            store.dispatch(setFsxNType('existing'));
            expect(store.getState().fsxN.fsxNType).toEqual('existing');

            store.dispatch(setFsxNName('existing'));
            expect(store.getState().fsxN.fsxNName).toEqual('existing');

            store.dispatch(setFsxNExistingUserName('existing'));
            expect(store.getState().fsxN.fsxNExistingUserName).toEqual('existing');

            store.dispatch(setFsxNPassword('existing'));
            expect(store.getState().fsxN.fsxNPassword).toEqual('existing');

            store.dispatch(setExistingFsxnName('existing'));
            expect(store.getState().fsxN.fsxNExistingName).toEqual('existing');
        });

        it('should test setInstanceType', () => {
            store.dispatch(setInstanceType('existing'));
            expect(store.getState().instanceType).toEqual('existing');
        });

        it('should test AD actions', () => {
            store.dispatch(setSelectedADDomainName('existing'));
            expect(store.getState().activeDirectory.domainName).toEqual('existing');

            store.dispatch(setSelectedADDomainAddress('existing'));
            expect(store.getState().activeDirectory.domainAddress).toEqual('existing');

            store.dispatch(setSelectedADUserName('existing'));
            expect(store.getState().activeDirectory.userName).toEqual('existing');

            store.dispatch(setSelectedADPassword('existing'));
            expect(store.getState().activeDirectory.password).toEqual('existing');
        });

        it('should test DB credentials', () => {
            store.dispatch(setDBCredentialsName('existing'));
            expect(store.getState().dbCredentials.name).toEqual('existing');

            store.dispatch(setDBCredentialsPassword('existing'));
            expect(store.getState().dbCredentials.password).toEqual('existing');
        });

        it('should test setSelectedKeyPair', () => {
            store.dispatch(setSelectedKeyPair('existing'));
            expect(store.getState().keyPair.selectedKeyPair).toEqual('existing');
        });
    });
});
