import styles from './CodeBox.module.scss';
import { ReactComponent as Copy } from '../../../assets/copyBlackBackground.svg';
import { ReactComponent as Download } from '../../../assets/downloadBlackBackground.svg';

import { Typography, useDialog, Popover, Button } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { CODE_VIEWER, GENERAL } from '../../../utils/appConstants';
import { useState, useRef, useEffect, useMemo } from 'react';
import HighlighterWord from '../../../workloadFactory/DatabaseHomePage/Highlighter/Highlighter';
import { TemplateRes } from '../../../utils/types/databaseHomeTypes';
import {
    cfDownloadName,
    generateOptionType,
    getCredDetails,
    handleDownloadYAML
} from '../../../utils/utilityFunctions';
import { ReactComponent as ComingSoon } from '../../../assets/ComingSoon.svg';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';

import { resetChecksAfterLoad } from '../Configuration/LoadConfiguration';
import { useDispatch } from 'react-redux';
import { getBaseUrl, useGetTemplatesMutation } from '../../../utils/apiService';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import {
    AWS_CLI_HIGHLIGHT_STRINGS,
    CRED_PLACEHOLDERS,
    CURL_REQ_TEMPLATE,
    DEPLOY_ENDPOINT,
    UI_IDS
} from '../../../utils/consts';

import { createMssqlPayload } from '../MSSqlServer/MSSqlFooter/createSqlServer';
//@ts-ignore
import Highlighter from 'react-highlight-words';
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

const _ = require('lodash');

