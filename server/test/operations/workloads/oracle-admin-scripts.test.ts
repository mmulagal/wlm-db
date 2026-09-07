import { describe, expect, it } from 'vitest';

import { loadOracleAdminScript } from '../../../src/operations/workloads/oracle/oracle-admin-scripts';

describe('loadOracleAdminScript', () => {
    it('loads a shell script verbatim and reports its mutating flag', () => {
        const { body, mutating } = loadOracleAdminScript('acct', 'topology-check', { ORACLE_SID: 'orcl' });

        expect(mutating).toBe(false);
        expect(body).toContain('#!/');
        expect(body).not.toContain('WLMDB_PY');
    });

    it('wraps a python script in the shell heredoc so AWS-RunShellScript can run it', () => {
        const { body, mutating } = loadOracleAdminScript('acct', 'mapped-ontap-volumes', { ORACLE_SID: 'orcl' });

        expect(mutating).toBe(false);
        expect(body.startsWith('PYTHON=$(command -v python3 || command -v python)')).toBe(true);
        expect(body).toContain('"$PYTHON" - <<\'WLMDB_PY\'');
        // Heredoc must be closed by the marker on its own line, else SSM hangs reading stdin.
        expect(body.trimEnd().endsWith('WLMDB_PY')).toBe(true);
    });

    it('rejects an unknown scriptId', () => {
        expect(() => loadOracleAdminScript('acct', 'not-a-real-script')).toThrow('Unknown scriptId: not-a-real-script');
    });

    it('rejects args outside the allowlist', () => {
        expect(() => loadOracleAdminScript('acct', 'topology-check', { ORACLE_SID: 'orcl', EXTRA: 'x' })).toThrow(
            'Unexpected args for scriptId topology-check: EXTRA'
        );
    });

    it('rejects missing required args', () => {
        expect(() => loadOracleAdminScript('acct', 'topology-check', {})).toThrow(
            'Missing required args for scriptId topology-check: ORACLE_SID'
        );
    });

    it('rejects shell-unsafe arg names', () => {
        expect(() => loadOracleAdminScript('acct', 'topology-check', { 'ORACLE-SID': 'orcl' })).toThrow(
            'Invalid script arg name: ORACLE-SID'
        );
    });
});
