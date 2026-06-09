import { Popover, DsTypography, PasswordField, TextField, useWizard } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import classNames from 'classnames';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info_tooltip.svg';
import styles from './InputCard.module.scss';
import CommonStyles from '../../../../../../utils/CommonStyles.module.scss';
import GovCloudSsmSection, {
    SsmArnFormatTooltip
} from '../../../../../../common/GovCloudSsmSection/GovCloudSsmSection';
import { useAppSelector } from '../../../../../../store/storeHooks';
import {
    setDetectONTAPPassword,
    setDetectONTAPUserName,
    setDetectONTAPSsmParameterArn,
    setDetectONTAPCredentialsByFsx
} from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { UseWizardReturn } from '../../../../../../utils/types/registerTypes';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../../../assets/error-icon.svg';
import { FSX_FOR_ONTAP_CRED_OPTION, RESPONSE_STATUS, isValidSsmArn } from '../../../../../../utils/consts';
import { FsxAuthStatus } from '../../../../../../utils/types/inventoryV2Types';
import {
    FsxItem,
    getAllFsxFromStorage,
    getFsxNeedingAuth,
    getAllFsxFromBulkStorage,
    getFsxNeedingAuthFromBulk,
    getFsxCredStatusByEngine,
    useFsxDiscoverContext
} from '../AuthenticateFsxUtils';

interface InputCardProps {
    isBulkMode?: boolean;
    isLoading?: boolean;
}

