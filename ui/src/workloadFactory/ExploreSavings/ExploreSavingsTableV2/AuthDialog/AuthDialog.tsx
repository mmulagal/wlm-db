import { useTranslation } from 'react-i18next';
import { DsCheckbox, DsRadioButton, DsTextField, DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { ChangeEvent, useEffect, useState } from 'react';
import { Popover } from '@netapp/design-system';
import styles from './AuthDialog.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { AUTHENTICATION_TYPE } from '../../../../utils/consts';
import SsmParameterArnField from '../../../../common/SsmParameterArnField/SsmParameterArnField';
import {
    AccordionCard,
    AccordionCardContent,
    AccordionController
} from '../../../../common/AccordionCard/AccordionCard';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import {
    resetServerDetailsCredentials,
    setCredentials,
    setSelectedAuthenticationType
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { setPartialDataBannerSelectedAuthHostIds } from '../../../../store/workloadFactory/exploreSavingsBulkSlice';

interface AuthDialogProps {
    databaseHostName: string;
    authHostRows?: any[];
    isOracle?: boolean;
}

const AuthDialog = ({ databaseHostName, authHostRows, isOracle = false }: AuthDialogProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [userNameTouched, setUserNameTouched] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);
    const [arnTouched, setArnTouched] = useState(false);

    const {
        selectedAuthenticationType,
        serverDetails: { userName, password, ssmParameterArn }
    } = useAppSelector(state => state.exploreSavings);
    const { actionsDisabled } = useAppSelector(state => state.dialogComponent);
    const { partialDataBannerSelectedAuthHostIds = [] } = useAppSelector(state => state.exploreSavingsBulk);
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);

    const toggleHostSelection = (hostId: string) => {
        const nextSelected = partialDataBannerSelectedAuthHostIds.includes(hostId)
            ? partialDataBannerSelectedAuthHostIds.filter(id => id !== hostId)
            : [...partialDataBannerSelectedAuthHostIds, hostId];
        dispatch(setPartialDataBannerSelectedAuthHostIds(nextSelected));
    };

    useEffect(() => {
        if (!isOracle && !selectedAuthenticationType) {
            dispatch(setSelectedAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
        }
    }, [dispatch, isOracle, selectedAuthenticationType]);

    const handleAuthTypeChange = (authType: string) => {
        dispatch(setSelectedAuthenticationType(authType));
        dispatch(resetServerDetailsCredentials());
        setUserNameTouched(false);
        setPasswordTouched(false);
    };

    const ssmArnInputField = () => (
        <div className={styles.firstSection}>
            <div className={styles.textFieldContainer}>
                <SsmParameterArnField
                    value={ssmParameterArn}
                    onChange={value => dispatch(setCredentials({ ssmParameterArn: value }))}
                    onBlur={() => setArnTouched(true)}
                    isDisabled={actionsDisabled}
                    className={styles.textFieldStyle}
                    showRequiredError={arnTouched && !ssmParameterArn}
                />
            </div>
        </div>
    );

    const credentialInputFields = () => {
        const { selectedAuthenticationType } = useAppSelector(state => state.exploreSavings);
        const isSqlAuth = !isOracle && selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION;
        const userNameTitle = isOracle
            ? t('databases.register-flow.detect-oracle-username')
            : isSqlAuth
            ? t('databases.register-flow.detect-mssql-username')
            : t('databases.register-flow.detect-windows-username');
        const passwordTitle = isOracle
            ? t('databases.register-flow.detect-oracle-password')
            : isSqlAuth
            ? t('databases.register-flow.detect-mssql-password')
            : t('databases.register-flow.detect-windows-password');
        const userNamePlaceholder = isOracle
            ? `${t('databases.general.enter')} ${t('databases.register-flow.detect-oracle-username')}`
            : isSqlAuth
            ? `${t('databases.general.enter')} ${t('databases.register-flow.detect-mssql-username')}`
            : t('databases.register-flow.detect-windows-username');

        return (
            <div className={styles.firstSection}>
                <div className={styles.textFieldContainer}>
                    <DsTextField
                        title={userNameTitle}
                        value={userName}
                        onChange={(event?: ChangeEvent<HTMLInputElement>) => {
                            dispatch(setCredentials({ userName: event?.target?.value }));
                        }}
                        isDisabled={actionsDisabled}
                        className={styles.textFieldStyle}
                        onBlur={() => setUserNameTouched(true)}
                        {...(userNameTouched && userName.length === 0
                            ? {
                                  message: {
                                      type: 'error',
                                      value: t('databases.general.action-required') || ''
                                  }
                              }
                            : {})}
                        placeholder={userNamePlaceholder}
                    />

                    <DsTextField
                        title={passwordTitle}
                        value={password}
                        isPassword
                        onChange={(event?: ChangeEvent<HTMLInputElement>) => {
                            dispatch(setCredentials({ password: event?.target?.value }));
                        }}
                        isDisabled={actionsDisabled}
                        className={styles.textFieldStyle}
                        onBlur={() => setPasswordTouched(true)}
                        {...(passwordTouched && password.length === 0
                            ? {
                                  message: {
                                      type: 'error',
                                      value: t('databases.general.action-required') || ''
                                  }
                              }
                            : {})}
                        placeholder={t('databases.general.enter-password')}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className={styles.authDialog}>
            <DsTypography variant="Regular_14">
                {t('databases.explore-savings.auth-heading')} <span className={styles.dbName}>{databaseHostName}</span>
            </DsTypography>
            {authHostRows && authHostRows.length > 1 && (
                <div className={styles.hostNameList}>
                    {authHostRows.map(row => (
                        <DsCheckbox
                            key={row.id}
                            id={row.id}
                            title={row.name}
                            isSelected={partialDataBannerSelectedAuthHostIds.includes(row.id)}
                            onSelect={() => toggleHostSelection(row.id)}
                            isDisabled={actionsDisabled}
                            className={styles.hostNameItem}
                        />
                    ))}
                </div>
            )}

            {isGovAccount ? (
                <div className={styles.textFieldContainer}>{ssmArnInputField()}</div>
            ) : isOracle ? (
                <div className={styles.textFieldContainer}>{credentialInputFields()}</div>
            ) : (
                <>
                    <div className={styles.radioContainer}>
                        <DsTypography variant="Semibold_14">
                            {t('databases.explore-savings.select-auth-mode')}
                        </DsTypography>
                        <DsRadioButton
                            id="select-sql-authentication"
                            variant="Default"
                            title={t('databases.explore-savings.sql-server-authentication')}
                            isSelected={selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION}
                            onClick={() => handleAuthTypeChange(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION)}
                        />
                        <DsRadioButton
                            id="select-windows-authentication"
                            variant="Default"
                            title={t('databases.explore-savings.windows-authentication')}
                            isSelected={selectedAuthenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION}
                            onClick={() => handleAuthTypeChange(AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION)}
                        />
                    </div>
                    <div className={styles.textFieldContainer}>{credentialInputFields()}</div>
                </>
            )}
            {!isOracle && (
                <div className={styles.accordionContainer}>
                    <AccordionController isGrouped={false}>
                        <AccordionCard
                            id="1"
                            title={
                                <DsTypography variant="Semibold_14">
                                    {t('databases.explore-savings.permissions-required-heading')}
                                </DsTypography>
                            }
                        >
                            <AccordionCardContent>
                                <DsTypography variant="Regular_14">
                                    <DsTypography variant="Regular_14" className={styles.text}>
                                        {' '}
                                        {t('databases.explore-savings.permissions-required-content')}
                                    </DsTypography>

                                    <div className={styles['dialog-body']}>
                                        <div className={styles['code-box']}>
                                            <div className={styles.code}>
                                                <DsTypography variant="Regular_13">
                                                    - {t('databases.explore-savings.view-any-definition')}
                                                </DsTypography>
                                                <DsTypography variant="Regular_13">
                                                    - {t('databases.explore-savings.view-server-state')}
                                                </DsTypography>
                                                <DsTypography variant="Regular_13">
                                                    - {t('databases.explore-savings.connect-sql')}
                                                </DsTypography>
                                            </div>
                                            <div className={styles.copy}>
                                                <Popover
                                                    popoverClass={styles['copy-popover']}
                                                    children="Permissions copied"
                                                    container={
                                                        <CopyToClipboardCommon
                                                            value={`${t(
                                                                'databases.explore-savings.view-any-definition'
                                                            )}, ${t(
                                                                'databases.explore-savings.view-server-state'
                                                            )}, ${t('databases.explore-savings.connect-sql')}`}
                                                            iconProvided={<CopyIcon fill="#404040" />}
                                                        />
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </DsTypography>
                            </AccordionCardContent>
                        </AccordionCard>
                    </AccordionController>
                </div>
            )}
        </div>
    );
};

export default AuthDialog;
