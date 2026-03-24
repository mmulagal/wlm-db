import { cloneDeep } from 'lodash-es';
import { hideSecretsValues, serializeErrors } from '../../src/utils/logger';

const stars = '*******';

describe('hideSecretsValues', () => {
    it('should return non-sensitive string unchanged', () => {
        const input = 'Hello World';
        const output = hideSecretsValues(input);
        expect(output).toBe(input);
    });

    it('should mask sensitive keys marked under SECRET_WORDS', () => {
        const output = hideSecretsValues({ credentials: 'secret' });
        expect(output).not.toBe({ credentials: 'secret' });
        expect(output.credentials).toContain(stars);
    });

    it('should mask sensitive nested fields in an object', () => {
        const testInput = {
            message: 'john_doe',
            passphrase: 'mySecretPassword123',
            profile: {
                accessKeyId: 'secret-api-key'
            }
        };
        const input = cloneDeep(testInput);

        const output = hideSecretsValues(testInput);

        expect(output.message).toBe(input.message);
        expect(output.passphrase).not.toBe(input.passphrase);
        expect(output.passphrase).toContain(stars);
        expect(output.profile.accessKeyId).not.toBe(input.profile.accessKeyId);
        expect(output.profile.accessKeyId).toContain(stars);
    });

    it('should mask DB host url', () => {
        const testInput = {
            error: `
				P1001: Can't reach database server at \`staging.db-host-url:3333\`

				Please make sure your database server is running at \`staging.db-host-url:3333\`.

					at genericNodeError (node:internal/errors:983:15)
					at wrappedFn (node:internal/errors:537:14)
					at ChildProcess.exithandler (node:child_process:414:12)
					at ChildProcess.emit (node:events:524:28)
					at maybeClose (node:internal/child_process:1101:16)
					at ChildProcess._handle.onexit (node:internal/child_process:304:5)
					at Process.callbackTrampoline (node:internal/async_hooks:130:17)
			`
        };
        const input = cloneDeep(testInput);

        const output = hideSecretsValues(testInput);

        expect(output.error).not.toBe(input.error);
        expect(output.error).toContain(stars);
        expect(output.error).not.toContain('staging.db-host-url:3333');
        expect(output.error).toContain('P1001');
    });

    it('should return primitives as they are when non-sensitive', () => {
        const inputInt = 100;
        const outputValue = hideSecretsValues(inputInt);
        expect(outputValue).toBe(inputInt);

        const inputStr = 'wlmdb';
        const outputStr = hideSecretsValues(inputStr);
        expect(outputStr).toBe(inputStr);
    });
});

describe('serializeErrors', () => {
    it('serializes nested Error into name, message, and stack', () => {
        const err = new Error('boom');
        const out = serializeErrors({ accountId: 'a1', error: err }) as Record<string, unknown>;
        expect(out.accountId).toBe('a1');
        const nested = out.error as Record<string, unknown>;
        expect(nested.name).toBe('Error');
        expect(nested.message).toBe('boom');
        expect(typeof nested.stack).toBe('string');
        expect(JSON.stringify(out)).toContain('boom');
    });

    it('serializes Error cause chain', () => {
        const root = new Error('root');
        const wrapped = new Error('wrapped', { cause: root });
        const out = serializeErrors(wrapped) as Record<string, unknown>;
        expect(out.message).toBe('wrapped');
        const cause = out.cause as Record<string, unknown>;
        expect(cause.message).toBe('root');
    });

    it('preserves enumerable custom fields on Error', () => {
        const err = new Error('x') as Error & { code: string };
        err.code = 'E_TEST';
        const out = serializeErrors(err) as Record<string, unknown>;
        expect(out.code).toBe('E_TEST');
    });

    it('maps errors in arrays', () => {
        const out = serializeErrors([new Error('a')]) as Record<string, unknown>[];
        expect(out[0].message).toBe('a');
    });

    it('returns non-objects unchanged', () => {
        expect(serializeErrors('x')).toBe('x');
        expect(serializeErrors(null)).toBe(null);
        expect(serializeErrors(undefined)).toBe(undefined);
    });

    it('after serializeErrors, hideSecretsValues masks sensitive keys inside cause chain', () => {
        const root = new Error('root') as Error & { token: string };
        root.token = 'must-not-appear';
        const wrapped = new Error('wrapped', { cause: root });
        const serialized = serializeErrors(wrapped) as Record<string, unknown>;
        const masked = hideSecretsValues(serialized);
        const cause = masked.cause as Record<string, unknown>;
        expect(cause.token).toContain(stars);
        expect(cause.token).not.toContain('must-not-appear');
    });
});
