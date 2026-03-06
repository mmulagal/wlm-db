import { describe, it, expect } from 'vitest';
import { setMaskedPassword, addEscapeInCli, maskAwsCli } from '../CodeboxUtility';

describe('setMaskedPassword', () => {
    it('masks non-empty passwords', () => {
        const data: any = {
            dbCredentials: { password: 'secret' },
            fsxN: { fsxNPassword: 'fsxSecret' },
            activeDirectory: { password: 'adSecret' }
        };
        const result = setMaskedPassword(data);
        expect(result.dbCredentials.password).toBe('******');
        expect(result.fsxN.fsxNPassword).toBe('*****');
        expect(result.activeDirectory.password).toBe('*****');
    });

    it('keeps empty passwords as empty string', () => {
        const data: any = {
            dbCredentials: { password: '' },
            fsxN: { fsxNPassword: '' },
            activeDirectory: { password: '' }
        };
        const result = setMaskedPassword(data);
        expect(result.dbCredentials.password).toBe('');
        expect(result.fsxN.fsxNPassword).toBe('');
        expect(result.activeDirectory.password).toBe('');
    });

    it('preserves other fields in the data object', () => {
        const data: any = {
            name: 'myConfig',
            dbCredentials: { username: 'admin', password: 'pw' },
            fsxN: { fsxNPassword: 'pw', otherField: 'x' },
            activeDirectory: { password: 'pw', domain: 'corp' }
        };
        const result = setMaskedPassword(data);
        expect(result.name).toBe('myConfig');
        expect(result.dbCredentials.username).toBe('admin');
        expect(result.fsxN.otherField).toBe('x');
        expect(result.activeDirectory.domain).toBe('corp');
    });
});

describe('addEscapeInCli', () => {
    it('returns data unchanged when cliCommand is not a string', () => {
        const data: any = { cliCommand: null };
        expect(addEscapeInCli(data)).toEqual(data);
    });

    it('returns null/undefined data unchanged', () => {
        expect(addEscapeInCli(null as any)).toBeNull();
        expect(addEscapeInCli(undefined as any)).toBeUndefined();
    });

    it('escapes backslashes in cliCommand', () => {
        const data: any = { cliCommand: 'aws\\command' };
        const result = addEscapeInCli(data);
        expect(result.cliCommand).toBe('aws\\\\command');
    });

    it('escapes double quotes in cliCommand', () => {
        const data: any = { cliCommand: 'aws "key"' };
        const result = addEscapeInCli(data);
        expect(result.cliCommand).toBe('aws \\"key\\"');
    });

    it('escapes both backslashes and double quotes', () => {
        const data: any = { cliCommand: 'cmd \\"val\\"' };
        const result = addEscapeInCli(data);
        expect(result.cliCommand).toBe('cmd \\\\\\"val\\\\\\"');
    });

    it('preserves other fields', () => {
        const data: any = { cliCommand: 'cmd', otherField: 42 };
        const result = addEscapeInCli(data);
        expect(result.otherField).toBe(42);
    });
});

describe('maskAwsCli', () => {
    it('returns undefined when data is undefined', () => {
        expect(maskAwsCli(undefined)).toBeUndefined();
    });

    it('returns empty string when data is empty string', () => {
        expect(maskAwsCli('')).toBe('');
    });

    it('masks DomainAdminPassword when present', () => {
        const cli =
            'DomainAdminPassword\\",ParameterValue=\\"myPassword\\" ParameterKey=FSxAdminPassword\\",ParameterValue=\\"\\" ParameterKey=FSxAdminPassword\\",ParameterValue=\\"\\" ParameterKey=SQLServiceAccountPassword\\",ParameterValue=\\"\\" ParameterKey=';
        const result = maskAwsCli(cli)!;
        expect(result).toContain('DomainAdminPassword\\",ParameterValue=\\"****\\"');
        expect(result).not.toContain('myPassword');
    });

    it('keeps DomainAdminPassword empty when value is empty', () => {
        const cli =
            'DomainAdminPassword\\",ParameterValue=\\"\\" ParameterKey=FSxAdminPassword\\",ParameterValue=\\"\\" ParameterKey=SQLServiceAccountPassword\\",ParameterValue=\\"\\" ParameterKey=';
        const result = maskAwsCli(cli)!;
        expect(result).toContain('DomainAdminPassword\\",ParameterValue=\\"\\"');
    });

    it('masks FSxAdminPassword when present', () => {
        const cli =
            'DomainAdminPassword\\",ParameterValue=\\"\\" ParameterKey=FSxAdminPassword\\",ParameterValue=\\"adminPw\\" ParameterKey=SQLServiceAccountPassword\\",ParameterValue=\\"\\" ParameterKey=';
        const result = maskAwsCli(cli)!;
        expect(result).toContain('FSxAdminPassword\\",ParameterValue=\\"****\\"');
        expect(result).not.toContain('adminPw');
    });

    it('masks SQLServiceAccountPassword when present', () => {
        const cli =
            'DomainAdminPassword\\",ParameterValue=\\"\\" ParameterKey=FSxAdminPassword\\",ParameterValue=\\"\\" ParameterKey=SQLServiceAccountPassword\\",ParameterValue=\\"sqlPw\\" ParameterKey=';
        const result = maskAwsCli(cli)!;
        expect(result).toContain('SQLServiceAccountPassword\\",ParameterValue=\\"****\\"');
        expect(result).not.toContain('sqlPw');
    });

    it('returns string unchanged when no patterns match', () => {
        const cli = 'aws cloudformation create-stack --stack-name myStack';
        expect(maskAwsCli(cli)).toBe(cli);
    });
});
