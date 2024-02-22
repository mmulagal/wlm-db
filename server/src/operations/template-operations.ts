import createError from 'http-errors';
import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import yaml from 'yaml';
import { preSignedUrl, putObjectBucket } from '../lib/aws/s3';
import {
    DatabaseTypes,
    SQL_RESOURCE_ASSETS,
    SQL_TEMPLATES_ASSETS,
    SQL_TEMPLATE_TAGS_INDENTATION,
    TEMPLATE_TYPES,
    SQL_TEMPLATES_DISTRIBUTION,
    MASTER_TEMPLATE_DISTRIBUTION,
    SIGNED_URL_ERROR_MESSAGE,
    HttpErrorCodes,
    DEFAULT_TAGS,
    SIGNED_TEMPLATES_BUCKET_NAME,
    WLMDB,
    TEMPLATE_BUCKET_REGION
} from '../utils/consts';
import getLogger from '../utils/logger';
import { getArtifactsRegionBucketName } from '../utils/utils';

interface TemplateDetails {
    name: string;
    url: string;
    location: string;
}

const logger = getLogger();
const { getPreSignedUrl } = preSignedUrl;

async function generateSignedUrls(region: string, resourceType: DatabaseTypes) {
    logger.info('Generating signed urls ', region, resourceType);

    let signedUrl: string = '';
    const signedUrls: Map<string, TemplateDetails> = new Map();

    let assets = [];
    if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
        assets = SQL_RESOURCE_ASSETS;
    }

    const bucketname = getArtifactsRegionBucketName(region);
    if (assets?.length) {
        await Promise.all(
            SQL_RESOURCE_ASSETS.map(async resource => {
                logger.info(`Creating signed url for ${resource.url} in region ${region}.`);
                try {
                    signedUrl = await getPreSignedUrl(region, bucketname, resource.url);
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
    region: string,
    templateFilepath: string,
    signedUrls: Map<string, TemplateDetails>,
    templateType: string,
    stackName: string,
    tags?: Array<{ Key: string; Value: string }>,
    templatePath?: string,
    templateParameters?: object
) {
    logger.info('Updating templates and uploading to bucket', region, templateFilepath, templateType);
    const source = readFileSync(templateFilepath).toString();
    const template = Handlebars.compile(source);
    if (templateType === TEMPLATE_TYPES.MASTER) {
        tags = tags ? tags.concat(DEFAULT_TAGS) : DEFAULT_TAGS;

        const yamlStr = yaml.stringify(
            {
                Tags: tags
            },
            {
                indent: SQL_TEMPLATE_TAGS_INDENTATION // !IMP: This is a workaround until we find a better solution, it should be changed if the indentation changes in master yaml file
            }
        );
        const contents = template({
            ValidationTemplate: decodeURI(signedUrls.get('ValidationTemplate')?.url || ''),
            FSXNewTemplate: decodeURI(signedUrls.get('FSXNewTemplate')?.url || ''),
            FSXExistingTemplate: decodeURI(signedUrls.get('FSXExistingTemplate')?.url || ''),
            SQLTemplate: decodeURI(signedUrls.get('SQLTemplate')?.url || ''),
            Tags: tags?.length ? yamlStr : '',
            SQLStandaloneTemplate: decodeURI(signedUrls.get('SQLStandaloneTemplate')?.url || ''),
            VpcEndpointTemplate: decodeURI(signedUrls.get('VpcEndpointTemplate')?.url || ''),
            ...templateParameters
        });
        await putObjectBucket(TEMPLATE_BUCKET_REGION, SIGNED_TEMPLATES_BUCKET_NAME, templatePath!, contents);
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
        const customSQLTemplatePath: string = `${WLMDB}/${stackName}/${sqlTemplatePath!.url}`;
        await putObjectBucket(TEMPLATE_BUCKET_REGION, SIGNED_TEMPLATES_BUCKET_NAME, customSQLTemplatePath, contents);
        const SQLsignedUrl = await getPreSignedUrl(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customSQLTemplatePath
        );
        signedUrls.set(sqlTemplatePath!.name, {
            name: sqlTemplatePath!.name,
            url: SQLsignedUrl,
            location: customSQLTemplatePath
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
            ScriptAdValidation: decodeURI(signedUrls.get('ScriptAdValidation')?.url || ''),
            ScriptFSxValidation: decodeURI(signedUrls.get('ScriptFSxValidation')?.url || '')
        });

        const ValidationTemplate = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'ValidationTemplate');
        const customValidationTemplatePath: string = `${WLMDB}/${stackName}/${ValidationTemplate!.url}`;
        await putObjectBucket(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customValidationTemplatePath,
            contents
        );
        const valSignedUrl = await getPreSignedUrl(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customValidationTemplatePath
        );
        signedUrls.set(ValidationTemplate!.name, {
            name: ValidationTemplate!.name,
            url: valSignedUrl,
            location: customValidationTemplatePath
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
        const customStandAloneTemplatePath: string = `${WLMDB}/${stackName}/${standAloneTemplatePath!.url}`;
        await putObjectBucket(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customStandAloneTemplatePath,
            contents
        );
        const standAloneSignedUrl = await getPreSignedUrl(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customStandAloneTemplatePath
        );
        signedUrls.set(standAloneTemplatePath!.name, {
            name: standAloneTemplatePath!.name,
            url: standAloneSignedUrl,
            location: customStandAloneTemplatePath
        });
    } else if (
        templateType === TEMPLATE_TYPES.ENDPOINT ||
        templateType === TEMPLATE_TYPES.NEWFSX ||
        templateType === TEMPLATE_TYPES.EXISTINGFSX
    ) {
        let staticTemplatePath = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'VpcEndpointTemplate');
        if (templateType === TEMPLATE_TYPES.NEWFSX) {
            staticTemplatePath = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'FSXNewTemplate');
        } else if (templateType === TEMPLATE_TYPES.EXISTINGFSX) {
            staticTemplatePath = SQL_TEMPLATES_ASSETS.find(asset => asset.name === 'FSXExistingTemplate');
        }
        const customTemplatePath: string = `${WLMDB}/${stackName}/${staticTemplatePath!.url}`;
        await putObjectBucket(TEMPLATE_BUCKET_REGION, SIGNED_TEMPLATES_BUCKET_NAME, customTemplatePath, source);
        const signedUrl = await getPreSignedUrl(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customTemplatePath
        );
        signedUrls.set(staticTemplatePath!.name, {
            name: staticTemplatePath!.name,
            url: signedUrl,
            location: customTemplatePath
        });
    }
}

async function uploadTemplates(
    region: string,
    resourceType: DatabaseTypes,
    stackName: string,
    tags?: Array<{ Key: string; Value: string }>,
    templatePath?: string,
    templateParameters?: object
) {
    logger.info('Uploading templates ', region, resourceType);

    if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
        const signedUrls = await generateSignedUrls(region, resourceType);
        const promises = SQL_TEMPLATES_DISTRIBUTION.map(async template =>
            updateTemplateUrls(region, template.location, signedUrls, template.name, stackName)
        );
        await Promise.all(promises).then(() =>
            updateTemplateUrls(
                region,
                MASTER_TEMPLATE_DISTRIBUTION.location,
                signedUrls,
                MASTER_TEMPLATE_DISTRIBUTION.name,
                stackName,
                tags,
                templatePath,
                templateParameters
            )
        );
    }
}

export default uploadTemplates;
