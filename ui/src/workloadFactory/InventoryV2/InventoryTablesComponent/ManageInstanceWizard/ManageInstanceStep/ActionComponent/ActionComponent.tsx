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

// Helper type for bulk instance
interface BulkInstance {
    instanceName?: string;
    hostName?: string;
    manageStates?: ManageStates;
}

// Helper functions to check instance requirements
const hasAwsRequirement = (instance: BulkInstance): boolean =>
    !!instance?.manageStates?.installMissingAWS && (instance?.manageStates?.installMissingAWSList?.length ?? 0) > 0;

const hasPowershellRequirement = (instance: BulkInstance): boolean =>
    !!instance?.manageStates?.installMissingPowershell;

const hasJqRequirement = (instance: BulkInstance): boolean => !!instance?.manageStates?.installMissingJQ;

const hasPythonRequirement = (instance: BulkInstance): boolean => !!instance?.manageStates?.installMissingPython;

const getInstanceName = (instance: BulkInstance): string => instance?.instanceName || instance?.hostName || '';

const ActionComponent = ({ manageChecks, engineType, wizardOperationType }: ActionComponentProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setState }: UseWizardReturn = useWizard();
    const installActionState = useAppSelector(state => state.inventoryV2.manageInstanceInstallAction);
    const { bulkDetectedInstanceList } = useAppSelector(state => state.inventoryV2);

    // Calculate instance counts and names for bulk operations
    const instanceCounts = useMemo(() => {
        if (wizardOperationType === ACTION_TYPE.BULK && Array.isArray(bulkDetectedInstanceList)) {
            const instances = bulkDetectedInstanceList as BulkInstance[];

            // Filter instances by requirement combinations
            const filterInstances = (
                aws: boolean | null,
                powershell: boolean | null,
                jq: boolean | null,
                python: boolean | null
            ): BulkInstance[] =>
                instances.filter(instance => {
                    const hasAws = hasAwsRequirement(instance);
                    const hasPs = hasPowershellRequirement(instance);
                    const hasJq = hasJqRequirement(instance);
                    const hasPy = hasPythonRequirement(instance);

                    return (
                        (aws === null || hasAws === aws) &&
                        (powershell === null || hasPs === powershell) &&
                        (jq === null || hasJq === jq) &&
                        (python === null || hasPy === python)
                    );
                });

            // Get count and names helper
            const getCountAndNames = (filtered: BulkInstance[]) => ({
                count: filtered.length,
                names: filtered.map(getInstanceName)
            });

            // Common filters
            const awsInstances = filterInstances(true, null, null, null);
            const powershellInstances = filterInstances(null, true, null, null);
            const jqInstances = filterInstances(null, null, true, null);
            const pythonInstances = filterInstances(null, null, null, true);

            // MSSQL combinations
            const awsAndPowershell = getCountAndNames(filterInstances(true, true, null, null));
            const awsOnlyMssql = getCountAndNames(filterInstances(true, false, null, null));
            const powershellOnly = getCountAndNames(filterInstances(false, true, null, null));

            // Oracle combinations
            const allThree = getCountAndNames(filterInstances(true, null, true, true));
            const awsAndJqOnly = getCountAndNames(filterInstances(true, null, true, false));
            const awsAndPythonOnly = getCountAndNames(filterInstances(true, null, false, true));
            const jqAndPythonOnly = getCountAndNames(filterInstances(false, null, true, true));
            const awsOnlyOracle = getCountAndNames(filterInstances(true, null, false, false));
            const jqOnly = getCountAndNames(filterInstances(false, null, true, false));
            const pythonOnly = getCountAndNames(filterInstances(false, null, false, true));

            return {
                // Common
                awsCount: awsInstances.length,
                awsInstanceNames: awsInstances.map(getInstanceName),
                // MSSQL specific
                powershellCount: powershellInstances.length,
                powershellInstanceNames: powershellInstances.map(getInstanceName),
                awsAndPowershellCount: awsAndPowershell.count,
                awsAndPowershellInstanceNames: awsAndPowershell.names,
                awsOnlyMssqlCount: awsOnlyMssql.count,
                awsOnlyMssqlInstanceNames: awsOnlyMssql.names,
                powershellOnlyCount: powershellOnly.count,
                powershellOnlyInstanceNames: powershellOnly.names,
                // Oracle specific
                jqCount: jqInstances.length,
                jqInstanceNames: jqInstances.map(getInstanceName),
                pythonCount: pythonInstances.length,
                pythonInstanceNames: pythonInstances.map(getInstanceName),
                awsOnlyOracleCount: awsOnlyOracle.count,
                awsOnlyOracleInstanceNames: awsOnlyOracle.names,
                jqOnlyCount: jqOnly.count,
                jqOnlyInstanceNames: jqOnly.names,
                pythonOnlyCount: pythonOnly.count,
                pythonOnlyInstanceNames: pythonOnly.names,
                allThreeCount: allThree.count,
                allThreeInstanceNames: allThree.names,
                awsAndJqOnlyCount: awsAndJqOnly.count,
                awsAndJqOnlyInstanceNames: awsAndJqOnly.names,
                awsAndPythonOnlyCount: awsAndPythonOnly.count,
                awsAndPythonOnlyInstanceNames: awsAndPythonOnly.names,
                jqAndPythonOnlyCount: jqAndPythonOnly.count,
                jqAndPythonOnlyInstanceNames: jqAndPythonOnly.names
            };
        }

        // For single instance mode
        const needsAws = manageChecks?.installMissingAWS ? 1 : 0;
        const needsPowershell = manageChecks?.installMissingPowershell ? 1 : 0;
        const needsJQ = manageChecks?.installMissingJQ ? 1 : 0;
        const needsPython = manageChecks?.installMissingPython ? 1 : 0;

        return {
            // Common
            awsCount: needsAws,
            awsInstanceNames: [] as string[],
            // MSSQL specific
            powershellCount: needsPowershell,
            powershellInstanceNames: [] as string[],
            awsAndPowershellCount: needsAws && needsPowershell ? 1 : 0,
            awsAndPowershellInstanceNames: [] as string[],
            awsOnlyMssqlCount: needsAws && !needsPowershell ? 1 : 0,
            awsOnlyMssqlInstanceNames: [] as string[],
            powershellOnlyCount: needsPowershell && !needsAws ? 1 : 0,
            powershellOnlyInstanceNames: [] as string[],
            // Oracle specific
            jqCount: needsJQ,
            jqInstanceNames: [] as string[],
            pythonCount: needsPython,
            pythonInstanceNames: [] as string[],
            awsOnlyOracleCount: needsAws && !needsJQ && !needsPython ? 1 : 0,
            awsOnlyOracleInstanceNames: [] as string[],
            jqOnlyCount: needsJQ && !needsAws && !needsPython ? 1 : 0,
            jqOnlyInstanceNames: [] as string[],
            pythonOnlyCount: needsPython && !needsAws && !needsJQ ? 1 : 0,
            pythonOnlyInstanceNames: [] as string[],
            allThreeCount: needsAws && needsJQ && needsPython ? 1 : 0,
            allThreeInstanceNames: [] as string[],
            awsAndJqOnlyCount: needsAws && needsJQ && !needsPython ? 1 : 0,
            awsAndJqOnlyInstanceNames: [] as string[],
            awsAndPythonOnlyCount: needsAws && !needsJQ && needsPython ? 1 : 0,
            awsAndPythonOnlyInstanceNames: [] as string[],
            jqAndPythonOnlyCount: !needsAws && needsJQ && needsPython ? 1 : 0,
            jqAndPythonOnlyInstanceNames: [] as string[]
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

    // Get engine-specific configuration for installation notes
    const installationConfig = useMemo(() => {
        if (engineType === DBType.MSSQL) {
            return {
                shouldRender: instanceCounts.awsCount > 0 || instanceCounts.powershellCount > 0,
                singlePrefix: 'databases.register-flow.single-instance-require-modules-prefix',
                singularText: 'instance requires',
                pluralText: 'instances require',
                tooltipHeader: 'databases.register-flow.instances',
                showRebootNotice: instanceCounts.powershellCount > 0,
                moduleConfigs: [
                    {
                        key: 'awsAndPowershell',
                        count: instanceCounts.awsAndPowershellCount,
                        instanceNames: instanceCounts.awsAndPowershellInstanceNames,
                        modules: ['netapp-aws-modules', 'powershell-module-7']
                    },
                    {
                        key: 'awsOnlyMssql',
                        count: instanceCounts.awsOnlyMssqlCount,
                        instanceNames: instanceCounts.awsOnlyMssqlInstanceNames,
                        modules: ['netapp-aws-modules']
                    },
                    {
                        key: 'powershellOnly',
                        count: instanceCounts.powershellOnlyCount,
                        instanceNames: instanceCounts.powershellOnlyInstanceNames,
                        modules: ['powershell-module-7']
                    }
                ]
            };
        }
        if (engineType === DBType.ORACLE) {
            return {
                shouldRender:
                    instanceCounts.awsCount > 0 || instanceCounts.jqCount > 0 || instanceCounts.pythonCount > 0,
                singlePrefix: 'databases.register-flow.single-database-require-modules-prefix',
                singularText: 'database requires',
                pluralText: 'databases require',
                tooltipHeader: 'databases.register-flow.databases',
                showRebootNotice: instanceCounts.jqCount > 0 || instanceCounts.pythonCount > 0,
                moduleConfigs: [
                    {
                        key: 'allThree',
                        count: instanceCounts.allThreeCount,
                        instanceNames: instanceCounts.allThreeInstanceNames,
                        modules: ['netapp-aws-modules', 'jq-module', 'python-module']
                    },
                    {
                        key: 'awsAndJqOnly',
                        count: instanceCounts.awsAndJqOnlyCount,
                        instanceNames: instanceCounts.awsAndJqOnlyInstanceNames,
                        modules: ['netapp-aws-modules', 'jq-module']
                    },
                    {
                        key: 'awsAndPythonOnly',
                        count: instanceCounts.awsAndPythonOnlyCount,
                        instanceNames: instanceCounts.awsAndPythonOnlyInstanceNames,
                        modules: ['netapp-aws-modules', 'python-module']
                    },
                    {
                        key: 'jqAndPythonOnly',
                        count: instanceCounts.jqAndPythonOnlyCount,
                        instanceNames: instanceCounts.jqAndPythonOnlyInstanceNames,
                        modules: ['jq-module', 'python-module']
                    },
                    {
                        key: 'awsOnlyOracle',
                        count: instanceCounts.awsOnlyOracleCount,
                        instanceNames: instanceCounts.awsOnlyOracleInstanceNames,
                        modules: ['netapp-aws-modules']
                    },
                    {
                        key: 'jqOnly',
                        count: instanceCounts.jqOnlyCount,
                        instanceNames: instanceCounts.jqOnlyInstanceNames,
                        modules: ['jq-module']
                    },
                    {
                        key: 'pythonOnly',
                        count: instanceCounts.pythonOnlyCount,
                        instanceNames: instanceCounts.pythonOnlyInstanceNames,
                        modules: ['python-module']
                    }
                ]
            };
        }
        return null;
    }, [engineType, instanceCounts]);

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

            {/* Installation notes for MSSQL and Oracle */}
            {installationConfig?.shouldRender && (
                <div className={styles.installationNotes}>
                    {installationConfig.moduleConfigs
                        .filter(config => config.count > 0)
                        .map(config => (
                            <div key={config.key} className={styles.installationRow}>
                                <DsTypography variant="Regular_14">
                                    {wizardOperationType === ACTION_TYPE.SINGLE
                                        ? t(installationConfig.singlePrefix)
                                        : t('databases.register-flow.instances-require-modules-prefix', {
                                              count: config.count,
                                              instanceText:
                                                  config.count === 1
                                                      ? installationConfig.singularText
                                                      : installationConfig.pluralText
                                          })}
                                    {config.modules.map((module, idx) => (
                                        <React.Fragment key={module}>
                                            {idx > 0 && t('databases.register-flow.and')}
                                            <span className={styles.boldText}>
                                                {t(`databases.register-flow.${module}`)}
                                            </span>
                                        </React.Fragment>
                                    ))}
                                </DsTypography>
                                {config.instanceNames.length > 0 && (
                                    <TooltipInfo placement="bottom" trigger="hover">
                                        <div className={styles.tooltipContent}>
                                            <DsTypography variant="Semibold_14">
                                                {t(installationConfig.tooltipHeader)}
                                            </DsTypography>
                                            {config.instanceNames.map(name => (
                                                <React.Fragment key={name}>
                                                    <hr className={styles.tooltipDivider} />
                                                    <DsTypography variant="Regular_14">{name}</DsTypography>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </TooltipInfo>
                                )}
                            </div>
                        ))}
                    {/* Reboot notice */}
                    {installationConfig.showRebootNotice && (
                        <DsTypography variant="Regular_14">
                            {t('databases.register-flow.module-reboot-notice')}
                        </DsTypography>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActionComponent;
