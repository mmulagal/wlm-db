import { DsTypography } from '@netapp/design-system';
import { AccordionItem, ManageInstanceAccordion } from '../ManageInstanceAccordion/ManageInstanceAccordion';
import { ReactComponent as Review } from '../../../../../../assets/Review.svg';
import { ReactComponent as Fix } from '../../../../../../assets/Fix.svg';
import { ReactComponent as Database } from '../../../../../../assets/Database.svg';
import { ReactComponent as SandboxImage } from '../../../../../../assets/create-db-copies.svg';

import { ReactComponent as ReviewDisabled } from '../../../../../../assets/Review-disabled.svg';
import { ReactComponent as FixDisabled } from '../../../../../../assets/Fix-disabled.svg';
import { ReactComponent as DatabaseDisabled } from '../../../../../../assets/Database-disabled.svg';
import { ReactComponent as SandboxImageDisabled } from '../../../../../../assets/Sandbox-disabled.svg';

import styles from './PermissionListComponent.module.scss';
import { useState } from 'react';
import { PermissionContent } from './PermissionContent/PermissionContent';
import { MANAGE_STATES } from '../../../../../../utils/consts';
import { GENERAL } from '../../../../../../utils/appConstants';
import { useAppSelector } from '../../../../../../store/storeHooks';

const PermissionListComponent = ({ manageChecks }: any) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [disableAll, setDisableAll] = useState(false);
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    const items: AccordionItem[] = [
        {
            id: '1',
            title: 'Review well-architected issues and recommendations',
            subtitle: 'Capability',
            readinessStatus: manageChecks?.assessment,
            missingPermission: manageChecks?.assessment !== MANAGE_STATES.READY,
            image:
                wizardOperationType !== 'bulk' && manageChecks?.assessment !== MANAGE_STATES.READY ? (
                    <ReviewDisabled />
                ) : (
                    <Review />
                ),
            content: (
                <PermissionContent
                    title={GENERAL.PREREQUISITE_LIST}
                    blocks={[
                        {
                            label: 'AWS IAM policy permissions',
                            values: ['Databases workload - Read-only permissions'],
                            showCopy: false
                        },
                        {
                            label: 'EC2 IAM instance profile permissions',
                            values: ['Databases workload - EC2 instance profile permissions'],
                            showCopy: false
                        },
                        {
                            label: 'SQL Server permissions',
                            values: ['VIEW ANY DEFINITION', 'CONNECT ANY DATABASE', 'VIEW SERVER STATE'],
                            showCopy: false
                        },
                        {
                            label: 'PowerShell modules',
                            values: ['AWS.Tools.SimpleSystemsManagement']
                        }
                    ]}
                />
            )
        },
        {
            id: '2',
            title: 'Fix well-architected issues',
            subtitle: 'Capability',
            readinessStatus: manageChecks?.remediation,
            missingPermission: manageChecks?.remediation !== MANAGE_STATES.READY,
            image:
                wizardOperationType !== 'bulk' && manageChecks?.remediation !== MANAGE_STATES.READY ? (
                    <FixDisabled />
                ) : (
                    <Fix />
                ),
            content: (
                <PermissionContent
                    title={GENERAL.PREREQUISITE_LIST}
                    blocks={[
                        {
                            label: 'AWS IAM policy permissions',
                            values: [
                                'Databases workload - Read-only permissions',
                                {
                                    title: 'Additional FSx for ONTAP permissions',
                                    items: ['fsx:UpdateFileSystem', 'fsx:UpdateVolume']
                                },
                                {
                                    title: 'AWS Compute Optimizer',
                                    items: [
                                        'compute-optimizer:GetEnrollmentStatus',
                                        'compute-optimizer:PutRecommendationPreferences',
                                        'compute-optimizer:GetEffectiveRecommendationPreferences',
                                        'compute-optimizer:GetEC2InstanceRecommendations',
                                        'autoscaling:DescribeAutoScalingGroups',
                                        'autoscaling:DescribeAutoScalingInstances'
                                    ]
                                }
                            ],
                            showCopy: false
                        },
                        {
                            label: 'EC2 IAM instance profile permissions',
                            values: ['Databases workload - EC2 instance profile permissions'],
                            showCopy: false
                        },
                        {
                            label: 'SQL Server permissions',
                            values: [
                                'VIEW ANY DEFINITION',
                                'CONNECT ANY DATABASE',
                                'ALTER SETTINGS',
                                'VIEW SERVER STATE'
                            ],
                            showCopy: false
                        },
                        {
                            label: 'PowerShell modules',
                            values: ['AWS.Tools.SimpleSystemsManagement']
                        }
                    ]}
                />
            )
        },
        {
            id: '3',
            title: 'Create database',
            subtitle: 'Capability',
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
                    title={GENERAL.PREREQUISITE_LIST}
                    blocks={[
                        {
                            label: 'AWS IAM policy permissions',
                            values: ['Databases workload - Read-only permissions'],
                            showCopy: false
                        },
                        {
                            label: 'EC2 IAM instance profile permissions',
                            values: ['Databases workload - EC2 instance profile permissions'],
                            showCopy: false
                        },
                        {
                            label: 'SQL Server permissions',
                            values: [
                                'VIEW ANY DEFINITION',
                                'VIEW SERVER STATE',
                                'CONNECT ANY DATABASE',
                                'CREATE ANY DATABASE'
                            ],
                            showCopy: false
                        },
                        {
                            label: 'PowerShell modules',
                            values: ['AWS.Tools.FSx', 'AWS.Tools.SimpleSystemsManagement', 'PowerShell 7']
                        }
                    ]}
                />
            )
        },
        {
            id: '4',
            title: 'Create database copies (Sandbox)',
            subtitle: 'Capability',
            readinessStatus: manageChecks?.sandbox,
            missingPermission: manageChecks?.sandbox !== MANAGE_STATES.READY,
            image:
                wizardOperationType !== 'bulk' && manageChecks?.sandbox !== MANAGE_STATES.READY ? (
                    <SandboxImageDisabled />
                ) : (
                    <SandboxImage />
                ),
            content: (
                <PermissionContent
                    title={GENERAL.PREREQUISITE_LIST}
                    blocks={[
                        {
                            label: 'AWS IAM policy permissions',
                            values: ['Databases workload - Read-only permissions'],
                            showCopy: false
                        },
                        {
                            label: 'EC2 IAM instance profile permissions',
                            values: ['Databases workload - EC2 instance profile permissions'],
                            showCopy: false
                        },
                        {
                            label: 'SQL Server permissions',
                            values: [
                                'ALTER SETTINGS',
                                'CONTROL SERVER',
                                'ALTER ANY DATABASE',
                                'VIEW ANY DEFINITION',
                                'VIEW SERVER STATE',
                                'CONNECT ANY DATABASE',
                                'CREATE ANY DATABASE'
                            ],
                            showCopy: false
                        },
                        {
                            label: 'PowerShell modules',
                            values: ['AWS.Tools.FSx', 'AWS.Tools.SimpleSystemsManagement', 'PowerShell 7']
                        }
                    ]}
                />
            )
        }
    ];
    return (
        <div className={styles.permissionList}>
            <DsTypography variant="Semibold_16">Prerequisite check</DsTypography>

            <div className={styles.accordionSection}>
                <ManageInstanceAccordion
                    items={items}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    disableAll={disableAll}
                />
            </div>
        </div>
    );
};

export default PermissionListComponent;
