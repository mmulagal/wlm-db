import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as asyncLocalStorage from '../../src/utils/async-local-storage';
import { GOV_ACCOUNT } from '../../src/utils/consts';
import {
    validateSsmArnFormat,
    validateCredentialJsonStructure,
    validateDeploymentConfigSsmArn
} from '../../src/utils/ssm-arn-validator';

const VALID_GOV_ARN = 'arn:aws-us-gov:ssm:us-gov-west-1:123456789012:parameter/netapp/wlmdb/fs-abc123';
const COMMERCIAL_ARN = 'arn:aws:ssm:us-east-1:123456789012:parameter/netapp/wlmdb/fs-abc123';
const WRONG_PATH_ARN = 'arn:aws-us-gov:ssm:us-gov-west-1:123456789012:parameter/other/path/value';
const WRONG_REGION_ARN = 'arn:aws-us-gov:ssm:us-gov-east-1:123456789012:parameter/netapp/wlmdb/fs-abc123';

function setGovAccount(value: boolean) {
    vi.spyOn(asyncLocalStorage, 'getAsyncLocalStorageResource').mockImplementation((key: string) => {
        if (key === GOV_ACCOUNT) {
            return value as any;
        }
        return undefined as any;
    });
}

describe('ssm-arn-validator', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('validateSsmArnFormat', () => {
        it('should skip validation for commercial accounts', () => {
            setGovAccount(false);
            expect(() => validateSsmArnFormat('not-an-arn', 'test')).not.toThrow();
        });

        it('should accept valid GovCloud ARN', () => {
            setGovAccount(true);
            expect(() => validateSsmArnFormat(VALID_GOV_ARN, 'fsxConfiguration')).not.toThrow();
        });

        it('should reject invalid ARN format', () => {
            setGovAccount(true);
            expect(() => validateSsmArnFormat('not-an-arn', 'fsxConfiguration')).toThrow(
                'Invalid SSM parameter ARN format'
            );
        });

        it('should reject commercial partition for GovCloud accounts', () => {
            setGovAccount(true);
            expect(() => validateSsmArnFormat(COMMERCIAL_ARN, 'fsxConfiguration')).toThrow(
                'GovCloud accounts must use a GovCloud SSM parameter ARN'
            );
        });

        it('should reject ARN with wrong path prefix', () => {
            setGovAccount(true);
            expect(() => validateSsmArnFormat(WRONG_PATH_ARN, 'fsxConfiguration')).toThrow(
                'SSM parameter path must start with'
            );
        });

        it('should reject ARN with mismatched region', () => {
            setGovAccount(true);
            expect(() => validateSsmArnFormat(WRONG_REGION_ARN, 'fsxConfiguration', 'us-gov-west-1')).toThrow(
                'does not match deployment region'
            );
        });

        it('should accept ARN when region matches', () => {
            setGovAccount(true);
            expect(() => validateSsmArnFormat(VALID_GOV_ARN, 'fsxConfiguration', 'us-gov-west-1')).not.toThrow();
        });

        it('should skip region check when no region is passed', () => {
            setGovAccount(true);
            expect(() => validateSsmArnFormat(WRONG_REGION_ARN, 'fsxConfiguration')).not.toThrow();
        });
    });

    describe('validateCredentialJsonStructure', () => {
        it('should accept valid FSx credentials', () => {
            const parsed = { fsx: { username: 'admin', password: 'secret' } };
            expect(() => validateCredentialJsonStructure(parsed, 'fsx', 'test')).not.toThrow();
        });

        it('should reject FSx credentials missing password', () => {
            const parsed = { fsx: { username: 'admin' } };
            expect(() => validateCredentialJsonStructure(parsed, 'fsx', 'test')).toThrow('must contain JSON');
        });

        it('should accept valid MSSQL credentials', () => {
            const parsed = { sql: [{ sqlinstancename: 'MSSQLSERVER', username: 'sa', password: 'secret' }] };
            expect(() => validateCredentialJsonStructure(parsed, 'sql-mssql', 'test')).not.toThrow();
        });

        it('should reject MSSQL credentials with empty array', () => {
            const parsed = { sql: [] };
            expect(() => validateCredentialJsonStructure(parsed, 'sql-mssql', 'test')).toThrow('must contain JSON');
        });

        it('should reject MSSQL entry missing sqlinstancename', () => {
            const parsed = { sql: [{ username: 'sa', password: 'secret' }] };
            expect(() => validateCredentialJsonStructure(parsed, 'sql-mssql', 'test')).toThrow(
                'sqlinstancename, username, and password'
            );
        });

        it('should accept valid domain credentials', () => {
            const parsed = {
                domain: [{ sqlinstancename: 'MSSQLSERVER', username: 'DOMAIN\\admin', password: 'secret' }]
            };
            expect(() => validateCredentialJsonStructure(parsed, 'domain', 'test')).not.toThrow();
        });

        it('should accept domain credentials with ad type alias', () => {
            const parsed = { domain: [{ sqlinstancename: 'MSSQLSERVER', username: 'admin', password: 'secret' }] };
            expect(() => validateCredentialJsonStructure(parsed, 'ad', 'test')).not.toThrow();
        });

        it('should accept valid Oracle credentials', () => {
            const parsed = { oracle: [{ oracleinstancename: 'ORCL', username: 'sys', password: 'secret' }] };
            expect(() => validateCredentialJsonStructure(parsed, 'oracle', 'test')).not.toThrow();
        });

        it('should reject Oracle credentials with empty array', () => {
            const parsed = { oracle: [] };
            expect(() => validateCredentialJsonStructure(parsed, 'oracle', 'test')).toThrow('must contain JSON');
        });

        it('should reject Oracle entry missing oracleinstancename', () => {
            const parsed = { oracle: [{ username: 'sys', password: 'secret' }] };
            expect(() => validateCredentialJsonStructure(parsed, 'oracle', 'test')).toThrow(
                'oracleinstancename, username, and password'
            );
        });

        it('should reject unsupported credential type', () => {
            expect(() => validateCredentialJsonStructure({}, 'unknown' as any, 'test')).toThrow(
                'Unsupported credential type'
            );
        });
    });

    describe('validateDeploymentConfigSsmArn', () => {
        it('should skip validation when config is null', () => {
            setGovAccount(true);
            expect(() => validateDeploymentConfigSsmArn('fsxConfiguration', null)).not.toThrow();
        });

        it('should require ssmParameterArn for GovCloud accounts', () => {
            setGovAccount(true);
            expect(() => validateDeploymentConfigSsmArn('fsxConfiguration', { password: 'secret' })).toThrow(
                'must provide ssmParameterArn'
            );
        });

        it('should reject password fields for GovCloud accounts', () => {
            setGovAccount(true);
            expect(() =>
                validateDeploymentConfigSsmArn('fsxConfiguration', {
                    ssmParameterArn: VALID_GOV_ARN,
                    fsxPassword: 'secret'
                })
            ).toThrow('Password fields are not supported for GovCloud');
        });

        it('should accept valid GovCloud config', () => {
            setGovAccount(true);
            expect(() =>
                validateDeploymentConfigSsmArn(
                    'fsxConfiguration',
                    {
                        ssmParameterArn: VALID_GOV_ARN
                    },
                    'us-gov-west-1'
                )
            ).not.toThrow();
        });

        it('should reject ssmParameterArn for commercial accounts', () => {
            setGovAccount(false);
            expect(() =>
                validateDeploymentConfigSsmArn('fsxConfiguration', {
                    ssmParameterArn: VALID_GOV_ARN
                })
            ).toThrow('only supported for GovCloud accounts');
        });

        it('should allow commercial config without ssmParameterArn', () => {
            setGovAccount(false);
            expect(() =>
                validateDeploymentConfigSsmArn('fsxConfiguration', {
                    password: 'secret'
                })
            ).not.toThrow();
        });
    });
});
