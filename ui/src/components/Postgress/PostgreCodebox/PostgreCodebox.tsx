import { Button, DsTypography, Popover, Typography, useDialog } from '@netapp/design-system';
import CodeBoxHeading from '../../../common/CodeBoxHeading/CodeBoxHeading';
import styles from './PostgreCodebox.module.scss';
import { ReactComponent as Copy } from '../../../assets/copyBlackBackground.svg';
import { ReactComponent as Download } from '../../../assets/downloadBlackBackground.svg';
import { ReactComponent as ComingSoon } from '../../../assets/ComingSoon.svg';
import CodeBoxScroll from '../../../common/CodeBoxScroll/CodeBoxScroll';

import { useEffect, useMemo, useState } from 'react';
import { CODE_VIEWER, GENERAL } from '../../../utils/appConstants';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import {
    cfDownloadName,
    generateOptionType,
    getCredDetails,
    handleDownloadYAML
} from '../../../utils/utilityFunctions';
import {
    AWS_CLI_HIGHLIGHT_STRINGS,
    PGSQL_CURL_REQ_TEMPLATE,
    CRED_PLACEHOLDERS,
    DEPLOY_ENDPOINT,
    UI_IDS
} from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import LoadingCodeBox from '../../../common/LoadingCodebox/LoadingCodebox';
import CodeBoxColor from '../../../common/CodeBoxColor/CodeBoxColor';
import {
    addEscapeInCli,
    maskAwsCli,
    setMaskedPassword
} from '../../../workloadFactory/DatabaseHomePage/Sidebar/CodeboxUtility';
import { createPgsqlPayload } from '../PostgreUtils';
import { getBaseUrl, useGetPgsqlTemplatesMutation } from '../../../utils/apiService';
import { TemplateRes } from '../../../utils/types/databaseHomeTypes';
import SyntaxHighlighter from '../../../common/hooks/SyntaxHighlighter';
import NoDataCodeBox from '../../../common/NoDataCodebox/NoDataCodebox';
import ThemeProvider from '../../../common/ThemeProvider/ThemeProvider';
import { useDispatch } from 'react-redux';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { isEqual } from 'lodash';
import CopyToClipboardCommon from '../../../common/CopyToClipboard/copyToClipboard';
import HighlightText from '../../../common/HighlightText/HighlightText';

