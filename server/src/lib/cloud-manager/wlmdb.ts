import { WF_CONSOLE_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';

const logger = getLogger();

// Package name constants for workload policies
// These must match the exact package names from the WF Console API response
// Update these constants if package names change in the API
const PACKAGE_NAMES = {
    VIEW_PLANNING_ANALYSIS: 'View, planning, and analysis',
    OPERATIONS_REMEDIATION: 'Operations and remediation',
    DATABASE_HOST_CREATION: 'Database host creation'
} as const;

interface PolicyStatement {
    Sid?: string;
    Effect: string;
    Action: string | string[];
    Resource: string | string[];
    Condition?: {
        [key: string]: {
            [key: string]: string | string[];
        };
    };
}

interface WorkloadPackage {
    name: string;
    description: string;
    immutable: boolean;
    isDefault: boolean;
    permissions: {
        Version: string;
        Statement: PolicyStatement[];
    };
}

interface WorkloadPoliciesResponse {
    workload: string;
    packages: WorkloadPackage[];
}

interface WlmdbPolicyResponse {
    view: {
        Statement: PolicyStatement[];
    };
    operate: {
        Statement: PolicyStatement[];
    };
}

// Helper function to normalize statements
function normalizeStatements(statements: any[]): PolicyStatement[] {
    return statements.map(stmt => ({
        ...stmt,
        Action: Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action],
        Resource: Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource]
    }));
}

async function getWlmdbPolicy(): Promise<WlmdbPolicyResponse> {
    logger.info('Getting WLMDB policy from WF Console');

    try {
        const response = await gotInstanceForInternalRequest
            .get('wlmdb/workload-policies.json', {
                prefixUrl: WF_CONSOLE_ENDPOINT
            })
            .json<WorkloadPoliciesResponse>();

        // Find the required packages
        const viewPackage = response.packages.find(pkg => pkg.name === PACKAGE_NAMES.VIEW_PLANNING_ANALYSIS);
        const operatePackage = response.packages.find(pkg => pkg.name === PACKAGE_NAMES.OPERATIONS_REMEDIATION);
        const hostCreationPackage = response.packages.find(pkg => pkg.name === PACKAGE_NAMES.DATABASE_HOST_CREATION);
        if (!viewPackage) {
            throw new Error(`${PACKAGE_NAMES.VIEW_PLANNING_ANALYSIS} package not found in workload policies`);
        }
        // Normalize all statements to ensure consistent types
        const viewStatements = normalizeStatements(viewPackage.permissions.Statement);
        // Operate permissions = view + operate + host creation (hierarchical)
        const operateStatements = [...viewStatements];
        if (operatePackage) {
            operateStatements.push(...normalizeStatements(operatePackage.permissions.Statement));
        }
        if (hostCreationPackage) {
            operateStatements.push(...normalizeStatements(hostCreationPackage.permissions.Statement));
        }
        logger.info(`Loaded view permissions with ${viewStatements.length} statements`);
        logger.info(`Loaded operate permissions with ${operateStatements.length} statements`);
        return {
            view: {
                Statement: viewStatements
            },
            operate: {
                Statement: operateStatements
            }
        };
    } catch (error) {
        logger.error('Error fetching WLMDB policy:', error);
        throw new Error(`Failed to fetch workload policies: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export { PolicyStatement, getWlmdbPolicy };
