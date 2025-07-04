import { cloneDeep } from 'lodash-es';
import getLogger, { hideSecretsValues } from '../../src/utils/logger';
import { initializeDatabase } from '../../src/utils/prisma-utils';

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
        expect(output.error).toContain("P1001: Can't reach database server");
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
