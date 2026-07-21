import { TFunction } from 'i18next';
import styles from './PermissionListComponent.module.scss';
import { ACTION_TYPE, MANAGE_STATES } from '../../../../../../utils/consts';
import { AccordionItem } from '../ManageInstanceAccordion/ManageInstanceAccordion';
import { PermissionContent } from './PermissionContent/PermissionContent';
import { ReactComponent as Fix } from '../../../../../../assets/Fix.svg';
import { ReactComponent as Database } from '../../../../../../assets/Database.svg';
import { ReactComponent as SandboxImage } from '../../../../../../assets/create-db-copies.svg';

import { ReactComponent as FixDisabled } from '../../../../../../assets/Fix-disabled.svg';
import { ReactComponent as DatabaseDisabled } from '../../../../../../assets/Database-disabled.svg';
import { ReactComponent as SandboxImageDisabled } from '../../../../../../assets/Sandbox-disabled.svg';
import { ReactComponent as LogAnalyzerDisabled } from '../../../../../../assets/log_analyzer_disable.svg';
import { ReactComponent as LogAnalyzer } from '../../../../../../assets/log_analyzer_small.svg';

export const PermissionListComponentItems = (
    t: TFunction,
    manageChecks: any,
    policiesList: any,
    wizardOperationType: string,
    engineType: any,
    aiAnalysisEnabled: boolean = true
) => {
    // Error investigation readiness is overridden when AI analysis has been disabled by the
    // administrator - it takes precedence over the normal prerequisite readiness state.
    const errorInvestigationReadinessStatus = aiAnalysisEnabled
        ? manageChecks?.errorInvestigation
        : MANAGE_STATES.AI_ANALYSIS_DISABLED;
    const errorInvestigationMissingPermission =
        !aiAnalysisEnabled || manageChecks?.errorInvestigation !== MANAGE_STATES.READY;

    // MSSQL blocks for remediation (Extended analysis and fix)
    const mssqlBlocksRemediation = [
        {
            label: t('databases.register-flow.aws-iam-policy-permissions'),
            values: [
                {
                    title: t('databases.register-flow.dbwl-operate-only-permissions'),
                    items: []
                },
                {
                    title: t('databases.register-flow.additional-fsx-ontap-permissions'),
                    items: []
                },
                {
                    title: t('databases.register-flow.additional-compute-optimizer-permissions'),
                    items: []
                }
            ],
            showCopy: false,
            viewPolicy: {
                value: true,
                withTabs: true
            },
            dialogHeader: t('databases.register-flow.extended-analysis-and-fix')
        },
        {
            label: t('databases.register-flow.ec2-iam-instance-profile-permissions'),
            values: [t('databases.register-flow.dbwl-ec2-instance-profile-permissions')],
            showCopy: false,
            viewPolicy: {
                value: true,
                withTabs: false
            },
            dialogHeader: t('databases.register-flow.extended-analysis-and-fix')
        },
        {
            label: t('databases.register-flow.sql-server-permissions'),
            values: ['VIEW ANY DEFINITION', 'ALTER SETTINGS', 'VIEW SERVER STATE'],
            showCopy: false
        },
        {
            label: t('databases.register-flow.powershell-modules'),
            values: ['AWS.Tools.SimpleSystemsManagement']
        }
    ];

    // Oracle blocks for remediation
    const oracleBlocksRemediation = [
        {
            label: t('databases.register-flow.aws-iam-policy-permissions'),
            values: [t('databases.register-flow.dbwl-read-only-permissions')],
            showCopy: false,
            viewPolicy: {
                value: true,
                withTabs: false
            },
            dialogHeader: t('databases.register-flow.extended-analysis-and-fix')
        },
        {
            label: t('databases.register-flow.ec2-iam-instance-profile-permissions'),
            values: [t('databases.register-flow.dbwl-ec2-instance-profile-permissions')],
            showCopy: false,
            viewPolicy: {
                value: true,
                withTabs: false
            },
            dialogHeader: t('databases.register-flow.extended-analysis-and-fix')
        },
        {
            label: t('databases.register-flow.dependent-modules'),
            values: ['AWS-CLI', 'JQ', 'PYTHON'],
            showCopy: false
        },
        {
            label: t('databases.register-flow.oracle-user-permissions'),
            values: ['CREATE SESSION', 'SELECT_CATALOG_ROLE CONTAINER = ALL'],
            secondLineValues: ['SET CONTAINER = ALL', 'SET CONTAINER_DATA = ALL CONTAINER = CURRENT', 'ALTER SYSTEM']
        }
    ];

    // Decide which items to show based on engineType
    if (engineType === 'Oracle') {
        return [
            {
                id: '1',
                title: t('databases.register-flow.extended-analysis-and-fix'),
                subtitle: t('databases.register-flow.capability'),
                readinessStatus: manageChecks?.remediation,
                missingPermission: manageChecks?.remediation !== MANAGE_STATES.READY,
                image:
                    wizardOperationType !== ACTION_TYPE.BULK && manageChecks?.remediation !== MANAGE_STATES.READY ? (
                        <FixDisabled />
                    ) : (
                        <Fix />
                    ),
                content: (
                    <PermissionContent
                        title={t('databases.register-flow.prerequisites-list')}
                        infoBlock={t(
                            'databases.register-flow.capabilities-information.oracle-capabilities.fix-well-architected-issues'
                        )}
                        blocks={oracleBlocksRemediation}
                        policies={policiesList}
                    />
                )
            },
            {
                id: '2',
                title: t('databases.register-flow.error-investigation'),
                subtitle: t('databases.register-flow.capability'),
                readinessStatus: errorInvestigationReadinessStatus,
                missingPermission: errorInvestigationMissingPermission,
                image:
                    (wizardOperationType !== ACTION_TYPE.BULK && errorInvestigationMissingPermission) ||
                    !aiAnalysisEnabled ? (
                        <div className={`${styles.logAnalyzer} ${styles.logAnalyzerDisabled}`}>
                            <LogAnalyzerDisabled />
                        </div>
                    ) : (
                        <div className={styles.logAnalyzer}>
                            <LogAnalyzer />
                        </div>
                    ),
                content: (
                    <PermissionContent
                        title={t('databases.register-flow.prerequisites-list')}
                        infoBlock={t('databases.register-flow.capabilities-information.error-investigation-oracle')}
                        blocks={[
                            {
                                label: t('databases.register-flow.amazon-bedrock-model-activation'),
                                values: ['anthropic.claude-sonnet-4-20250514']
                            },
                            {
                                label: t('databases.register-flow.private-endpoint-for-bedrock'),
                                values: [t('databases.register-flow.private-endpoint-for-bedrock-text-oracle')]
                            },
                            {
                                label: t('databases.register-flow.aws-iam-permissions'),
                                values: [
                                    'bedrock:InvokeModel',
                                    'bedrock:GetFoundationModelAvailability',
                                    'bedrock:ListInferenceProfiles'
                                ]
                            },
                            {
                                label: t('databases.register-flow.oracle-user-permissions'),
                                values: ['V$DIAG_ALERT_EXT']
                            }
                        ]}
                        policies={policiesList}
                    />
                )
            }
        ];
    }

    // Default: MSSQL (Microsoft SQL Server)
    const items: AccordionItem[] = [
        {
            id: '1',
            title: t('databases.register-flow.extended-analysis-and-fix'),
            subtitle: t('databases.register-flow.capability'),
            readinessStatus: manageChecks?.remediation,
            missingPermission: manageChecks?.remediation !== MANAGE_STATES.READY,
            image:
                wizardOperationType !== ACTION_TYPE.BULK && manageChecks?.remediation !== MANAGE_STATES.READY ? (
                    <FixDisabled />
                ) : (
                    <Fix />
                ),
            content: (
                <PermissionContent
                    title={t('databases.register-flow.prerequisites-list')}
                    infoBlock={t('databases.register-flow.capabilities-information.fix-well-architected-issues')}
                    blocks={mssqlBlocksRemediation}
                    policies={policiesList}
                />
            )
        },
        {
            id: '2',
            title: t('databases.register-flow.create-database'),
            subtitle: t('databases.register-flow.capability'),
            readinessStatus: manageChecks?.dbcreation,
            missingPermission: manageChecks?.dbcreation !== MANAGE_STATES.READY,
            image:
                wizardOperationType !== 'bulk' && manageChecks?.dbcreation !== MANAGE_STATES.READY ? (
                    <DatabaseDisabled />
                ) : (
                    <Database />
                ),
            content: (
                <PermissionContent
                    title={t('databases.register-flow.prerequisites-list')}
                    infoBlock={t('databases.register-flow.capabilities-information.create-database')}
                    blocks={[
                        {
                            label: t('databases.register-flow.aws-iam-policy-permissions'),
                            values: [t('databases.register-flow.dbwl-read-only-permissions')],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t('databases.register-flow.create-database')
                        },
                        {
                            label: t('databases.register-flow.ec2-iam-instance-profile-permissions'),
                            values: [t('databases.register-flow.dbwl-ec2-instance-profile-permissions')],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t('databases.register-flow.create-database')
                        },
                        {
                            label: t('databases.register-flow.sql-server-permissions'),
                            values: ['VIEW ANY DEFINITION', 'VIEW SERVER STATE', 'CREATE ANY DATABASE'],
                            showCopy: false
                        },
                        {
                            label: t('databases.register-flow.powershell-modules'),
                            values: ['AWS.Tools.FSx', 'AWS.Tools.SimpleSystemsManagement', 'PowerShell 7']
                        }
                    ]}
                    policies={policiesList}
                />
            )
        },
        {
            id: '3',
            title: t('databases.register-flow.create-database-copies-sandbox'),
            subtitle: t('databases.register-flow.capability'),
            readinessStatus: manageChecks?.sandbox,
            missingPermission: manageChecks?.sandbox !== MANAGE_STATES.READY,
            image:
                wizardOperationType !== ACTION_TYPE.BULK && manageChecks?.sandbox !== MANAGE_STATES.READY ? (
                    <SandboxImageDisabled />
                ) : (
                    <SandboxImage />
                ),
            content: (
                <PermissionContent
                    title={t('databases.register-flow.prerequisites-list')}
                    infoBlock={t('databases.register-flow.capabilities-information.create-sandbox')}
                    blocks={[
                        {
                            label: t('databases.register-flow.aws-iam-policy-permissions'),
                            values: [t('databases.register-flow.dbwl-read-only-permissions')],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t('databases.register-flow.create-database-copies-sandbox')
                        },
                        {
                            label: t('databases.register-flow.ec2-iam-instance-profile-permissions'),
                            values: [t('databases.register-flow.dbwl-ec2-instance-profile-permissions')],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t('databases.register-flow.create-database-copies-sandbox')
                        },
                        {
                            label: t('databases.register-flow.sql-server-permissions'),
                            values: [
                                'ALTER SETTINGS',
                                'CONTROL SERVER',
                                'ALTER ANY DATABASE',
                                'VIEW ANY DEFINITION',
                                'VIEW SERVER STATE',
                                'CREATE ANY DATABASE'
                            ],
                            showCopy: false
                        },
                        {
                            label: t('databases.register-flow.powershell-modules'),
                            values: ['AWS.Tools.SimpleSystemsManagement', 'NetApp.ONTAP']
                        }
                    ]}
                    policies={policiesList}
                />
            )
        },
        {
            id: '4',
            title: t('databases.register-flow.error-investigation'),
            subtitle: t('databases.register-flow.capability'),
            readinessStatus: errorInvestigationReadinessStatus,
            missingPermission: errorInvestigationMissingPermission,
            image:
                (wizardOperationType !== ACTION_TYPE.BULK && errorInvestigationMissingPermission) ||
                !aiAnalysisEnabled ? (
                    <div className={`${styles.logAnalyzer} ${styles.logAnalyzerDisabled}`}>
                        <LogAnalyzerDisabled />
                    </div>
                ) : (
                    <div className={styles.logAnalyzer}>
                        <LogAnalyzer />
                    </div>
                ),
            content: (
                <PermissionContent
                    title={t('databases.register-flow.prerequisites-list')}
                    infoBlock={t('databases.register-flow.capabilities-information.error-investigation')}
                    blocks={[
                        {
                            label: t('databases.register-flow.amazon-bedrock-model-activation'),
                            values: ['anthropic.claude-sonnet-4-20250514']
                        },
                        {
                            label: t('databases.register-flow.private-endpoint-for-bedrock'),
                            values: [t('databases.register-flow.private-endpoint-for-bedrock-text')]
                        },
                        {
                            label: t('databases.register-flow.aws-iam-permissions'),
                            values: [
                                'bedrock:InvokeModel',
                                'bedrock:GetFoundationModelAvailability',
                                'bedrock:ListInferenceProfiles'
                            ]
                        },
                        {
                            label: t('databases.register-flow.powershell-modules'),
                            values: ['AWS.Tools.BedrockRuntime']
                        }
                    ]}
                    policies={policiesList}
                />
            )
        }
    ];

    return items;
};
