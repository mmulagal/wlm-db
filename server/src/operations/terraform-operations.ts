import createError from 'http-errors';
import Handlebars from 'handlebars';
import { readFileSync, createWriteStream } from 'fs';
import { mkdir, writeFile, rmdir, cp } from 'fs/promises';
import { Parameter } from '@aws-sdk/client-cloudformation';
import archiver from 'archiver';
import { preSignedUrl, putObjectBucket } from '../lib/aws/s3';
import {
    DatabaseTypes,
    HttpErrorCodes,
    SIGNED_TEMPLATES_BUCKET_NAME,
    WLMDB,
    TEMPLATE_BUCKET_REGION,
    TERRAFORM_SQL_INITIALIZATION_TEMPLATES_DISTRIBUTION,
    TERRAFORM_SQL_INITIALIZER_TEMPLATES_ASSETS,
    TEMPLATE_TYPES,
    CLOUDFORMATION_TO_TERRAFORM_VARIABLE_MAPPING,
    TERRAFORM_FOLDER_PATH,
    TERRAFORM_ROOT_MODULE_DISTRIBUTION,
    FCI,
    STANDALONE,
    TF_VARS_CONFIG,
    INITIALIZER,
    MSSQL,
    TERRAFORM_PGSQL_INITIALIZATION_TEMPLATES_DISTRIBUTION,
    TERRAFORM_PGSQL_INITIALIZER_TEMPLATES_ASSETS,
    PGSQL,
    CLOUDFORMATION_TO_TERRAFORM_PGSQL_VARIABLE_MAPPING,
    PGSQL_TERRAFORM_FOLDER_PATH,
    PGSQL_TERRAFORM_ROOT_MODULE_DISTRIBUTION,
    TEMP_DIRECTORY
} from '../utils/consts';
import { getArtifactsRegionBucketName, isMssql, isPgsql } from '../utils/utils';
import getLogger from '../utils/logger';
import { generateSignedUrls } from './template-operations';

const logger = getLogger();

const { getPreSignedUrl } = preSignedUrl;

interface TemplateDetails {
    name: string;
    url: string;
    location: string;
}

interface InitializationScript {
    name: string;
    url: string;
}

async function uploadTerraformModules(
    region: string,
    resourceType: DatabaseTypes,
    deploymentName: string,
    deploymentMode: string,
    tags?: Array<{ Key: string; Value: string }>,
    templatePath?: string
) {
    logger.info(
        'Uploading terraform module templates',
        region,
        resourceType,
        deploymentName,
        tags,
        templatePath,
        deploymentMode
    );

    // here getting all the assets signed urls for the scripts and other resources
    // then upating the initializer scripts for validation and sql/pgsql standalone node with the signed urls and uploading them to s3
    try {
        if (isMssql(resourceType) || isPgsql(resourceType)) {
            const signedUrls = await generateSignedUrls(region, resourceType);
            const initializationTemplatesDistribution = isMssql(resourceType)
                ? TERRAFORM_SQL_INITIALIZATION_TEMPLATES_DISTRIBUTION
                : TERRAFORM_PGSQL_INITIALIZATION_TEMPLATES_DISTRIBUTION;
            const promises = initializationTemplatesDistribution.map(async template =>
                uploadInitializerScripts(
                    region,
                    resourceType,
                    deploymentName,
                    signedUrls,
                    template.name,
                    template.location,
                    deploymentMode
                )
            );

            const data = await Promise.all(promises);
            logger.info('Initializer scripts uploaded successfully', data);
            return data;
        }
        // Yet to Implement
        logger.error('Resource type not found');
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Resource type not found');
    } catch (err: any) {
        logger.error('Error while uploading initializer scripts', err);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error while uploading initializer scripts');
    }
}