const InputCard = ({ isBulkMode = false, isLoading = false }: InputCardProps) => {
    const inventoryV2State = useAppSelector(state => state.inventoryV2);
    const {
        detectOntapUsername,
        detectOntapPassword,
        selectedFSxForOntapCredentials,
        detectOntapCredentialsByFsx,
        fsxAuthStatus,
        registerHostType
    } = inventoryV2State;

    const fsxCredentialStatusObj = useMemo(
        () => getFsxCredStatusByEngine(inventoryV2State, registerHostType),
        [
            inventoryV2State.fsxCredentialStatusObj,
            inventoryV2State.fsxCredentialStatusObjOracle,
            inventoryV2State.fsxCredentialStatusObjPgsql,
            registerHostType
        ]
    );
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { state, setState }: UseWizardReturn = useWizard();
    const { hitNextForStep2, fsxAllAuthFailed } = state;

    // Use the consolidated hook for discover context and instance identifiers
    const { discoverContext, instanceIdentifiers, manageSingleInstanceData, selectedMultiDetectInstances } =
        useFsxDiscoverContext();

    // Get FSx lists based on mode (bulk vs single)
    const fullFsxList = useMemo(() => {
        if (isBulkMode) {
            return getAllFsxFromBulkStorage(selectedMultiDetectInstances, discoverContext);
        }
        return getAllFsxFromStorage(manageSingleInstanceData?.storage, instanceIdentifiers, discoverContext);
    }, [
        isBulkMode,
        manageSingleInstanceData?.storage,
        selectedMultiDetectInstances,
        instanceIdentifiers,
        discoverContext
    ]);

    const fsxList = useMemo(() => {
        if (isBulkMode) {
            return getFsxNeedingAuthFromBulk(selectedMultiDetectInstances, fsxCredentialStatusObj, discoverContext);
        }
        return getFsxNeedingAuth(
            manageSingleInstanceData?.storage,
            fsxCredentialStatusObj,
            instanceIdentifiers,
            discoverContext
        );
    }, [
        isBulkMode,
        manageSingleInstanceData?.storage,
        selectedMultiDetectInstances,
        fsxCredentialStatusObj,
        instanceIdentifiers,
        discoverContext
    ]);

    // Get unique FSx items by fsxId for MANAGE_CRED_MANUALLY mode
    const uniqueFsxList = useMemo(() => {
        const seenIds = new Set<string>();
        return fsxList.filter((fsx: FsxItem) => {
            if (seenIds.has(fsx.fsxId)) return false;
            seenIds.add(fsx.fsxId);
            return true;
        });
    }, [fsxList]);

    // Track the previous mode to detect switches
    const prevModeRef = useRef(selectedFSxForOntapCredentials);

    // Populate credentials for authenticated FSx when switching to MANAGE_CRED_MANUALLY
    useEffect(() => {
        const wasUseTheSameCred = prevModeRef.current === FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED;
        const isNowManageManually = selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY;

        if (wasUseTheSameCred && isNowManageManually) {
            // Find all authenticated FSx and populate their credentials
            uniqueFsxList.forEach((fsx: FsxItem) => {
                const authStatus = fsxAuthStatus[fsx.fsxId];
                const isAuthenticated = authStatus?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();

                if (isAuthenticated && detectOntapUsername && detectOntapPassword) {
                    // Only populate if not already set (credentials are keyed by fsxId)
                    if (!detectOntapCredentialsByFsx[fsx.fsxId]?.username) {
                        dispatch(
                            setDetectONTAPCredentialsByFsx({
                                fsxId: fsx.fsxId,
                                username: detectOntapUsername,
                                password: detectOntapPassword
                            })
                        );
                    }
                }
            });
        }

        prevModeRef.current = selectedFSxForOntapCredentials;
    }, [
        selectedFSxForOntapCredentials,
        uniqueFsxList,
        fsxAuthStatus,
        detectOntapUsername,
        detectOntapPassword,
        dispatch
    ]);

    // Helper to get auth status for a specific FSx by fsxId (memoized for referential stability)
    const getFsxAuthStatusById = useCallback(
        (fsxId: string): FsxAuthStatus | undefined => fsxAuthStatus[fsxId],
        [fsxAuthStatus]
    );

    const tooltipContent = (
        <div className={CommonStyles.tooltipContent}>
            {fullFsxList.map((fsx: FsxItem, index: number) => (
                <div
                    key={fsx.fsxId}
                    className={`${CommonStyles.tooltipRow} ${
                        index !== fullFsxList.length - 1 ? CommonStyles.tooltipRowWithBorder : ''
                    }`}
                >
                    <DsTypography variant="Semibold_14">{fsx.fsxName}</DsTypography>
                    <DsTypography variant="Regular_14">
                        {t('databases.register-flow.id')}: {fsx.fsxId}
                    </DsTypography>
                </div>
            ))}
        </div>
    );

    return (
        <div
            className={classNames(styles.inputCard, {
                [styles.disabled]: isLoading,
                [styles.govCloudInputCard]: isGovAccount
            })}
        >
            {selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED && (
                <div className={classNames(styles.card1, { [styles.govCloudCard]: isGovAccount })}>
                    <div className={styles.topHeading}>
                        <div className={styles.headerPart}>
                            <DsTypography variant="Semibold_14">
                                {isGovAccount
                                    ? `${t('databases.register-flow.govcloud-fsx-require-auth')} (${fsxList.length})`
                                    : `${t('databases.register-flow.all-fsx-for-ontap-resources')} (${
                                          fullFsxList.length
                                      })`}
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
                                {tooltipContent}
                            </Popover>
                        </div>

                        {isGovAccount ? (
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.govcloud-ssm-description-line1', {
                                    count: fsxList.length
                                })}{' '}
                                {t('databases.register-flow.govcloud-ssm-description-line2')}
                            </DsTypography>
                        ) : (
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.fsx-discovered-need-auth', { count: fsxList.length })}
                            </DsTypography>
                        )}
                    </div>

                    {isGovAccount ? (
                        <GovCloudSsmSection
                            arnValue={inventoryV2State.detectOntapSsmParameterArn}
                            onArnChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                dispatch(setDetectONTAPSsmParameterArn(e.target.value));
                            }}
                            jsonExample="databases.register-flow.ssm-tooltip-json-fsx"
                            errorMessage={
                                fsxAllAuthFailed ? t('databases.register-flow.fsx-authentication-failed') : ''
                            }
                            isValid={
                                !!inventoryV2State.detectOntapSsmParameterArn &&
                                isValidSsmArn(inventoryV2State.detectOntapSsmParameterArn)
                            }
                            showRequiredError={!inventoryV2State.detectOntapSsmParameterArn && hitNextForStep2}
                            isDisabled={isLoading}
                            learnMoreUrl={t('databases.register-flow.govcloud-ssm-docs-url')}
                        />
                    ) : (
                        <div className={styles.textFieldContainer}>
                            <TextField
                                label={t('databases.register-flow.fsx-for-ontap-username')}
                                value={detectOntapUsername}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setDetectONTAPUserName(e.target.value));
                                }}
                                className={`${styles.textFieldStyle} ${fsxAllAuthFailed ? styles.errorBorder : ''}`}
                                error={
                                    !detectOntapUsername && hitNextForStep2
                                        ? t('databases.general.action-required')
                                        : fsxAllAuthFailed
                                        ? t('databases.register-flow.fsx-authentication-failed')
                                        : ''
                                }
                                placeholder={`${t('databases.general.enter')} ${t(
                                    'databases.register-flow.fsx-for-ontap-username'
                                )}`}
                                isDisabled={isLoading}
                            />

                            <PasswordField
                                label={t('databases.register-flow.fsx-for-ontap-password')}
                                value={detectOntapPassword}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setDetectONTAPPassword(e.target.value));
                                }}
                                className={`${styles.textFieldStyle} ${fsxAllAuthFailed ? styles.errorBorder : ''}`}
                                error={
                                    !detectOntapPassword && hitNextForStep2
                                        ? t('databases.general.action-required')
                                        : fsxAllAuthFailed
                                        ? t('databases.register-flow.fsx-authentication-failed')
                                        : ''
                                }
                                placeholder={t('databases.general.enter-password')}
                                isDisabled={isLoading}
                            />
                        </div>
                    )}
                </div>
            )}

            {selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY && (
                <div className={classNames(styles.card2, { [styles.govCloudCard]: isGovAccount })}>
                    {isGovAccount && (
                        <div className={styles.govCloudManualTop}>
                            <div className={styles.topHeading}>
                                <div className={styles.headerPart}>
                                    <DsTypography variant="Semibold_14">
                                        {`${t('databases.register-flow.govcloud-fsx-require-auth')} (${
                                            fsxList.length
                                        })`}
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
                                        {tooltipContent}
                                    </Popover>
                                </div>

                                <DsTypography variant="Regular_14">
                                    {t('databases.register-flow.govcloud-ssm-description-line1', {
                                        count: fsxList.length
                                    })}{' '}
                                    {t('databases.register-flow.govcloud-ssm-description-line2')}
                                </DsTypography>
                            </div>

                            <GovCloudSsmSection
                                instructionalOnly
                                jsonExample="databases.register-flow.ssm-tooltip-json-fsx"
                                learnMoreUrl={t('databases.register-flow.govcloud-ssm-docs-url')}
                            />
                        </div>
                    )}

                    {uniqueFsxList.map((fsx: FsxItem, index: number) => {
                        const authStatus = getFsxAuthStatusById(fsx.fsxId);
                        const isAuthenticated =
                            authStatus && authStatus.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();
                        const isFailed =
                            authStatus && authStatus.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase();

                        return (
                            <div
                                key={fsx.fsxId}
                                className={`${styles.row} ${
                                    index !== uniqueFsxList.length - 1 ? styles.rowWithBorder : ''
                                }`}
                            >
                                <div className={styles.firstCol}>
                                    <DsTypography variant="Semibold_14" title={fsx.fsxName}>
                                        {fsx.fsxName}
                                    </DsTypography>
                                    <DsTypography
                                        variant="Regular_14"
                                        title={`${t('databases.register-flow.id')}: ${fsx.fsxId}`}
                                    >
                                        {t('databases.register-flow.id')}: {fsx.fsxId}
                                    </DsTypography>
                                </div>

                                <div
                                    className={`${styles.textFieldContainer} ${
                                        isGovAccount ? styles.govCloudTextFieldContainer : ''
                                    }`}
                                >
                                    {isGovAccount ? (
                                        <TextField
                                            label={t('databases.register-flow.govcloud-ssm-endpoint-label')}
                                            info={<SsmArnFormatTooltip />}
                                            infoProps={{
                                                interactive: true,
                                                delayHide: 300,
                                                placement: 'right',
                                                isAppendedToBody: true
                                            }}
                                            value={detectOntapCredentialsByFsx[fsx.fsxId]?.ssmParameterArn || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                dispatch(
                                                    setDetectONTAPCredentialsByFsx({
                                                        fsxId: fsx.fsxId,
                                                        ssmParameterArn: e.target.value
                                                    })
                                                );
                                            }}
                                            className={`${styles.govCloudTextField} ${
                                                isFailed ? styles.errorBorder : ''
                                            }`}
                                            error={
                                                !detectOntapCredentialsByFsx[fsx.fsxId]?.ssmParameterArn &&
                                                hitNextForStep2
                                                    ? t('databases.general.action-required')
                                                    : detectOntapCredentialsByFsx[fsx.fsxId]?.ssmParameterArn &&
                                                      !isValidSsmArn(
                                                          detectOntapCredentialsByFsx[fsx.fsxId]?.ssmParameterArn || ''
                                                      )
                                                    ? t('databases.register-flow.ssm-parameter-arn-invalid')
                                                    : isFailed
                                                    ? t('databases.general.action-required')
                                                    : ''
                                            }
                                            placeholder={t('databases.register-flow.ssm-parameter-arn-placeholder')}
                                            isDisabled={isAuthenticated || isLoading}
                                        />
                                    ) : (
                                        <>
                                            <TextField
                                                label={t('databases.register-flow.fsx-for-ontap-username')}
                                                value={detectOntapCredentialsByFsx[fsx.fsxId]?.username || ''}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    dispatch(
                                                        setDetectONTAPCredentialsByFsx({
                                                            fsxId: fsx.fsxId,
                                                            username: e.target.value
                                                        })
                                                    );
                                                }}
                                                className={`${styles.textFieldStyle} ${
                                                    isFailed ? styles.errorBorder : ''
                                                }`}
                                                error={
                                                    (!detectOntapCredentialsByFsx[fsx.fsxId]?.username &&
                                                        hitNextForStep2) ||
                                                    isFailed
                                                        ? t('databases.general.action-required')
                                                        : ''
                                                }
                                                placeholder={`${t('databases.general.enter')} ${t(
                                                    'databases.register-flow.fsx-for-ontap-username'
                                                )}`}
                                                isDisabled={isAuthenticated || isLoading}
                                            />

                                            <PasswordField
                                                label={t('databases.register-flow.fsx-for-ontap-password')}
                                                value={detectOntapCredentialsByFsx[fsx.fsxId]?.password || ''}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    dispatch(
                                                        setDetectONTAPCredentialsByFsx({
                                                            fsxId: fsx.fsxId,
                                                            password: e.target.value
                                                        })
                                                    );
                                                }}
                                                className={`${styles.textFieldStyle} ${
                                                    isFailed ? styles.errorBorder : ''
                                                }`}
                                                error={
                                                    (!detectOntapCredentialsByFsx[fsx.fsxId]?.password &&
                                                        hitNextForStep2) ||
                                                    isFailed
                                                        ? t('databases.general.action-required')
                                                        : ''
                                                }
                                                placeholder={t('databases.general.enter-password')}
                                                isDisabled={isAuthenticated || isLoading}
                                            />
                                        </>
                                    )}
                                </div>

                                {/* Always reserve space for auth status */}
                                <div className={styles.authStatusRight}>
                                    {isAuthenticated && (
                                        <>
                                            <Success className={styles.successIcon} />
                                            <DsTypography variant="Regular_13">
                                                {t('databases.register-flow.fsx-authenticated')}
                                            </DsTypography>
                                        </>
                                    )}
                                    {isFailed && (
                                        <>
                                            <Failure className={styles.failedIcon} />
                                            <DsTypography variant="Regular_13">
                                                {t('databases.register-flow.fsx-authentication-failed')}
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

export default InputCard;
