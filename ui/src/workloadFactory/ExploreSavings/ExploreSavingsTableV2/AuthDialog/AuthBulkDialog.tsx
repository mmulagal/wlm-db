import { useTranslation } from 'react-i18next';
import { Popover } from '@netapp/design-system';
import { DsRadioButton, DsSpinner, DsTextField, DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { ChangeEvent, useEffect, useState } from 'react';
import {
    AccordionCard,
    AccordionCardContent,
    AccordionController
} from '../../../../common/AccordionCard/AccordionCard';

import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import styles from './AuthDialog.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { AUTHENTICATION_TYPE } from '../../../../utils/consts';
import { ReactComponent as Cross } from '../../../../assets/Cancel.svg';
import {
    resetServerDetailsCredentials,
    setSelectedAuthenticationType
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../assets/error-icon.svg';
import {
    setSelectedRowsForExploreSavingsEBSBulk,
    setBulkAuthCredentials,
    resetBulkAuthCredentialsAndStatus,
    setRowsRequiringAuthBulk
} from '../../../../store/workloadFactory/exploreSavingsBulkSlice';

const AuthBulkDialog = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [touchedFields, setTouchedFields] = useState<Record<string, { user: boolean; pass: boolean }>>({});

    const { selectedAuthenticationType } = useAppSelector(state => state.exploreSavings);

    const { actionsDisabled } = useAppSelector(state => state.dialogComponent);

    const { selectedRowsForExploreSavingsEBSBulk, rowsRequiringAuthBulk, bulkAuthStatus } = useAppSelector(
        state => state.exploreSavingsBulk
    );

    const rowsToRender =
        rowsRequiringAuthBulk && rowsRequiringAuthBulk.length > 0
            ? rowsRequiringAuthBulk
            : selectedRowsForExploreSavingsEBSBulk;

    const [inputValues, setInputValues] = useState<Record<string, { userName: string; password: string }>>({});

    useEffect(() => {
        if (!selectedAuthenticationType) {
            dispatch(setSelectedAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
        }
    }, [selectedAuthenticationType, dispatch]);

    useEffect(() => {
        if (Object.keys(inputValues).length > 0) {
            dispatch(setBulkAuthCredentials(inputValues));
        }
    }, [inputValues, dispatch]);

    // Initialize local input state based on rows we'll render
    useEffect(() => {
        const newValues: Record<string, { userName: string; password: string }> = {};
        rowsToRender.forEach((row: any) => {
            newValues[row.name] = inputValues[row.name] || { userName: '', password: '' };
        });
        setInputValues(newValues);
    }, [rowsToRender]);

    const handleAuthTypeChange = (authType: string) => {
        dispatch(setSelectedAuthenticationType(authType));
        dispatch(resetServerDetailsCredentials());
        dispatch(resetBulkAuthCredentialsAndStatus());
        setTouchedFields({});
        setInputValues({});
    };

    const handleInputChange = (hostName: string, field: 'userName' | 'password', value: string) => {
        const updated = {
            ...inputValues,
            [hostName]: {
                ...inputValues[hostName],
                [field]: value
            }
        };
        setInputValues(updated);
    };

    const handleBlur = (hostName: string, field: 'user' | 'pass') => {
        setTouchedFields(prev => ({
            ...prev,
            [hostName]: { ...prev[hostName], [field]: true }
        }));
    };

    const handleRemoveRow = (id: number) => {
        if (rowsToRender.length === 1) return;

        const updatedSelected = selectedRowsForExploreSavingsEBSBulk.filter((row: any) => row.id !== id);
        dispatch(setSelectedRowsForExploreSavingsEBSBulk(updatedSelected));

        if (rowsRequiringAuthBulk && rowsRequiringAuthBulk.length > 0) {
            const updatedReq = rowsRequiringAuthBulk.filter((row: any) => row.id !== id);
            dispatch(setRowsRequiringAuthBulk(updatedReq));
        }

        const updatedInputs = { ...inputValues };
        const removedName = rowsToRender.find((row: any) => row.id === id)?.name;
        if (removedName) delete updatedInputs[removedName];
        setInputValues(updatedInputs);
    };

    const getImageForStatus = (status: string) => {
        switch (status) {
            case 'success':
                return <Success />;
            case 'in-progress':
                return <DsSpinner className={styles.spinner} />;
            case 'failure':
                return <Failure />;
            default:
                return null;
        }
    };

    // Get dynamic labels based on authentication type
    const getUsernameLabel = () => {
        if (selectedAuthenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION) {
            return t('databases.register-flow.detect-windows-username');
        }
        return t('databases.explore-savings.mssql-user-name');
    };

    const getPasswordLabel = () => {
        if (selectedAuthenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION) {
            return t('databases.register-flow.detect-windows-password');
        }
        return t('databases.explore-savings.mssql-password');
    };

    const getUsernamePlaceholder = () => {
        if (selectedAuthenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION) {
            return `${t('databases.general.enter')} ${t('databases.register-flow.detect-windows-username')}`;
        }
        return `${t('databases.general.enter')} ${t('databases.register-flow.detect-mssql-username')}`;
    };

    const authInputFields = () => (
        <div className={styles.firstBulkSection}>
            <div className={styles.rowContainer} style={{ marginBottom: '-16px' }}>
                <div className={styles.hostNameContainer}>
                    {/* Reserve same space as icon container for alignment */}
                    <div className={styles.svgContainer} />
                    <DsTypography className={styles.hostName} variant="Semibold_14">
                        {t('databases.explore-savings.database-name')}
                    </DsTypography>
                </div>

                <DsTypography className={styles.fieldLabel} variant="Semibold_14">
                    {getUsernameLabel()}
                </DsTypography>

                <DsTypography className={styles.fieldLabel} variant="Semibold_14">
                    {getPasswordLabel()}
                </DsTypography>
            </div>
            {rowsToRender.map((row: any) => {
                const hostName = row.name;
                const userTouched = touchedFields[hostName]?.user;
                const passTouched = touchedFields[hostName]?.pass;
                const userValue = inputValues[hostName]?.userName || '';
                const passValue = inputValues[hostName]?.password || '';
                const authStatus = bulkAuthStatus?.[hostName];

                return (
                    <div key={row.id} className={styles.rowContainer}>
                        <div className={styles.hostNameContainer}>
                            {/* Reserve space for status icon to maintain alignment */}
                            <div className={styles.svgContainer}>{authStatus && getImageForStatus(authStatus)}</div>
                            <DsTypography className={styles.hostName} variant="Regular_14">
                                {hostName}
                            </DsTypography>
                        </div>

                        <DsTextField
                            title=""
                            value={userValue}
                            onChange={(event?: ChangeEvent<HTMLInputElement>) =>
                                handleInputChange(hostName, 'userName', event?.target?.value || '')
                            }
                            isDisabled={actionsDisabled}
                            onBlur={() => handleBlur(hostName, 'user')}
                            className={styles.textFieldStyleBulk}
                            {...(userTouched && userValue.length === 0
                                ? {
                                      message: {
                                          type: 'error',
                                          value: t('databases.general.action-required') || ''
                                      }
                                  }
                                : {})}
                            placeholder={getUsernamePlaceholder()}
                        />

                        <DsTextField
                            title=""
                            value={passValue}
                            isPassword
                            onChange={(event?: ChangeEvent<HTMLInputElement>) =>
                                handleInputChange(hostName, 'password', event?.target?.value || '')
                            }
                            isDisabled={actionsDisabled}
                            onBlur={() => handleBlur(hostName, 'pass')}
                            className={styles.textFieldStyleBulk}
                            {...(passTouched && passValue.length === 0
                                ? {
                                      message: {
                                          type: 'error',
                                          value: t('databases.general.action-required') || ''
                                      }
                                  }
                                : {})}
                            placeholder={t('databases.general.enter-password')}
                        />

                        <Cross
                            className={`${styles.crossIcon} ${
                                selectedRowsForExploreSavingsEBSBulk.length === 1 ? styles.crossDisabled : ''
                            }`}
                            onClick={() => handleRemoveRow(row.id)}
                        />
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className={styles.authDialog}>
            {rowsToRender.length === selectedRowsForExploreSavingsEBSBulk.length && (
                <DsTypography variant="Regular_14">
                    To explore potential savings, authentication is required for all databases
                </DsTypography>
            )}

            {rowsToRender.length < selectedRowsForExploreSavingsEBSBulk.length && (
                <>
                    <DsTypography variant="Regular_14">
                        To explore potential savings, authentication is required. Out of the{' '}
                        {selectedRowsForExploreSavingsEBSBulk.length} selected databases,{' '}
                        {selectedRowsForExploreSavingsEBSBulk.length - rowsToRender.length} are already authenticated.
                    </DsTypography>
                    <DsTypography variant="Regular_14">
                        Please provide credentials for the remaining {rowsToRender.length} databases to complete the
                        authentication process.
                    </DsTypography>
                </>
            )}

            <div className={styles.radioContainer}>
                <DsTypography variant="Semibold_14">{t('databases.explore-savings.select-auth-mode')}</DsTypography>
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
            <div className={styles.textFieldContainer}>{authInputFields()}</div>
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

export default AuthBulkDialog;