const CodeBox = () => {
    const [copyText, setCopyText] = useState('');
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);
    const [isRightPanelTemplateLoading, setIsRightPanelTemplateLoading] = useState(false);

    const [rightPanelTemplateResponse, setRightPanelTemplateResponse] = useState<TemplateRes | null>(null);
    const [formData, setFormData] = useState<any>(null); // Saving form data on template API call
    const [isRightPanelDataLoading, setIsRightPanelDataLoading] = useState(false);
    const [rightPanelResponse, setRightPanelResponse] = useState<any>('');
    const [rightPanelMaskedResponse, setRightPanelMaskedResponse] = useState<any>('');
    const [rightPanelMaskedHidePasswordResponse, setRightPanelMaskedHidePasswordResponse] = useState<any>('');

    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();

    const [loadTemplateData] = useGetTemplatesMutation();

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const refetchApiCount = useAppSelector(state => state.msSqlAction.refetchApiCount);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const selectedDBName = useAppSelector(state => state.mssqlForm.dbName);

    useEffect(() => {
        if (isLoadConfig) {
            if (
                refetchApiCount?.isLoading &&
                (refetchApiCount?.expected.length === 0 ||
                    _.uniq(refetchApiCount?.ran).length === _.uniq(refetchApiCount?.expected).length)
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

    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = [CODE_VIEWER.CLOUDFORMATION, CODE_VIEWER.AWS_CLI, CODE_VIEWER.REST_API, terraformUI()];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', idx === 3 ? true : false, '');
            options.push(option);
        });
        return options;
    }, []);

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
                        <Highlighter
                            highlightClassName={styles.awsCliHighlightClass}
                            searchWords={AWS_CLI_HIGHLIGHT_STRINGS}
                            autoEscape={true}
                            textToHighlight={maskAwsCli(rightPanelTemplateResponse?.cliCommand)}
                        />
                    ) : (
                        <NoDataCodeBox text={CODE_VIEWER.NO_DATA_MSG} />
                    )}
                </Typography>
            );
        }
    };

    // To copy response based on dropdown selection
    const copyResponseData = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return rightPanelTemplateResponse?.template;
        } else if (dropDownValue === CODE_VIEWER.REST_API) {
            return rightPanelResponse?.props?.textToHighlight;
        } else if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return rightPanelTemplateResponse?.cliCommand;
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
            mssqlForm: actualData
        };
        const resBody = createMssqlPayload(changeObjectForm);
        resBody.credentialsId = credDetails?.credId || '';
        resBody.region = credDetails?.region || '';
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

    // After form update if user clicks on CF or CLI than get template data
    useEffect(() => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION || dropDownValue === CODE_VIEWER.AWS_CLI) {
            // If user is switching between CF and CLI than no need to call template APi again
            if (!formData || !_.isEqual(mssqlFormData, formData)) {
                setFormData(mssqlFormData);
                getTemplateResponse();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dropDownValue]);

    // This will get get for Rest API section. After getting rest API it will call template API to get CF and AWS CLI response.
    const getRestResponse = () => {
        setIsRightPanelDataLoading(true);
        const baseUrl = getBaseUrl();

        // Getting saved config data using API
        const actualData = mssqlFormData;
        // To get accountid, credid and region from saved config
        const credDetails = getCredDetails(actualData);
        const changeObjectForm = {
            mssqlForm: actualData
        };
        const resBody = createMssqlPayload(changeObjectForm);
        const res = JSON.stringify(resBody, null, 2);
        // To set REST API response as deploy API curl request
        const highlightedString = (
            <Highlighter
                highlightClassName={styles.highlightClass}
                searchWords={[
                    CRED_PLACEHOLDERS.ACCOUNT_ID,
                    CRED_PLACEHOLDERS.CRED_ID,
                    CRED_PLACEHOLDERS.REGION,
                    CRED_PLACEHOLDERS.TOKEN
                ]}
                autoEscape={true}
                textToHighlight={CURL_REQ_TEMPLATE(
                    baseUrl,
                    credDetails.credId || CRED_PLACEHOLDERS.CRED_ID,
                    credDetails.region || CRED_PLACEHOLDERS.REGION,
                    CRED_PLACEHOLDERS.TOKEN,
                    res
                )}
            />
        );
        //@ts-ignore
        setRightPanelResponse(highlightedString);
        getMaskedRestResponse(actualData, credDetails, baseUrl);
        setIsRightPanelDataLoading(false);
    };

    // This will set masked data
    const getMaskedRestResponse = (actualData: any, credDetails: any, baseUrl: string) => {
        const changeObjectForm = {
            mssqlForm: setMaskedPassword(actualData)
        };
        const resBody = createMssqlPayload(changeObjectForm);
        const res = JSON.stringify(resBody, null, 2);
        // To set REST API response as deploy API curl request
        const highlightedString = (
            <Highlighter
                highlightClassName={styles.highlightClass}
                searchWords={[
                    CRED_PLACEHOLDERS.ACCOUNT_ID,
                    CRED_PLACEHOLDERS.CRED_ID,
                    CRED_PLACEHOLDERS.REGION,
                    CRED_PLACEHOLDERS.TOKEN
                ]}
                autoEscape={true}
                textToHighlight={CURL_REQ_TEMPLATE(
                    baseUrl,
                    credDetails.credId || CRED_PLACEHOLDERS.CRED_ID,
                    credDetails.region || CRED_PLACEHOLDERS.REGION,
                    CRED_PLACEHOLDERS.TOKEN,
                    res
                )}
            />
        );
        //@ts-ignore
        setRightPanelMaskedResponse(resBody);
        setRightPanelMaskedHidePasswordResponse(highlightedString);
    };

    useEffect(() => {
        getRestResponse();
        // Reset dropdown value to Rest API in case of form change
        setDropdownValue(CODE_VIEWER.REST_API);
        setFormData(null);
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
        } else {
            if (!formData || !_.isEqual(mssqlFormData, formData)) {
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
        }
    };

    const setCssId = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return UI_IDS.WIZARD_CODEBOX_CF;
        } else if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return UI_IDS.WIZARD_CODEBOX_AWS_CLI;
        } else if (dropDownValue === CODE_VIEWER.REST_API) {
            return UI_IDS.WIZARD_CODEBOX_REST_API;
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
                        <Typography variant="Regular_14" style={{ color: 'var(--white)' }}>
                            {dropDownValue}
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
                                        onClick={() =>
                                            handleDownloadYAML(
                                                rightPanelTemplateResponse?.template,
                                                cfDownloadName(selectedDBName)
                                            )
                                        }
                                    />
                                ))}
                            {dropDownValue !== CODE_VIEWER.REST_API && isRightPanelTemplateLoading ? (
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
                                        <CopyToClipboard text={copyResponseData()}>
                                            <div className={styles.menuItem} id={UI_IDS.WIZARD_CODEBOX_COPY}>
                                                <Copy />
                                            </div>
                                        </CopyToClipboard>
                                    }
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Cloud formation button */}
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

                <CodeBoxScroll dropDownValue={dropDownValue} setDisplayedDataInCodeBox={setDisplayedDataInCodeBox()} />
            </div>
        </div>
    );
};

export default CodeBox;
