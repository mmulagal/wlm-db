import { describe, it, expect } from 'vitest';

import { MSSQL_ONE_TIME_WAD } from '../../../../../src/operations/continuous-optimization/mssql/ssm-scripts/offline-assessment';
import { MSSQL_ONE_TIME_ASSESSMENT_README } from '../../../../../src/operations/continuous-optimization/one-time-assessment-consts';
import { INSTANCE_DRIVE_DETAILS_TEMPLATE } from '../../../../../src/operations/workloads/mssql/assessment-scripts';

describe('MSSQL one-time assessment script', () => {
    it('should compare tempdb drive letter against data and log drive letters, not whole drive objects', () => {
        // Comparing a drive letter against $defaultDataDriveDetails / $defaultTempDBDriveDetails
        // (the objects) is always true in PowerShell, so shared drives were reported as separate.
        expect(MSSQL_ONE_TIME_WAD).not.toContain('-notcontains $defaultDataDriveDetails)');
        expect(MSSQL_ONE_TIME_WAD).not.toContain('$defaultTempDBDriveDetails -notcontains');
        expect(MSSQL_ONE_TIME_WAD).toContain(
            '($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultDataDriveDetails.dataDriveLetter)'
        );
        expect(MSSQL_ONE_TIME_WAD).toContain(
            '($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultLogDriveDetails.logDriveLetter)'
        );
    });

    it('should define Invoke-ONTAPRequest before the connect loop that resolves FSx IDs', () => {
        // PowerShell resolves function names when the call executes, so the definition has to be
        // spliced ahead of the Connect-OntapFilesystem loop or every FSx ID lookup fails.
        const definition = MSSQL_ONE_TIME_WAD.indexOf('Function Invoke-ONTAPRequest');
        const connectLoop = MSSQL_ONE_TIME_WAD.indexOf('Connect-OntapFilesystem -Address $addr');
        expect(definition).toBeGreaterThan(-1);
        expect(connectLoop).toBeGreaterThan(definition);
    });

    it('should read the credential source from the resolved primary filesystem context', () => {
        expect(MSSQL_ONE_TIME_WAD).toContain('credentialSource = $primaryCtx.CredentialSource');
        expect(MSSQL_ONE_TIME_WAD).not.toContain('$ontapCreds');
    });

    it('should skip adding a filesystem context when the resolved FSx key is already present', () => {
        expect(MSSQL_ONE_TIME_WAD).toContain('if ($visitedFileSystems.ContainsKey($fsKey))');
        expect(MSSQL_ONE_TIME_WAD).toContain('Skipping duplicate filesystem');
    });

    it('should resolve ONTAP identity across every filesystem, not just the primary one', () => {
        expect(MSSQL_ONE_TIME_WAD).toContain('$secondaryLunResult = Get-LunFromSerialNumber $SerialNumbers');
        expect(MSSQL_ONE_TIME_WAD).toContain('$LunResult.LunDetails += $secondaryLunResult.LunDetails');
        const primaryLookup = MSSQL_ONE_TIME_WAD.indexOf(
            '$LunResult = Get-LunFromSerialNumber $SerialNumbers $Result.VolumeSerialMapping $visitedFileSystems $instanceLevelFsxnId'
        );
        const mergeLookup = MSSQL_ONE_TIME_WAD.indexOf('$secondaryLunResult = Get-LunFromSerialNumber $SerialNumbers');
        const emptyLookupThrow = MSSQL_ONE_TIME_WAD.indexOf('Failed to retrieve ONTAP LUN volume names');
        expect(primaryLookup).toBeGreaterThan(-1);
        expect(mergeLookup).toBeGreaterThan(primaryLookup);
        expect(emptyLookupThrow).toBeGreaterThan(mergeLookup);
    });

    it('should skip per-filesystem assessment objects that have no matching volumes or LUNs', () => {
        expect(MSSQL_ONE_TIME_WAD).toContain('if ($MappedVolumeUuids.Count -gt 0 -or $MappedLunNames.Count -gt 0)');
        expect(MSSQL_ONE_TIME_WAD).toContain('volumes      = @()');
        expect(MSSQL_ONE_TIME_WAD).toContain('luns         = @()');
    });

    it('should carry instance-level sizing from the layout template onto the primary assessment', () => {
        expect(MSSQL_ONE_TIME_WAD).toMatch(/\$SharedSizingData = \$DriftAssessmentData\['sizing'\]/);
        expect(MSSQL_ONE_TIME_WAD).toMatch(/\$AssessmentsArray\[0\]\['sizing'\]\[\$sizingKey\] = \$SharedSizingData\[/);
    });

    it('should keep ethernet ports from every filesystem even when port names collide', () => {
        expect(MSSQL_ONE_TIME_WAD).not.toContain('$seenPortNames');
        expect(MSSQL_ONE_TIME_WAD).not.toContain('ContainsKey($port.name)');
        expect(MSSQL_ONE_TIME_WAD).toContain('foreach ($fsCtx in $script:FilesystemContexts)');
        expect(MSSQL_ONE_TIME_WAD).toContain('$fsxMtuInterfaces += @{ Name = $port.name; MTU = $port.mtu }');
    });

    it('should not fail the whole MTU assessment when one filesystem port fetch fails', () => {
        expect(MSSQL_ONE_TIME_WAD).toContain('if ($fsxMtuInterfaces.Count -gt 0)');
        expect(MSSQL_ONE_TIME_WAD).toContain('$fsxMtuError = $null');
        const portLoop = MSSQL_ONE_TIME_WAD.indexOf('ApiEndPoint            = "/network/ethernet/ports"');
        const clearError = MSSQL_ONE_TIME_WAD.indexOf('if ($fsxMtuInterfaces.Count -gt 0)', portLoop);
        expect(portLoop).toBeGreaterThan(-1);
        expect(clearError).toBeGreaterThan(portLoop);
    });
});

describe('MSSQL one-time assessment README', () => {
    it('should document -StorageManagementAddresses to match the script parameter', () => {
        expect(MSSQL_ONE_TIME_ASSESSMENT_README).toContain('-StorageManagementAddresses');
        expect(MSSQL_ONE_TIME_ASSESSMENT_README).not.toMatch(/-StorageManagementAddress(?!es)/);
    });
});

describe('MSSQL registered storage layout collector', () => {
    it('should compare tempdb drive letter against data and log drive letters, not whole drive objects', () => {
        const registeredLayoutScript = INSTANCE_DRIVE_DETAILS_TEMPLATE('MSSQLSERVER', false);

        expect(registeredLayoutScript).not.toContain('-notcontains $defaultDataDriveDetails )');
        expect(registeredLayoutScript).not.toContain('$defaultTempDBDriveDetails -notcontains');
        expect(registeredLayoutScript).toContain(
            '($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultDataDriveDetails.dataDriveLetter )'
        );
        expect(registeredLayoutScript).toContain(
            '($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultLogDriveDetails.logDriveLetter)'
        );
    });
});
