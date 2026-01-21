import { TooltipInfo, DsTypography, PasswordField, TextField, useWizard } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useEffect, useRef, useMemo } from 'react';
import classNames from 'classnames';
import styles from './InputCard.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import {
    setDetectONTAPPassword,
    setDetectONTAPUserName,
    setDetectONTAPCredentialsByFsx
} from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { UseWizardReturn } from '../../../../../../utils/types/registerTypes';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../../../assets/error-icon.svg';
import { FSX_FOR_ONTAP_CRED_OPTION, RESPONSE_STATUS } from '../../../../../../utils/consts';
import { FsxAuthStatus } from '../../../../../../utils/types/inventoryV2Types';
import {
    FsxItem,
    getAllFsxFromStorage,
    getFsxNeedingAuth,
    getAllFsxFromBulkStorage,
    getFsxNeedingAuthFromBulk
} from '../AuthenticateFsxUtils';

interface InputCardProps {
    isBulkMode?: boolean;
    isLoading?: boolean;
}

const InputCard = ({ isBulkMode = false, isLoading = false }: InputCardProps) => {
    const {
        detectOntapUsername,
        detectOntapPassword,
        selectedFSxForOntapCredentials,
        detectOntapCredentialsByFsx,
        fsxAuthStatus,
        fsxCredentialStatusObj,
        manageSingleInstanceData,
        selectedMultiDetectInstances
    } = useAppSelector(state => state.inventoryV2);
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { state, setState }: UseWizardReturn = useWizard();
    const { hitNextForStep2, fsxAllAuthFailed } = state;

    // Get FSx lists based on mode (bulk vs single)
    const fullFsxList = useMemo(() => {
        if (isBulkMode) {
            return getAllFsxFromBulkStorage(selectedMultiDetectInstances);
        }
        return getAllFsxFromStorage(manageSingleInstanceData?.storage);
    }, [isBulkMode, manageSingleInstanceData?.storage, selectedMultiDetectInstances]);

    const fsxList = useMemo(() => {
        if (isBulkMode) {
            return getFsxNeedingAuthFromBulk(selectedMultiDetectInstances, fsxCredentialStatusObj);
        }
        return getFsxNeedingAuth(manageSingleInstanceData?.storage, fsxCredentialStatusObj);
    }, [isBulkMode, manageSingleInstanceData?.storage, selectedMultiDetectInstances, fsxCredentialStatusObj]);

    const fsxNames = useMemo(() => [...new Set(fsxList.map((fsx: FsxItem) => fsx.fsxName))], [fsxList]);

    // Track the previous mode to detect switches
    const prevModeRef = useRef(selectedFSxForOntapCredentials);

    // Populate credentials for authenticated FSx when switching to MANAGE_CRED_MANUALLY
    useEffect(() => {
        const wasUseTheSameCred = prevModeRef.current === FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED;
        const isNowManageManually = selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY;

        if (wasUseTheSameCred && isNowManageManually) {
            // Find all authenticated FSx and populate their credentials
            fsxNames.forEach((fsxName: string) => {
                const authStatus = fsxAuthStatus[fsxName];
                const isAuthenticated = authStatus?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();

                if (isAuthenticated && detectOntapUsername && detectOntapPassword) {
                    // Only populate if not already set
                    if (!detectOntapCredentialsByFsx[fsxName]?.username) {
                        dispatch(
                            setDetectONTAPCredentialsByFsx({
                                fsxName,
                                username: detectOntapUsername,
                                password: detectOntapPassword
                            })
                        );
                    }
                }
            });
        }

        prevModeRef.current = selectedFSxForOntapCredentials;
    }, [selectedFSxForOntapCredentials, fsxNames, fsxAuthStatus, detectOntapUsername, detectOntapPassword, dispatch]);

    // Helper to get auth status for a specific FSx
    const getFsxAuthStatus = (fsxName: string): FsxAuthStatus | undefined => {
        const fsx = fsxList.find(f => f.fsxName === fsxName);
        if (fsx && fsxAuthStatus[fsx.fsxId]) {
            return fsxAuthStatus[fsx.fsxId];
        }
        return undefined;
    };

    const tooltipContent = (
        <div className={styles.tooltipContent}>
            {fullFsxList.map((fsx: FsxItem, index: number) => (
                <div
                    key={fsx.fsxId}
                    className={`${styles.tooltipRow} ${
                        index !== fullFsxList.length - 1 ? styles.tooltipRowWithBorder : ''
                    }`}
                >
                    <DsTypography variant="Semibold_14">{fsx.fsxName}</DsTypography>
                </div>
            ))}
        </div>
    );

    return (
        <div className={classNames(styles.inputCard, { [styles.disabled]: isLoading })}>
            {selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED && (
                <div className={styles.card1}>
                    <div className={styles.topHeading}>
                        <div className={styles.headerPart}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.register-flow.all-fsx-for-ontap-resources')} ({fullFsxList.length})
                            </DsTypography>
                            <TooltipInfo trigger="hover" placement="bottom">
                                {tooltipContent}
                            </TooltipInfo>
                        </div>

                        <DsTypography variant="Regular_14">
                            {t('databases.register-flow.fsx-discovered-need-auth', { count: fsxList.length })}
                        </DsTypography>
                    </div>

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
                </div>
            )}

            {selectedFSxForOntapCredentials === FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY && (
                <div className={styles.card2}>
                    {fsxNames.map((fsxName: string, index: number) => {
                        const authStatus = getFsxAuthStatus(fsxName);
                        const isAuthenticated =
                            authStatus && authStatus.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();
                        const isFailed =
                            authStatus && authStatus.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase();

                        return (
                            <div
                                key={fsxName}
                                className={`${styles.row} ${index !== fsxNames.length - 1 ? styles.rowWithBorder : ''}`}
                            >
                                <div className={styles.firstCol}>
                                    <DsTypography variant="Semibold_14">{fsxName}</DsTypography>
                                </div>

                                <div className={styles.textFieldContainer}>
                                    <TextField
                                        label={t('databases.register-flow.fsx-for-ontap-username')}
                                        value={detectOntapCredentialsByFsx[fsxName]?.username || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(
                                                setDetectONTAPCredentialsByFsx({
                                                    fsxName,
                                                    username: e.target.value
                                                })
                                            );
                                        }}
                                        className={`${styles.textFieldStyle} ${isFailed ? styles.errorBorder : ''}`}
                                        error={
                                            (!detectOntapCredentialsByFsx[fsxName]?.username && hitNextForStep2) ||
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
                                        value={detectOntapCredentialsByFsx[fsxName]?.password || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(
                                                setDetectONTAPCredentialsByFsx({
                                                    fsxName,
                                                    password: e.target.value
                                                })
                                            );
                                        }}
                                        className={`${styles.textFieldStyle} ${isFailed ? styles.errorBorder : ''}`}
                                        error={
                                            (!detectOntapCredentialsByFsx[fsxName]?.password && hitNextForStep2) ||
                                            isFailed
                                                ? t('databases.general.action-required')
                                                : ''
                                        }
                                        placeholder={t('databases.general.enter-password')}
                                        isDisabled={isAuthenticated || isLoading}
                                    />
                                </div>

                                {(isAuthenticated || isFailed) && (
                                    <div className={styles.authStatusRight}>
                                        {isAuthenticated ? (
                                            <>
                                                <Success className={styles.successIcon} />
                                                <DsTypography variant="Regular_13">
                                                    {t('databases.register-flow.fsx-authenticated')}
                                                </DsTypography>
                                            </>
                                        ) : (
                                            <>
                                                <Failure className={styles.failedIcon} />
                                                <DsTypography variant="Regular_13">
                                                    {t('databases.register-flow.fsx-authentication-failed')}
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

export default InputCard;
