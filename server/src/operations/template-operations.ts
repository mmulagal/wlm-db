import createError from 'http-errors';
import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import yaml from 'yaml';
import { getPreSignedUrl, putObjectBucket } from '../lib/aws/s3';
import {
    DatabaseTypes,
    SQL_TEMPLATES_ASSETS,
    TEMPLATE_TYPES,
    BUCKET_NAME,
    SQL_TEMPLATES_DISTRIBUTION,
    SIGNED_URL_ERROR_MESSAGE,
    HttpErrorCodes,
    MASTER_TEMPLATE_PATH
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
        assets = SQL_TEMPLATES_ASSETS;
    }

    if (assets?.length) {
        await Promise.all(
            SQL_TEMPLATES_ASSETS.map(async template => {
                logger.info(`Creating signed url for ${template.url} in region ${region}.`);
                try {
                    signedUrl = await getPreSignedUrl(region, template.url);
                    signedUrls.set(template.name, { name: template.name, url: signedUrl, location: template.url });
                } catch (error) {
                    const errorMessage = SIGNED_URL_ERROR_MESSAGE(template.url, region, error as string);
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
    tags?: Array<{ Key: string; Value: string }>
) {
    logger.info('Updating templates and uploading to bucket', credentialsId, region, templateFilepath, templateType);
    const yamlStr = yaml.stringify(
        {
            Tags: tags
        },
        {
            indent: 6 // !IMP: This is a workaround untill we find a better solution, it should be changed if the indentation changes in master yaml file
        }
    );
    const source = readFileSync(templateFilepath).toString();
    const template = Handlebars.compile(source, { noEscape: true });
    if (templateType === TEMPLATE_TYPES.MASTER) {
        const contents = template({
            ValidationTemplate: decodeURI(signedUrls.get('ValidationTemplate')?.url || ''),
            FSXNewTemplate: decodeURI(signedUrls.get('FSXNewTemplate')?.url || ''),
            FSXExistingTemplate: decodeURI(signedUrls.get('FSXExistingTemplate')?.url || ''),
            SQLTemplate: decodeURI(signedUrls.get('SQLTemplate')?.url || ''),
            Tags: tags?.length ? yamlStr : ''
        });
        await putObjectBucket(credentialsId, region, BUCKET_NAME, MASTER_TEMPLATE_PATH, contents);
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
        await putObjectBucket(
            credentialsId,
            region,
            BUCKET_NAME,
            signedUrls.get('SQLTemplate')?.location || '',
            contents
        );
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
        await putObjectBucket(
            credentialsId,
            region,
            BUCKET_NAME,
            signedUrls.get('ValidationTemplate')?.location || '',
            contents
        );
    }
}

async function uploadTemplates(
    credentialsId: string,
    region: string,
    resourceType: DatabaseTypes,
    tags?: Array<{ Key: string; Value: string }>
) {
    logger.info('Uploading templates ', credentialsId, region, resourceType);

    if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
        const signedUrls = await generateSignedUrls(region, resourceType);
        await updateTemplateUrls(
            credentialsId,
            region,
            SQL_TEMPLATES_DISTRIBUTION.VALIDATION,
            signedUrls,
            TEMPLATE_TYPES.VALIDATION
        );
        await updateTemplateUrls(
            credentialsId,
            region,
            SQL_TEMPLATES_DISTRIBUTION.SQLSTACK,
            signedUrls,
            TEMPLATE_TYPES.SQLSTACK
        );
        await updateTemplateUrls(
            credentialsId,
            region,
            SQL_TEMPLATES_DISTRIBUTION.MASTER,
            signedUrls,
            TEMPLATE_TYPES.MASTER,
            tags
        );
    }
}

export { uploadTemplates };
