import { DsTypography } from '@netapp/design-system';
import { AccordionItem, ManageInstanceAccordion } from '../ManageInstanceAccordion/ManageInstanceAccordion';
import { ReactComponent as Review } from '../../../../../../assets/Review.svg';
import { ReactComponent as Fix } from '../../../../../../assets/Fix.svg';
import { ReactComponent as Database } from '../../../../../../assets/Database.svg';
import { ReactComponent as SandboxImage } from '../../../../../../assets/create-db-copies.svg';

import styles from './PermissionListComponent.module.scss';
import { useState } from 'react';
import { PermissionContent } from './PermissionContent/PermissionContent';

const PermissionListComponent = () => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [disableAll, setDisableAll] = useState(false);

    const items: AccordionItem[] = [
        {
            id: '1',
            title: 'Review well-architected issues and recommendations',
            subtitle: 'Capability',
            readinessStatus: 'Ready',
            image: <Review />,
            content: (
                <PermissionContent
                    title="Permission list"
                    blocks={[
                        {
                            label: 'AWS IAM policy permissions',
                            values: ['Databases workload - Read - only permissions'],
                            showCopy: true
                        },
                        {
                            label: 'SQL Server permissions',
                            values: ['VIEW ANY DEFINITION', 'CONNECT ANY DATABASE', 'VIEW SERVER STATE'],
                            showCopy: true
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
            readinessStatus: 'Ready',
            image: <Fix />,
            content: (
                <PermissionContent
                    title="Permission list"
                    blocks={[
                        {
                            label: 'AWS IAM policy permissions',
                            values: [
                                'Databases workload - Read - only permissions',
                                {
                                    title: 'Additional FSx permissions',
                                    items: ['fsx:UpdateFileSystem', 'fsx:UpdateVolume']
                                },
                                {
                                    title: 'Compute optimizer permissions',
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
                            showCopy: true
                        },
                        {
                            label: 'SQL Server permissions',
                            values: [
                                'VIEW ANY DEFINITION',
                                'CONNECT ANY DATABASE',
                                'ALTER SETTINGS',
                                'VIEW SERVER STATE'
                            ],
                            showCopy: true
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
            readinessStatus: 'Ready',
            image: <Database />,
            content: (
                <PermissionContent
                    title="Permission list"
                    blocks={[
                        {
                            label: 'AWS IAM policy permissions',
                            values: ['Databases workload - Read - only permissions'],
                            showCopy: true
                        },
                        {
                            label: 'SQL Server permissions',
                            values: [
                                'VIEW ANY DEFINITION',
                                'VIEW SERVER STATE',
                                'CONNECT ANY DATABASE',
                                'CREATE ANY DATABASE'
                            ],
                            showCopy: true
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
            readinessStatus: 'Ready',
            image: <SandboxImage />,
            content: (
                <PermissionContent
                    title="Permission list"
                    blocks={[
                        {
                            label: 'AWS IAM policy permissions',
                            values: ['Databases workload - Read - only permissions'],
                            showCopy: true
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
                            showCopy: true
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
            <DsTypography variant="Semibold_16">Permission list</DsTypography>

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
