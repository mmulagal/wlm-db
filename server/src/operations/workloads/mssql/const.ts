const PSSCRIPT = 'C:\\SSM\\ExecuteQueryFromSSM.ps1';
const CONFIGURELUNSCRIPT = 'C:\\SSM\\Configure-LUNs.ps1';
const CREATEDBSCRIPT = 'C:\\SSM\\Create-Database.ps1';
const INITIALIZEDBSCRIPT = 'C:\\SSM\\NewDB_Initialize-Iscsidisk.ps1';
const CLEANUPSCRIPT = 'C:\\SSM\\Cleanup-ONTAP.ps1';
const SSM_RUN_POWERSHELL_SCRIPT_DOC = 'AWS-RunPowerShellScript';
const SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION = '1';
const DB_ROWS_COUNT = 75;
const SSM_QUERY_CONCURRENCY_LIMIT = 10;
const INVOKE_VIRTUAL_MOUNT = 'C:\\SSM\\Invoke-virtualmount.ps1';
const CREATE_SANDBOX = 'C:\\SSM\\Create-Sandbox.ps1';
const SCRIPT_VERSON_FILE = 'C:\\SSM\\Script-Version.txt';
const GOOGLE_DNS = '8.8.8.8'; // Using a public DNS server to check internet connectivity
const DISCOVER_OPERATION_LOG_PATH = 'C:\\cfn\\log\\discover-operation.log.txt';
const COMPUTE_OPTIMIZE_LOG_PATH = 'C:\\cfn\\log\\compute-optimize.log.txt';
const SIZING_OPERATIONS_LOG_PATH = 'C:\\cfn\\log\\sizing-operations.log.txt';
const STORAGE_ASSESSMENT_LOG_PATH = 'C:\\cfn\\log\\storage-assessment.log.txt';
const RESILIENCY_OPTIMIZE_LOG_PATH = 'C:\\cfn\\log\\resiliency-optimize.log.txt';
const RSS_OPTIMIZE_LOG_PATH = 'C:\\cfn\\log\\rss-optimize.log.txt';
const CRR_ASSESSMENT_LOG_PATH = 'C:\\cfn\\log\\crr-assessment.log.txt';
const HIGH_AVAILABILITY_LOG_PATH = 'C:\\cfn\\log\\high-availability.log.txt';

const REQUIRED_PS_MODULES_FOR_MANAGEMENT: string = `
  'AWS.Tools.EC2',
  'AWS.Tools.FSx',
  'AWS.Tools.SimpleSystemsManagement',
  'NetApp.ONTAP',
  'AWS.Tools.BedrockRuntime',
  'AWS.Tools.CloudWatch'
`;

export {
    DB_ROWS_COUNT,
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION,
    PSSCRIPT,
    SSM_QUERY_CONCURRENCY_LIMIT,
    CONFIGURELUNSCRIPT,
    CREATEDBSCRIPT,
    INITIALIZEDBSCRIPT,
    CLEANUPSCRIPT,
    INVOKE_VIRTUAL_MOUNT,
    CREATE_SANDBOX,
    SCRIPT_VERSON_FILE,
    GOOGLE_DNS,
    DISCOVER_OPERATION_LOG_PATH,
    COMPUTE_OPTIMIZE_LOG_PATH,
    SIZING_OPERATIONS_LOG_PATH,
    STORAGE_ASSESSMENT_LOG_PATH,
    RESILIENCY_OPTIMIZE_LOG_PATH,
    RSS_OPTIMIZE_LOG_PATH,
    CRR_ASSESSMENT_LOG_PATH,
    HIGH_AVAILABILITY_LOG_PATH,
    REQUIRED_PS_MODULES_FOR_MANAGEMENT
};
