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
    TEMPLATE_BUCKET_REGION,
    PGSQL_RESOURCE_ASSETS,
    PGSQL_TEMPLATES_DISTRIBUTION,
    PGSQL_TEMPLATES_ASSETS,
    PGSQL_MASTER_TEMPLATE_DISTRIBUTION,
    PGSQL_CW_CONFIG
} from '../utils/consts';
import getLogger from '../utils/logger';
import { getArtifactsBucketRegion, getArtifactsRegionBucketName } from '../utils/utils';

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

    let assets: Record<string, string>[] = [];
    switch (resourceType) {
        case DatabaseTypes.MS_SQL_SERVER:
            assets = SQL_RESOURCE_ASSETS;
            break;
        case DatabaseTypes.PG_SQL:
            assets = PGSQL_RESOURCE_ASSETS;
            break;
        default:
            break;
    }

    const artifactsRegion = getArtifactsBucketRegion(region);
    const bucketname = getArtifactsRegionBucketName(region);
    if (assets?.length) {
        await Promise.all(
            assets.map(async resource => {
                logger.info(`Creating signed url for ${resource.url} in region ${region}.`);
                try {
                    signedUrl = await getPreSignedUrl(artifactsRegion, bucketname, resource.url);
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
            PGSQLTemplate: decodeURI(signedUrls.get('PGSQLTemplate')?.url || ''),
            ...templateParameters
        });
        await putObjectBucket(TEMPLATE_BUCKET_REGION, SIGNED_TEMPLATES_BUCKET_NAME, templatePath!, contents);
    } else if (templateType === TEMPLATE_TYPES.SQLSTACK) {
        const contents = template({
            DSC: decodeURI(signedUrls.get('DSC')?.url || ''),
            PowerShell: decodeURI(signedUrls.get('PowerShell')?.url || ''),
            Dotnet: decodeURIComponent(signedUrls.get('Dotnet')?.url || ''),

            Sqlspcu: decodeURI(signedUrls.get('Sqlspcu')?.url || ''),
            AmazonFailoverCluster: decodeURI(signedUrls.get('AmazonFailoverCluster')?.url || ''),

            AmazonLaunchWizardForCFN: decodeURI(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
            AmazonLaunchWizardForSSM: decodeURI(signedUrls.get('AmazonLaunchWizardForSSM')?.url || ''),

            ScriptVerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
            ScriptUnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
            ScriptCommon: decodeURI(signedUrls.get('ScriptCommon')?.url || ''),

            ScriptSQLFCI: decodeURI(signedUrls.get('ScriptSQLFCI')?.url || ''),
            ScriptSQLONTAP: decodeURI(signedUrls.get('ScriptSQLONTAP')?.url || ''),
            ScriptDBCREATE: decodeURI(signedUrls.get('ScriptDBCREATE')?.url || ''),
            DependentPackages: decodeURI(signedUrls.get('DependentPackages')?.url || ''),
            ArtifactsSignatures: decodeURI(signedUrls.get('ArtifactsSignatures')?.url || ''),
            OpenSSL: decodeURI(signedUrls.get('OpenSSL')?.url || '')
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
            ScriptUnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
            ScriptVerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
            ScriptValidation: `"${decodeURI(signedUrls.get('ScriptValidation')?.url || '')}"`,
            ScriptCommon: decodeURI(signedUrls.get('ScriptCommon')?.url || ''),
            ArtifactsSignatures: decodeURI(signedUrls.get('ArtifactsSignatures')?.url || ''),
            FsxCertificates: decodeURI(signedUrls.get('FsxCertificates')?.url || ''),
            OpenSSL: decodeURI(signedUrls.get('OpenSSL')?.url || ''),
            PgsqlCloudWatchConfig: PGSQL_CW_CONFIG || ''
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
            PowerShell: decodeURI(signedUrls.get('PowerShell')?.url || ''),
            Dotnet: decodeURIComponent(signedUrls.get('Dotnet')?.url || ''),

            Sqlspcu: decodeURI(signedUrls.get('Sqlspcu')?.url || ''),
            AmazonLaunchWizardForCFN: decodeURI(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
            AmazonLaunchWizardForSSM: decodeURI(signedUrls.get('AmazonLaunchWizardForSSM')?.url || ''),

            ScriptVerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
            ScriptUnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
            ScriptCommon: decodeURI(signedUrls.get('ScriptCommon')?.url || ''),

            ScriptSQLFCI: decodeURI(signedUrls.get('ScriptSQLFCI')?.url || ''),
            ScriptSQLONTAP: decodeURI(signedUrls.get('ScriptSQLONTAP')?.url || ''),
            ScriptDBCREATE: decodeURI(signedUrls.get('ScriptDBCREATE')?.url || ''),
            DependentPackages: decodeURI(signedUrls.get('DependentPackages')?.url || ''),
            ArtifactsSignatures: decodeURI(signedUrls.get('ArtifactsSignatures')?.url || ''),
            OpenSSL: decodeURI(signedUrls.get('OpenSSL')?.url || '')
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
    } else if (templateType === TEMPLATE_TYPES.PGSQLSTACK) {
        const contents = template({
            ScriptVerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
            ScriptUnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
            ScriptCommon: decodeURI(signedUrls.get('ScriptCommon')?.url || ''),
            ScriptSetup: decodeURI(signedUrls.get('ScriptSetup')?.url || ''),
            FsxCertificates: decodeURI(signedUrls.get('FsxCertificates')?.url || ''),
            ArtifactsSignatures: decodeURI(signedUrls.get('ArtifactsSignatures')?.url || ''),
            PGSQLPackages: decodeURI(signedUrls.get('PGSQLPackages')?.url || ''),
            PGPOOLPackage: decodeURI(signedUrls.get('PGPOOLPackage')?.url || ''),
            PgsqlCloudWatchConfig: PGSQL_CW_CONFIG || ''
        });
        const pgsqlTemplatePath = PGSQL_TEMPLATES_ASSETS.find(asset => asset.name === 'PGSQLTemplate');
        const customPgsqlTemplatePath: string = `${WLMDB}/${stackName}/${pgsqlTemplatePath!.url}`;
        await putObjectBucket(TEMPLATE_BUCKET_REGION, SIGNED_TEMPLATES_BUCKET_NAME, customPgsqlTemplatePath, contents);
        const pgsqlTemplateSignedUrl = await getPreSignedUrl(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customPgsqlTemplatePath
        );
        signedUrls.set(pgsqlTemplatePath!.name, {
            name: pgsqlTemplatePath!.name,
            url: pgsqlTemplateSignedUrl,
            location: customPgsqlTemplatePath
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

    const signedUrls = await generateSignedUrls(region, resourceType);
    const templateDistribution =
        resourceType === DatabaseTypes.MS_SQL_SERVER ? SQL_TEMPLATES_DISTRIBUTION : PGSQL_TEMPLATES_DISTRIBUTION;
    const promises = templateDistribution.map(async template =>
        updateTemplateUrls(region, template.location, signedUrls, template.name, stackName)
    );
    const masterTempate =
        resourceType === DatabaseTypes.MS_SQL_SERVER
            ? MASTER_TEMPLATE_DISTRIBUTION
            : PGSQL_MASTER_TEMPLATE_DISTRIBUTION;
    await Promise.all(promises).then(() =>
        updateTemplateUrls(
            region,
            masterTempate.location,
            signedUrls,
            masterTempate.name,
            stackName,
            tags,
            templatePath,
            templateParameters
        )
    );
}

export { uploadTemplates, generateSignedUrls };
