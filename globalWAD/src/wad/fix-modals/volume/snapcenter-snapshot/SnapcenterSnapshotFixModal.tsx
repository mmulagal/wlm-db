import { memo, useMemo } from 'react';
import {
    ModalHeader,
    ModalContent,
    ModalFooter,
    ButtonsGroup,
    Button,
    Text,
    BulletList
} from '@netapp/bxp-design-system-react';
import {
    FixModalNumberedList,
    FixModalSection,
    FixModalSectionTitle,
    HeightCapModal
} from '../../shared/fixModalStyles';
import type { VolumeFixModalProps } from '../../shared/volumeFixModalComponents';
import { readResourceWorkloadType, WorkloadType, type WorkloadTypeValue } from '../../../tables/shared/metadataUtils';

const SnapcenterSnapshotFixModalTestIds = {
    modal: 'wlmdb-snapcenter-snapshot-fix-modal',
    header: 'wlmdb-snapcenter-snapshot-fix-modal-header',
    content: 'wlmdb-snapcenter-snapshot-fix-modal-content',
    closeButton: 'wlmdb-snapcenter-snapshot-fix-close-btn',
    optimizationSteps: 'wlmdb-snapcenter-snapshot-fix-modal-optimization-steps'
} as const;

const MSSQL_COPY = {
    actionSummary:
        'Use SnapCenter to create application-consistent snapshots of your volumes at a specific point in time. This helps keep apps stable, protects critical data, and enables faster, more accurate restores with less downtime.',
    option1Title: 'Option 1: Configure application-consistent snapshots with NetApp Backup and Recovery',
    option1Steps: [
        'From the inventory, click on the actions menu for the instance and then select Protect.',
        "If prompted, enter Windows admin credentials. We'll check for Console agents. If none are installed, you'll be redirected to NetApp Console to create one.",
        "If multiple Console agents are available, choose the agent you want to use to register and protect this workload. You'll then be redirected to NetApp Console to complete the data protection setup.",
        'To prepare for data protection, Workload Factory automatically registers your Microsoft SQL Server resources in Backup and Recovery, configures and installs the Plug-in for Microsoft SQL Server, and discovers resources to meet the prerequisites for protecting your SQL Server instance. Select Start to begin the process.',
        'After meeting the prerequisites, select Redirect to access Backup and Recovery.'
    ],
    option2Title: 'Option 2: Configure application-consistent snapshots with standalone SnapCenter Server',
    option2Intro:
        'Schedule SnapCenter configuration changes during a maintenance window. Ensure the SnapCenter Server has network connectivity to the Microsoft SQL server and FSx for ONTAP management interfaces. Initial backup operations may consume storage and I/O resources.',
    option2Steps: [
        'Install SnapCenter Server on a dedicated host.',
        'Review the list of impacted volumes that are not currently protected by SnapCenter snapshots. If you intentionally protect any of these volumes using an alternative backup method, dismiss or postpone this recommendation and record the reason for audit purposes.',
        'Verify that the SnapCenter Plug-in service is installed and running on the Windows host (Get-Service -Name "SnapCenter*").',
        'Register the Microsoft SQL Server instance in SnapCenter Server and discover the database resources.',
        'Create or assign a backup policy with an appropriate schedule and retention that aligns with your recovery point objective (RPO).',
        'Assign the policy to a resource group containing the impacted Microsoft SQL Server databases and verify that scheduled backups complete successfully.'
    ]
} as const;

