import createError from 'http-errors';
import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import yaml from 'yaml';
import { getPreSignedUrl, putObjectBucket } from '../lib/aws/s3';
import {
    DatabaseTypes,
    SQL_RESOURCE_ASSETS,
    SQL_TEMPLATES_ASSETS,
    SQL_TEMPLATE_TAGS_INDENTATION,
    TEMPLATE_TYPES,
    BUCKET_NAME,
    SQL_TEMPLATES_DISTRIBUTION,
    SIGNED_URL_ERROR_MESSAGE,
    HttpErrorCodes
} from '../utils/consts';
import getLogger from '../utils/logger';

interface TemplateDetails {
    name: string;
    url: string;
    location: string;
}

const logger = getLogger();

async function generateSignedUrls(region: string, resourceType: DatabaseTypes) {
    logger.info('Generating signed urls ', region, resourceType);

    let signedUrl: string = '';
    const signedUrls: Map<string, TemplateDetails> = new Map();

    let assets = [];
    if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
        assets = SQL_RESOURCE_ASSETS;
    }

    if (assets?.length) {
        await Promise.all(
            SQL_RESOURCE_ASSETS.map(async resource => {
                logger.info(`Creating signed url for ${resource.url} in region ${region}.`);
                try {
                    signedUrl = await getPreSignedUrl(region, resource.url);
                    signedUrls.set(resource.name, { name: resource.name, url: signedUrl, location: resource.url });
                } catch (error) {
                    const errorMessage = SIGNED_URL_ERROR_MESSAGE(resource.url, region, error as string);
                    logger.error(errorMessage);
                    throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
                }
            })
        );
    }

    logger.debug('Signed urls', signedUrls);

    return signedUrls;
}

