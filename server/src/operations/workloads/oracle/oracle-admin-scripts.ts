import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';

import { HttpErrorCodes } from '../../../utils/consts';
import getLogger from '../../../utils/logger';

const logger = getLogger();

const ADMIN_SCRIPTS_DIR = join(process.cwd(), 'resources/oracle/scripts/admin');
const SHELL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
// SSM's AWS-RunShellScript wrapper prepends `export ...` lines ahead of the body, which
// pushes any shebang off line 1 and can make the runtime fall back to sh/dash — a python
// body would then be parsed as shell and fail. Wrap it the same way the skill's former
// build_run_script_payload.sh did: run it via a python interpreter through a heredoc.
const PYTHON_HEREDOC_MARKER = 'WLMDB_PY';

const ORACLE_ADMIN_SCRIPT_IDS = [
    'topology-check',
    'mapped-ontap-volumes',
    'pdb-exists-check',
    'create-pdb',
    'clone-target-preflight',
    'oracle-version-check',
    'consistency-group-snapshot',
    'flexclone-create',
    'clone-attach-nfs',
    'clone-bootstrap-pfile',
    'clone-start-resetlogs'
] as const;

type OracleAdminScriptId = (typeof ORACLE_ADMIN_SCRIPT_IDS)[number];

interface OracleAdminScriptSpec {
    file: string;
    requiredArgs: readonly string[];
    optionalArgs: readonly string[];
    mutating: boolean;
}

const ORACLE_ADMIN_SCRIPTS: Record<OracleAdminScriptId, OracleAdminScriptSpec> = {
    'topology-check': {
        file: 'topology_check.sh',
        requiredArgs: ['ORACLE_SID'],
        optionalArgs: ['PROTOCOL', 'SVM_NAME', 'FILESYSTEM_ID'],
        mutating: false
    },
    'mapped-ontap-volumes': {
        file: 'mapped_ontap_volumes.py',
        requiredArgs: ['ORACLE_SID'],
        optionalArgs: ['FILESYSTEM_ID', 'FSX_USERNAME', 'FSX_PASSWORD'],
        mutating: false
    },
    'pdb-exists-check': {
        file: 'pdb_exists_check.sh',
        requiredArgs: ['ORACLE_SID', 'PDB_NAME'],
        optionalArgs: [],
        mutating: false
    },
    'create-pdb': {
        file: 'create_pdb.sh',
        requiredArgs: ['ORACLE_SID', 'PDB_NAME', 'PDB_ADMIN_USER', 'PDB_ADMIN_PASSWORD'],
        optionalArgs: [],
        mutating: true
    },
    'clone-target-preflight': {
        file: 'clone_target_preflight.sh',
        requiredArgs: ['CLONE_SID', 'CLONE_PORT'],
        optionalArgs: [],
        mutating: false
    },
    'oracle-version-check': {
        file: 'oracle_version_check.sh',
        requiredArgs: ['ORACLE_SID'],
        optionalArgs: [],
        mutating: false
    },
    'consistency-group-snapshot': {
        file: 'consistency_group_snapshot.py',
        requiredArgs: [
            'ORACLE_SID',
            'FILESYSTEM_ID',
            'SVM_NAME',
            'RETENTION_LABEL',
            'VOLUME_NAMES',
            'VOLUME_FILE_TYPES_JSON',
            'CG_NAME'
        ],
        optionalArgs: ['FSX_USERNAME', 'FSX_PASSWORD'],
        mutating: true
    },
    'flexclone-create': {
        file: 'flexclone_create.py',
        requiredArgs: ['FILESYSTEM_ID', 'SVM_NAME', 'CLONE_NAME', 'PARENT_VOLUME', 'PARENT_SNAPSHOT'],
        optionalArgs: ['FSX_USERNAME', 'FSX_PASSWORD'],
        mutating: true
    },
    'clone-attach-nfs': {
        file: 'clone_attach_nfs.sh',
        requiredArgs: ['CLONE_SID', 'SVM_DATA_LIF', 'CLONE_VOLUMES_JSON'],
        optionalArgs: [],
        mutating: true
    },
    'clone-bootstrap-pfile': {
        file: 'clone_bootstrap_pfile.sh',
        requiredArgs: ['CLONE_SID', 'CLONE_ORACLE_HOME', 'SOURCE_DB_NAME', 'CONTROL_FILES'],
        optionalArgs: [
            'IS_CDB',
            'DB_BLOCK_SIZE',
            'SGA_TARGET',
            'PGA_AGGREGATE_TARGET',
            'UNDO_TABLESPACE',
            'ARCHIVE_LOG_DEST',
            'DIAGNOSTIC_DEST',
            'COMPATIBLE'
        ],
        mutating: true
    },
    'clone-start-resetlogs': {
        file: 'clone_start_resetlogs.sh',
        requiredArgs: ['CLONE_SID', 'CLONE_ORACLE_HOME', 'PHASE'],
        optionalArgs: [],
        mutating: true
    }
};

function isOracleAdminScriptId(scriptId: string): scriptId is OracleAdminScriptId {
    return (ORACLE_ADMIN_SCRIPT_IDS as readonly string[]).includes(scriptId);
}

function wrapIfPython(file: string, body: string): string {
    if (extname(file) !== '.py') {
        return body;
    }
    if (body.split('\n').includes(PYTHON_HEREDOC_MARKER)) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Admin script ${file} has a line reading exactly '${PYTHON_HEREDOC_MARKER}', which would close its heredoc wrapper early`
        );
    }
    return [
        // Exit 0 like every other admin script: the JSON envelope on stdout is the
        // result contract, and a non-zero exit only marks the invocation Failed
        // without carrying the reason back to the caller.
        'PYTHON=$(command -v python3 || command -v python) || {',
        '    echo \'{"status":"error","error":"no python interpreter found on host"}\'',
        '    exit 0',
        '}',
        `"$PYTHON" - <<'${PYTHON_HEREDOC_MARKER}'`,
        body,
        PYTHON_HEREDOC_MARKER
    ].join('\n');
}

function loadOracleAdminScript(
    accountId: string,
    scriptId: string,
    args: Record<string, string> = {}
): { body: string; mutating: boolean } {
    if (!isOracleAdminScriptId(scriptId)) {
        const errorMessage = `Unknown scriptId: ${scriptId}`;
        logger.error(errorMessage, { accountId, scriptId });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
    const spec = ORACLE_ADMIN_SCRIPTS[scriptId];
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
    const rawBody = readFileSync(join(ADMIN_SCRIPTS_DIR, spec.file), 'utf8').trim();
    if (!rawBody) {
        const errorMessage = `Admin script ${scriptId} is empty`;
        logger.error(errorMessage, { accountId, scriptId, file: spec.file });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    return { body: wrapIfPython(spec.file, rawBody), mutating: spec.mutating };
}

export { ORACLE_ADMIN_SCRIPT_IDS, loadOracleAdminScript };
