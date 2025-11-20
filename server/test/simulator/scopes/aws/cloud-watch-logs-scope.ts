import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    GetLogEventsCommand,
    PutRetentionPolicyCommand
} from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import describeLogGroupsResponse from '../../responses/aws/describe-log-groups.json';
import logsAnalysisResponse from '../../responses/logs-analysis/logs-analysis.json';
import oracleLogsAnalysisResponse from '../../responses/logs-analysis/oracle-logs-analysis.json';

const cloudwatchLogsMock = mockClient(CloudWatchLogsClient);

cloudwatchLogsMock.on(GetLogEventsCommand).callsFake(async args => {
    if (args.logStreamName.includes('logs-analyzer')) {
        let recommendation;
        if (args.logStreamName.includes('runShellScript')) {
            recommendation = oracleLogsAnalysisResponse.remediationRecommendation;
        } else {
            recommendation = logsAnalysisResponse.remediationRecommendation;
        }
        return {
            events: [
                {
                    message: JSON.stringify({
                        status: 'success',
                        message: 'Logs analysis complete.',
                        data: {
                            conversationFilePath:
                                '/Users/srigowri/wlmdb/logs-analyzer/output/conversation_history_2025-05-15T05-21-34-242Z.json',
                            remediationFilePath:
                                '/Users/srigowri/wlmdb/logs-analyzer/output/remediation_recommendations_2025-05-15T05-21-34-242Z.json',
                            statusFilePath:
                                '/Users/srigowri/wlmdb/logs-analyzer/output/status_2025-05-15T05-21-34-242Z.txt',
                            remediationRecommendation: recommendation
                        }
                    })
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