async function updateTemplateUrls(
    credentialsId: string,
    region: string,
    templateFilepath: string,
    signedUrls: Map<string, TemplateDetails>,
    templateType: string,
    stackName: string,
    tags?: Array<{ Key: string; Value: string }>,
    templatePath?: string
) {
    logger.info('Updating templates and uploading to bucket', credentialsId, region, templateFilepath, templateType);
    const yamlStr = yaml.stringify(
        {
            Tags: tags
        },
        {
            indent: SQL_TEMPLATE_TAGS_INDENTATION // !IMP: This is a workaround until we find a better solution, it should be changed if the indentation changes in master yaml file
        }
    );
    const source = readFileSync(templateFilepath).toString();
    const template = Handlebars.compile(source, { noEscape: true });
    if (templateType === TEMPLATE_TYPES.MASTER) {
        const fsxNewTemplatePath = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'FSXNewTemplate');
        const fsxExistingTemplatePath = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'FSXExistingTemplate');
        const fsxNewTemplatesignedUrl = await getPreSignedUrl(region, fsxNewTemplatePath!.url);
        const fsxExistingTemplatesignedUrl = await getPreSignedUrl(region, fsxExistingTemplatePath!.url);

        await Promise.all([
            signedUrls.set(fsxNewTemplatePath!.name, {
                name: fsxNewTemplatePath!.name,
                url: fsxNewTemplatesignedUrl,
                location: fsxNewTemplatePath!.url
            }),
            signedUrls.set(fsxExistingTemplatePath!.name, {
                name: fsxExistingTemplatePath!.name,
                url: fsxExistingTemplatesignedUrl,
                location: fsxNewTemplatePath!.url
            })
        ]);
        const contents = template({
            ValidationTemplate: decodeURI(signedUrls.get('ValidationTemplate')?.url || ''),
            FSXNewTemplate: decodeURI(signedUrls.get('FSXNewTemplate')?.url || ''),
            FSXExistingTemplate: decodeURI(signedUrls.get('FSXExistingTemplate')?.url || ''),
            SQLTemplate: decodeURI(signedUrls.get('SQLTemplate')?.url || ''),
            Tags: tags?.length ? yamlStr : '',
            SQLStandaloneTemplate: decodeURI(signedUrls.get('SQLStandaloneTemplate')?.url || '')
        });
        await putObjectBucket(credentialsId, region, BUCKET_NAME, templatePath!, contents);
    } else if (templateType === TEMPLATE_TYPES.SQLSTACK) {
        const contents = template({
            DSC: decodeURI(signedUrls.get('DSC')?.url || ''),
            DSCSignature: decodeURI(signedUrls.get('DSCSignature')?.url || ''),
            PowerShell: decodeURI(signedUrls.get('PowerShell')?.url || ''),
            PowerShellSignature: decodeURI(signedUrls.get('PowerShellSignature')?.url || ''),

            Sqlspcu: decodeURI(signedUrls.get('Sqlspcu')?.url || ''),
            SqlspcuSignature: decodeURI(signedUrls.get('SqlspcuSignature')?.url || ''),
            AmazonFailoverCluster: decodeURI(signedUrls.get('AmazonFailoverCluster')?.url || ''),
            AmazonFailoverClusterSignature: decodeURI(signedUrls.get('AmazonFailoverClusterSignature')?.url || ''),

            AmazonLaunchWizardForCFN: decodeURI(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
            AmazonLaunchWizardForCFNSignature: decodeURI(
                signedUrls.get('AmazonLaunchWizardForCFNSignature')?.url || ''
            ),
            AmazonLaunchWizardForSSM: decodeURI(signedUrls.get('AmazonLaunchWizardForSSM')?.url || ''),
            AmazonLaunchWizardForSSMSignature: decodeURI(
                signedUrls.get('AmazonLaunchWizardForSSMSignature')?.url || ''
            ),

            ScriptVerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
            ScriptUnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
            ScriptCommon: decodeURI(signedUrls.get('ScriptCommon')?.url || ''),
            ScriptCommonSignature: decodeURI(signedUrls.get('ScriptCommonSignature')?.url || ''),

            ScriptSQLFCI: decodeURI(signedUrls.get('ScriptSQLFCI')?.url || ''),
            ScriptSQLFCISignature: decodeURI(signedUrls.get('ScriptSQLFCISignature')?.url || ''),
            ScriptSQLONTAP: decodeURI(signedUrls.get('ScriptSQLONTAP')?.url || ''),
            ScriptSQLONTAPSignature: decodeURI(signedUrls.get('ScriptSQLONTAPSignature')?.url || '')
        });

        const sqlTemplatePath = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'SQLTemplate');
        const newSQLTemplatePath: string = `${stackName}/${sqlTemplatePath!.url}`;
        await putObjectBucket(credentialsId, region, BUCKET_NAME, newSQLTemplatePath, contents);
        const SQLsignedUrl = await getPreSignedUrl(region, newSQLTemplatePath);
        signedUrls.set(sqlTemplatePath!.name, {
            name: sqlTemplatePath!.name,
            url: SQLsignedUrl,
            location: newSQLTemplatePath
        });
    } else if (templateType === TEMPLATE_TYPES.VALIDATION) {
        const contents = template({
            AmazonLaunchWizardForCFN: decodeURI(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
            AmazonLaunchWizardForCFNSignature: decodeURI(
                signedUrls.get('AmazonLaunchWizardForCFNSignature')?.url || ''
            ),

            ScriptUnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
            ScriptVerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
            ScriptVpcCheck: decodeURI(signedUrls.get('ScriptVpcCheck')?.url || ''),
            ScriptUpdateDnsServers: decodeURI(signedUrls.get('ScriptUpdateDnsServers')?.url || ''),
            ScriptRenameComputer: decodeURI(signedUrls.get('ScriptRenameComputer')?.url || ''),
            ScriptRestartComputer: decodeURI(signedUrls.get('ScriptRestartComputer')?.url || ''),
            ScriptAdValidation: decodeURI(signedUrls.get('ScriptAdValidation')?.url || '')
        });

        const ValidationTemplate = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'ValidationTemplate');
        const newValidationTemplatePath: string = `${stackName}/${ValidationTemplate!.url}`;
        await putObjectBucket(credentialsId, region, BUCKET_NAME, newValidationTemplatePath, contents);
        const valSignedUrl = await getPreSignedUrl(region, newValidationTemplatePath);
        signedUrls.set(ValidationTemplate!.name, {
            name: ValidationTemplate!.name,
            url: valSignedUrl,
            location: newValidationTemplatePath
        });
    } else if (templateType === TEMPLATE_TYPES.SQLSTANDALONE) {
        const contents = template({
            DSC: decodeURI(signedUrls.get('DSC')?.url || ''),
            DSCSignature: decodeURI(signedUrls.get('DSCSignature')?.url || ''),
            PowerShell: decodeURI(signedUrls.get('PowerShell')?.url || ''),
            PowerShellSignature: decodeURI(signedUrls.get('PowerShellSignature')?.url || ''),

            Sqlspcu: decodeURI(signedUrls.get('Sqlspcu')?.url || ''),
            SqlspcuSignature: decodeURI(signedUrls.get('SqlspcuSignature')?.url || ''),
            AmazonLaunchWizardForCFN: decodeURI(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
            AmazonLaunchWizardForCFNSignature: decodeURI(
                signedUrls.get('AmazonLaunchWizardForCFNSignature')?.url || ''
            ),
            AmazonLaunchWizardForSSM: decodeURI(signedUrls.get('AmazonLaunchWizardForSSM')?.url || ''),
            AmazonLaunchWizardForSSMSignature: decodeURI(
                signedUrls.get('AmazonLaunchWizardForSSMSignature')?.url || ''
            ),

            ScriptVerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
            ScriptUnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
            ScriptCommon: decodeURI(signedUrls.get('ScriptCommon')?.url || ''),
            ScriptCommonSignature: decodeURI(signedUrls.get('ScriptCommonSignature')?.url || ''),

            ScriptSQLFCI: decodeURI(signedUrls.get('ScriptSQLFCI')?.url || ''),
            ScriptSQLFCISignature: decodeURI(signedUrls.get('ScriptSQLFCISignature')?.url || ''),
            ScriptSQLONTAP: decodeURI(signedUrls.get('ScriptSQLONTAP')?.url || ''),
            ScriptSQLONTAPSignature: decodeURI(signedUrls.get('ScriptSQLONTAPSignature')?.url || '')
        });
        const standAloneTemplatePath = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'SQLStandaloneTemplate');
        const newStandAloneTemplatePath: string = `${stackName}/${standAloneTemplatePath!.url}`;
        await putObjectBucket(credentialsId, region, BUCKET_NAME, newStandAloneTemplatePath, contents);
        const standAloneSignedUrl = await getPreSignedUrl(region, newStandAloneTemplatePath);
        signedUrls.set(standAloneTemplatePath!.name, {
            name: standAloneTemplatePath!.name,
            url: standAloneSignedUrl,
            location: newStandAloneTemplatePath
        });
    }
}

