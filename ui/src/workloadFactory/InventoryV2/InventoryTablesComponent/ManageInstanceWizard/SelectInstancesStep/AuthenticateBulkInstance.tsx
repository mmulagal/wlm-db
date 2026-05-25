import { Popover, PasswordField, useDialog, DsTypography as NdsTypography } from '@netapp/design-system';
import { DsRadioButton, DsTextField, DsTypography } from '@tlveng/wlm-ds';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { ReactComponent as CloseIcon } from '@netapp/icons/ic_close.svg';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info_tooltip.svg';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { ReactComponent as InstancesImage } from '../../../../../assets/Instances_Img.svg';
import { ReactComponent as SingleAuth } from '../../../../../assets/SingleAuth.svg';
import { ReactComponent as Success } from '../../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../../assets/error-icon.svg';
import ManageWizardFooter from '../ManageWizardFooter';
import DialogComponent from '../../../../../common/Dialog/DialogComponent';
import DotComponent from '../../../../../common/DotComponent/DotComponent';
import {
    setCredentialOption,
    setBulkInstanceCredentials,
    setInstanceCredentials,
    removeInstanceCredentials,
    setSelectedMultiDetectInstances
} from '../../../../../store/workloadFactory/inventoryV2Slice';
import { AUTHENTICATION_TYPE, CREDENTIAL_OPTIONS, DBType } from '../../../../../utils/consts';
import SsmParameterArnField from '../../../../../common/SsmParameterArnField/SsmParameterArnField';
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

/**
 * Get field labels based on authentication mode
 * Mirrors the logic in DetectContent.tsx for consistency
 */
const getAuthFieldLabels = (authModeValue: string, t: (key: string) => string) => {
    if (authModeValue === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION) {
        return {
            usernameLabel: t('databases.register-flow.detect-windows-username'),
            passwordLabel: t('databases.register-flow.detect-windows-password')
        };
    }
    // Default to SQL Server Authentication labels
    return {
        usernameLabel: t('databases.register-flow.detect-mssql-username'),
        passwordLabel: t('databases.register-flow.detect-mssql-password')
    };
};

/**
 * Dialog content component for auth mode change confirmation
 */
interface AuthModeChangeDialogContentProps {
    confirmationText: string;
    noOptionText: string;
    yesOptionText: string;
    onSelectionChange: (applyToAll: boolean) => void;
}

const AuthModeChangeDialogContent = ({
    confirmationText,
    noOptionText,
    yesOptionText,
    onSelectionChange
}: AuthModeChangeDialogContentProps) => {
    const [applyToAll, setApplyToAll] = useState(false);

    const handleSelection = (value: boolean) => {
        setApplyToAll(value);
        onSelectionChange(value);
    };

    return (
        <div className={styles.authModeDialogContent}>
            <DsTypography variant="Regular_14">{confirmationText}</DsTypography>
            <div className={styles.authModeDialogOptions}>
                <DsRadioButton
                    id="auth-mode-no-option"
                    variant="Default"
                    title={noOptionText}
                    isSelected={!applyToAll}
                    onClick={() => handleSelection(false)}
                />
                <DsRadioButton
                    id="auth-mode-yes-option"
                    variant="Default"
                    title={yesOptionText}
                    isSelected={applyToAll}
                    onClick={() => handleSelection(true)}
                />
            </div>
        </div>
    );
};