const ORACLE_COPY = {
    actionSummary:
        'Workload Factory recommends configuring application-consistent snapshots with NetApp SnapCenter for all Oracle database volumes to ensure reliable point-in-time recovery and data integrity.',
    optimizationSteps: [
        'Review the list of impacted volumes that are not currently protected by SnapCenter snapshots.',
        'Verify that the SnapCenter Plug-in Loader (SPL) service is installed and running on the Oracle host (systemctl status snapcenter_spl).',
        'Register the Oracle database host in SnapCenter Server and discover the database resources.',
        'Create or assign a backup policy with an appropriate schedule and retention that aligns with your recovery point objective (RPO).',
        'Assign the policy to a resource group containing the impacted Oracle databases and verify that scheduled backups complete successfully.',
        'If you intentionally protect any of these volumes using an alternative backup method, dismiss or postpone this recommendation and record the reason for audit purposes.'
    ],
    notes: [
        'Schedule SnapCenter configuration changes during a maintenance window.',
        'Ensure the SnapCenter Server has network connectivity to the Oracle host and FSx for ONTAP management interfaces.',
        'Initial backup operations may consume storage and I/O resources.',
        'Verify that ONTAP snapshots with SnapCenter comments are present on all protected volumes after the first scheduled backup completes.'
    ]
} as const;

const SNAPCENTER_COPY: Record<WorkloadTypeValue, typeof MSSQL_COPY | typeof ORACLE_COPY> = {
    [WorkloadType.MSSQL]: MSSQL_COPY,
    [WorkloadType.ORACLE]: ORACLE_COPY
};

const isMssqlCopy = (copy: typeof MSSQL_COPY | typeof ORACLE_COPY): copy is typeof MSSQL_COPY => 'option1Title' in copy;

export const SnapcenterSnapshotFixModal = memo(({ recommendationName, resources, close }: VolumeFixModalProps) => {
    const copy = useMemo(() => {
        const workloadType = readResourceWorkloadType(resources[0]) ?? WorkloadType.MSSQL;
        return SNAPCENTER_COPY[workloadType];
    }, [resources]);

    return (
        <HeightCapModal dataTestId={SnapcenterSnapshotFixModalTestIds.modal}>
            <ModalHeader dataTestId={SnapcenterSnapshotFixModalTestIds.header}>{recommendationName}</ModalHeader>
            <ModalContent dataTestId={SnapcenterSnapshotFixModalTestIds.content}>
                <FixModalSection>
                    <FixModalSectionTitle bold>Action summary</FixModalSectionTitle>
                    <Text>{copy.actionSummary}</Text>
                </FixModalSection>
                {isMssqlCopy(copy) ? (
                    <>
                        <FixModalSection>
                            <FixModalSectionTitle bold>Optimization steps</FixModalSectionTitle>
                            <Text bold>{copy.option1Title}</Text>
                            <FixModalNumberedList dataTestId={SnapcenterSnapshotFixModalTestIds.optimizationSteps}>
                                {copy.option1Steps.map(step => (
                                    <Text key={step}>{step}</Text>
                                ))}
                            </FixModalNumberedList>
                        </FixModalSection>
                        <FixModalSection>
                            <Text bold>{copy.option2Title}</Text>
                            <Text>{copy.option2Intro}</Text>
                            <FixModalNumberedList dataTestId={SnapcenterSnapshotFixModalTestIds.optimizationSteps}>
                                {copy.option2Steps.map(step => (
                                    <Text key={step}>{step}</Text>
                                ))}
                            </FixModalNumberedList>
                        </FixModalSection>
                    </>
                ) : (
                    <>
                        <FixModalSection>
                            <FixModalSectionTitle bold>Optimization steps</FixModalSectionTitle>
                            <FixModalNumberedList dataTestId={SnapcenterSnapshotFixModalTestIds.optimizationSteps}>
                                {copy.optimizationSteps.map(step => (
                                    <Text key={step}>{step}</Text>
                                ))}
                            </FixModalNumberedList>
                        </FixModalSection>
                        <FixModalSection>
                            <FixModalSectionTitle bold>Note</FixModalSectionTitle>
                            <BulletList>
                                {copy.notes.map(note => (
                                    <Text key={note}>{note}</Text>
                                ))}
                            </BulletList>
                        </FixModalSection>
                    </>
                )}
            </ModalContent>
            <ModalFooter>
                <ButtonsGroup>
                    <Button onClick={close} dataTestId={SnapcenterSnapshotFixModalTestIds.closeButton}>
                        Close
                    </Button>
                </ButtonsGroup>
            </ModalFooter>
        </HeightCapModal>
    );
});
