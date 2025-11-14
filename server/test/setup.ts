// Test setup file - Import all scopes needed for tests
// This runs before all tests via vitest.config.ts setupFiles

// AWS Scopes
import './simulator/scopes/aws/ssm-scope';
import './simulator/scopes/aws/fsx-scope';
import './simulator/scopes/aws/cloud-watch-logs-scope';
import './simulator/scopes/aws/cloud-watch-scope';
import './simulator/scopes/aws/ec2-scope';
import './simulator/scopes/aws/iam-scope';
import './simulator/scopes/aws/s3-scope';
import './simulator/scopes/aws/bedrock-scope';
import './simulator/scopes/aws/kms-scope';
import './simulator/scopes/aws/compute-optimizer-scope';
import './simulator/scopes/aws/pricing-scope';
import './simulator/scopes/aws/cloud-formation-scope';
import './simulator/scopes/aws/secrets-manager-scope';
import './simulator/scopes/aws/service-quota-scope';
import './simulator/scopes/aws/cost-explorer-scope';
import './simulator/scopes/aws/auto-scaling-scope';
import './simulator/scopes/aws/sqs-scope';
import './simulator/scopes/aws/directory-service-scope';
import './simulator/scopes/aws/sns-scope';

// Cloud Manager Scopes
import './simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import './simulator/scopes/cloud-manager/workload-factory-auth-scope';
import './simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import './simulator/scopes/cloud-manager/link-service-scope';
import './simulator/scopes/cloud-manager/wlmdb-scope';
import './simulator/scopes/cloud-manager/fsx-core-scope';
import './simulator/scopes/cloud-manager/marketing-scope';
import './simulator/scopes/cloud-manager/workload-factory-notification-scope';
import './simulator/scopes/cloud-manager/cloud-manager-audit-scope';
import './simulator/scopes/cloud-manager/ubr-scope';
import './simulator/scopes/cloud-manager/cloud-manager-notification-scope';

// Other Scopes
import './simulator/scopes/opentelemetry-scope';
import './simulator/scopes/jwt-scope';
import './simulator/scopes/batch-scope';