async function uploadTemplates(
    credentialsId: string,
    region: string,
    resourceType: DatabaseTypes,
    stackName: string,
    tags?: Array<{ Key: string; Value: string }>,
    templatePath?: string
) {
    logger.info('Uploading templates ', credentialsId, region, resourceType);

    if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
        const signedUrls = await generateSignedUrls(region, resourceType);
        await updateTemplateUrls(
            credentialsId,
            region,
            SQL_TEMPLATES_DISTRIBUTION.VALIDATION,
            signedUrls,
            TEMPLATE_TYPES.VALIDATION,
            stackName
        );
        await updateTemplateUrls(
            credentialsId,
            region,
            SQL_TEMPLATES_DISTRIBUTION.SQLSTACK,
            signedUrls,
            TEMPLATE_TYPES.SQLSTACK,
            stackName
        );
        await updateTemplateUrls(
            credentialsId,
            region,
            SQL_TEMPLATES_DISTRIBUTION.SQLSTANDALONE,
            signedUrls,
            TEMPLATE_TYPES.SQLSTANDALONE,
            stackName
        );
        await updateTemplateUrls(
            credentialsId,
            region,
            SQL_TEMPLATES_DISTRIBUTION.MASTER,
            signedUrls,
            TEMPLATE_TYPES.MASTER,
            stackName,
            tags,
            templatePath
        );
    }
}

export { uploadTemplates };
