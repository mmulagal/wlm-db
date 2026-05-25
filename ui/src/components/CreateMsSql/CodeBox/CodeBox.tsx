import { Typography, useDialog, Popover, Button, DsTooltipInfo } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { useState, useRef, useEffect, useMemo } from 'react';
import { uniq, isEqual } from 'lodash';
import { useDispatch } from 'react-redux';
import styles from './CodeBox.module.scss';
import { ReactComponent as Copy } from '../../../assets/copyBlackBackground.svg';
import { ReactComponent as Download } from '../../../assets/downloadBlackBackground.svg';

import { CODE_VIEWER, GENERAL } from '../../../utils/appConstants';
import { TemplateRes } from '../../../utils/types/databaseHomeTypes';
import {
    cfDownloadName,
    generateOptionType,
    getCredDetails,
    handleDownloadTerraform,
    handleDownloadYAML
} from '../../../utils/utilityFunctions';

import { resetChecksAfterLoad } from '../Configuration/LoadConfiguration';
import { getBaseUrl, useGetTemplatesMutation, useGetTerraformSetupMutation } from '../../../utils/apiService';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import {
    AWS_CLI_HIGHLIGHT_STRINGS,
    CRED_PLACEHOLDERS,
    CURL_REQ_TEMPLATE,
    DEPLOY_ENDPOINT,
    UI_IDS
} from '../../../utils/consts';

import { createMssqlPayload } from '../MSSqlServer/MSSqlFooter/createSqlServer';

import { useAppSelector } from '../../../store/storeHooks';
import LoadingCodeBox from '../../../common/LoadingCodebox/LoadingCodebox';
import {
    setMaskedPassword,
    addEscapeInCli,
    maskAwsCli
} from '../../../workloadFactory/DatabaseHomePage/Sidebar/CodeboxUtility';
import CodeBoxColor from '../../../common/CodeBoxColor/CodeBoxColor';
import NoDataCodeBox from '../../../common/NoDataCodebox/NoDataCodebox';
import ThemeProvider from '../../../common/ThemeProvider/ThemeProvider';
import SyntaxHighlighter from '../../../common/hooks/SyntaxHighlighter';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import CodeBoxHeading from '../../../common/CodeBoxHeading/CodeBoxHeading';
import CodeBoxScroll from '../../../common/CodeBoxScroll/CodeBoxScroll';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import TerraformColor from '../Terraform/TerraformColor';
import { downloadTerraformZip } from '../MockTerraformZip/MockTerraformZip';
import CopyToClipboardCommon from '../../../common/CopyToClipboard/copyToClipboard';
import HighlightText from '../../../common/HighlightText/HighlightText';