export const Content = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();

    // Local state to track if auth mode change dialog has been shown
    const [hasShownAuthModeChangeDialog, setHasShownAuthModeChangeDialog] = useState(false);

    // Ref to track the dialog selection
    const applyToAllInstancesRef = useRef(false);

    // Redux state
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const credentialOption = useAppSelector(state => state.inventoryV2.credentialOption);
    const { authMode, username, password, ssmParameterArn } = useAppSelector(
        state => state.inventoryV2.bulkInstanceCredentials
    );
    const instanceCredentials = useAppSelector(state => state.inventoryV2.instanceCredentials);
    const selectedMultiDetectInstances = useAppSelector(state => state.inventoryV2.selectedMultiDetectInstances);
    const instanceAuthStatus = useAppSelector(state => state.inventoryV2.instanceAuthStatus);
    const instanceAuthErrors = useAppSelector(state => state.inventoryV2.instanceAuthErrors);
    const { selectedHostType } = useAppSelector(state => state.inventoryV2);

    // Get loading state from msSqlAction slice to disable inputs during API calls
    const isDetectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);

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

    // Check if all auth errors are identical (used to decide staying in "same for all" vs switching to manual)
    const allErrorsSame = useMemo(() => {
        const errors = Object.values(instanceAuthErrors || {});
        if (errors.length === 0) return true;
        return errors.every(e => e === errors[0]);
    }, [instanceAuthErrors]);

    // Calculate number of authenticated instances for notification
    const authenticatedCount = useMemo(
        () =>
            instances.filter(instance => {
                const originalInstance = (selectedMultiDetectInstances as any[]).find((inst: any) => {
                    const ec2Id = inst.data?.ec2InstanceId || inst.ec2InstanceId || '';
                    const dbInstanceName = inst.data?.databaseInstanceName || inst.databaseInstanceName || '';
                    return generateInstanceUniqueKey(ec2Id, dbInstanceName) === instance.uniqueKey;
                });
                const instanceData = originalInstance?.data || originalInstance;
                return isInstanceAuthenticated(instance.uniqueKey, instanceData, instanceAuthStatus, hostType);
            }).length,
        [instances, selectedMultiDetectInstances, instanceAuthStatus, hostType]
    );

    // Show notification only when there's partial authentication
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
    }, [hasPartialSuccess]);

    // Auto-switch to manual mode when all fail with different errors
    // so each instance shows its own specific error message
    useEffect(() => {
        if (allFailed && !allErrorsSame) {
            dispatch(setCredentialOption(CREDENTIAL_OPTIONS.MANUAL));
        }
    }, [allFailed, allErrorsSame]);

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
                    instance.uniqueKey,
                    instanceData,
                    instanceAuthStatus,
                    hostType
                );

                if (authenticated && username && password) {
                    // Only populate if not already set - use uniqueKey for credentials map
                    if (!instanceCredentials[instance.uniqueKey]?.username) {
                        dispatch(
                            setInstanceCredentials({
                                instanceId: instance.uniqueKey,
                                credentials: {
                                    authMode,
                                    username,
                                    password
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
        authMode,
        username,
        password,
        instanceCredentials,
        dispatch
    ]);

    const authModeOptions: optionType[] = [
        {
            label: t('databases.register-flow.sql-server-authentication'),
            value: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
        },
        {
            label: t('databases.register-flow.windows-authentication'),
            value: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
        }
    ];

    // Show confirmation dialog for applying auth mode to all instances
    const showAuthModeChangeDialog = (uniqueKey: string, newAuthMode: any) => {
        applyToAllInstancesRef.current = false;

        const handleSave = () => {
            if (applyToAllInstancesRef.current) {
                // Apply auth mode to all instances
                instances.forEach(instance => {
                    dispatch(
                        setInstanceCredentials({
                            instanceId: instance.uniqueKey,
                            credentials: { authMode: newAuthMode }
                        })
                    );
                });
            } else {
                // Only apply to the current instance
                dispatch(setInstanceCredentials({ instanceId: uniqueKey, credentials: { authMode: newAuthMode } }));
            }
            setHasShownAuthModeChangeDialog(true);
            closeDialog();
        };

        setDialog(
            <DialogComponent
                header={t('databases.register-flow.change-auth-mode-header')}
                content={
                    <AuthModeChangeDialogContent
                        confirmationText={t('databases.register-flow.change-auth-mode-confirmation')}
                        noOptionText={t('databases.register-flow.change-auth-mode-no-option')}
                        yesOptionText={t('databases.register-flow.change-auth-mode-yes-option')}
                        onSelectionChange={(applyToAll: boolean) => {
                            applyToAllInstancesRef.current = applyToAll;
                        }}
                    />
                }
                primaryButton={t('databases.general.save')}
                secondaryButton={t('databases.general.close')}
                callback={handleSave}
                closeCallback={() => {
                    closeDialog();
                }}
            />
        );
    };

    // Handle updating individual instance credentials using uniqueKey to handle duplicate names
    const handleInstanceUpdate = (
        uniqueKey: string,
        field: 'authMode' | 'username' | 'password' | 'ssmParameterArn',
        value: any
    ) => {
        // For auth mode changes on the first time, show confirmation dialog
        if (field === 'authMode' && !hasShownAuthModeChangeDialog && instances.length > 1) {
            showAuthModeChangeDialog(uniqueKey, value);
            return;
        }
        dispatch(setInstanceCredentials({ instanceId: uniqueKey, credentials: { [field]: value } }));
    };

    // Handle removing an instance from the selection using unique key (ec2InstanceId + instanceName)
    // to ensure only the specific instance is removed even if multiple instances share the same name
    const handleRemoveInstance = (uniqueKey: string) => {
        dispatch(removeInstanceCredentials(uniqueKey));
        // Filter using unique key (ec2InstanceId::databaseInstanceName) to handle duplicate names
        const updatedInstances = selectedMultiDetectInstances.filter((inst: any) => {
            const ec2Id = inst.data?.ec2InstanceId || inst.ec2InstanceId || '';
            const dbInstanceName = inst.data?.databaseInstanceName || inst.databaseInstanceName || '';
            const instUniqueKey = generateInstanceUniqueKey(ec2Id, dbInstanceName);
            return instUniqueKey !== uniqueKey;
        });
        dispatch(setSelectedMultiDetectInstances(updatedInstances));
    };

    // Get credentials for an instance using uniqueKey (from Redux or defaults)
    const getInstanceCredentials = (uniqueKey: string) =>
        instanceCredentials[uniqueKey] || {
            authMode: {
                label: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
                value: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
            },
            username: '',
            password: ''
        };

    // Render authenticated screen when all instances are authenticated
    if (allAuthenticated && instances.length > 0) {
        const authenticatedTooltipContent = (
            <div className={CommonStyles.tooltipContent}>
                {instances.map((instance, index) => (
                    <div
                        key={instance.uniqueKey}
                        className={`${CommonStyles.tooltipRow} ${
                            index !== instances.length - 1 ? CommonStyles.tooltipRowWithBorder : ''
                        }`}
                    >
                        <DsTypography variant="Semibold_14">{instance.instanceName}</DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.general.host')}
                            {': '}
                            {instance.hostName}
                        </DsTypography>
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
        <div className={classNames(styles.authenticateBulkInstance, { [styles.disabled]: isDetectHostLoading })}>
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
                            isDisabled={hasPartialSuccess || isDetectHostLoading}
                        />
                        <DsRadioButton
                            id="manual-credentials"
                            variant="Default"
                            title={t('databases.register-flow.manage-instances-credentials-manually')}
                            isSelected={credentialOption === CREDENTIAL_OPTIONS.MANUAL}
                            onClick={() => dispatch(setCredentialOption(CREDENTIAL_OPTIONS.MANUAL))}
                            isDisabled={hasPartialSuccess || isDetectHostLoading}
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
                                        (inst: any) => {
                                            const ec2Id = inst.data?.ec2InstanceId || inst.ec2InstanceId || '';
                                            const dbInstanceName =
                                                inst.data?.databaseInstanceName || inst.databaseInstanceName || '';
                                            return (
                                                generateInstanceUniqueKey(ec2Id, dbInstanceName) === instance.uniqueKey
                                            );
                                        }
                                    );
                                    const instanceData = originalInstance?.data || originalInstance;
                                    const authenticated = isInstanceAuthenticated(
                                        instance.uniqueKey,
                                        instanceData,
                                        instanceAuthStatus,
                                        hostType
                                    );
                                    return (
                                        <div
                                            key={instance.uniqueKey}
                                            className={`${CommonStyles.tooltipRow} ${
                                                index !== instances.length - 1 ? CommonStyles.tooltipRowWithBorder : ''
                                            }`}
                                        >
                                            <div className={styles.instanceStatusRow}>
                                                <DsTypography variant="Semibold_13">
                                                    {instance.instanceName}
                                                </DsTypography>
                                                <DsTypography variant="Regular_13">
                                                    {t('databases.general.host')}
                                                    {': '}
                                                    {instance.hostName}
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

                    <div className={styles.formFields}>
                        {isGovAccount ? (
                            <SsmParameterArnField
                                value={ssmParameterArn}
                                onChange={value => dispatch(setBulkInstanceCredentials({ ssmParameterArn: value }))}
                                className={styles.textField}
                                isDisabled={isDetectHostLoading}
                            />
                        ) : (
                            <>
                                <SelectField
                                    label={t('databases.register-flow.select-authentication-mode')}
                                    value={authMode}
                                    onChange={(selectedOption: any) =>
                                        dispatch(setBulkInstanceCredentials({ authMode: selectedOption }))
                                    }
                                    options={authModeOptions}
                                    isClearable={false}
                                    isSearchable={false}
                                    className={`${styles.selectField} ${allFailed ? styles.errorBorder : ''}`}
                                    isDisabled={isDetectHostLoading}
                                />

                                <DsTextField
                                    title={getAuthFieldLabels(authMode?.value, t).usernameLabel}
                                    value={username}
                                    onChange={(event?: React.ChangeEvent<HTMLInputElement>) =>
                                        dispatch(setBulkInstanceCredentials({ username: event?.target?.value || '' }))
                                    }
                                    placeholder={`${t('databases.general.enter')} ${
                                        getAuthFieldLabels(authMode?.value, t).usernameLabel
                                    }`}
                                    className={styles.textField}
                                    isDisabled={isDetectHostLoading}
                                    {...(allFailed && allErrorsSame
                                        ? {
                                              message: {
                                                  type: 'error',
                                                  value:
                                                      (Object.values(instanceAuthErrors || {})[0] as string) ||
                                                      t('databases.register-flow.authentication-failed') ||
                                                      ''
                                              }
                                          }
                                        : {})}
                                />

                                <PasswordField
                                    label={getAuthFieldLabels(authMode?.value, t).passwordLabel}
                                    value={password}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        dispatch(setBulkInstanceCredentials({ password: e.target.value }))
                                    }
                                    placeholder={t('databases.general.enter-password')}
                                    className={styles.passwordField}
                                    error={
                                        allFailed && allErrorsSame
                                            ? (Object.values(instanceAuthErrors || {})[0] as string) ||
                                              t('databases.register-flow.authentication-failed')
                                            : ''
                                    }
                                    isDisabled={isDetectHostLoading}
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Credentials Section */}
            {credentialOption === CREDENTIAL_OPTIONS.MANUAL && (
                <div className={styles.manualCredentialsSection}>
                    {instances.map((instance, index) => {
                        const creds = getInstanceCredentials(instance.uniqueKey);
                        // Find the original instance data using uniqueKey to handle duplicate names
                        const originalInstance = (selectedMultiDetectInstances as any[]).find((inst: any) => {
                            const ec2Id = inst.data?.ec2InstanceId || inst.ec2InstanceId || '';
                            const dbInstanceName = inst.data?.databaseInstanceName || inst.databaseInstanceName || '';
                            return generateInstanceUniqueKey(ec2Id, dbInstanceName) === instance.uniqueKey;
                        });
                        const instanceData = originalInstance?.data || originalInstance;
                        const authenticated = isInstanceAuthenticated(
                            instance.uniqueKey,
                            instanceData,
                            instanceAuthStatus,
                            hostType
                        );
                        const failed = hasInstanceFailed(instance.uniqueKey, instanceAuthStatus);
                        const instanceError = instanceAuthErrors?.[instance.uniqueKey] || '';

                        return (
                            <div
                                key={instance.uniqueKey}
                                className={styles.instanceRow}
                                style={{ borderTop: index > 0 ? '2px solid #e0e0e0' : 'none' }}
                            >
                                <div className={styles.instanceInfo}>
                                    <div className={styles.instanceHeader}>
                                        <DsTypography variant="Semibold_14" className={styles.instanceName}>
                                            {instance.instanceName}
                                        </DsTypography>
                                        <DsTypography variant="Regular_14">
                                            {t('databases.general.host')}
                                            {': '}
                                            {instance.hostName}
                                        </DsTypography>
                                    </div>
                                </div>

                                <div className={styles.instanceFields}>
                                    {isGovAccount ? (
                                        <SsmParameterArnField
                                            value={instanceCredentials[instance.uniqueKey]?.ssmParameterArn || ''}
                                            onChange={value =>
                                                handleInstanceUpdate(instance.uniqueKey, 'ssmParameterArn', value)
                                            }
                                            className={styles.instanceTextField}
                                            isDisabled={authenticated || isDetectHostLoading}
                                        />
                                    ) : (
                                        <>
                                            <SelectField
                                                label={t('databases.register-flow.select-authentication-mode')}
                                                value={creds.authMode}
                                                onChange={(selectedOption: any) =>
                                                    handleInstanceUpdate(instance.uniqueKey, 'authMode', selectedOption)
                                                }
                                                options={authModeOptions}
                                                isClearable={false}
                                                isSearchable={false}
                                                isDisabled={authenticated || isDetectHostLoading}
                                                className={`${styles.instanceSelectField} ${
                                                    failed ? styles.errorBorder : ''
                                                }`}
                                            />

                                            <DsTextField
                                                title={getAuthFieldLabels(creds.authMode?.value, t).usernameLabel}
                                                value={creds.username}
                                                onChange={(event?: React.ChangeEvent<HTMLInputElement>) =>
                                                    handleInstanceUpdate(
                                                        instance.uniqueKey,
                                                        'username',
                                                        event?.target?.value || ''
                                                    )
                                                }
                                                placeholder={`${t('databases.general.enter')} ${
                                                    getAuthFieldLabels(creds.authMode?.value, t).usernameLabel
                                                }`}
                                                className={styles.instanceTextField}
                                                isDisabled={authenticated || isDetectHostLoading}
                                                {...(failed
                                                    ? {
                                                          message: {
                                                              type: 'error',
                                                              value:
                                                                  instanceError ||
                                                                  t('databases.register-flow.authentication-failed') ||
                                                                  ''
                                                          }
                                                      }
                                                    : {})}
                                            />

                                            <PasswordField
                                                label={getAuthFieldLabels(creds.authMode?.value, t).passwordLabel}
                                                value={creds.password}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    handleInstanceUpdate(instance.uniqueKey, 'password', e.target.value)
                                                }
                                                placeholder={t('databases.general.enter-password')}
                                                className={styles.instancePasswordField}
                                                isDisabled={authenticated || isDetectHostLoading}
                                                error={
                                                    failed
                                                        ? instanceError ||
                                                          t('databases.register-flow.authentication-failed')
                                                        : ''
                                                }
                                            />
                                        </>
                                    )}

                                    {/* Reserve space for close button to prevent layout shift */}
                                    <div className={styles.closeButtonContainer}>
                                        {!authenticated && !isDetectHostLoading && (
                                            <button
                                                className={styles.closeButton}
                                                onClick={() => handleRemoveInstance(instance.uniqueKey)}
                                                aria-label={t('databases.register-flow.remove-instance')}
                                                disabled={instances.length === 1}
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
