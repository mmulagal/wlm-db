import { useTranslation } from 'react-i18next';
import { DsRadioButton, DsTextField, DsTypography } from '@tlveng/wlm-ds';
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

interface AuthDialogProps {
    databaseHostName: string;
}

const AuthDialog = ({ databaseHostName }: AuthDialogProps) => {
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
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);

    useEffect(() => {
        if (!selectedAuthenticationType) {
            dispatch(setSelectedAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
        }
    }, []);

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

    const mssqlInputFields = () => {
        const { selectedAuthenticationType } = useAppSelector(state => state.exploreSavings);
        return (
            <div className={styles.firstSection}>
                <div className={styles.textFieldContainer}>
                    <DsTextField
                        title={
                            selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                                ? t('databases.register-flow.detect-mssql-username')
                                : t('databases.register-flow.detect-windows-username')
                        }
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
                        placeholder={
                            selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                                ? `${t('databases.general.enter')} ${t(
                                      'databases.register-flow.detect-mssql-username'
                                  )}`
                                : t('databases.register-flow.detect-windows-username')
                        }
                    />

                    <DsTextField
                        title={
                            selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                                ? t('databases.register-flow.detect-mssql-password')
                                : t('databases.register-flow.detect-windows-password')
                        }
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

            {isGovAccount ? (
                <div className={styles.textFieldContainer}>{ssmArnInputField()}</div>
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
                    <div className={styles.textFieldContainer}>{mssqlInputFields()}</div>
                </>
            )}
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
                                                        )}, ${t('databases.explore-savings.view-server-state')}, ${t(
                                                            'databases.explore-savings.connect-sql'
                                                        )}`}
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
        </div>
    );
};

export default AuthDialog;
