import { useState, useEffect, useMemo, useRef } from 'react';
import { Typography, SearchInput, Popover, FlashingDotsLoader, Button, useDialog } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { ReactComponent as ArrowRight } from '../../../assets/ic_arrow_right.svg';
import { ReactComponent as ArrowLeft } from '../../../assets/ic_arrow_left.svg';
import { ReactComponent as Copy } from '../../../assets/copyBlackBackground ❇️.svg';
import { ReactComponent as VectorIcon } from '../../../assets/vector-icon.svg';
import { ReactComponent as ComingSoon } from '../../../assets/ComingSoon.svg';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import HighlighterWord from '../Highlighter/Highlighter';
//@ts-ignore
import Highlighter from 'react-highlight-words';

import styles from './Sidebar.module.scss';
import Accordion from '../Accordion/Accordion';
import {
    cfDownloadName,
    formatDateWithTime,
    generateOptionType,
    getCredDetails,
    handleDownloadYAML,
    setRecommendedValues
} from '../../../utils/utilityFunctions';
import {
    getBaseUrl,
    useGetConfigListQuery,
    useGetTemplatesMutation,
    useLazyGetConfigDataQuery
} from '../../../utils/apiService';
import { createMssqlPayload } from '../../../components/CreateMsSql/MSSqlServer/MSSqlFooter/createSqlServer';
import MenuPopover, { MenuItemType } from '../../../common/MenuPopover/MenuPopover';
import { CODE_VIEWER, GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import {
    LoadConfiguration,
    LoadRecommendedConfig
} from '../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { useNavigate } from 'react-router-dom';
import { setIsLoading, setIsRecommendedInstance } from '../../../store/mssql/msSqlActionSlice';
import {
    RECOMMENDED_TEMPLATES,
    WLF_TO_FORM_NAVIGATE,
    CURL_REQ_TEMPLATE,
    CRED_PLACEHOLDERS,
    CODEBOX_REST_RES,
    AWS_CLI_HIGHLIGHT_STRINGS
} from '../../../utils/consts';
import { initialMssqlState } from '../../../store/mssql/mssqlFormSlice';
import LoadingCodeBox from '../../../common/LoadingCodebox/LoadingCodebox';
import { addEscapeInCli, maskAwsCli, setMaskedPassword } from './CodeboxUtility';
import CodeBoxColor from '../../../common/CodeBoxColor/CodeBoxColor';
import NoDataCodeBox from '../../../common/NoDataCodebox/NoDataCodebox';
import SyntaxHighlighter from '../../../common/hooks/SyntaxHighlighter';
import ThemeProvider from '../../../common/ThemeProvider/ThemeProvider';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { useAppSelector } from '../../../store/storeHooks';

type ConfigType = {
    id?: string;
    name?: string;
    data?: any;
};

const Sidebar = ({ isOpen, onClose }: any) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [openKey, setOpenKey] = useState<string | undefined>();
    const [openedItem, setOpenedItem] = useState<ConfigType>({});
    const [searchInput, setSearchInput] = useState('');
    const [credDetailsData, setCredDetailsData] = useState({});
    const { setDialog } = useDialog();
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);

    //To get configDatalist
    const [configData, setConfigData] = useState<any>([]);
    const [dataToCheck, setDataToCheck] = useState<any>([]);

    // For expanded menu
    const [menuOpenedRow, setOpenedRow] = useState<string | null>(null);
    const menuOpenedRowDetail: any = useRef(null);

    //For selected option from dropdown
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);

    // For selected config REST API response
    const [rightPanelData, setRightPanelData] = useState<any>([]);
    const [isRightPanelDataLoading, setIsRightPanelDataLoading] = useState(false);

    // For selected config CloudFormation and AWS CLI response
    const [rightPanelTemplateResponse, setRightPanelTemplateResponse] = useState<any>([]);
    const [isRightPanelTemplateLoading, setIsRightPanelTemplateLoading] = useState(false);

    const [recommendedData, setRecommendedData] = useState<ConfigType[]>([]);

    const [disableCopy, setDisableCopy] = useState(true);

    //Search Word count
    const [countWord, setCountWord] = useState(0);

    const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
    const [dbName, setDbName] = useState('');

    const [loadConfigDataExe] = useLazyGetConfigDataQuery();
    const [loadTemplateData] = useGetTemplatesMutation();

    useEffect(() => {
        if (dropDownValue === 'CloudFormation') {
            setMenuItems([
                {
                    id: 'loadWizardOption',
                    displayName: CODE_VIEWER.SIDEBAR_LOAD_WIZARD
                },
                {
                    id: 'viewAwsCloudFormation',
                    displayName: CODE_VIEWER.VIEW_IN_AWS_CLOUD_FORMATION,
                    disabled:
                        !getRightPanelTemplateResponse(openKey)?.template || isRightPanelTemplateLoading ? true : false
                },
                {
                    id: 'downloadYaml',
                    displayName: CODE_VIEWER.DOWNLOAD_YAML,
                    disabled: !getRightPanelTemplateResponse(openKey) || isRightPanelTemplateLoading ? true : false
                }
            ]);
        } else {
            setMenuItems([
                {
                    id: 'loadWizardOption',
                    displayName: CODE_VIEWER.SIDEBAR_LOAD_WIZARD
                }
            ]);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRightPanelTemplateLoading, rightPanelTemplateResponse, dropDownValue]);

    const { data: configDataList, isFetching: configLoading, refetch: configRefetch } = useGetConfigListQuery({});

    useEffect(() => {
        setConfigData(configDataList);
        setDataToCheck(configDataList);
    }, [configDataList]);

    useEffect(() => {
        const recList = [
            {
                name: CODE_VIEWER.RECOMMENDED_DEV,
                id: RECOMMENDED_TEMPLATES.DEV_ID,
                data: setRecommendedValues(initialMssqlState, RECOMMENDED_TEMPLATES.DEV_ID)
            },
            {
                name: CODE_VIEWER.RECOMMENDED_PROD,
                id: RECOMMENDED_TEMPLATES.PROD_ID,
                data: setRecommendedValues(initialMssqlState, RECOMMENDED_TEMPLATES.PROD_ID)
            }
        ];
        setRecommendedData(recList);
    }, []);

    // This is to set disableCopy flag value
    useEffect(() => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            if (!getRightPanelTemplateResponse(openKey)?.template || isRightPanelTemplateLoading) {
                setDisableCopy(true);
            } else {
                setDisableCopy(false);
            }
        } else if (dropDownValue === CODE_VIEWER.REST_API) {
            const rightPanelResponse = getRightPanelRestResponse(openKey, CODEBOX_REST_RES.VIEW);
            if (!rightPanelResponse || isRightPanelDataLoading) {
                setDisableCopy(true);
            } else {
                setDisableCopy(false);
            }
        } else if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            if (!getRightPanelTemplateResponse(openKey)?.cliCommand || isRightPanelTemplateLoading) {
                setDisableCopy(true);
            } else {
                setDisableCopy(false);
            }
        } else {
            setDisableCopy(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        dropDownValue,
        rightPanelData,
        isRightPanelDataLoading,
        rightPanelTemplateResponse,
        isRightPanelTemplateLoading
    ]);

    // This will call template API to get CloudFormation and AWS CLI response for config payload. For both recommended and saved config.
    const getTemplateResponse = (payload: any, credDetails: any, id: string) => {
        const data = getRightPanelTemplateResponse(id);
        if (data) {
            setIsRightPanelTemplateLoading(false);
        } else {
            payload.credentialsId = credDetails?.credId || '';
            payload.region = credDetails?.region || '';
            loadTemplateData({ payload: payload }).then((data: any) => {
                if (data?.data) {
                    storeRightPanelTemplateResponse(id, data?.data);
                    setIsRightPanelTemplateLoading(false);
                } else {
                    storeRightPanelTemplateResponse(id, null);
                    setIsRightPanelTemplateLoading(false);
                }
            });
        }
    };

    // To save Rest API response
    const storeRightPanelRestResponse = (
        id: string,
        data: any,
        viewData: any,
        restViewDataMasked: any,
        originalData: any
    ) => {
        if (!rightPanelData.some((val: { id: string }) => val.id === id)) {
            const newData = {
                id: id,
                restApiData: data,
                restViewData: viewData,
                restViewDataMasked: restViewDataMasked,
                restOriginalData: originalData
            };
            setRightPanelData((prevData: any) => [...prevData, newData]);
        }
    };

    // To get Rest API response
    const getRightPanelRestResponse = (id: string | undefined, resType: string) => {
        const result = rightPanelData.find((val: any) => val.id === id);
        if (result && resType === CODEBOX_REST_RES.API) {
            return result?.restApiData;
        } else if (result && resType === CODEBOX_REST_RES.COPY) {
            return result?.restViewData;
        } else if (result && resType === CODEBOX_REST_RES.VIEW) {
            return result?.restViewDataMasked;
        } else if (result && resType === CODEBOX_REST_RES.ORIGINAL_DATA) {
            return result?.restOriginalData;
        } else {
            return undefined;
        }
    };

    // To store Template API response
    const storeRightPanelTemplateResponse = (id: string, data: any) => {
        if (!rightPanelTemplateResponse.some((val: { id: string }) => val.id === id)) {
            const newData = {
                id: id,
                data: data
            };
            setRightPanelTemplateResponse((prevData: any) => [...prevData, newData]);
        }
    };

    // To get template API response
    const getRightPanelTemplateResponse = (id: string | undefined) => {
        const result = rightPanelTemplateResponse.find((val: any) => val.id === id);
        if (result && result?.data) {
            return addEscapeInCli(result?.data);
        } else {
            return undefined;
        }
    };

    const loadRestApi = (actualData: any, id: string, save: boolean) => {
        const baseUrl = getBaseUrl();
        // To get accountid, credid and region from saved config
        const credDetails = getCredDetails(actualData);
        const changeObjectForm = {
            mssqlForm: actualData
        };
        const maskedChangeObj = { mssqlForm: setMaskedPassword(actualData) };
        const maskedResBody = createMssqlPayload(maskedChangeObj);
        const resBody = createMssqlPayload(changeObjectForm);

        if (id === openKey) {
            setIsRightPanelDataLoading(false);
            getTemplateResponse(resBody, credDetails, id);
        }
        if (save) {
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

            const res1 = JSON.stringify(maskedResBody, null, 2);
            // To set REST API response as deploy API curl request
            const highlightedString1 = (
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
                        res1
                    )}
                />
            );

            storeRightPanelRestResponse(id, actualData, highlightedString, highlightedString1, resBody);
        }
    };

    // This will get get for Rest API section. After getting rest API it will call template API to get CF and AWS CLI response.
    const getRestResponse = (id: string) => {
        setIsRightPanelDataLoading(true);
        setIsRightPanelTemplateLoading(true);
        const baseUrl = getBaseUrl();
        if (id === RECOMMENDED_TEMPLATES.DEV_ID || id === RECOMMENDED_TEMPLATES.PROD_ID) {
            // For recommended template updating values in initial form and getting response
            const actualData = recommendedData.filter((item: any) => item.id === id);
            const changeObjectForm = {
                mssqlForm: actualData[0].data
            };
            const resBody = createMssqlPayload(changeObjectForm);
            const res = JSON.stringify(resBody, null, 2);
            // To set REST API response as deploy API curl request. Passing accountId, credentialId and region placeholder for recommended configs.
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
                        CRED_PLACEHOLDERS.CRED_ID,
                        CRED_PLACEHOLDERS.REGION,
                        CRED_PLACEHOLDERS.TOKEN,
                        res
                    )}
                />
            );
            setIsRightPanelDataLoading(false);
            getTemplateResponse(resBody, {}, id);
            setCredDetailsData({});
            storeRightPanelRestResponse(id, actualData[0].data, highlightedString, highlightedString, resBody);
        } else {
            const data = getRightPanelRestResponse(id, CODEBOX_REST_RES.API);
            if (data) {
                // If data is already saved that just load data
                setCredDetailsData(data);
                loadRestApi(data, id, false);
            } else {
                // Getting saved config data using API
                loadConfigDataExe({ configId: id })
                    .then(data => {
                        const actualData = data?.data?.data;
                        setDbName(actualData?.dbName);
                        setCredDetailsData(actualData);
                        loadRestApi(actualData, id, true);
                    })
                    .catch((error: any) => {
                        setCredDetailsData({});
                        setIsRightPanelDataLoading(false);
                        setIsRightPanelTemplateLoading(false);
                    });
            }
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

    useEffect(() => {
        if (openKey && (openKey === RECOMMENDED_TEMPLATES.DEV_ID || openKey === RECOMMENDED_TEMPLATES.PROD_ID)) {
            const recList = recommendedData.filter((item: any) => item.id === openKey);
            setOpenedItem(recList[0]);
            getRestResponse(openKey);
        } else if (openKey && configData && configData.length) {
            const updatedConfigData = configData.filter((item: any) => item.id === openKey);
            setOpenedItem(updatedConfigData[0]);
            getRestResponse(updatedConfigData[0].id);
        } else if (!openKey && recommendedData && recommendedData.length) {
            setOpenedItem(recommendedData[0]);
            getRestResponse(recommendedData[0].id || '');
        } else if (!openKey && configData && configData.length) {
            setOpenedItem(configData[0]);
            getRestResponse(configData[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configData, openKey]);

    const handleToggle = (key: any, id: any) => {
        if (openKey !== id) {
            setOpenKey(openKey !== id ? id : null);
            setOpenedItem({ name: key, id: id });
        }
    };

    const handleViewCode = (key: any, id: any) => {
        setOpenKey(openKey !== id ? id : openKey);
        setOpenedItem({ name: key, id: id });
    };

    //To expand collapse side bar
    const handleClose = () => {
        if (!isOpen && !openKey) {
            setOpenKey('0');
        }
        onClose();
    };

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
            const option = generateOptionType(val, val, '', idx === 3 ? true : false, '');
            options.push(option);
        });
        return options;
    }, []);

    //To set the data that will be displayed after selecting the drop down option in code box
    const setDisplayedDataInCodeBox = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return isRightPanelTemplateLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_CLOUD_FORMATION} />
            ) : getRightPanelTemplateResponse(openKey)?.template ? (
                <ThemeProvider theme={'dark'} isRoot={false}>
                    {/* @ts-ignore */}
                    <SyntaxHighlighter wrapLongLines={true} language="yaml">
                        {getRightPanelTemplateResponse(openKey)?.template}
                    </SyntaxHighlighter>
                </ThemeProvider>
            ) : (
                <NoDataCodeBox text={CODE_VIEWER.NO_DATA_MSG} />
            );
        }
        if (dropDownValue === CODE_VIEWER.REST_API) {
            const credDetails = getCredDetails(credDetailsData);
            return isRightPanelDataLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_REST_API} />
            ) : (
                <HighlighterWord highlight={searchInput} count={countDetails}>
                    {getRightPanelRestResponse(openKey, CODEBOX_REST_RES.ORIGINAL_DATA) ? (
                        <CodeBoxColor
                            credID={credDetails.credId || CRED_PLACEHOLDERS.CRED_ID}
                            region={credDetails.region || CRED_PLACEHOLDERS.REGION}
                            actualData={getRightPanelRestResponse(openKey, CODEBOX_REST_RES.ORIGINAL_DATA)}
                        />
                    ) : (
                        <NoDataCodeBox text={CODE_VIEWER.NO_DATA_MSG} />
                    )}
                </HighlighterWord>
            );
        }
        if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return isRightPanelTemplateLoading ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_AWS_CLI} />
            ) : (
                <Typography variant="Regular_14" className={`${styles.colorAutomation} ${styles.newClass}`}>
                    {getRightPanelTemplateResponse(openKey)?.cliCommand ? (
                        <Highlighter
                            highlightClassName={styles.awsCliHighlightClass}
                            searchWords={AWS_CLI_HIGHLIGHT_STRINGS}
                            autoEscape={true}
                            textToHighlight={maskAwsCli(getRightPanelTemplateResponse(openKey)?.cliCommand)}
                        />
                    ) : (
                        <NoDataCodeBox text={CODE_VIEWER.NO_DATA_MSG} />
                    )}
                </Typography>
            );
        }
    };

    const loadWizard = async () => {
        dispatch(setIsLoading(true));
        navigate(WLF_TO_FORM_NAVIGATE);
        const key = openedItem?.id || '';
        if (key === RECOMMENDED_TEMPLATES.DEV_ID || key === RECOMMENDED_TEMPLATES.PROD_ID) {
            // Load config by setting recommended data in initial state
            const data = setRecommendedValues(initialMssqlState, key);
            dispatch(setIsRecommendedInstance(data?.instanceType));
            LoadRecommendedConfig(dispatch, data);
        } else {
            // Load config by getting data from load config API and update in form
            LoadConfiguration(dispatch, loadConfigDataExe, null, key);
        }
    };

    // To copy response based on dropdown selection
    const copyResponseData = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return getRightPanelTemplateResponse(openKey)?.template;
        } else if (dropDownValue === CODE_VIEWER.REST_API) {
            const rightPanelResponse = getRightPanelRestResponse(openKey, CODEBOX_REST_RES.COPY);
            return rightPanelResponse?.props?.textToHighlight;
        } else if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return getRightPanelTemplateResponse(openKey)?.cliCommand;
        }
    };

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
    const handleViewInAwsCloudFormation = () => {
        if (isDemoMode) {
            openDemoInfoDialog();
        } else {
            if (getRightPanelTemplateResponse(openKey)?.url) {
                window.open(getRightPanelTemplateResponse(openKey)?.url, '_blank', 'noopener');
            }
        }
    };

    //Handle Search
    const handleSearch = (val: string) => {
        if (val.length) {
            const newVal = configDataList.filter((text: any) => {
                return text?.name.includes(val);
            });
            setDataToCheck(newVal);
        } else {
            setDataToCheck(configDataList);
        }
    };

    //Logic for Scroll space starts here

    const [scrollPosition, setScrollPosition] = useState(0);
    const [scrollTopPosition, setScrollTopPosition] = useState(0);
    const [reachedHorizontalEnd, setReachedHorizontalEnd] = useState(false);
    const [reachedVerticalEnd, setReachedVerticalEnd] = useState(false);

    const containerRef = useRef(null);

    const handleScrollLeft = () => {
        const container = containerRef?.current;
        //@ts-ignore
        const isEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth;
        //@ts-ignore
        const isTopEnd = container.scrollTop + container.clientHeight >= container.scrollHeight;
        setReachedVerticalEnd(isTopEnd);
        setReachedHorizontalEnd(isEnd);
        //@ts-ignore
        setScrollPosition(containerRef?.current?.scrollLeft);
        //@ts-ignore
        setScrollTopPosition(containerRef?.current?.scrollTop);
    };

    const dynamicClassForContent = () => {
        if (reachedHorizontalEnd && !reachedVerticalEnd) {
            return `${styles.firstBlock} ${styles.addMargin}`;
        } else {
            return `${styles.firstBlock}`;
        }
    };

    //Logic for Scroll space ends here

    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            <div className={styles.topBar}>
                <div className={styles.title}>
                    <VectorIcon />
                    <Typography variant="Regular_16" className={styles.colorAutomation}>
                        {CODE_VIEWER.CODEBOX}
                    </Typography>
                </div>
                <div className={styles.rightSection} id={isOpen ? 'codebox-collapse' : 'codebox-expand'}>
                    {!isOpen && <ArrowRight />}
                    <Typography variant="Regular_16" className={styles.colorExpandCollapse} onClick={handleClose}>
                        {!isOpen ? CODE_VIEWER.EXPAND : CODE_VIEWER.COLLAPSE}
                    </Typography>
                    {isOpen && <ArrowLeft />}
                </div>
            </div>

            {!isOpen && (
                <div className={styles.accordionMainContainer}>
                    {/* Recommended templates when code box in collapse state */}

                    <div className={styles.accordionStructure}>
                        <div className={styles.recTemplateHeading}>
                            <Typography variant="Regular_16" className={styles.templateHeading}>
                                {CODE_VIEWER.RECOMMENDED_TEMPLATES_HEADING[0]}
                            </Typography>
                            &nbsp;
                            <Typography variant="Regular_16" className={styles.templateHeading}>
                                {CODE_VIEWER.RECOMMENDED_TEMPLATES_HEADING[1]}
                            </Typography>
                        </div>
                        {recommendedData.map((item: any, i: number) => (
                            <div key={i}>
                                <Accordion
                                    heading={item.name}
                                    subHeading={''}
                                    toggle={handleToggle}
                                    open={openKey === item.id}
                                    id={item.id}
                                    configRefetch={configRefetch}
                                    isExpanded={isOpen}
                                    expand={handleClose}
                                    viewCode={handleViewCode}
                                    recommended={true}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Collapse in loading state */}
                    {configLoading && (
                        <div className={`${styles.headingContainer} ${styles.headingLoadingContainer}`}>
                            <Typography variant="Regular_16" className={styles.templateHeading}>
                                {CODE_VIEWER.MY_TEMPLATES}
                            </Typography>
                            <FlashingDotsLoader />
                        </div>
                    )}

                    {/* configData length 0 */}
                    {configData && !configData.length && (
                        <div className={`${styles.headingContainer} ${styles.headingLoadingContainer}`}>
                            <Typography variant="Regular_16" className={styles.templateHeading}>
                                {CODE_VIEWER.MY_TEMPLATES}
                            </Typography>
                            <div className={styles.searchComponent}>
                                <SearchInput
                                    onChange={(e: any) => {
                                        handleSearch(e);
                                    }}
                                    isDisabled={true}
                                />
                            </div>
                        </div>
                    )}

                    {/* Saved templates when code box in collapse state */}
                    {configData && configData.length && (
                        <div className={styles.accordionStructure}>
                            <div className={styles.headingContainer}>
                                <Typography variant="Regular_16" className={styles.templateHeading}>
                                    {CODE_VIEWER.MY_TEMPLATES}
                                </Typography>
                                <SearchInput
                                    onChange={(e: any) => {
                                        handleSearch(e);
                                    }}
                                />
                            </div>

                            {dataToCheck.map((item: any, i: number) => (
                                <div key={i}>
                                    <Accordion
                                        heading={item.name}
                                        subHeading={formatDateWithTime(item.creationTime)}
                                        toggle={handleToggle}
                                        open={openKey === item.id}
                                        id={item.id}
                                        configRefetch={configRefetch}
                                        isExpanded={isOpen}
                                        expand={handleClose}
                                        viewCode={handleViewCode}
                                        recommended={false}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* when code box in expanded state */}
            {isOpen && (
                <div className={styles.openView}>
                    <div className={styles.leftSideView}>
                        {/* recommended templates list when code box in expanded state */}
                        {isOpen && (
                            <div className={styles.accordionStructure}>
                                <div className={styles.recTemplateHeading}>
                                    <Typography variant="Regular_16" className={styles.templateHeading}>
                                        {CODE_VIEWER.RECOMMENDED_TEMPLATES_HEADING[0]}
                                    </Typography>
                                    &nbsp;
                                    <Typography variant="Regular_16" className={styles.templateHeading}>
                                        {CODE_VIEWER.RECOMMENDED_TEMPLATES_HEADING[1]}
                                    </Typography>
                                </div>
                                {recommendedData.map((item: any, i: number) => (
                                    <div key={i}>
                                        <Accordion
                                            heading={item.name}
                                            subHeading={''}
                                            toggle={handleToggle}
                                            open={openKey === item.id}
                                            openedItem={openedItem?.name}
                                            id={item.id}
                                            configRefetch={configRefetch}
                                            isExpanded={isOpen}
                                            expand={handleClose}
                                            viewCode={handleViewCode}
                                            recommended={true}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* expanded in loading state */}
                        {configLoading && (
                            <div className={`${styles.headingContainer} ${styles.headingLoadingContainer}`}>
                                <Typography variant="Regular_16" className={styles.templateHeading}>
                                    {CODE_VIEWER.MY_TEMPLATES}
                                </Typography>
                                <FlashingDotsLoader />
                            </div>
                        )}

                        {/* expanded length 0 */}
                        {configData && !configData.length && (
                            <div className={`${styles.headingContainer} ${styles.headingLoadingContainer}`}>
                                <Typography variant="Regular_16" className={styles.templateHeading}>
                                    {CODE_VIEWER.MY_TEMPLATES}
                                </Typography>
                                <div className={styles.searchComponent}>
                                    <SearchInput
                                        onChange={(e: any) => {
                                            handleSearch(e);
                                        }}
                                        isDisabled={true}
                                    />
                                </div>
                            </div>
                        )}
                        {/* saved templates list when code box in expanded state */}
                        {configData && configData.length && isOpen && (
                            <div className={styles.accordionStructure}>
                                <div className={styles.headingContainer}>
                                    <Typography variant="Regular_16" className={styles.templateHeading}>
                                        {CODE_VIEWER.MY_TEMPLATES}
                                    </Typography>
                                    <SearchInput
                                        onChange={(e: any) => {
                                            console.log('e', e);
                                            handleSearch(e);
                                        }}
                                    />
                                </div>
                                {dataToCheck.map((item: any, i: number) => (
                                    <div key={i}>
                                        <Accordion
                                            heading={item.name}
                                            subHeading={formatDateWithTime(item.creationTime)}
                                            toggle={handleToggle}
                                            open={openKey === item.id}
                                            openedItem={openedItem?.name}
                                            id={item.id}
                                            configRefetch={configRefetch}
                                            isExpanded={isOpen}
                                            expand={handleClose}
                                            viewCode={handleViewCode}
                                            recommended={false}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Right side panel in expanded code box */}
                    <div style={{ width: '1170px' }}>
                        <div className={styles.rightSideView}>
                            {/* Code for top bar here */}
                            <div className={styles.rightSideTopBar}>
                                <Typography variant="Regular_16" className={styles.rightSideHeading}>
                                    {openedItem?.name}
                                </Typography>

                                <div className={styles.inputBox} style={{ color: 'var(--white)' }}>
                                    <SelectField
                                        isClearable={false}
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
                            {/* Top bar code ends */}

                            {/* Code for Search bar and input */}
                            <div className={styles.secondBar}>
                                <div className={styles.inputPart}>
                                    <Typography variant="Regular_14" style={{ color: 'var(--white)' }}>
                                        {dropDownValue}
                                    </Typography>
                                </div>

                                {/* <SearchInput onChange={e => setSearchInput(e)} /> */}
                                <div className={styles.menuContainer}>
                                    <div className={styles['copy']}>
                                        {disableCopy ? (
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
                                                        <div className={styles.menuItem}>
                                                            <Copy />
                                                        </div>
                                                    </CopyToClipboard>
                                                }
                                            />
                                        )}
                                    </div>

                                    <div className={styles.sideBarMenuPopover} onClick={e => e.stopPropagation()}>
                                        <MenuPopover
                                            isMenuOpen={menuOpenedRowDetail.current === '' || menuOpenedRow === ''}
                                            menuItems={menuItems}
                                            toggleMenu={(toggleType: string, menuId: string) => {
                                                if (toggleType === 'close') {
                                                    menuOpenedRowDetail.current = null;
                                                    setOpenedRow(null);
                                                } else if (toggleType === 'open') {
                                                    menuOpenedRowDetail.current = null;
                                                    setOpenedRow('');
                                                    menuOpenedRowDetail.current = '';
                                                } else if (toggleType === 'selectedOption') {
                                                    menuOpenedRowDetail.current = null;
                                                    setOpenedRow(null);
                                                    if (menuId === 'loadWizardOption') {
                                                        loadWizard();
                                                    } else if (menuId === 'downloadYaml') {
                                                        handleDownloadYAML(
                                                            getRightPanelTemplateResponse(openKey)?.template,
                                                            cfDownloadName(dbName || openedItem?.name || '')
                                                        );
                                                    } else if (menuId === 'viewAwsCloudFormation') {
                                                        handleViewInAwsCloudFormation();
                                                    }
                                                }
                                            }}
                                            CustomMenu={undefined}
                                            disabledText={undefined}
                                            isBlackLayout={true}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Search bar input code ends here */}

                            {/* Cloud formation button */}
                            {dropDownValue === CODE_VIEWER.CLOUDFORMATION &&
                                !isRightPanelTemplateLoading &&
                                getRightPanelTemplateResponse(openKey)?.template && (
                                    <div className={styles.cloudFormationButtonContainer}>
                                        <Button variant="secondary" onClick={() => handleViewInAwsCloudFormation()}>
                                            {GENERAL.SAVE_FORM_AS_CLOUD}
                                        </Button>
                                    </div>
                                )}

                            {/* Last section starts here */}
                            <div
                                className={
                                    dropDownValue === CODE_VIEWER.CLOUDFORMATION
                                        ? `${styles.thirdBar} ${styles.thirdBarHeight}`
                                        : `${styles.thirdBar}`
                                }
                            >
                                <div className={styles.scrollContainer} onScroll={handleScrollLeft} ref={containerRef}>
                                    {/* to add scroll space in horizontal */}
                                    <div className={styles.scrollLeft}>
                                        <div className={styles.setHorizontalScroll}>
                                            <Typography
                                                variant="Regular_14"
                                                style={{ color: 'var(--white)' }}
                                                className={dynamicClassForContent()}
                                            >
                                                {setDisplayedDataInCodeBox()}
                                            </Typography>
                                            <div
                                                className={styles.empty}
                                                style={{
                                                    position: 'relative',
                                                    left: `${scrollPosition}px` // Move the div based on scroll position
                                                }}
                                            />
                                        </div>

                                        <div
                                            className={
                                                reachedVerticalEnd
                                                    ? `${styles.setVerticalScroll} ${styles.addVerticalMargin}`
                                                    : `${styles.setVerticalScroll}`
                                            }
                                            style={{
                                                position: 'relative',
                                                top: `${scrollTopPosition}px` // Move the div based on scroll position
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
