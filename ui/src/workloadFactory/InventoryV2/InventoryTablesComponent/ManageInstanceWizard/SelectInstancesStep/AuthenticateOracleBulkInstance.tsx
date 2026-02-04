import { Popover, PasswordField } from '@netapp/design-system';
import { DsRadioButton, DsTextField, DsTypography } from '@tlveng/wlm-ds';

import { ReactComponent as CloseIcon } from '@netapp/icons/ic_close.svg';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info_tooltip.svg';
import { useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InstancesImage } from '../../../../../assets/Instances_Img.svg';
import { ReactComponent as SingleAuth } from '../../../../../assets/SingleAuth.svg';
import { ReactComponent as Success } from '../../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../../assets/error-icon.svg';
import ManageWizardFooter from '../ManageWizardFooter';
import DotComponent from '../../../../../common/DotComponent/DotComponent';
import {
    setCredentialOption,
    setInstanceCredentials,
    removeInstanceCredentials,
    setSelectedMultiDetectInstances,
    setOracleBulkDatabaseCredentials
} from '../../../../../store/workloadFactory/inventoryV2Slice';
import { CREDENTIAL_OPTIONS, DBType } from '../../../../../utils/consts';
import { addNotification, NOTIFICATION_TYPES } from '../../../../../store/notificationSlice';
import styles from './AuthenticateBulkInstance.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import {
    getSelectedInstancesForBulk,
    areAllInstancesAuthenticated,
    hasPartialInstanceAuthSuccess,
    isInstanceAuthenticated,
    hasInstanceFailed,
    haveAllInstancesFailed,
    generateInstanceUniqueKey,
    BulkInstanceItem
} from './AuthenticateBulkUtils';

