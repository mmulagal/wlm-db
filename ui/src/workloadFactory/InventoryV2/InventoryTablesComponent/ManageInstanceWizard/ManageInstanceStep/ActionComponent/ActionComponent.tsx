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
};

const ActionComponent = ({ manageChecks, engineType }: ActionComponentProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { state, setState }: UseWizardReturn = useWizard();
    const installActionState = useAppSelector(state => state.inventoryV2.manageInstanceInstallAction);
    const { wizardOperationType, bulkDetectedInstanceList } = useAppSelector(state => state.inventoryV2);

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

            return {
                awsCount: awsInstances.length,
                awsInstanceNames: awsInstances.map((i: any) => i?.instanceName || i?.hostName),
                powershellCount: powershellInstances.length,
                powershellInstanceNames: powershellInstances.map((i: any) => i?.instanceName || i?.hostName)
            };
        }
        // For single instance mode
        return {
            awsCount: manageChecks?.installMissingAWS ? 1 : 0,
            awsInstanceNames: [] as string[],
            powershellCount: manageChecks?.installMissingPowershell ? 1 : 0,
            powershellInstanceNames: [] as string[]
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
                    {instanceCounts.awsCount > 0 && (
                        <div className={styles.installationRow}>
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.instances-require-netapp-modules', {
                                    count: instanceCounts.awsCount,
                                    instanceText:
                                        instanceCounts.awsCount === 1 ? 'instance requires' : 'instances require'
                                })}
                            </DsTypography>
                            {instanceCounts.awsInstanceNames.length > 0 && (
                                <TooltipInfo placement="bottom" trigger="hover">
                                    <div className={styles.tooltipContent}>
                                        <DsTypography variant="Semibold_14">
                                            {t('databases.register-flow.instances')}
                                        </DsTypography>
                                        {instanceCounts.awsInstanceNames.map(name => (
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
                    {instanceCounts.powershellCount > 0 && (
                        <>
                            <div className={styles.installationRow}>
                                <DsTypography variant="Regular_14">
                                    {t('databases.register-flow.instances-require-powershell7', {
                                        count: instanceCounts.powershellCount,
                                        instanceText:
                                            instanceCounts.powershellCount === 1
                                                ? 'instance requires'
                                                : 'instances require'
                                    })}
                                </DsTypography>
                                {instanceCounts.powershellInstanceNames.length > 0 && (
                                    <TooltipInfo placement="bottom" trigger="hover">
                                        <div className={styles.tooltipContent}>
                                            <DsTypography variant="Semibold_14">
                                                {t('databases.register-flow.instances')}
                                            </DsTypography>
                                            {instanceCounts.powershellInstanceNames.map(name => (
                                                <React.Fragment key={name}>
                                                    <hr className={styles.tooltipDivider} />
                                                    <DsTypography variant="Regular_14">{name}</DsTypography>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </TooltipInfo>
                                )}
                            </div>
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.powershell7-reboot-notice')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.powershell7-authorization-notice')}
                            </DsTypography>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActionComponent;