const PostgreCodebox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);
    const [rightPanelMaskedResponse, setRightPanelMaskedResponse] = useState<any>('');
    const [formData, setFormData] = useState<any>(null); // Saving form data on template API call
    const [isRightPanelTemplateLoading, setIsRightPanelTemplateLoading] = useState(false);
    const [rightPanelTemplateResponse, setRightPanelTemplateResponse] = useState<TemplateRes | null>(null);

    const selectedCredId = useAppSelector(state => state.headers.headerSelectedCred);
    const selectedRegionCode = useAppSelector(state => state.headers.headerSelectedRegion);

    const mssqlFormData = useAppSelector(state => state.mssqlForm);
    const pgsqlFormData = useAppSelector(state => state.postgreForm);
    const selectedDBName = useAppSelector(state => state.postgreForm.postgreServerName);
    const { isWorkloadFactory, isDemoMode } = useAppSelector(state => state?.auth);

    const [loadTemplateData] = useGetPgsqlTemplatesMutation();
    const dispatch = useDispatch();
    const { setDialog } = useDialog();

    const terraformUI = () => {
        return (
            <div className={styles.terraformContainer}>
                <div>{GENERAL.TERRAFORM}</div>
                <div>
                    <ComingSoon />
                </div>
            </div>
        );
    };

    //Function to generate the options for Select Field for License
    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = [CODE_VIEWER.CLOUDFORMATION, CODE_VIEWER.AWS_CLI, CODE_VIEWER.REST_API, terraformUI()];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', idx === 3, '');
            options.push(option);
        });
        return options;
    }, []);

    const openDemoInfoDialog = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.DEMO_TITLE}
                content={<Typography variant="Regular_14">{`${GENERAL.DEMO_CONTENT}`}</Typography>}
                primaryButton={GENERAL.CONTINUE}
                callback={() => {}}
            />
        );
    };

    // "Redirect to CloudFormation" click implementation
    const handleRedirectToCF = () => {
        if (isDemoMode) {
            openDemoInfoDialog();
        } else {
            const updatedFormData = { mssqlFormData, pgsqlFormData };
            if (!formData || !isEqual(updatedFormData, formData)) {
                // If form changed so template API will get called again to get latest CF url
                dispatch(setIsLoading(true));
                setFormData(updatedFormData);
                getTemplateResponse(true);
            } else {
                // If data is already stored
                if (rightPanelTemplateResponse?.url) {
                    window.open(rightPanelTemplateResponse?.url, '_blank', 'noopener');
                }
            }
        }
    };

    const setCssId = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return UI_IDS.WIZARD_CODEBOX_CF;
        } else if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return UI_IDS.WIZARD_CODEBOX_AWS_CLI;
        } else if (dropDownValue === CODE_VIEWER.REST_API) {
            return UI_IDS.WIZARD_CODEBOX_REST_API;
        } else if (dropDownValue === CODE_VIEWER.TERRAFORM) {
            return UI_IDS.WIZARD_CODEBOX_TF;
        }
    };

    // After form update if user clicks on CF or CLI than get template data
    useEffect(() => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION || dropDownValue === CODE_VIEWER.AWS_CLI) {
            // If user is switching between CF and CLI than no need to call template APi again
            const updatedFormData = { mssqlFormData, pgsqlFormData };
            if (!formData || !isEqual(updatedFormData, formData)) {
                setFormData(updatedFormData);
                getTemplateResponse();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dropDownValue]);

    useEffect(() => {
        getMaskedRestResponse(mssqlFormData, pgsqlFormData);
        setDropdownValue(CODE_VIEWER.REST_API);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mssqlFormData, pgsqlFormData]);

    // This will set masked data
    const getMaskedRestResponse = (actualData: any, pgsqlFormData: any) => {
        const changeObjectForm = {
            mssqlForm: setMaskedPassword(actualData),
            postgreForm: setMaskedPassword(pgsqlFormData)
        };
        const resBody = createPgsqlPayload(changeObjectForm);
        //@ts-ignore
        setRightPanelMaskedResponse(resBody);
    };

    // This will call template API to get CloudFormation and AWS CLI response for current payload.
    const getTemplateResponse = (redirect = false) => {
        setIsRightPanelTemplateLoading(true);
        const credDetails = getCredDetails(mssqlFormData);
        const changeObjectForm = {
            mssqlForm: mssqlFormData,
            postgreForm: pgsqlFormData
        };
        const resBody: any = createPgsqlPayload(changeObjectForm);
        if (credDetails?.credId) {
            resBody.credentialsId = credDetails?.credId;
        }
        if (credDetails?.region) {
            resBody.region = credDetails?.region;
        }
        loadTemplateData({ payload: resBody }).then((data: any) => {
            if (data?.data) {
                setRightPanelTemplateResponse(addEscapeInCli(data?.data));
                setIsRightPanelTemplateLoading(false);
                dispatch(setIsLoading(false));
                // Redirect if clicked on Redirect to CloudFormation
                if (redirect) {
                    if (data?.data?.url) {
                        window.open(data?.data?.url, '_blank', 'noopener');
                    }
                }
            } else {
                setRightPanelTemplateResponse(null);
                setIsRightPanelTemplateLoading(false);
                dispatch(setIsLoading(false));
            }
        });
    };

    const copyResponseData = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return rightPanelTemplateResponse?.template;
        } else if (dropDownValue === CODE_VIEWER.REST_API) {
            const baseUrl = getBaseUrl();
            const rightPanelResponse = createPgsqlPayload({ mssqlForm: mssqlFormData, postgreForm: pgsqlFormData });
            const restApiPayload = PGSQL_CURL_REQ_TEMPLATE(
                baseUrl,
                selectedCredId?.data?.credentialsId || CRED_PLACEHOLDERS.CRED_ID,
                selectedRegionCode?.data?.regionCode || CRED_PLACEHOLDERS.REGION,
                CRED_PLACEHOLDERS.TOKEN,
                JSON.stringify(rightPanelResponse, null, 2),
                isWorkloadFactory
            );
            return restApiPayload;
        } else if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return rightPanelTemplateResponse?.cliCommand;
        }
    };

    const setDisplayedDataInCodeBox = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return isRightPanelTemplateLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_CLOUD_FORMATION} />
            ) : rightPanelTemplateResponse?.template ? (
                <ThemeProvider theme={'dark'} isRoot={false}>
                    {/* @ts-ignore */}
                    <SyntaxHighlighter wrapLongLines={true} language="yaml">
                        {rightPanelTemplateResponse?.template}
                    </SyntaxHighlighter>
                </ThemeProvider>
            ) : (
                <NoDataCodeBox text={CODE_VIEWER.NO_DATA_MSG} />
            );
        }
        if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return isRightPanelTemplateLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_AWS_CLI} />
            ) : (
                <Typography
                    variant="Regular_14"
                    className={`${styles.colorAutomation} ${styles.awsCli} ${styles.newClass}`}
                >
                    {rightPanelTemplateResponse?.cliCommand ? (
                        <>
                            <HighlightText
                                text={maskAwsCli(rightPanelTemplateResponse?.cliCommand)}
                                searchWords={AWS_CLI_HIGHLIGHT_STRINGS}
                            />
                        </>
                    ) : (
                        <NoDataCodeBox text={CODE_VIEWER.NO_DATA_MSG} />
                    )}
                </Typography>
            );
        }
        if (dropDownValue === CODE_VIEWER.REST_API) {
            const actualData = mssqlFormData;
            // To get accountid, credid and region from saved config
            const credDetails = getCredDetails(actualData);
            return false ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_REST_API} />
            ) : (
                <>
                    <CodeBoxColor
                        credID={credDetails.credId}
                        region={credDetails.region}
                        actualData={rightPanelMaskedResponse}
                        endpoint={DEPLOY_ENDPOINT}
                        dbType="pgsql"
                    />
                </>
            );
        }
    };

    const handleCopy = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            dispatch(clearNotifications());
            const ele = (
                <div>
                    <div style={{ fontWeight: 400 }}>{GENERAL.CF_COPIED}</div>
                    <div style={{ fontWeight: 400 }}>{GENERAL.CF_NOTICE}</div>
                </div>
            );
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: ele
                })
            );
        }
    };

    return (
        <div className={styles.postgreCodebox}>
            <div className={styles.createNewUserCodeBox}>
                <CodeBoxHeading />
                <div className={styles.createDbHeader}>
                    <DsTypography variant="Regular_16" className={styles.createDBText}>
                        PostgreSQL
                    </DsTypography>

                    <div className={styles.inputBox} style={{ color: 'var(--white)' }}>
                        <SelectField
                            id={setCssId()}
                            isClearable={false}
                            value={generateOptionType(dropDownValue, dropDownValue, '', false, '')}
                            onChange={(selectedOptions: any): void => {
                                setDropdownValue(selectedOptions?.value);
                            }}
                            isSearchable={false}
                            variant="underline"
                            options={generateCLIOptions}
                            defaultValue={[generateCLIOptions[2]]}
                        />
                    </div>
                </div>

                <div className={styles.payloadContainer}>
                    <div className={styles.payloadHeader}>
                        <div className={styles.inputPart}>
                            <DsTypography variant="Regular_14" style={{ color: 'var(--white)' }}>
                                {dropDownValue}
                            </DsTypography>
                        </div>
                        <div className={styles.actionPopOver}>
                            <div className={styles.actions}>
                                {dropDownValue === CODE_VIEWER.CLOUDFORMATION &&
                                    (isRightPanelTemplateLoading ? (
                                        <div className={styles.menuItemDisabled}>
                                            <Download />
                                        </div>
                                    ) : (
                                        <Download
                                            onClick={() => {
                                                handleDownloadYAML(
                                                    rightPanelTemplateResponse?.template,
                                                    cfDownloadName(selectedDBName)
                                                );
                                                dispatch(clearNotifications());
                                                const ele = (
                                                    <div>
                                                        <div style={{ fontWeight: 400 }}>{GENERAL.CF_DOWNLOAD}</div>
                                                        <div style={{ fontWeight: 400 }}>{GENERAL.CF_NOTICE}</div>
                                                    </div>
                                                );
                                                dispatch(
                                                    addNotification({
                                                        notificationType: NOTIFICATION_TYPES.INFO,
                                                        message: ele
                                                    })
                                                );
                                            }}
                                        />
                                    ))}
                                {dropDownValue !== CODE_VIEWER.TERRAFORM &&
                                    (dropDownValue !== CODE_VIEWER.REST_API && isRightPanelTemplateLoading ? (
                                        <div className={styles.menuItemDisabled}>
                                            <Copy />
                                        </div>
                                    ) : (
                                        <Popover
                                            popoverClass={styles['copy-popover']}
                                            children={CODE_VIEWER.COPIED_TO_CLIPBOARD}
                                            container={
                                                <CopyToClipboardCommon
                                                    value={copyResponseData()}
                                                    iconProvided={
                                                        <div
                                                            className={styles.menuItem}
                                                            id={UI_IDS.WIZARD_CODEBOX_COPY}
                                                            onClick={handleCopy}
                                                        >
                                                            <Copy />
                                                        </div>
                                                    }
                                                />
                                            }
                                        />
                                    ))}
                            </div>
                        </div>
                    </div>

                    {dropDownValue === CODE_VIEWER.CLOUDFORMATION &&
                        !isRightPanelTemplateLoading &&
                        rightPanelTemplateResponse?.template && (
                            <div className={styles.cloudFormationButtonContainer}>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleRedirectToCF()}
                                    id={UI_IDS.WIZARD_REDIRECT_TO_CF}
                                >
                                    {GENERAL.SAVE_FORM_AS_CLOUD}
                                </Button>
                            </div>
                        )}

                    <CodeBoxScroll
                        dropDownValue={dropDownValue}
                        setDisplayedDataInCodeBox={setDisplayedDataInCodeBox()}
                    />
                </div>
            </div>
        </div>
    );
};

export default PostgreCodebox;