const CodeBox = () => {
    const [copyText, setCopyText] = useState('');
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);
    const [isRightPanelTemplateLoading, setIsRightPanelTemplateLoading] = useState(false);

    const [rightPanelTemplateResponse, setRightPanelTemplateResponse] = useState<TemplateRes | null>(null);
    const [terraformSetupResponse, setTerraformSetupResponse] = useState<any>(null);
    const [formData, setFormData] = useState<any>(null); // Saving form data on template API call
    const [formDataTerraform, setFormDataTerraform] = useState<any>(null); // Saving form data on terraform setup API call
    const [isRightPanelDataLoading, setIsRightPanelDataLoading] = useState(false);
    const [isTerraformDataLoading, setIsTerraformDataLoading] = useState(false);
    const [rightPanelResponse, setRightPanelResponse] = useState<any>('');
    const [rightPanelMaskedResponse, setRightPanelMaskedResponse] = useState<any>('');

    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();

    const [loadTemplateData] = useGetTemplatesMutation();
    const [loadTerraformData] = useGetTerraformSetupMutation();

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const refetchApiCount = useAppSelector(state => state.msSqlAction.refetchApiCount);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const selectedDBName = useAppSelector(state => state.mssqlForm.dbName);
    const { isWorkloadFactory, isGovAccount } = useAppSelector(state => state?.auth);

    useEffect(() => {
        if (isLoadConfig) {
            if (
                refetchApiCount?.isLoading &&
                (refetchApiCount?.expected.length === 0 ||
                    uniq(refetchApiCount?.ran).length === uniq(refetchApiCount?.expected).length)
            ) {
                resetChecksAfterLoad(dispatch, closeDialog);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoadConfig, refetchApiCount]);

    const copyRef = useRef<HTMLDivElement>(null);

    const mssqlFormData = useAppSelector(state => state.mssqlForm);

    const handleClick = (e: any) => {
        if (copyRef && copyRef.current && !copyRef.current.contains(e.target) && e.target.tagName !== 'LI') {
            setCopyText('');
        }
    };

    useEffect(() => {
        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('click', handleClick);
        };
    });

    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = [CODE_VIEWER.CLOUDFORMATION, CODE_VIEWER.AWS_CLI, CODE_VIEWER.REST_API, CODE_VIEWER.TERRAFORM];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    const setDisplayedDataInCodeBox = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return isRightPanelTemplateLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_CLOUD_FORMATION} />
            ) : rightPanelTemplateResponse?.template ? (
                <ThemeProvider theme="dark" isRoot={false}>
                    {/* @ts-ignore */}
                    <SyntaxHighlighter wrapLongLines language="yaml">
                        {rightPanelTemplateResponse?.template}
                    </SyntaxHighlighter>
                </ThemeProvider>
            ) : (
                <NoDataCodeBox text={CODE_VIEWER.NO_DATA_MSG} />
            );
        }
        if (dropDownValue === CODE_VIEWER.REST_API) {
            // Getting saved config data using API
            const actualData = mssqlFormData;
            // To get accountid, credid and region from saved config
            const credDetails = getCredDetails(actualData);
            return isRightPanelDataLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_REST_API} />
            ) : (
                <>
                    <CodeBoxColor
                        credID={credDetails.credId}
                        region={credDetails.region}
                        actualData={rightPanelMaskedResponse}
                        endpoint={DEPLOY_ENDPOINT}
                    />
                    {/* <pre className={styles.colorAutomation}>
                        {rightPanelMaskedResponse}
                    </pre> */}
                </>
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
                        <HighlightText
                            text={maskAwsCli(rightPanelTemplateResponse?.cliCommand)}
                            searchWords={AWS_CLI_HIGHLIGHT_STRINGS}
                        />
                    ) : (
                        <NoDataCodeBox text={CODE_VIEWER.NO_DATA_MSG} />
                    )}
                </Typography>
            );
        }
        if (dropDownValue === CODE_VIEWER.TERRAFORM) {
            return isTerraformDataLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_TERRAFORM} />
            ) : (
                <TerraformColor data={terraformSetupResponse} />
            );
        }
    };

    // To copy response based on dropdown selection
    const copyResponseData = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return rightPanelTemplateResponse?.template;
        }
        if (dropDownValue === CODE_VIEWER.REST_API) {
            console.log(rightPanelMaskedResponse);
            return rightPanelResponse;
        }
        if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return rightPanelTemplateResponse?.cliCommand;
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

    // This will call template API to get CloudFormation and AWS CLI response for current payload.
    const getTemplateResponse = (redirect = false) => {
        setIsRightPanelTemplateLoading(true);
        // Current form data
        const actualData = mssqlFormData;
        // To get accountid, credid and region from provided data
        const credDetails = getCredDetails(actualData);
        const changeObjectForm = {
            mssqlForm: actualData,
            auth: { isGovAccount }
        };
        const resBody = createMssqlPayload(changeObjectForm);
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

    // This will call terraform setup API to get Terraform response for current payload.
    const getTerraformSetupResponse = () => {
        setIsTerraformDataLoading(true);
        const actualData = mssqlFormData;
        const credDetails = getCredDetails(actualData);
        const changeObjectForm = {
            mssqlForm: actualData,
            auth: { isGovAccount }
        };
        const resBody = createMssqlPayload(changeObjectForm);
        if (credDetails?.credId) {
            resBody.credentialsId = credDetails?.credId;
        }
        if (credDetails?.region) {
            resBody.region = credDetails?.region;
        }
        if (changeObjectForm?.mssqlForm?.encryption?.selectedRow?.[0]?.arn) {
            resBody.fsxConfiguration.encryptionKey = changeObjectForm.mssqlForm.encryption.selectedRow[0].arn;
        }
        loadTerraformData({ payload: resBody }).then((data: any) => {
            if (data?.data) {
                setTerraformSetupResponse(data?.data);
                setIsTerraformDataLoading(false);
                dispatch(setIsLoading(false));
            } else {
                setTerraformSetupResponse(null);
                setIsTerraformDataLoading(false);
                dispatch(setIsLoading(false));
            }
        });
    };

    // After form update if user clicks on CF or CLI than get template data
    useEffect(() => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION || dropDownValue === CODE_VIEWER.AWS_CLI) {
            // If user is switching between CF and CLI than no need to call template APi again
            if (!formData || !isEqual(mssqlFormData, formData)) {
                setFormData(mssqlFormData);
                getTemplateResponse();
            }
        }
        if (dropDownValue === CODE_VIEWER.TERRAFORM && !isDemoMode) {
            if (!formDataTerraform || !isEqual(mssqlFormData, formDataTerraform)) {
                setFormDataTerraform(mssqlFormData);
                getTerraformSetupResponse();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dropDownValue]);

    // After form update if user clicks on CF or CLI than get template data
    useEffect(() => {
        // For demo mode will not reset codebox option so it will call APIs again
        if (isDemoMode) {
            if (dropDownValue === CODE_VIEWER.CLOUDFORMATION || dropDownValue === CODE_VIEWER.AWS_CLI) {
                // If user is switching between CF and CLI than no need to call template APi again
                if (!formData || !isEqual(mssqlFormData, formData)) {
                    setFormData(mssqlFormData);
                    getTemplateResponse();
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mssqlFormData]);

    // This will get get for Rest API section. After getting rest API it will call template API to get CF and AWS CLI response.
    const getRestResponse = () => {
        setIsRightPanelDataLoading(true);
        const baseUrl = getBaseUrl();

        // Getting saved config data using API
        const actualData = mssqlFormData;
        // To get accountid, credid and region from saved config
        const credDetails = getCredDetails(actualData);
        const changeObjectForm = {
            mssqlForm: actualData,
            auth: { isGovAccount }
        };
        const resBody = createMssqlPayload(changeObjectForm);
        const res = JSON.stringify(resBody, null, 2);

        // @ts-ignore
        setRightPanelResponse(
            CURL_REQ_TEMPLATE(
                baseUrl,
                credDetails.credId || CRED_PLACEHOLDERS.CRED_ID,
                credDetails.region || CRED_PLACEHOLDERS.REGION,
                CRED_PLACEHOLDERS.TOKEN,
                res,
                isWorkloadFactory
            )
        );
        getMaskedRestResponse(actualData, credDetails, baseUrl);
        setIsRightPanelDataLoading(false);
    };

    // This will set masked data
    const getMaskedRestResponse = (actualData: any, credDetails: any, baseUrl: string) => {
        const changeObjectForm = {
            mssqlForm: setMaskedPassword(actualData),
            auth: { isGovAccount }
        };
        const resBody = createMssqlPayload(changeObjectForm);

        // @ts-ignore
        setRightPanelMaskedResponse(resBody);
    };

    useEffect(() => {
        getRestResponse();
        // For demo mode will not reset codebox option so it will call APIs again
        if (!isDemoMode) {
            // Reset dropdown value to Rest API in case of form change
            setDropdownValue(CODE_VIEWER.REST_API);
            setFormData(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mssqlFormData]);

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
        } else if (!formData || !isEqual(mssqlFormData, formData)) {
            // If form changed so template API will get called again to get latest CF url
            dispatch(setIsLoading(true));
            setFormData(mssqlFormData);
            getTemplateResponse(true);
        } else {
            // If data is already stored
            if (rightPanelTemplateResponse?.url) {
                window.open(rightPanelTemplateResponse?.url, '_blank', 'noopener');
            }
        }
    };

    const setCssId = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return UI_IDS.WIZARD_CODEBOX_CF;
        }
        if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return UI_IDS.WIZARD_CODEBOX_AWS_CLI;
        }
        if (dropDownValue === CODE_VIEWER.REST_API) {
            return UI_IDS.WIZARD_CODEBOX_REST_API;
        }
        if (dropDownValue === CODE_VIEWER.TERRAFORM) {
            return UI_IDS.WIZARD_CODEBOX_TF;
        }
    };

    return (
        <div className={styles.codebox}>
            <CodeBoxHeading />
            <div className={styles.createDbHeader}>
                <Typography variant="Regular_16" className={styles.createDBText}>
                    {CODE_VIEWER.CREATE_DATABASE}
                </Typography>

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
                        <Typography
                            className={styles.codeboxHeader}
                            variant="Regular_14"
                            style={{ color: 'var(--white)' }}
                        >
                            {dropDownValue}
                            {dropDownValue === GENERAL.TERRAFORM && (
                                <DsTooltipInfo className={styles['tooltip-icon']} trigger="hover">
                                    {GENERAL.TERRAFORM_CODEBOX_TOOLTIP}
                                </DsTooltipInfo>
                            )}
                        </Typography>
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
                            {dropDownValue === CODE_VIEWER.TERRAFORM &&
                                (isTerraformDataLoading ? (
                                    <div className={styles.menuItemDisabled}>
                                        <Download />
                                    </div>
                                ) : (
                                    <div id="codebox-terraform-download">
                                        <Download
                                            onClick={() => {
                                                if (isDemoMode) {
                                                    downloadTerraformZip(
                                                        mssqlFormData?.dbDeploymentModel?.value,
                                                        'mssql'
                                                    );
                                                } else {
                                                    handleDownloadTerraform(terraformSetupResponse?.url);
                                                }
                                                dispatch(clearNotifications());
                                                const ele = (
                                                    <div>
                                                        <div style={{ fontWeight: 400 }}>
                                                            {GENERAL.TERRAFORM_DOWNLOAD}
                                                        </div>
                                                        <div style={{ fontWeight: 400 }}>
                                                            {GENERAL.TERRAFORM_NOTICE}
                                                        </div>
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
                                    </div>
                                ))}
                            {dropDownValue !== CODE_VIEWER.TERRAFORM &&
                                (dropDownValue !== CODE_VIEWER.REST_API && isRightPanelTemplateLoading ? (
                                    // Disabled copy button
                                    <div className={styles.menuItemDisabled}>
                                        <Copy />
                                    </div>
                                ) : (
                                    // Enabled copy button
                                    <Popover
                                        popoverClass={styles['copy-popover']}
                                        children={CODE_VIEWER.COPIED_TO_CLIPBOARD}
                                        container={
                                            <CopyToClipboardCommon
                                                tooltipTitle="Copied to clipboard"
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

                {/* Cloud formation button — hidden for GovCloud (Quick Create URL uses commercial console) */}
                {!isGovAccount &&
                    dropDownValue === CODE_VIEWER.CLOUDFORMATION &&
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

                <CodeBoxScroll dropDownValue={dropDownValue} setDisplayedDataInCodeBox={setDisplayedDataInCodeBox()} />
            </div>
        </div>
    );
};

export default CodeBox;
