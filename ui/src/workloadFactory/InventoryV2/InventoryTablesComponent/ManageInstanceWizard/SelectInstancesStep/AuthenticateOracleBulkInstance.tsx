import { Popover, PasswordField } from '@netapp/design-system';
import { DsRadioButton, DsTextField, DsTypography } from '@tlveng/wlm-ds';

import { ReactComponent as CloseIcon } from '@netapp/icons/ic_close.svg';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info_tooltip.svg';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InstancesImage } from '../../../../../assets/Instances_Img.svg';
import { ReactComponent as SingleAuth } from '../../../../../assets/SingleAuth.svg';
import { ReactComponent as Success } from '../../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../../assets/error-icon.svg';
import ManageWizardFooter from '../ManageWizardFooter';
import {
    setCredentialOption,
    setInstanceCredentials,
    removeInstanceCredentials,
    setSelectedMultiDetectInstances,
    setOracleBulkDatabaseCredentials
} from '../../../../../store/workloadFactory/inventoryV2Slice';
import { CREDENTIAL_OPTIONS, DBType } from '../../../../../utils/consts';
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
    BulkInstanceItem
} from './AuthenticateBulkUtils';

export const Content = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    // Redux state
    const credentialOption = useAppSelector(state => state.inventoryV2.credentialOption);
    const { oracleUsername, oraclePassword, oracleASM, asmPassword } = useAppSelector(
        state => state.inventoryV2.oracleBulkDatabaseCredentials
    );
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

    // Auto-switch to manual mode when partial success occurs
    // This allows users to fix failed instances individually
    useEffect(() => {
        if (hasPartialSuccess) {
            dispatch(setCredentialOption(CREDENTIAL_OPTIONS.MANUAL));
        }
    }, [hasPartialSuccess, dispatch]);

    // Handle updating individual instance credentials
    const handleInstanceUpdate = (
        instanceId: string,
        field: 'authMode' | 'username' | 'password' | 'oracleASM' | 'asmPassword',
        value: any
    ) => {
        dispatch(setInstanceCredentials({ instanceId, credentials: { [field]: value } }));
    };

    // Handle removing an instance from the selection
    const handleRemoveInstance = (instanceId: string) => {
        dispatch(removeInstanceCredentials(instanceId));
        // Also update selectedMultiDetectInstances
        const updatedInstances = selectedMultiDetectInstances.filter(
            (inst: any) => (inst.data?.databaseInstanceName || inst.databaseInstanceName) !== instanceId
        );
        dispatch(setSelectedMultiDetectInstances(updatedInstances));
    };

    // Get credentials for an instance (from Redux or defaults)
    const getInstanceCredentials = (instanceId: string) =>
        instanceCredentials[instanceId] || {
            username: '',
            password: '',
            oracleASM: '',
            asmPassword: ''
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
                                {instances.map((instance, index) => (
                                    <div
                                        key={instance.instanceId}
                                        className={`${CommonStyles.tooltipRow} ${
                                            index !== instances.length - 1 ? CommonStyles.tooltipRowWithBorder : ''
                                        }`}
                                    >
                                        <DsTypography variant="Semibold_13">{instance.instanceName}</DsTypography>
                                    </div>
                                ))}
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

                        <div className={styles.oracleFormFields}>
                            <DsTextField
                                title={t('databases.register-flow.detect-oracle-asm-username')}
                                value={oracleASM}
                                isOptional
                                onChange={(event?: React.ChangeEvent<HTMLInputElement>) =>
                                    dispatch(
                                        setOracleBulkDatabaseCredentials({ oracleASM: event?.target?.value || '' })
                                    )
                                }
                                placeholder={`${t('databases.general.enter')} ${t(
                                    'databases.register-flow.detect-oracle-asm-username'
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
                                label={t('databases.register-flow.detect-oracle-asm-password')}
                                value={asmPassword}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    dispatch(setOracleBulkDatabaseCredentials({ asmPassword: e.target.value }))
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
                        const creds = getInstanceCredentials(instance.instanceId);
                        // Find the original instance data to check authentication status properly
                        const originalInstance = (selectedMultiDetectInstances as any[]).find(
                            (inst: any) =>
                                (inst.data?.databaseInstanceName || inst.databaseInstanceName) === instance.instanceId
                        );
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
                                                instance.instanceId,
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
                                            handleInstanceUpdate(instance.instanceId, 'password', e.target.value)
                                        }
                                        placeholder={t('databases.general.enter-password')}
                                        className={styles.oracleInstancePasswordField}
                                        isDisabled={authenticated}
                                        error={failed ? t('databases.register-flow.authentication-failed') : ''}
                                    />

                                    <DsTextField
                                        title={t('databases.register-flow.detect-oracle-asm-username')}
                                        value={creds.oracleASM || ''}
                                        isOptional
                                        onChange={(event?: React.ChangeEvent<HTMLInputElement>) =>
                                            handleInstanceUpdate(
                                                instance.instanceId,
                                                'oracleASM',
                                                event?.target?.value || ''
                                            )
                                        }
                                        placeholder={`${t('databases.general.enter')} ${t(
                                            'databases.register-flow.detect-oracle-asm-username'
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
                                        label={t('databases.register-flow.detect-oracle-asm-password')}
                                        value={creds.asmPassword || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            handleInstanceUpdate(instance.instanceId, 'asmPassword', e.target.value)
                                        }
                                        placeholder={t('databases.general.enter-password')}
                                        className={styles.oracleInstancePasswordField}
                                        isDisabled={authenticated}
                                        error={failed ? t('databases.register-flow.authentication-failed') : ''}
                                    />

                                    {!authenticated && (
                                        <div className={styles.closeButtonContainer}>
                                            <button
                                                className={styles.closeButton}
                                                onClick={() => handleRemoveInstance(instance.instanceId)}
                                                aria-label={t('databases.register-flow.remove-instance')}
                                            >
                                                <CloseIcon />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Auth Status - Right side like FSx */}
                                {(authenticated || failed) && (
                                    <div className={styles.authStatusRight}>
                                        {authenticated ? (
                                            <>
                                                <Success className={styles.successIcon} />
                                                <DsTypography variant="Regular_13">
                                                    {t('databases.register-flow.authenticated')}
                                                </DsTypography>
                                            </>
                                        ) : (
                                            <>
                                                <Failure className={styles.failedIcon} />
                                                <DsTypography variant="Regular_13">
                                                    {t('databases.register-flow.authentication-failed')}
                                                </DsTypography>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const Footer = () => <ManageWizardFooter />;
