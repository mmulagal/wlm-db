import styles from './CodeBox.module.scss';
import { ReactComponent as VectorIcon } from '../../../assets/vector-icon.svg';
import { ReactComponent as UploadIcon } from '../../../assets/upload-icon.svg';
import { ReactComponent as DownloadIcon } from '../../../assets/download-icon.svg';
import { SearchInput, Typography, useDialog } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { CODE_VIEWER, GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { useState, useRef, useEffect, useMemo } from 'react';
import HighlighterWord from '../../../workloadFactory/DatabaseHomePage/Highlighter/Highlighter';
import { TemplateRes } from '../../../utils/types/databaseHomeTypes';
import { generateOptionType, getCredDetails } from '../../../utils/utilityFunctions';
import { ReactComponent as ComingSoon } from '../../../assets/TagComingSoon.svg';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import LoadConfig from '../LoadConfig/LoadConfig';
import { LoadConfiguration, SaveConfiguration, resetRefetchApiCheck } from '../Configuration/LoadConfiguration';
import { useDispatch } from 'react-redux';
import {
    getBaseUrl,
    useGetConfigListQuery,
    useGetTemplatesMutation,
    useLazyGetConfigDataQuery,
    useSaveConfigDataMutation
} from '../../../utils/apiService';
import { setIsLoadConfig, setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { CRED_PLACEHOLDERS, CURL_REQ_TEMPLATE, FROM_DIALOG } from '../../../utils/consts';
import SaveConfig from '../SaveConfig/SaveConfig';
import { setSaveConfigName } from '../../../store/mssql/mssqlFormSlice';
import { navigateToCanvas } from '../../../utils/appConfig';
import { createMssqlPayload } from '../MSSqlServer/MSSqlFooter/createSqlServer';
//@ts-ignore
import Highlighter from 'react-highlight-words';
import { useAppSelector } from '../../../store/storeHooks';
import LoadingCodeBox from '../../../common/LoadingCodebox/LoadingCodebox';
import { setMaskedPassword, addEscapeInCli } from '../../../workloadFactory/DatabaseHomePage/Sidebar/CodeboxUtility';
import CodeBoxColor from '../../../common/CodeBoxColor/CodeBoxColor';
const _ = require('lodash');

const CodeBox = () => {
    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [copyText, setCopyText] = useState('');
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);
    const [isRightPanelTemplateLoading, setIsRightPanelTemplateLoading] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [rightPanelTemplateResponse, setRightPanelTemplateResponse] = useState<TemplateRes | null>(null);
    const [formData, setFormData] = useState<any>(null); // Saving form data on template API call
    const [isRightPanelDataLoading, setIsRightPanelDataLoading] = useState(false);
    const [rightPanelResponse, setRightPanelResponse] = useState<any>('');
    const [rightPanelMaskedResponse, setRightPanelMaskedResponse] = useState<any>('');
    const [rightPanelMaskedHidePasswordResponse, setRightPanelMaskedHidePasswordResponse] = useState<any>('');
    const [countWord, setCountWord] = useState(0);

    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();
    const [saveConfigData] = useSaveConfigDataMutation();
    const [loadConfigDataExe] = useLazyGetConfigDataQuery();
    const { refetch: configListRefetch } = useGetConfigListQuery({});
    const [loadTemplateData] = useGetTemplatesMutation();

    const MenuOptions = [
        {
            id: 'copy',
            displayName: CODE_VIEWER.COPY,
            // disable copy for CF till CF template issue gets resolved
            disabled: dropDownValue === CODE_VIEWER.CLOUDFORMATION ? true : false
        },
        { id: 'redirect', displayName: GENERAL.SAVE_FORM_AS_CLOUD }
    ];

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
            ) : (
                <HighlighterWord highlight={searchInput} count={countDetails}>
                    <pre className={styles.colorAutomation}>
                        {rightPanelTemplateResponse?.template || CODE_VIEWER.NO_DATA_MSG}
                    </pre>
                </HighlighterWord>
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
                <HighlighterWord
                    highlight={searchInput}
                    count={countDetails}
                    apiResForSearch={rightPanelMaskedHidePasswordResponse}
                >
                    <CodeBoxColor
                        credID={credDetails.credId}
                        region={credDetails.region}
                        actualData={rightPanelMaskedResponse}
                    />
                    {/* <pre className={styles.colorAutomation}>
                        {rightPanelMaskedResponse}
                    </pre> */}
                </HighlighterWord>
            );
        }
        if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return isRightPanelTemplateLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_AWS_CLI} />
            ) : (
                <HighlighterWord highlight={searchInput} isAWSCli={true} count={countDetails}>
                    <Typography variant="Regular_16" className={`${styles.colorAutomation} ${styles.awsCli}`}>
                        {rightPanelTemplateResponse?.cliCommand || CODE_VIEWER.NO_DATA_MSG}
                    </Typography>
                </HighlighterWord>
            );
        }
    };

    const handleLoadConfiguration = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LOAD_CONFIG_HEADER}
                content={<LoadConfig />}
                primaryButton={GENERAL.LOAD}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    LoadConfiguration(dispatch, loadConfigDataExe, closeDialog);
                }}
                closeCallback={() => {
                    dispatch(setIsLoadConfig(false));
                    resetRefetchApiCheck(dispatch);
                }}
                dialogFrom={FROM_DIALOG.LOAD_CONFIG}
            />
        );
    };

    const handleSaveConfig = (dialogFrom: string) => {
        setDialog(
            <DialogComponent
                header={GENERAL.SAVE_CONFIG_HEADER}
                content={<SaveConfig description={GENERAL.SAVE_CONFIG_CONTENT} />}
                primaryButton={GENERAL.SAVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => SaveConfiguration(dispatch, saveConfigData, configListRefetch, closeDialog, dialogFrom)}
                closeCallback={() => {
                    dispatch(setSaveConfigName(''));
                    if (dialogFrom === FROM_DIALOG.HEADER_CROSS) {
                        navigateToCanvas('/');
                    }
                }}
                dialogFrom={dialogFrom}
            />
        );
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

    const countDetails = (count: any) => {
        setCountWord(count - 1);
    };

    useEffect(() => {
        if (countWord > 0) {
            setTimeout(() => {
                const occurrences = document.querySelectorAll('[class$="highlighted"]');
                const target = occurrences[0];

                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

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

    // "Redirect to CloudFormation" click implementation
    const handleRedirectToCF = () => {
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
    };

    return (
        <div className={styles.codebox}>
            <div className={styles.topBar}>
                <div className={styles.title}>
                    <VectorIcon />
                    <Typography variant="Regular_16" className={styles.colorAutomation}>
                        {CODE_VIEWER.CODEBOX}
                    </Typography>
                </div>
            </div>
            <div className={styles.createDbHeader}>
                <Typography variant="Regular_16" className={styles.createDBText}>
                    {CODE_VIEWER.CREATE_DATABASE}
                </Typography>
                <div className={styles.configActions} onClick={() => handleSaveConfig(FROM_DIALOG.SAVE_CONFIG)}>
                    <UploadIcon />
                    <Typography variant="Semibold_14" className={styles.configText}>
                        {SELECT_CONFIG.SAVE_CONFIG}
                    </Typography>
                </div>
                {configData && configData.length > 0 && 
                    <div className={styles.configActions} onClick={() => handleLoadConfiguration()}>
                        <DownloadIcon />
                        <Typography variant="Semibold_14" className={styles.configText}>
                            {SELECT_CONFIG.LOAD_CONFIG}
                        </Typography>
                    </div>
                }
                {!configData || configData.length === 0 && 
                    <div className={styles.configActionsDisabled}>
                        <DownloadIcon />
                        <Typography variant="Semibold_14" className={styles.configText}>
                            {SELECT_CONFIG.LOAD_CONFIG}
                        </Typography>
                    </div>
                }
                
                <div className={styles.menuContainer}>
                    <MenuPopover
                        isMenuOpen={isMenuOpen}
                        menuItems={MenuOptions}
                        toggleMenu={(toggleType: string, menuId: string) => {
                            if (toggleType === 'close') {
                                setIsMenuOpen(false);
                            } else if (toggleType === 'open') {
                                setIsMenuOpen(true);
                            } else if (toggleType === 'selectedOption') {
                                setIsMenuOpen(false);
                                if (menuId === 'copy') {
                                    navigator.clipboard.writeText(copyResponseData());
                                    setCopyText(`${dropDownValue} copied`);
                                } else if (menuId === 'redirect') {
                                    handleRedirectToCF();
                                }
                            }
                        }}
                        customColor="#84B0FF"
                        isBlackLayout={true}
                    />
                    {copyText && (
                        <div ref={copyRef} className={styles.copyContainer}>
                            <Typography variant="Regular_13" className={styles.copyText}>
                                {copyText}
                            </Typography>
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.payloadContainer}>
                <div className={styles.payloadHeader}>
                    <div className={styles.inputPart}>
                        <Typography variant="Regular_14" style={{ color: 'var(--white)' }}>
                            {CODE_VIEWER.SHOW_CODE_AS}
                        </Typography>
                        <div className={styles.inputBox} style={{ color: 'var(--white)' }}>
                            <SelectField
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
                    <div className={styles.searchPart}>
                        <SearchInput onChange={e => setSearchInput(e)} className={styles.searchInput} />
                    </div>
                </div>
                <div className={styles.payloadBody}>
                    <div className={styles.scrollContainer}>
                        <Typography variant="Regular_14" style={{ color: 'var(--white)' }}>
                            {setDisplayedDataInCodeBox()}
                        </Typography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeBox;
