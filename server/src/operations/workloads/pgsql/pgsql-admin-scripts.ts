import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';

import { HttpErrorCodes } from '../../../utils/consts';
import getLogger from '../../../utils/logger';

const logger = getLogger();

const ADMIN_SCRIPTS_DIR = join(process.cwd(), 'resources/pgsql/scripts/admin');
const SHELL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PGSQL_ADMIN_SCRIPT_IDS = ['inspect', 'createdb', 'cg-snapshot', 'cg-flexclone', 'clone-recovery'] as const;

type PgSqlAdminScriptId = (typeof PGSQL_ADMIN_SCRIPT_IDS)[number];

interface PgSqlAdminScriptSpec {
    file: string;
    requiredArgs: readonly string[];
    optionalArgs: readonly string[];
    mutating: boolean;
}

const PGSQL_ADMIN_SCRIPTS: Record<PgSqlAdminScriptId, PgSqlAdminScriptSpec> = {
    inspect: {
        file: 'inspect.sh',
        requiredArgs: [],
        optionalArgs: [
            'FILESYSTEM_ID',
            'FSX_USERNAME',
            'FSX_PASSWORD',
            'DATABASE_NAME',
            'OWNER',
            'CLONE_NAME',
            'CLONE_PORT',
            'CLONE_PGDATA',
            'CLONE_LOGDIR'
        ],
        mutating: false
    },
    createdb: {
        file: 'createdb.sh',
        requiredArgs: ['DATABASE_NAME'],
        optionalArgs: ['OWNER', 'DEPLOYMENT_TYPE'],
        mutating: true
    },
    'cg-snapshot': {
        file: 'cg-snapshot.sh',
        requiredArgs: [
            'SVM_NAME',
            'DATA_VOLUME',
            'LOG_VOLUME',
            'FILESYSTEM_ID',
            'CG_NAME',
            'SNAPSHOT_NAME',
            'RETENTION_LABEL'
        ],
        optionalArgs: ['FSX_USERNAME', 'FSX_PASSWORD'],
        mutating: true
    },
    'cg-flexclone': {
        file: 'cg-flexclone.sh',
        requiredArgs: [
            'SVM_NAME',
            'DATA_VOLUME',
            'LOG_VOLUME',
            'FILESYSTEM_ID',
            'DATA_CLONE_VOLUME',
            'WAL_CLONE_VOLUME',
            'MEMBER_SNAPSHOTS'
        ],
        optionalArgs: ['FSX_USERNAME', 'FSX_PASSWORD'],
        mutating: true
    },
    'clone-recovery': {
        file: 'clone-recovery.sh',
        requiredArgs: [
            'CLONE_NAME',
            'CLONE_PORT',
            'NFS_SERVER',
            'DATA_CLONE_VOLUME',
            'WAL_CLONE_VOLUME',
            'DATA_CLONE_UUID',
            'WAL_CLONE_UUID'
        ],
        optionalArgs: [],
        mutating: true
    }
};

function isPgSqlAdminScriptId(scriptId: string): scriptId is PgSqlAdminScriptId {
    return (PGSQL_ADMIN_SCRIPT_IDS as readonly string[]).includes(scriptId);
}

function loadPgSqlAdminScript(
    accountId: string,
    scriptId: string,
    args: Record<string, string> = {}
): { body: string; mutating: boolean } {
    if (!isPgSqlAdminScriptId(scriptId)) {
        const errorMessage = `Unknown scriptId: ${scriptId}`;
        logger.error(errorMessage, { accountId, scriptId });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
    const spec = PGSQL_ADMIN_SCRIPTS[scriptId];
    const allowed = new Set([...spec.requiredArgs, ...spec.optionalArgs]);
    const argKeys = Object.keys(args);
    const invalidName = argKeys.find(key => !SHELL_IDENTIFIER.test(key));
    if (invalidName) {
        const errorMessage = `Invalid script arg name: ${invalidName}`;
        logger.error(errorMessage, { accountId, scriptId, argKeys });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
    const extra = argKeys.filter(key => !allowed.has(key));
    if (extra.length > 0) {
        const errorMessage = `Unexpected args for scriptId ${scriptId}: ${extra.join(', ')}`;
        logger.error(errorMessage, { accountId, scriptId, extra });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
    const missing = spec.requiredArgs.filter(key => isEmpty(args[key]));
    if (missing.length > 0) {
        const errorMessage = `Missing required args for scriptId ${scriptId}: ${missing.join(', ')}`;
        logger.error(errorMessage, { accountId, scriptId, missing });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
    const body = readFileSync(join(ADMIN_SCRIPTS_DIR, spec.file), 'utf8').trim();
    if (!body) {
        const errorMessage = `Admin script ${scriptId} is empty`;
        logger.error(errorMessage, { accountId, scriptId, file: spec.file });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    return { body, mutating: spec.mutating };
}

export { PGSQL_ADMIN_SCRIPT_IDS, loadPgSqlAdminScript };
