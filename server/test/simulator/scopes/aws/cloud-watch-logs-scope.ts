import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    GetLogEventsCommand,
    PutRetentionPolicyCommand
} from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import describeLogGroupsResponse from '../../responses/aws/describe-log-groups.json';

const cloudwatchLogsMock = mockClient(CloudWatchLogsClient);

cloudwatchLogsMock.on(GetLogEventsCommand).callsFake(async args => {
    if (args.logStreamName.includes('logs-analyzer')) {
        return {
            events: [
                {
                    message:
                        '{"status":"success","message":"Logs analysis complete.","data":{"conversationFilePath":"/Users/srigowri/wlmdb/logs-analyzer/output/conversation_history_2025-05-15T05-21-34-242Z.json","remediationFilePath":"/Users/srigowri/wlmdb/logs-analyzer/output/remediation_recommendations_2025-05-15T05-21-34-242Z.json","statusFilePath":"/Users/srigowri/wlmdb/logs-analyzer/output/status_2025-05-15T05-21-34-242Z.txt","remediationRecommendation":[{"error":"2025-02-24 20:08:17.83 Logon       Error: 18456, Severity: 14, State: 5.","context":"2025-02-24 20:08:17.83 Logon       Login failed for user \'r7\'. Reason: Could not find a login matching the name provided. [CLIENT: 10.193.34.102]","cause":"Login failed for user \'r7\' because the login does not exist in the SQL Server instance. State 5 specifically indicates that the server cannot find a SQL Server login that matches the login name provided during the connection attempt.","count":1,"severity":"14","remediation":["Create a SQL login for user \'r7\' using: CREATE LOGIN [r7] WITH PASSWORD = \'<strong_password>\', CHECK_POLICY = ON;","Verify if the login name \'r7\' might be misspelled in the connection string or application configuration.","Check if this login should be using Windows Authentication instead of SQL Authentication.","Investigate recent login attempts from IP 10.193.34.102 to identify what application or user is attempting to connect.","Review security logs to determine if this could be an unauthorized access attempt."],"firstOccurrence":1708810097830,"lastOccurrence":1708810097830,"errorCode":"18456","uniqueErrorKey":"18456","hourlyErrorCounts":[{"hour":1708808400000,"count":1}],"tokenUsage":{"causeIdentification":{"input":1180,"output":195,"total":1375},"remediationRecommendation":{"input":890,"output":178,"total":1068}}}]}}'
                }
            ]
        };
    }
    return {
        events: [{ message: 'log message 1' }, { message: 'log message 2' }]
    };
});
cloudwatchLogsMock.on(DescribeLogGroupsCommand).resolves(describeLogGroupsResponse);

cloudwatchLogsMock.on(PutRetentionPolicyCommand).resolves({});

export default cloudwatchLogsMock;
