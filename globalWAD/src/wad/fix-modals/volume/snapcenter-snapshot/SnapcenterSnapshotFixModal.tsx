import { memo } from 'react';
import {
    ModalHeader,
    ModalContent,
    ModalFooter,
    ButtonsGroup,
    Button,
    Text
} from '@netapp/bxp-design-system-react';
import { FixModalNumberedList, FixModalSection, FixModalSectionTitle, HeightCapModal } from '../../shared/fixModalStyles';
import type { VolumeFixModalProps } from '../../shared/volumeFixModalComponents';

const SnapcenterSnapshotFixModalTestIds = {
    modal: 'wlmdb-snapcenter-snapshot-fix-modal',
    header: 'wlmdb-snapcenter-snapshot-fix-modal-header',
    content: 'wlmdb-snapcenter-snapshot-fix-modal-content',
    closeButton: 'wlmdb-snapcenter-snapshot-fix-close-btn',
    optimizationSteps: 'wlmdb-snapcenter-snapshot-fix-modal-optimization-steps'
} as const;

const ACTION_SUMMARY_TEXT =
    'Use SnapCenter to create application-consistent snapshots of your volumes at a specific point in time. This helps keep apps stable, protects critical data, and enables faster, more accurate restores with less downtime.';

const OPTION_1_TITLE =
    'Option 1: Configure application-consistent snapshots with NetApp Backup and Recovery';

const OPTION_1_STEPS = [
    'From the inventory, click on the actions menu for the instance and then select Protect.',
    "If prompted, enter Windows admin credentials. We'll check for Console agents. If none are installed, you'll be redirected to NetApp Console to create one.",
    "If multiple Console agents are available, choose the agent you want to use to register and protect this workload. You'll then be redirected to NetApp Console to complete the data protection setup.",
    'To prepare for data protection, Workload Factory automatically registers your database resources in Backup and Recovery, configures and installs the required plug-in, and discovers resources to meet the prerequisites for protecting your workload. Select Start to begin the process.',
    'After meeting the prerequisites, select Redirect to access Backup and Recovery.'
] as const;

const OPTION_2_TITLE =
    'Option 2: Configure application-consistent snapshots with standalone SnapCenter Server';

const OPTION_2_INTRO =
    'Schedule SnapCenter configuration changes during a maintenance window. Ensure the SnapCenter Server has network connectivity to the database host and FSx for ONTAP management interfaces. Initial backup operations may consume storage and I/O resources.';

const OPTION_2_STEPS = [
    'Install SnapCenter Server on a dedicated host.',
    'Review the list of impacted volumes that are not currently protected by SnapCenter snapshots. If you intentionally protect any of these volumes using an alternative backup method, dismiss or postpone this recommendation and record the reason for audit purposes.',
    'Verify that the SnapCenter Plug-in service is installed and running on the Windows host (Get-Service -Name "SnapCenter*").',
    'Register the database instance in SnapCenter Server and discover the database resources.',
    'Create or assign a backup policy with an appropriate schedule and retention that aligns with your recovery point objective (RPO).',
    'Assign the policy to a resource group containing the impacted databases and verify that scheduled backups complete successfully.'
] as const;

export const SnapcenterSnapshotFixModal = memo(({ recommendationName, close }: VolumeFixModalProps) => (
    <HeightCapModal dataTestId={SnapcenterSnapshotFixModalTestIds.modal}>
        <ModalHeader dataTestId={SnapcenterSnapshotFixModalTestIds.header}>{recommendationName}</ModalHeader>
        <ModalContent dataTestId={SnapcenterSnapshotFixModalTestIds.content}>
            <FixModalSection>
                <FixModalSectionTitle bold>Action summary</FixModalSectionTitle>
                <Text>{ACTION_SUMMARY_TEXT}</Text>
            </FixModalSection>
            <FixModalSection>
                <FixModalSectionTitle bold>Optimization steps</FixModalSectionTitle>
                <Text bold>{OPTION_1_TITLE}</Text>
                <FixModalNumberedList dataTestId={SnapcenterSnapshotFixModalTestIds.optimizationSteps}>
                    {OPTION_1_STEPS.map(step => (
                        <Text key={step}>{step}</Text>
                    ))}
                </FixModalNumberedList>
            </FixModalSection>
            <FixModalSection>
                <Text bold>{OPTION_2_TITLE}</Text>
                <Text>{OPTION_2_INTRO}</Text>
                <FixModalNumberedList dataTestId={SnapcenterSnapshotFixModalTestIds.optimizationSteps}>
                    {OPTION_2_STEPS.map(step => (
                        <Text key={step}>{step}</Text>
                    ))}
                </FixModalNumberedList>
            </FixModalSection>
        </ModalContent>
        <ModalFooter>
            <ButtonsGroup>
                <Button onClick={close} dataTestId={SnapcenterSnapshotFixModalTestIds.closeButton}>
                    Close
                </Button>
            </ButtonsGroup>
        </ModalFooter>
    </HeightCapModal>
));
