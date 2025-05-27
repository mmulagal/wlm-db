import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
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

const PermissionListComponent = ({ manageChecks, policiesList }: any) => {
    const { t } = useTranslation();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [disableAll, setDisableAll] = useState(false);
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    const items: AccordionItem[] = [
        {
            id: '1',
            title: t('databases.register-flow.review-well-architected-issues-and-recommendations'),
            subtitle: t('databases.register-flow.capability'),
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
                            label: t('databases.register-flow.aws-iam-policy-permissions'),
                            values: ['Databases workload - Read-only permissions'],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t(
                                'databases.register-flow.review-well-architected-issues-and-recommendations'
                            )
                        },
                        {
                            label: t('databases.register-flow.ec2-iam-instance-profile-permissions'),
                            values: ['Databases workload - EC2 instance profile permissions'],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t(
                                'databases.register-flow.review-well-architected-issues-and-recommendations'
                            )
                        },
                        {
                            label: t('databases.register-flow.sql-server-permissions'),
                            values: ['VIEW ANY DEFINITION', 'CONNECT ANY DATABASE', 'VIEW SERVER STATE'],
                            showCopy: false
                        },
                        {
                            label: t('databases.register-flow.powershell-modules'),
                            values: ['AWS.Tools.SimpleSystemsManagement']
                        }
                    ]}
                    policies={policiesList}
                />
            )
        },
        {
            id: '2',
            title: t('databases.register-flow.fix-well-architected-issues'),
            subtitle: t('databases.register-flow.capability'),
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
                            label: t('databases.register-flow.aws-iam-policy-permissions'),
                            values: [
                                {
                                    title: 'Databases workload - Read-only permissions',
                                    items: []
                                },
                                {
                                    title: 'Additional FSx for ONTAP permissions',
                                    items: []
                                },
                                {
                                    title: 'Additional Compute Optimizer permissions',
                                    items: []
                                }
                            ],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: true
                            },
                            dialogHeader: t('databases.register-flow.fix-well-architected-issues')
                        },
                        {
                            label: t('databases.register-flow.ec2-iam-instance-profile-permissions'),
                            values: ['Databases workload - EC2 instance profile permissions'],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t('databases.register-flow.fix-well-architected-issues')
                        },
                        {
                            label: t('databases.register-flow.sql-server-permissions'),
                            values: [
                                'VIEW ANY DEFINITION',
                                'CONNECT ANY DATABASE',
                                'ALTER SETTINGS',
                                'VIEW SERVER STATE'
                            ],
                            showCopy: false
                        },
                        {
                            label: t('databases.register-flow.powershell-modules'),
                            values: ['AWS.Tools.SimpleSystemsManagement']
                        }
                    ]}
                    policies={policiesList}
                />
            )
        },
        {
            id: '3',
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
                    title={GENERAL.PREREQUISITE_LIST}
                    blocks={[
                        {
                            label: t('databases.register-flow.aws-iam-policy-permissions'),
                            values: ['Databases workload - Read-only permissions'],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t('databases.register-flow.create-database')
                        },
                        {
                            label: t('databases.register-flow.ec2-iam-instance-profile-permissions'),
                            values: ['Databases workload - EC2 instance profile permissions'],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t('databases.register-flow.create-database')
                        },
                        {
                            label: t('databases.register-flow.sql-server-permissions'),
                            values: [
                                'VIEW ANY DEFINITION',
                                'VIEW SERVER STATE',
                                'CONNECT ANY DATABASE',
                                'CREATE ANY DATABASE'
                            ],
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
            id: '4',
            title: t('databases.register-flow.create-database-copies-sandbox'),
            subtitle: t('databases.register-flow.capability'),
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
                            label: t('databases.register-flow.aws-iam-policy-permissions'),
                            values: ['Databases workload - Read-only permissions'],
                            showCopy: false,
                            viewPolicy: {
                                value: true,
                                withTabs: false
                            },
                            dialogHeader: t('databases.register-flow.create-database-copies-sandbox')
                        },
                        {
                            label: t('databases.register-flow.ec2-iam-instance-profile-permissions'),
                            values: ['Databases workload - EC2 instance profile permissions'],
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
                                'CONNECT ANY DATABASE',
                                'CREATE ANY DATABASE'
                            ],
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
        }
    ];
    return (
        <div className={styles.permissionList}>
            <DsTypography variant="Semibold_16">{t('databases.register-flow.prerequisite-check')}</DsTypography>

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
