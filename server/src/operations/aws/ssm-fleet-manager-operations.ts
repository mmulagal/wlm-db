import { SendCommandCommandInput } from '@aws-sdk/client-ssm';

import { executeSSMDocument } from './ssm-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

const GET_WINDOWS_REGISTRY_CONTENT_DOCUMENT = 'AWSFleetManager-GetWindowsRegistryContent';
const GET_FILE_SYSTEM_CONTENT_DOCUMENT = 'AWSFleetManager-GetFileSystemContent';
const FLEET_MANAGER_DOCUMENT_VERSION = '$DEFAULT';
const INVOKE_WINDOWS_SCRIPT_PLUGIN = 'InvokeWindowsScript';
const FLEET_MANAGER_MAX_PAGES = 50;

interface RegistryEntry {
    name: string;
    type: string;
    value: string;
}

interface FileSystemEntry {
    name: string;
    mode: string;
    length: string;
    lastWriteTimeUtc: string;
}

interface FleetManagerContentResult<T> {
    found: boolean;
    entries: T[];
    error?: string;
}

function toRegistryEntry(raw: Record<string, string>): RegistryEntry {
    return { name: raw.Name, type: raw.Type, value: raw.Value };
}

function toFileSystemEntry(raw: Record<string, string>): FileSystemEntry {
    return { name: raw.Name, mode: raw.Mode, length: raw.Length, lastWriteTimeUtc: raw.LastWriteTimeUTC };
}

interface FleetManagerPage {
    found: boolean;
    results: Record<string, string>[];
    nextToken?: string;
    error?: string;
}

async function fetchFleetManagerPage(
    documentName: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    path: string,
    nextToken: string,
    accountId?: string
): Promise<FleetManagerPage> {
    const params: SendCommandCommandInput = {
        DocumentName: documentName,
        DocumentVersion: FLEET_MANAGER_DOCUMENT_VERSION,
        InstanceIds: [instanceId],
        Parameters: { Path: [path], NextToken: [nextToken], AllowTruncatedOutput: ['Yes'] }
    };

    const pluginName = documentName === GET_FILE_SYSTEM_CONTENT_DOCUMENT ? INVOKE_WINDOWS_SCRIPT_PLUGIN : undefined;
    let commandId;
    let response;
    try {
        ({ commandId, response } = await executeSSMDocument(
            credentialsId,
            region,
            params,
            accountId,
            undefined,
            pluginName
        ));
    } catch (error) {
        logger.error('Fleet Manager document execution threw', { documentName, instanceId, path, error });
        return { found: false, results: [], error: error instanceof Error ? error.message : String(error) };
    }
    const invocationContext = {
        documentName,
        instanceId,
        path,
        commandId,
        status: response?.Status,
        statusDetails: response?.StatusDetails,
        responseCode: response?.ResponseCode
    };

    if (response?.StandardErrorContent) {
        logger.error('Fleet Manager document execution failed', {
            ...invocationContext,
            error: response.StandardErrorContent
        });
        return { found: false, results: [], error: response.StandardErrorContent };
    }

    const output = (response?.StandardOutputContent ?? '').trim();
    if (!output) {
        const errorMessage = `No output returned from ${documentName} for path ${path} on instance ${instanceId}`;
        logger.error(errorMessage, invocationContext);
        return { found: false, results: [], error: errorMessage };
    }

    let parsed;
    try {
        parsed = JSON.parse(output);
    } catch (error) {
        logger.error('Fleet Manager document output was not valid JSON, likely truncated by SSM', {
            ...invocationContext,
            error
        });
        return { found: false, results: [], error: `Output from ${documentName} was truncated or malformed` };
    }
    if (parsed.error) {
        logger.debug('Fleet Manager document reported a data-level error', { documentName, instanceId, path });
        return { found: false, results: [], error: parsed.error };
    }

    return { found: true, results: parsed.data?.results ?? [], nextToken: parsed.data?.nextToken || undefined };
}

async function runFleetManagerDocument(
    documentName: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    path: string,
    accountId?: string
): Promise<{ found: boolean; results: Record<string, string>[]; error?: string }> {
    const results: Record<string, string>[] = [];
    let nextToken = '*';

    for (let page = 0; page < FLEET_MANAGER_MAX_PAGES; page++) {
        // Each page's request depends on the previous page's nextToken, so this must run sequentially.
        // eslint-disable-next-line no-await-in-loop
        const currentPage = await fetchFleetManagerPage(
            documentName,
            credentialsId,
            region,
            instanceId,
            path,
            nextToken,
            accountId
        );
        if (!currentPage.found) {
            return { found: false, results: [...results, ...currentPage.results], error: currentPage.error };
        }
        results.push(...currentPage.results);
        if (!currentPage.nextToken) {
            return { found: true, results };
        }
        nextToken = currentPage.nextToken;
    }

    const errorMessage = `Fleet Manager pagination cap (${FLEET_MANAGER_MAX_PAGES} pages) reached with more data remaining`;
    logger.error(errorMessage, { documentName, instanceId, path });
    return { found: false, results, error: errorMessage };
}

async function getWindowsRegistryContent(
    credentialsId: string,
    region: string,
    instanceId: string,
    path: string,
    accountId?: string
): Promise<FleetManagerContentResult<RegistryEntry>> {
    const { found, results, error } = await runFleetManagerDocument(
        GET_WINDOWS_REGISTRY_CONTENT_DOCUMENT,
        credentialsId,
        region,
        instanceId,
        path,
        accountId
    );
    return { found, entries: results.map(toRegistryEntry), error };
}

async function getFileSystemContent(
    credentialsId: string,
    region: string,
    instanceId: string,
    path: string,
    accountId?: string
): Promise<FleetManagerContentResult<FileSystemEntry>> {
    const { found, results, error } = await runFleetManagerDocument(
        GET_FILE_SYSTEM_CONTENT_DOCUMENT,
        credentialsId,
        region,
        instanceId,
        path,
        accountId
    );
    return { found, entries: results.map(toFileSystemEntry), error };
}

export { getWindowsRegistryContent, getFileSystemContent };
export type { RegistryEntry, FileSystemEntry, FleetManagerContentResult };