export const Content = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    // Redux state
    const credentialOption = useAppSelector(state => state.inventoryV2.credentialOption);
    const { oracleUsername, oraclePassword } = useAppSelector(state => state.inventoryV2.oracleBulkDatabaseCredentials);
    const instanceCredentials = useAppSelector(state => state.inventoryV2.instanceCredentials);
    const selectedMultiDetectInstances = useAppSelector(state => state.inventoryV2.selectedMultiDetectInstances);
    const instanceAuthStatus = useAppSelector(state => state.inventoryV2.instanceAuthStatus);
    const { selectedHostType } = useAppSelector(state => state.inventoryV2);

    // Host type for auth checks (defaults to MSSQL for bulk registration)
    const hostType = selectedHostType || DBType.MSSQL;

    // Get formatted instances from selected instances
    const instances: BulkInstanceItem[] = useMemo(
        () => getSelectedInstancesForBulk(selectedMultiDetectInstances),
        [selectedMultiDetectInstances]
    );

    // Check if all instances are authenticated (either already authenticated or wizard auth success)
    const allAuthenticated = useMemo(
        () => areAllInstancesAuthenticated(selectedMultiDetectInstances, instanceAuthStatus, hostType),
        [selectedMultiDetectInstances, instanceAuthStatus, hostType]
    );

    // Check for partial success to disable radio buttons
    const hasPartialSuccess = useMemo(
        () => hasPartialInstanceAuthSuccess(selectedMultiDetectInstances, instanceAuthStatus, hostType),
        [selectedMultiDetectInstances, instanceAuthStatus, hostType]
    );

    // Check if all authentication attempts have failed (for error display)
    const allFailed = useMemo(
        () => haveAllInstancesFailed(selectedMultiDetectInstances, instanceAuthStatus, hostType),
        [selectedMultiDetectInstances, instanceAuthStatus, hostType]
    );

    // Calculate number of authenticated instances for notification
    const authenticatedCount = useMemo(
        () =>
            instances.filter(instance => {
                const originalInstance = (selectedMultiDetectInstances as any[]).find(
                    (inst: any) =>
                        (inst.data?.databaseInstanceName || inst.databaseInstanceName) === instance.instanceId
                );
                const instanceData = originalInstance?.data || originalInstance;
                return isInstanceAuthenticated(instance.instanceId, instanceData, instanceAuthStatus, hostType);
            }).length,
        [instances, selectedMultiDetectInstances, instanceAuthStatus, hostType]
    );

    // Show notification only when there's partial authentication (not all, not none)
    const showPartialAuthNotification = authenticatedCount > 0 && authenticatedCount < instances.length;

    // Dispatch notification on first load when there's partial authentication
    useEffect(() => {
        if (showPartialAuthNotification) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: t('databases.register-flow.partial-instances-authenticated', {
                        authenticated: authenticatedCount,
                        total: instances.length
                    })
                })
            );
        }
    }, []);
    // Auto-switch to manual mode when partial success occurs
    // This allows users to fix failed instances individually
    useEffect(() => {
        if (hasPartialSuccess) {
            dispatch(setCredentialOption(CREDENTIAL_OPTIONS.MANUAL));
        }
    }, [hasPartialSuccess, dispatch]);

    // Track the previous credential option to detect switches
    const prevCredentialOptionRef = useRef(credentialOption);

    // Populate credentials for authenticated instances when switching to MANUAL mode
    // This mirrors the FSx InputCard behavior
    useEffect(() => {
        const wasUseTheSameCred = prevCredentialOptionRef.current === CREDENTIAL_OPTIONS.SAME_FOR_ALL;
        const isNowManual = credentialOption === CREDENTIAL_OPTIONS.MANUAL;

        if (wasUseTheSameCred && isNowManual) {
            // Find all authenticated instances and populate their credentials
            instances.forEach((instance: BulkInstanceItem) => {
                const originalInstance = (selectedMultiDetectInstances as any[]).find((inst: any) => {
                    const ec2Id = inst.data?.ec2InstanceId || inst.ec2InstanceId || '';
                    const dbInstanceName = inst.data?.databaseInstanceName || inst.databaseInstanceName || '';
                    return generateInstanceUniqueKey(ec2Id, dbInstanceName) === instance.uniqueKey;
                });
                const instanceData = originalInstance?.data || originalInstance;
                const authenticated = isInstanceAuthenticated(
                    instance.instanceId,
                    instanceData,
                    instanceAuthStatus,
                    hostType
                );

                if (authenticated && oracleUsername && oraclePassword) {
                    // Only populate if not already set - use uniqueKey for credentials map
                    if (!instanceCredentials[instance.uniqueKey]?.username) {
                        dispatch(
                            setInstanceCredentials({
                                instanceId: instance.uniqueKey,
                                credentials: {
                                    username: oracleUsername,
                                    password: oraclePassword
                                }
                            })
                        );
                    }
                }
            });
        }

        prevCredentialOptionRef.current = credentialOption;
    }, [
        credentialOption,
        instances,
        selectedMultiDetectInstances,
        instanceAuthStatus,
        hostType,
        oracleUsername,
        oraclePassword,
        instanceCredentials
    ]);

    // Handle updating individual instance credentials using uniqueKey (ec2InstanceId::databaseInstanceName)
    const handleInstanceUpdate = (uniqueKey: string, field: 'authMode' | 'username' | 'password', value: any) => {
        dispatch(setInstanceCredentials({ instanceId: uniqueKey, credentials: { [field]: value } }));
    };

    // Handle removing an instance from the selection using uniqueKey (ec2InstanceId::databaseInstanceName)
    // to ensure only the specific instance is removed even if multiple instances share the same name
    const handleRemoveInstance = (uniqueKey: string) => {
        dispatch(removeInstanceCredentials(uniqueKey));
        // Also update selectedMultiDetectInstances - filter by matching uniqueKey
        const updatedInstances = selectedMultiDetectInstances.filter((inst: any) => {
            const ec2Id = inst.data?.ec2InstanceId || inst.ec2InstanceId || '';
            const dbInstanceName = inst.data?.databaseInstanceName || inst.databaseInstanceName || '';
            const instUniqueKey = `${ec2Id}::${dbInstanceName}`;
            return instUniqueKey !== uniqueKey;
        });
        dispatch(setSelectedMultiDetectInstances(updatedInstances));
    };

    // Get credentials for an instance using uniqueKey (from Redux or defaults)
    const getInstanceCredentials = (uniqueKey: string) =>
        instanceCredentials[uniqueKey] || {
            username: '',
            password: ''
        };

    // Render authenticated screen when all instances are authenticated
    if (allAuthenticated && instances.length > 0) {
        const authenticatedTooltipContent = (
            <div className={CommonStyles.tooltipContent}>
                {instances.map((instance, index) => (
                    <div
                        key={instance.instanceId}
                        className={`${CommonStyles.tooltipRow} ${
                            index !== instances.length - 1 ? CommonStyles.tooltipRowWithBorder : ''
                        }`}
                    >
                        <DsTypography variant="Semibold_14">{instance.instanceName}</DsTypography>
                    </div>
                ))}
            </div>
        );

        return (
            <div className={styles.authenticateBulkInstance}>
                <div className={styles.authenticatedScreen}>
                    <SingleAuth />
                    <div className={styles.authenticatedTextContainer}>
                        <DsTypography variant="Semibold_14">
                            {t('databases.register-flow.instances-authenticated')}
                        </DsTypography>
                        <div className={styles.instancesInfo}>
                            <Popover
                                popoverClass={CommonStyles.scrollablePopover}
                                trigger="hover"
                                placement="bottom"
                                delayHide={200}
                                interactive
                                isAppendedToBody
                                container={<InfoIcon className={CommonStyles.infoIcon} />}
                            >
                                {authenticatedTooltipContent}
                            </Popover>
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.all-instances-count', { count: instances.length })}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authenticateBulkInstance}>
            {/* Authentication Type Section - Header Card */}
            <div className={styles.authenticationTypeSection}>
                <div className={styles.instanceIcon}>
                    <InstancesImage />
                </div>

                <div className={styles.credentialsSection}>
                    <DsTypography variant="Semibold_14" className={styles.sectionTitle}>
                        {t('databases.register-flow.instances-credentials')}
                    </DsTypography>
                    <div className={styles.radioGroup}>
                        <DsRadioButton
                            id="same-credentials"
                            variant="Default"
                            title={t('databases.register-flow.use-same-credentials-for-all-instances')}
                            isSelected={credentialOption === CREDENTIAL_OPTIONS.SAME_FOR_ALL}
                            onClick={() => dispatch(setCredentialOption(CREDENTIAL_OPTIONS.SAME_FOR_ALL))}
                            isDisabled={hasPartialSuccess}
                        />
                        <DsRadioButton
                            id="manual-credentials"
                            variant="Default"
                            title={t('databases.register-flow.manage-instances-credentials-manually')}
                            isSelected={credentialOption === CREDENTIAL_OPTIONS.MANUAL}
                            onClick={() => dispatch(setCredentialOption(CREDENTIAL_OPTIONS.MANUAL))}
                            isDisabled={hasPartialSuccess}
                        />
                    </div>
                </div>
            </div>

            {/* Form Section - Same credentials for all */}
            {credentialOption === CREDENTIAL_OPTIONS.SAME_FOR_ALL && (
                <div className={styles.formSection}>
                    <div className={styles.formHeader}>
                        <DsTypography variant="Semibold_14" className={styles.formTitle}>
                            {t('databases.register-flow.all-selected-instances')} ({instances.length})
                        </DsTypography>
                        <Popover
                            popoverClass={CommonStyles.scrollablePopover}
                            trigger="hover"
                            placement="bottom"
                            delayHide={200}
                            interactive
                            isAppendedToBody
                            container={<InfoIcon className={CommonStyles.infoIcon} />}
                        >
                            <div className={CommonStyles.tooltipContent}>
                                {instances.map((instance, index) => {
                                    const originalInstance = (selectedMultiDetectInstances as any[]).find(
                                        (inst: any) =>
                                            (inst.data?.databaseInstanceName || inst.databaseInstanceName) ===
                                            instance.instanceId
                                    );
                                    const instanceData = originalInstance?.data || originalInstance;
                                    const authenticated = isInstanceAuthenticated(
                                        instance.instanceId,
                                        instanceData,
                                        instanceAuthStatus,
                                        hostType
                                    );
                                    return (
                                        <div
                                            key={instance.instanceId}
                                            className={`${CommonStyles.tooltipRow} ${
                                                index !== instances.length - 1 ? CommonStyles.tooltipRowWithBorder : ''
                                            }`}
                                        >
                                            <div className={styles.instanceStatusRow}>
                                                <DsTypography variant="Semibold_13">
                                                    {instance.instanceName}
                                                </DsTypography>
                                                <DotComponent
                                                    color={authenticated ? 'var(--success)' : 'var(--toggle-off-bg)'}
                                                    value={
                                                        authenticated
                                                            ? t('databases.register-flow.authenticated')
                                                            : t('databases.register-flow.not-authenticated')
                                                    }
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Popover>
                    </div>

                    <div className={styles.formContainer}>
                        <div className={styles.oracleFormFields}>
                            <DsTextField
                                title={t('databases.register-flow.detect-oracle-username')}
                                value={oracleUsername}
                                onChange={(event?: React.ChangeEvent<HTMLInputElement>) =>
                                    dispatch(
                                        setOracleBulkDatabaseCredentials({ oracleUsername: event?.target?.value || '' })
                                    )
                                }
                                placeholder={`${t('databases.general.enter')} ${t(
                                    'databases.register-flow.detect-oracle-username'
                                )}`}
                                className={styles.textField}
                                {...(allFailed
                                    ? {
                                          message: {
                                              type: 'error',
                                              value: t('databases.register-flow.authentication-failed') || ''
                                          }
                                      }
                                    : {})}
                            />

                            <PasswordField
                                label={t('databases.register-flow.detect-oracle-password')}
                                value={oraclePassword}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    dispatch(setOracleBulkDatabaseCredentials({ oraclePassword: e.target.value }))
                                }
                                placeholder={t('databases.general.enter-password')}
                                className={styles.passwordField}
                                error={allFailed ? t('databases.register-flow.authentication-failed') : ''}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Credentials Section */}
            {credentialOption === CREDENTIAL_OPTIONS.MANUAL && (
                <div className={styles.manualCredentialsSection}>
                    {instances.map((instance, index) => {
                        const creds = getInstanceCredentials(instance.uniqueKey);
                        // Find the original instance data to check authentication status properly
                        const originalInstance = (selectedMultiDetectInstances as any[]).find((inst: any) => {
                            const ec2Id = inst.data?.ec2InstanceId || inst.ec2InstanceId || '';
                            const dbInstanceName = inst.data?.databaseInstanceName || inst.databaseInstanceName || '';
                            return `${ec2Id}::${dbInstanceName}` === instance.uniqueKey;
                        });
                        const instanceData = originalInstance?.data || originalInstance;
                        const authenticated = isInstanceAuthenticated(
                            instance.instanceId,
                            instanceData,
                            instanceAuthStatus,
                            hostType
                        );
                        const failed = hasInstanceFailed(instance.instanceId, instanceAuthStatus);

                        return (
                            <div
                                key={instance.instanceId}
                                className={styles.instanceRow}
                                style={{ borderTop: index > 0 ? '2px solid #e0e0e0' : 'none' }}
                            >
                                <div className={styles.instanceInfo}>
                                    <div className={styles.instanceHeader}>
                                        <DsTypography variant="Semibold_14" className={styles.instanceName}>
                                            {instance.instanceName}
                                        </DsTypography>
                                    </div>
                                </div>

                                <div className={styles.instanceFields}>
                                    <DsTextField
                                        title={t('databases.register-flow.detect-oracle-username')}
                                        value={creds.username}
                                        onChange={(event?: React.ChangeEvent<HTMLInputElement>) =>
                                            handleInstanceUpdate(
                                                instance.uniqueKey,
                                                'username',
                                                event?.target?.value || ''
                                            )
                                        }
                                        placeholder={`${t('databases.general.enter')} ${t(
                                            'databases.register-flow.detect-oracle-username'
                                        )}`}
                                        className={styles.oracleInstanceTextField}
                                        isDisabled={authenticated}
                                        {...(failed
                                            ? {
                                                  message: {
                                                      type: 'error',
                                                      value: t('databases.register-flow.authentication-failed') || ''
                                                  }
                                              }
                                            : {})}
                                    />

                                    <PasswordField
                                        label={t('databases.register-flow.detect-oracle-password')}
                                        value={creds.password}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            handleInstanceUpdate(instance.uniqueKey, 'password', e.target.value)
                                        }
                                        placeholder={t('databases.general.enter-password')}
                                        className={styles.oracleInstancePasswordField}
                                        isDisabled={authenticated}
                                        error={failed ? t('databases.register-flow.authentication-failed') : ''}
                                    />

                                    {/* Reserve space for close button */}
                                    <div className={styles.closeButtonContainer}>
                                        {!authenticated && (
                                            <button
                                                className={styles.closeButton}
                                                onClick={() => handleRemoveInstance(instance.uniqueKey)}
                                                aria-label={t('databases.register-flow.remove-instance')}
                                            >
                                                <CloseIcon />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Reserve space for auth status */}
                                <div className={styles.authStatusRight}>
                                    {authenticated && (
                                        <>
                                            <Success className={styles.successIcon} />
                                            <DsTypography variant="Regular_13">
                                                {t('databases.register-flow.authenticated')}
                                            </DsTypography>
                                        </>
                                    )}
                                    {failed && (
                                        <>
                                            <Failure className={styles.failedIcon} />
                                            <DsTypography variant="Regular_13">
                                                {t('databases.register-flow.authentication-failed')}
                                            </DsTypography>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const Footer = () => <ManageWizardFooter />;
