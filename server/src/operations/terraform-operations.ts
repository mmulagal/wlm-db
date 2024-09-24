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
    TERRAFORM_FOLDER_PATH
} from '../utils/consts';
import getLogger from '../utils/logger';
import { generateSignedUrls } from './template-operations';

const logger = getLogger();
const { getPreSignedUrl } = preSignedUrl;

interface TemplateDetails {
    name: string;
    url: string;
    location: string;
}

async function uploadTerraformModules(
    region: string,
    resourceType: DatabaseTypes,
    deploymentName: string,
    tags?: Array<{ Key: string; Value: string }>,
    templatePath?: string
) {
    logger.info('Uploading terraform module templates', region, resourceType, deploymentName, tags, templatePath);

    // here getting all the assets signed urls for the scripts and other resources
    // then upating the initializer scripts for validation and sql standalone node with the signed urls and uploading them to s3
    try {
        if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
            const signedUrls = await generateSignedUrls(region, resourceType);
            const promises = TERRAFORM_SQL_INITIALIZATION_TEMPLATES_DISTRIBUTION.map(async template =>
                uploadInitializerScripts(
                    region,
                    resourceType,
                    deploymentName,
                    signedUrls,
                    template.name,
                    template.location
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
    initializerPath: string
) {
    logger.info(
        'Uploading initializer scripts for terraform modules',
        region,
        resourceType,
        deploymentName,
        signedUrls,
        initializerName,
        initializerPath
    );

    let signedURLDetail = {};

    try {
        if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
            const source = readFileSync(initializerPath).toString();
            const template = Handlebars.compile(source);
            if (initializerName === TEMPLATE_TYPES.VALIDATION) {
                const contents = template({
                    AwsLaunchWizardForFcn: decodeURI(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
                    UnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
                    VerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
                    ValidationZip: decodeURI(signedUrls.get('ScriptValidation')?.url || ''),
                    CommonZip: decodeURI(signedUrls.get('ScriptCommon')?.url || ''),
                    SigningFilesZip: decodeURI(signedUrls.get('ArtifactsSignatures')?.url || ''),
                    OpenSslWin64Zip: decodeURI(signedUrls.get('OpenSSL')?.url || '')
                });
                signedURLDetail = await processTemplate(
                    deploymentName,
                    'ValidationInitializerTemplate',
                    contents,
                    'validation_node_initialization_s3_url'
                );
            } else if (initializerName === TEMPLATE_TYPES.SQLSTANDALONE) {
                const contents = template({
                    Dsc: decodeURI(signedUrls.get('DSC')?.url || ''),
                    PowerShell: decodeURI(signedUrls.get('PowerShell')?.url || ''),

                    SqlSpcu: decodeURI(signedUrls.get('Sqlspcu')?.url || ''),
                    AmazonLaunchWizardForCfn: decodeURI(signedUrls.get('AmazonLaunchWizardForCFN')?.url || ''),
                    AmazonLaunchWizardForSsm: decodeURI(signedUrls.get('AmazonLaunchWizardForSSM')?.url || ''),

                    ScriptVerifySignature: decodeURI(signedUrls.get('ScriptVerifySignature')?.url || ''),
                    ScriptUnzipArchive: decodeURI(signedUrls.get('ScriptUnzipArchive')?.url || ''),
                    ScriptCommon: decodeURI(signedUrls.get('ScriptCommon')?.url || ''),

                    ScriptSqlFci: decodeURI(signedUrls.get('ScriptSQLFCI')?.url || ''),
                    ScriptSqlOntap: decodeURI(signedUrls.get('ScriptSQLONTAP')?.url || ''),
                    ScriptDbCreate: decodeURI(signedUrls.get('ScriptDBCREATE')?.url || ''),
                    DependentPackages: decodeURI(signedUrls.get('DependentPackages')?.url || ''),
                    ArtifactsSignatures: decodeURI(signedUrls.get('ArtifactsSignatures')?.url || ''),
                    OpenSsl: decodeURI(signedUrls.get('OpenSSL')?.url || ''),
                    SqlSetup: decodeURI(signedUrls.get('ScriptSqlSetup')?.url || '')
                });
                signedURLDetail = await processTemplate(
                    deploymentName,
                    'SQLStandaloneInitializerTemplate',
                    contents,
                    'sql_node_initialization_s3_url'
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

async function processTemplate(deploymentName: string, templateName: string, contents: string, urlName: string) {
    logger.info('Processing template', templateName, contents, deploymentName, urlName);

    const initializerTemplate = TERRAFORM_SQL_INITIALIZER_TEMPLATES_ASSETS.find(asset => asset.name === templateName);

    const customInitializerTemplatePath: string = `${WLMDB}/${deploymentName}/${initializerTemplate!.url}`;
    await putObjectBucket(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customInitializerTemplatePath,
        contents
    );
    const initializerS3ignedURL = await getPreSignedUrl(
        TEMPLATE_BUCKET_REGION,
        SIGNED_TEMPLATES_BUCKET_NAME,
        customInitializerTemplatePath
    );
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
    initializationScriptURLs: any,
    metrics: string
) {
    logger.info('Creating terraform vars file', region, resourceType, deploymentName, templatePath, templateParameters);
    if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
        // This will create the terraform variable with the values of proper types like string, number & boolean
        const tfVariables = {
            aws_location: region,
            creator_tag: deploymentName,
            deployment_name: deploymentName,
            role_credentials_id: '',
            metrics,
            fsx_encryption_key: ''
        };
        let terraformVariableString = '';

        templateParameters.forEach(e => {
            if (e.ParameterKey) {
                const terraformVariable = CLOUDFORMATION_TO_TERRAFORM_VARIABLE_MAPPING[e.ParameterKey];
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
                            value = e.ParameterValue ? encodeURIComponent(e.ParameterValue) : '';
                            break;
                    }
                    terraformVariableString += `${terraformVariable.name} = ${
                        terraformVariable.type === 'string' ? `"${value}"` : value
                    }\n`;
                }
            }
        });

        for (const item of initializationScriptURLs) {
            terraformVariableString += `${item.name} = "${item.url}"\n`;
        }

        for (const [key, value] of Object.entries(tfVariables)) {
            terraformVariableString += `${key} = "${value}"\n`;
        }

        // Write the Terraform variables to a local file as well.. can be decided whether to use it from local or s3
        const dirPath = `./resources/mssql/${deploymentName}/terraform`;
        const localTfVarsPath = `${dirPath}/terraform.tfvars`;
        await mkdir(dirPath, { recursive: true });
        await writeFile(localTfVarsPath, terraformVariableString);

        // Copy all files from the source directory to the destination directory
        const sourceDir = TERRAFORM_FOLDER_PATH;
        const destDir = dirPath;
        const result = await cp(sourceDir, destDir, { recursive: true });
        return result;
    }
    // Yet to Implement
    logger.error('Resource type not found');
    throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Resource type not found');
}

async function createAndUploadTheTerraformZipFile(
    region: string,
    resourceType: DatabaseTypes,
    deploymentName: string,
    templatePath: string
) {
    logger.info('Creating and uploading the terraform zip file', region, resourceType, deploymentName, templatePath);

    if (resourceType === DatabaseTypes.MS_SQL_SERVER) {
        const archiveFolder = `./resources/mssql/${deploymentName}/terraform.zip`;
        const folderToBeZipped = `./resources/mssql/${deploymentName}/terraform`;
        await createArchive(archiveFolder, folderToBeZipped);
        const customSQLStandaloneTFPath: string = `${WLMDB}/${deploymentName}/terraform/terraform.zip`;
        await putObjectBucket(
            TEMPLATE_BUCKET_REGION,
            SIGNED_TEMPLATES_BUCKET_NAME,
            customSQLStandaloneTFPath,
            '',
            archiveFolder
        );
        await rmdir(`./resources/mssql/${deploymentName}`, { recursive: true });
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

export { uploadTerraformModules, uploadInitializerScripts, createTFVarsFile, createAndUploadTheTerraformZipFile };
