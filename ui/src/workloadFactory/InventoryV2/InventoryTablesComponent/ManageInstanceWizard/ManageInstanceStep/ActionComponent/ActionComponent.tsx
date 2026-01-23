import { DsCheckbox, DsTypography, useWizard, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import React, { useEffect, useMemo } from 'react';
import styles from './ActionComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { setInstallType } from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { ManageStates, UseWizardReturn } from '../../../../../../utils/types/registerTypes';
import { CHECK_LABELS, ENGINE_TYPE_CHECKS } from '../ManageInstanceStepHelper';
import { ACTION_TYPE, DBType } from '../../../../../../utils/consts';

type ActionComponentProps = {
    manageChecks: Partial<ManageStates>;
    engineType: string;
    wizardOperationType: string;
};

const ActionComponent = ({ manageChecks, engineType, wizardOperationType }: ActionComponentProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { state, setState }: UseWizardReturn = useWizard();
    const installActionState = useAppSelector(state => state.inventoryV2.manageInstanceInstallAction);
    const { bulkDetectedInstanceList } = useAppSelector(state => state.inventoryV2);

    // Calculate instance counts and names for bulk operations
    const instanceCounts = useMemo(() => {
        if (wizardOperationType === ACTION_TYPE.BULK && Array.isArray(bulkDetectedInstanceList)) {
            const awsInstances = bulkDetectedInstanceList.filter(
                (instance: any) =>
                    instance?.manageStates?.installMissingAWS &&
                    (instance?.manageStates?.installMissingAWSList?.length ?? 0) > 0
            );

            const powershellInstances = bulkDetectedInstanceList.filter(
                (instance: any) => instance?.manageStates?.installMissingPowershell
            );

            // Instances that need both AWS modules and PowerShell 7
            const bothInstances = bulkDetectedInstanceList.filter(
                (instance: any) =>
                    instance?.manageStates?.installMissingAWS &&
                    (instance?.manageStates?.installMissingAWSList?.length ?? 0) > 0 &&
                    instance?.manageStates?.installMissingPowershell
            );

            // Instances that need only AWS modules (not PowerShell 7)
            const awsOnlyInstances = awsInstances.filter(
                (instance: any) => !instance?.manageStates?.installMissingPowershell
            );

            // Instances that need only PowerShell 7 (not AWS modules)
            const powershellOnlyInstances = powershellInstances.filter(
                (instance: any) =>
                    !instance?.manageStates?.installMissingAWS ||
                    (instance?.manageStates?.installMissingAWSList?.length ?? 0) === 0
            );

            return {
                awsCount: awsInstances.length,
                awsInstanceNames: awsInstances.map((i: any) => i?.instanceName || i?.hostName),
                powershellCount: powershellInstances.length,
                powershellInstanceNames: powershellInstances.map((i: any) => i?.instanceName || i?.hostName),
                bothCount: bothInstances.length,
                bothInstanceNames: bothInstances.map((i: any) => i?.instanceName || i?.hostName),
                awsOnlyCount: awsOnlyInstances.length,
                awsOnlyInstanceNames: awsOnlyInstances.map((i: any) => i?.instanceName || i?.hostName),
                powershellOnlyCount: powershellOnlyInstances.length,
                powershellOnlyInstanceNames: powershellOnlyInstances.map((i: any) => i?.instanceName || i?.hostName)
            };
        }
        // For single instance mode
        const needsAws = manageChecks?.installMissingAWS ? 1 : 0;
        const needsPowershell = manageChecks?.installMissingPowershell ? 1 : 0;
        const needsBoth = needsAws && needsPowershell ? 1 : 0;
        return {
            awsCount: needsAws,
            awsInstanceNames: [] as string[],
            powershellCount: needsPowershell,
            powershellInstanceNames: [] as string[],
            bothCount: needsBoth,
            bothInstanceNames: [] as string[],
            awsOnlyCount: needsAws && !needsPowershell ? 1 : 0,
            awsOnlyInstanceNames: [] as string[],
            powershellOnlyCount: needsPowershell && !needsAws ? 1 : 0,
            powershellOnlyInstanceNames: [] as string[]
        };
    }, [wizardOperationType, bulkDetectedInstanceList, manageChecks]);

    useEffect(() => {
        // Set all install types found in manageChecks for this engine type
        const installTypes: Record<string, any> = {};
        (ENGINE_TYPE_CHECKS[engineType] || []).forEach(key => {
            installTypes[key] = manageChecks?.[key as keyof ManageStates];
        });
        dispatch(setInstallType(installTypes));
    }, [wizardOperationType, manageChecks, engineType]);

    const checksToRender = ENGINE_TYPE_CHECKS[engineType] || [];

    return (
        <div className={styles.actionComponent}>
            <DsTypography variant="Semibold_16">{t('databases.general.action-required')}</DsTypography>
            <div className={styles.selectContainer}>
                {checksToRender.map(key =>
                    manageChecks?.[key as keyof ManageStates] ? (
                        <DsCheckbox
                            key={key}
                            id={`wlm-db-${key}`}
                            title={t(CHECK_LABELS[key]?.[engineType] || key)}
                            onSelect={() => {
                                dispatch(setInstallType({ [key]: !installActionState[key] }));
                                setState({ [key]: !installActionState[key] });
                            }}
                            isSelected={!!installActionState[key]}
                            isDisabled={!manageChecks?.[key as keyof ManageStates]}
                            className={styles.checkboxContainer}
                        />
                    ) : null
                )}
            </div>

            {/* MSSQL-specific installation notes */}
            {engineType === DBType.MSSQL && (instanceCounts.awsCount > 0 || instanceCounts.powershellCount > 0) && (
                <div className={styles.installationNotes}>
                    {/* Combined message when both AWS modules and PowerShell 7 are needed */}
                    {instanceCounts.bothCount > 0 && (
                        <div className={styles.installationRow}>
                            <DsTypography variant="Regular_14">
                                {wizardOperationType === ACTION_TYPE.SINGLE
                                    ? t('databases.register-flow.single-instance-require-modules-prefix')
                                    : t('databases.register-flow.instances-require-modules-prefix', {
                                          count: instanceCounts.bothCount,
                                          instanceText:
                                              instanceCounts.bothCount === 1 ? 'instance requires' : 'instances require'
                                      })}
                                <span className={styles.boldText}>
                                    {t('databases.register-flow.netapp-powershell-modules')}
                                </span>
                                {t('databases.register-flow.and')}
                                <span className={styles.boldText}>
                                    {t('databases.register-flow.powershell-module-7')}
                                </span>
                            </DsTypography>
                            {instanceCounts.bothInstanceNames.length > 0 && (
                                <TooltipInfo placement="bottom" trigger="hover">
                                    <div className={styles.tooltipContent}>
                                        <DsTypography variant="Semibold_14">
                                            {t('databases.register-flow.instances')}
                                        </DsTypography>
                                        {instanceCounts.bothInstanceNames.map(name => (
                                            <React.Fragment key={name}>
                                                <hr className={styles.tooltipDivider} />
                                                <DsTypography variant="Regular_14">{name}</DsTypography>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </TooltipInfo>
                            )}
                        </div>
                    )}
                    {/* AWS modules only (when PowerShell 7 is not needed) */}
                    {instanceCounts.awsOnlyCount > 0 && (
                        <div className={styles.installationRow}>
                            <DsTypography variant="Regular_14">
                                {wizardOperationType === ACTION_TYPE.SINGLE
                                    ? t('databases.register-flow.single-instance-require-modules-prefix')
                                    : t('databases.register-flow.instances-require-modules-prefix', {
                                          count: instanceCounts.awsOnlyCount,
                                          instanceText:
                                              instanceCounts.awsOnlyCount === 1
                                                  ? 'instance requires'
                                                  : 'instances require'
                                      })}
                                <span className={styles.boldText}>
                                    {t('databases.register-flow.netapp-powershell-modules')}
                                </span>
                            </DsTypography>
                            {instanceCounts.awsOnlyInstanceNames.length > 0 && (
                                <TooltipInfo placement="bottom" trigger="hover">
                                    <div className={styles.tooltipContent}>
                                        <DsTypography variant="Semibold_14">
                                            {t('databases.register-flow.instances')}
                                        </DsTypography>
                                        {instanceCounts.awsOnlyInstanceNames.map(name => (
                                            <React.Fragment key={name}>
                                                <hr className={styles.tooltipDivider} />
                                                <DsTypography variant="Regular_14">{name}</DsTypography>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </TooltipInfo>
                            )}
                        </div>
                    )}
                    {/* PowerShell 7 only (when AWS modules are not needed) */}
                    {instanceCounts.powershellOnlyCount > 0 && (
                        <div className={styles.installationRow}>
                            <DsTypography variant="Regular_14">
                                {wizardOperationType === ACTION_TYPE.SINGLE
                                    ? t('databases.register-flow.single-instance-require-modules-prefix')
                                    : t('databases.register-flow.instances-require-modules-prefix', {
                                          count: instanceCounts.powershellOnlyCount,
                                          instanceText:
                                              instanceCounts.powershellOnlyCount === 1
                                                  ? 'instance requires'
                                                  : 'instances require'
                                      })}
                                <span className={styles.boldText}>
                                    {t('databases.register-flow.powershell-module-7')}
                                </span>
                            </DsTypography>
                            {instanceCounts.powershellOnlyInstanceNames.length > 0 && (
                                <TooltipInfo placement="bottom" trigger="hover">
                                    <div className={styles.tooltipContent}>
                                        <DsTypography variant="Semibold_14">
                                            {t('databases.register-flow.instances')}
                                        </DsTypography>
                                        {instanceCounts.powershellOnlyInstanceNames.map(name => (
                                            <React.Fragment key={name}>
                                                <hr className={styles.tooltipDivider} />
                                                <DsTypography variant="Regular_14">{name}</DsTypography>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </TooltipInfo>
                            )}
                        </div>
                    )}
                    {/* PowerShell reboot and authorization notices (shown when any instance needs PowerShell 7) */}
                    {instanceCounts.powershellCount > 0 && (
                        <DsTypography variant="Regular_14">
                            {t('databases.register-flow.powershell7-reboot-notice-prefix')}
                            <span className={styles.boldText}>{t('databases.register-flow.powershell-module-7')}</span>
                            {t('databases.register-flow.powershell7-reboot-notice-suffix')}
                        </DsTypography>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActionComponent;