async function uploadInitializerScripts(
    region: string,
    resourceType: DatabaseTypes,
    deploymentName: string,
    signedUrls: Map<string, TemplateDetails>,
    initializerName: string,
    initializerPath: string,
    deploymentMode: string
) {
    logger.info(
        'Uploading initializer scripts for terraform modules',
        region,
        resourceType,
        deploymentName,
        signedUrls,
        initializerName,
        initializerPath,
        deploymentMode
    );

    let signedURLDetail = {};

    try {
        if (isMssql(resourceType)) {
            const source = readFileSync(initializerPath).toString();
            const template = Handlebars.compile(source);
            if (initializerName === TEMPLATE_TYPES.VALIDATION) {
                const contents = template({
                    AwsLaunchWizardForFcn: decodeURIComponent(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
                    UnzipArchive: decodeURIComponent(signedUrls.get('ScriptUnzipArchive')?.url || ''),
                    VerifySignature: decodeURIComponent(signedUrls.get('ScriptVerifySignature')?.url || ''),
                    ValidationZip: decodeURIComponent(signedUrls.get('ScriptValidation')?.url || ''),
                    CommonZip: decodeURIComponent(signedUrls.get('ScriptCommon')?.url || ''),
                    SigningFilesZip: decodeURIComponent(signedUrls.get('ArtifactsSignatures')?.url || ''),
                    OpenSslWin64Zip: decodeURIComponent(signedUrls.get('OpenSSL')?.url || '')
                });
                signedURLDetail = await processTemplate(
                    deploymentName,
                    'ValidationInitializerTemplate',
                    contents,
                    'validation_node_initialization_s3_url',
                    region,
                    resourceType
                );
            } else if (initializerName === TEMPLATE_TYPES.SQLSTANDALONE) {
                const contents = template({
                    Dsc: decodeURIComponent(signedUrls.get('DSC')?.url || ''),
                    PowerShell: decodeURIComponent(signedUrls.get('PowerShell')?.url || ''),
                    Dotnet: decodeURIComponent(signedUrls.get('Dotnet')?.url || ''),
                    SqlSpcu: decodeURIComponent(signedUrls.get('Sqlspcu')?.url || ''),
                    AmazonLaunchWizardForCfn: decodeURIComponent(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
                    AmazonLaunchWizardForSsm: decodeURIComponent(signedUrls.get('AmazonLaunchWizardForSSM')?.url || ''),
                    ...(deploymentMode === FCI
                        ? {
                              AmazonFailoverCluster: decodeURIComponent(
                                  signedUrls.get('AmazonFailoverCluster')?.url || ''
                              )
                          }
                        : {}),

                    ScriptVerifySignature: decodeURIComponent(signedUrls.get('ScriptVerifySignature')?.url || ''),
                    ScriptUnzipArchive: decodeURIComponent(signedUrls.get('ScriptUnzipArchive')?.url || ''),
                    ScriptCommon: decodeURIComponent(signedUrls.get('ScriptCommon')?.url || ''),

                    ScriptSqlFci: decodeURIComponent(signedUrls.get('ScriptSQLFCI')?.url || ''),
                    ScriptSqlOntap: decodeURIComponent(signedUrls.get('ScriptSQLONTAP')?.url || ''),
                    ScriptDbCreate: decodeURIComponent(signedUrls.get('ScriptDBCREATE')?.url || ''),
                    DependentPackages: decodeURIComponent(signedUrls.get('DependentPackages')?.url || ''),
                    ArtifactsSignatures: decodeURIComponent(signedUrls.get('ArtifactsSignatures')?.url || ''),
                    OpenSsl: decodeURIComponent(signedUrls.get('OpenSSL')?.url || ''),
                    SqlSetup: decodeURIComponent(signedUrls.get('ScriptSqlSetup')?.url || '')
                });
                const templateName =
                    deploymentMode === STANDALONE ? 'SQLStandaloneInitializerTemplate' : 'SQLFCIInitializerTemplate';
                signedURLDetail = await processTemplate(
                    deploymentName,
                    templateName,
                    contents,
                    'sql_node_initialization_s3_url',
                    region,
                    resourceType
                );
            } else {
                // Yet to implement for FCI
                logger.error('Initializer script not found');
            }
            return signedURLDetail;
        }
        // Initializer scripts for pgsql
        if (resourceType === DatabaseTypes.PG_SQL) {
            const source = readFileSync(initializerPath).toString();
            const template = Handlebars.compile(source);
            if (initializerName === TEMPLATE_TYPES.VALIDATION) {
                const contents = template({
                    AmazonLaunchWizardForCFN: decodeURIComponent(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
                    ScriptUnzipArchive: decodeURIComponent(signedUrls.get('ScriptUnzipArchive')?.url || ''),
                    ScriptVerifySignature: decodeURIComponent(signedUrls.get('ScriptVerifySignature')?.url || ''),
                    ScriptValidation: decodeURIComponent(signedUrls.get('ScriptValidation')?.url || ''),
                    ScriptCommon: decodeURIComponent(signedUrls.get('ScriptCommon')?.url || ''),
                    ArtifactsSignatures: decodeURIComponent(signedUrls.get('ArtifactsSignatures')?.url || ''),
                    FsxCertificates: decodeURIComponent(signedUrls.get('FsxCertificates')?.url || ''),
                    OpenSSL: decodeURIComponent(signedUrls.get('OpenSSL')?.url || '')
                });
                signedURLDetail = await processTemplate(
                    deploymentName,
                    'ValidationInitializerTemplate',
                    contents,
                    'validation_node_initialization_s3_url',
                    region,
                    resourceType
                );
            } else if (initializerName === TEMPLATE_TYPES.PGSQLSTACK) {
                // Both Standalone and HA have the same initializer script
                const contents = template({
                    ScriptVerifySignature: decodeURIComponent(signedUrls.get('ScriptVerifySignature')?.url || ''),
                    ScriptUnzipArchive: decodeURIComponent(signedUrls.get('ScriptUnzipArchive')?.url || ''),
                    ScriptCommon: decodeURIComponent(signedUrls.get('ScriptCommon')?.url || ''),
                    ScriptSetup: decodeURIComponent(signedUrls.get('ScriptSetup')?.url || ''),
                    FsxCertificates: decodeURIComponent(signedUrls.get('FsxCertificates')?.url || ''),
                    ArtifactsSignatures: decodeURIComponent(signedUrls.get('ArtifactsSignatures')?.url || ''),
                    PGSQLPackages: decodeURIComponent(signedUrls.get('PGSQLPackages')?.url || ''),
                    PGPOOLPackage: decodeURIComponent(signedUrls.get('PGPOOLPackage')?.url || '')
                });
                const templateName =
                    deploymentMode === STANDALONE ? 'PGSQLStandaloneInitializerTemplate' : 'PGSQLHAInitializerTemplate';
                signedURLDetail = await processTemplate(
                    deploymentName,
                    templateName,
                    contents,
                    'pgsql_node_initialization_s3_url',
                    region,
                    resourceType
                );
            } else {
                // Yet to implement for FCI
                logger.error('Initializer script not found');
            }
            return signedURLDetail;
        }
    } catch (error: any) {
        logger.error('Error while uploading initializer scripts', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error while uploading initializer scripts');
    }
}

async function processTemplate(
    deploymentName: string,
    templateName: string,
    contents: string,
    urlName: string,
    region: string,
    resourceType: string
) {
    logger.info('Processing template', templateName, contents, deploymentName, urlName, region, resourceType);

    const templateAssets = isMssql(resourceType)
        ? TERRAFORM_SQL_INITIALIZER_TEMPLATES_ASSETS
        : TERRAFORM_PGSQL_INITIALIZER_TEMPLATES_ASSETS;
    const resourcePath = isMssql(resourceType) ? MSSQL : PGSQL;

    const initializerTemplate = templateAssets.find(asset => asset.name === templateName);

    const customInitializerTemplatePath: string = `${WLMDB}/${resourcePath}/${INITIALIZER}/${deploymentName}/${
        initializerTemplate!.url
    }`;
    const bucketName = getArtifactsRegionBucketName(region);

    await putObjectBucket(region, bucketName, customInitializerTemplatePath, contents);
    const initializerS3ignedURL = await getPreSignedUrl(region, bucketName, customInitializerTemplatePath);
    return {
        name: urlName,
        url: initializerS3ignedURL,
        location: customInitializerTemplatePath
    };
}

async function createTFVarsFile(
    region: string,
    resourceType: DatabaseTypes,
    deploymentName: string,
    templatePath: string,
    templateParameters: Array<Parameter>,
    initializationScriptURLs: InitializationScript[]
) {
    logger.info('Creating terraform vars file', region, resourceType, deploymentName, templatePath, templateParameters);
    try {
        if (isMssql(resourceType) || isPgsql(resourceType)) {
            // This will create the terraform variable with the values of proper types like string, number & boolean

            const isMssqlServer = isMssql(resourceType);
            const databaseFolderPath = isMssqlServer ? MSSQL : PGSQL;

            const tfVariables = {
                aws_location: region,
                creator_tag: deploymentName,
                deployment_name: deploymentName,
                ...(isMssqlServer && { role_credentials_id: '' }),
                aws_profile: 'default',
                ...(!isMssqlServer && { fsx_aggr_name: 'aggr1' })
            };
            let terraformVariableString = '';
            let tfVarsGeneral = '\n# General Configurations\n# -----------------------------\n';
            let tfVarsEc2 = '\n# EC2 Instance Configurations\n# -----------------------------\n';
            let tfVarsAd = '\n# Active Directory Configurations\n# -----------------------------\n';
            let tfVarsFsx = '\n# FSx for ONTAP Configurations\n# -----------------------------\n';
            let tfVarsSqlServer = '\n# SQL Server Configurations\n# -----------------------------\n';
            let tfVarsEndpoint = '\n# Endpoint Configurations\n# -----------------------------\n';
            let tfVarsVpc = '# VPC and Subnet Configurations\n# -----------------------------\n';
            const terraformVariables: any = {};

            const cfToTerraformVariableMapping = isMssqlServer
                ? CLOUDFORMATION_TO_TERRAFORM_VARIABLE_MAPPING
                : CLOUDFORMATION_TO_TERRAFORM_PGSQL_VARIABLE_MAPPING;

            templateParameters.forEach(e => {
                if (e.ParameterKey) {
                    const terraformVariable = cfToTerraformVariableMapping[e.ParameterKey];
                    if (terraformVariable) {
                        let value;
                        switch (terraformVariable.type) {
                            case 'boolean':
                                value = e.ParameterValue?.toLowerCase() === 'true';
                                break;
                            case 'number':
                                value = Number(e.ParameterValue);
                                break;
                            default:
                                value = e.ParameterValue ? decodeURIComponent(e.ParameterValue) : '';
                                break;
                        }
                        const currentKeyValuePair = `${terraformVariable.name} = ${
                            terraformVariable.type === 'string' ? `"${value}"` : value
                        }\n`;
                        switch (terraformVariable.configType) {
                            case TF_VARS_CONFIG.General:
                                tfVarsGeneral += currentKeyValuePair;
                                break;
                            case TF_VARS_CONFIG.EC2:
                                tfVarsEc2 += currentKeyValuePair;
                                break;
                            case TF_VARS_CONFIG.AD:
                                tfVarsAd += currentKeyValuePair;
                                break;
                            case TF_VARS_CONFIG.FSX:
                                tfVarsFsx += currentKeyValuePair;
                                break;
                            case TF_VARS_CONFIG.SQLServer:
                                tfVarsSqlServer += currentKeyValuePair;
                                break;
                            case TF_VARS_CONFIG.Endpoint:
                                tfVarsEndpoint += currentKeyValuePair;
                                break;
                            case TF_VARS_CONFIG.VPC:
                                tfVarsVpc += currentKeyValuePair;
                                break;
                            default:
                                tfVarsGeneral += currentKeyValuePair;
                                break;
                        }
                        terraformVariables[terraformVariable.name] = value;
                    }
                }
            });

            for (const item of initializationScriptURLs) {
                tfVarsEc2 += `${item.name} = "${item.url}"\n`;
                terraformVariables[item.name] = item.url;
            }

            for (const [key, value] of Object.entries(tfVariables)) {
                tfVarsGeneral += `${key} = "${value}"\n`;
                terraformVariables[key] = value;
            }

            terraformVariableString += `${tfVarsVpc}${tfVarsEc2}${tfVarsSqlServer}${
                isMssqlServer ? tfVarsAd : ''
            }${tfVarsFsx}${tfVarsEndpoint}${tfVarsGeneral}`;
            // Write the Terraform variables to a temp directory (writable in read-only pods)
            const dirPath = `${TEMP_DIRECTORY}/${databaseFolderPath}/${deploymentName}/terraform`;
            const localTfVarsPath = `${dirPath}/terraform.tfvars`;
            await mkdir(dirPath, { recursive: true });
            await writeFile(localTfVarsPath, terraformVariableString);

            const terraformFolderPathInLocal = isMssqlServer ? TERRAFORM_FOLDER_PATH : PGSQL_TERRAFORM_FOLDER_PATH;
            // Copy all files from the source directory to the destination directory
            const sourceDir = terraformFolderPathInLocal;
            const destDir = dirPath;
            await cp(sourceDir, destDir, { recursive: true });
            return { terraformVariables };
        }
        // Yet to Implement
        logger.error('Resource type not found');
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Resource type not found');
    } catch (err: any) {
        logger.error('Error while creating tf vars file', err);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error while creating tf vars files');
    }
}

async function createRootModuleFile(
    region: string,
    resourceType: DatabaseTypes,
    deploymentName: string,
    terraformVariables: any
) {
    logger.info('creating root module file', region, resourceType, deploymentName, terraformVariables);

    try {
        if (isMssql(resourceType) || isPgsql(resourceType)) {
            const tfRootModuleTemplatePath = isMssql(resourceType)
                ? TERRAFORM_ROOT_MODULE_DISTRIBUTION
                : PGSQL_TERRAFORM_ROOT_MODULE_DISTRIBUTION;
            const source = readFileSync(tfRootModuleTemplatePath.location).toString();
            const template = Handlebars.compile(source);

            const contents = template(terraformVariables);
            return contents;
        }
    } catch (err: any) {
        logger.error('Error while creating main.tf file', err);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error while creating main.tf tempalte file');
    }
}

async function createAndUploadTheTerraformZipFile(
    region: string,
    resourceType: DatabaseTypes,
    deploymentName: string,
    templatePath: string
) {
    logger.info('Creating and uploading the terraform zip file', region, resourceType, deploymentName, templatePath);
    const type = isMssql(resourceType) ? MSSQL : PGSQL;
    try {
        if (isMssql(resourceType) || isPgsql(resourceType)) {
            const customSQLStandaloneTFPath: string = `${WLMDB}/${deploymentName}/terraform/${deploymentName}.zip`;

            const archiveFolder = `${TEMP_DIRECTORY}/${type}/${deploymentName}/${deploymentName}.zip`;
            const folderToBeZipped = `${TEMP_DIRECTORY}/${type}/${deploymentName}/terraform`;
            await createArchive(archiveFolder, folderToBeZipped);
            await putObjectBucket(
                TEMPLATE_BUCKET_REGION,
                SIGNED_TEMPLATES_BUCKET_NAME,
                customSQLStandaloneTFPath,
                '',
                archiveFolder
            );

            const zipSignedURL = await getPreSignedUrl(
                TEMPLATE_BUCKET_REGION,
                SIGNED_TEMPLATES_BUCKET_NAME,
                customSQLStandaloneTFPath
            );
            return zipSignedURL;
        }
        // Yet to Implement
        logger.error('Resource type not found');
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Resource type not found');
    } catch (err: any) {
        logger.error('Error while creating terraform zip file', err);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error while creating terraform zip file');
    } finally {
        try {
            await rmdir(`${TEMP_DIRECTORY}/${type}/${deploymentName}`, { recursive: true });
        } catch (err: any) {
            logger.error('Error while deleting the directory', err);
        }
    }
}

async function createArchive(archiveFolder: string, source: string): Promise<void> {
    logger.info('Creating archive', archiveFolder, source);

    return new Promise((resolve, reject) => {
        // Create a file to stream archive data to
        const output = createWriteStream(archiveFolder);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        // Listen for all archive data to be written
        output.on('close', () => {
            logger.info(`${archive.pointer()} total bytes`);
            logger.info('Archiver has been finalized and the output file descriptor has closed.');
            resolve();
        });

        archive.on('warning', (err: any) => {
            logger.error(err);
            reject(err);
        });

        archive.on('error', (err: any) => {
            reject(err);
        });

        // Pipe archive data to the file
        archive.pipe(output);

        // Append the entire folder to the archive
        archive.directory(source, false);

        // Finalize the archive (ie we are done appending files but streams have to finish yet)
        archive.finalize();
    });
}

export {
    uploadTerraformModules,
    uploadInitializerScripts,
    createTFVarsFile,
    createAndUploadTheTerraformZipFile,
    createRootModuleFile
};
