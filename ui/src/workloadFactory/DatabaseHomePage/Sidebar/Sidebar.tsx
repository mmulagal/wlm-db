import { useState, useEffect, useMemo, useRef } from 'react';
import { Typography, SearchInput, Popover } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { ReactComponent as ArrowRight } from '../../../assets/ic_arrow_right.svg';
import { ReactComponent as ArrowLeft } from '../../../assets/ic_arrow_left.svg';
import { ReactComponent as Copy } from '../../../assets/ic_copy_replicate.svg';
import { ReactComponent as LoadIcon } from '../../../assets/ic_restore.svg';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import HighlighterWord from '../Highlighter/Highlighter';
//@ts-ignore
import Highlighter from 'react-highlight-words';

import styles from './Sidebar.module.scss';
import Accordion from '../Accordion/Accordion';
import {
    formatDateWithTime,
    generateOptionType,
    getCredDetails,
    handleDownloadYAML,
    setRecommendedValues
} from '../../../utils/utilityFunctions';
import { useGetConfigListQuery, useGetTemplatesMutation, useLazyGetConfigDataQuery } from '../../../utils/apiService';
import { createMssqlPayload } from '../../../components/CreateMsSql/MSSqlServer/MSSqlFooter/createSqlServer';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { CODE_VIEWER } from '../../../utils/appConstants';
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
    CRED_PLACEHOLDERS
} from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { TemplateRes } from '../../../utils/types/databaseHomeTypes';
import { initialMssqlState } from '../../../store/mssql/mssqlFormSlice';

type ConfigType = {
    id?: string;
    name?: string;
    data?: any;
};

const Sidebar = ({ isOpen, onClose }: any) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [openKey, setOpenKey] = useState();
    const [openedItem, setOpenedItem] = useState<ConfigType>({});
    const [searchInput, setSearchInput] = useState('');

    const accountId = useAppSelector(state => state?.auth?.accountId);

    // For expanded menu
    const [menuOpenedRow, setOpenedRow] = useState<string | null>(null);
    const menuOpenedRowDetail: any = useRef(null);

    //For selected option from dropdown
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);

    // For selected config REST API response
    const [rightPanelResponse, setRightPanelResponse] = useState<any>('');
    const [isRightPanelDataLoading, setIsRightPanelDataLoading] = useState(false);

    // For selected config CloudFormation and AWS CLI response
    const [rightPanelTemplateResponse, setRightPanelTemplateResponse] = useState<TemplateRes | null>(null);
    const [isRightPanelTemplateLoading, setIsRightPanelTemplateLoading] = useState(false);

    const [recommendedData, setRecommendedData] = useState<ConfigType[]>([]);

    const [disableCopy, setDisableCopy] = useState(true);

    const [loadConfigDataExe] = useLazyGetConfigDataQuery();
    const [loadTemplateData] = useGetTemplatesMutation();

    const menuItems = [
        {
            id: 'viewAwsCloudFormation',
            displayName: CODE_VIEWER.VIEW_IN_AWS_CLOUD_FORMATION,
            disabled: (!rightPanelTemplateResponse || isRightPanelTemplateLoading) ? true: false
        },
        {
            id: 'downloadYaml',
            displayName: CODE_VIEWER.DOWNLOAD_YAML,
            disabled: (!rightPanelTemplateResponse || isRightPanelTemplateLoading) ? true: false
        }
    ];

    const { data: configData, isFetching: configLoading, refetch: configRefetch } = useGetConfigListQuery({});

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
            if (!rightPanelTemplateResponse?.template || isRightPanelTemplateLoading) {
                setDisableCopy(true);
            } else {
                setDisableCopy(false);
            }
        } else if (dropDownValue === CODE_VIEWER.REST_API) {
            if (!rightPanelResponse || isRightPanelDataLoading) {
                setDisableCopy(true);
            } else {
                setDisableCopy(false);
            }
        } else if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            if (!rightPanelTemplateResponse?.cliCommand || isRightPanelTemplateLoading) {
                setDisableCopy(true);
            } else {
                setDisableCopy(false);
            }
        } else {
            setDisableCopy(true);
        }
    }, [dropDownValue, rightPanelResponse, isRightPanelDataLoading, rightPanelTemplateResponse, isRightPanelTemplateLoading]);

    // This will call template API to get CloudFormation and AWS CLI response for config payload. For both recommended and saved config.
    const getTemplateResponse = (payload: any, credDetails: any) => {
        // TBD - to add code to get credentials and pass in request body
        if (credDetails?.credId && credDetails?.region) {
            loadTemplateData({ credentialId: credDetails?.credId, region: credDetails?.region,payload: payload }).then((data: any) => {
                if (data?.data) {
                    setRightPanelTemplateResponse(data?.data);
                    setIsRightPanelTemplateLoading(false);
                } else {
                    setRightPanelTemplateResponse(null);
                    setIsRightPanelTemplateLoading(false);
                }
            });
        } else {
            setRightPanelTemplateResponse(null);
            setIsRightPanelTemplateLoading(false);
        }
    };

    // This will get get for Rest API section. After getting rest API it will call template API to get CF and AWS CLI response.
    const getRestResponse = (id: string) => {
        setIsRightPanelDataLoading(true);
        setIsRightPanelTemplateLoading(true);
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
                    searchWords={[CRED_PLACEHOLDERS.ACCOUNT_ID, CRED_PLACEHOLDERS.CRED_ID, CRED_PLACEHOLDERS.REGION, CRED_PLACEHOLDERS.TOKEN]}
                    autoEscape={true}
                    textToHighlight={CURL_REQ_TEMPLATE(
                        accountId || CRED_PLACEHOLDERS.ACCOUNT_ID,
                        CRED_PLACEHOLDERS.CRED_ID,
                        CRED_PLACEHOLDERS.REGION,
                        CRED_PLACEHOLDERS.TOKEN,
                        res
                    )}
                />
            );
            //@ts-ignore
            setRightPanelResponse(highlightedString);
            setIsRightPanelDataLoading(false);
            getTemplateResponse(resBody, {});
        } else {
            // Getting saved config data using API
            loadConfigDataExe({ configId: id }).then(data => {
                const actualData = data?.data?.data;
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
                        searchWords={[CRED_PLACEHOLDERS.ACCOUNT_ID, CRED_PLACEHOLDERS.CRED_ID, CRED_PLACEHOLDERS.REGION, CRED_PLACEHOLDERS.TOKEN]}
                        autoEscape={true}
                        textToHighlight={CURL_REQ_TEMPLATE(
                            accountId || CRED_PLACEHOLDERS.ACCOUNT_ID,
                            credDetails.credId || CRED_PLACEHOLDERS.CRED_ID,
                            credDetails.region || CRED_PLACEHOLDERS.REGION,
                            CRED_PLACEHOLDERS.TOKEN,
                            res
                        )}
                    />
                );
                //@ts-ignore
                setRightPanelResponse(highlightedString);
                setIsRightPanelDataLoading(false);
                getTemplateResponse(resBody, credDetails);
            });
        }
    };

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
        setOpenKey(openKey !== id ? id : null);
        setOpenedItem({ name: key, id: id });
        getRestResponse(id);
    };

    const handleViewCode = (key: any, id: any) => {
        setOpenKey(openKey !== id ? id : openKey);
        setOpenedItem({ name: key, id: id });
        getRestResponse(id);
    };

    //To expand collapse side bar
    const handleClose = () => {
        onClose();
    };

    //Function to generate the options for Select Field for License
    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = [CODE_VIEWER.CLOUDFORMATION, CODE_VIEWER.AWS_CLI, CODE_VIEWER.REST_API];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    //To set the data that will be displayed after selecting the drop down option in code box
    const setDisplayedDataInCodeBox = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return isRightPanelTemplateLoading ? (
                <Typography variant="Semibold_14" className={styles.loading}>
                    {CODE_VIEWER.LOADING}
                </Typography>
            ) : (
                <HighlighterWord highlight={searchInput}>
                    <pre className={styles.colorAutomation}>
                        {rightPanelTemplateResponse?.template || CODE_VIEWER.NO_DATA_MSG}
                    </pre>
                </HighlighterWord>
            );
        }
        if (dropDownValue === CODE_VIEWER.REST_API) {
            return isRightPanelDataLoading ? (
                <Typography variant="Semibold_14" className={styles.loading}>
                    {CODE_VIEWER.LOADING}
                </Typography>
            ) : (
                <HighlighterWord highlight={searchInput}>
                    <pre>{rightPanelResponse}</pre>
                </HighlighterWord>
            );
        }
        if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return isRightPanelTemplateLoading ? (
                <Typography variant="Semibold_14" className={styles.loading}>
                    {CODE_VIEWER.LOADING}
                </Typography>
            ) : (
                <HighlighterWord highlight={searchInput}>
                    <Typography variant="Regular_16" className={styles.colorAutomation}>
                        {rightPanelTemplateResponse?.cliCommand || CODE_VIEWER.NO_DATA_MSG}
                    </Typography>
                </HighlighterWord>
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
            return rightPanelTemplateResponse?.template;
        } else if (dropDownValue === CODE_VIEWER.REST_API) {
            return rightPanelResponse?.props?.textToHighlight;
        } else if (dropDownValue === CODE_VIEWER.AWS_CLI) {
            return rightPanelTemplateResponse?.cliCommand;
        }
    };

    const handleViewInAwsCloudFormation = () => {
        if (rightPanelTemplateResponse?.cliCommand) {
            window.open(rightPanelTemplateResponse?.cliCommand, '_blank', 'noopener');
        }
    };

    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            <div className={styles.topBar}>
                <Typography variant="Regular_16" className={styles.colorAutomation}>
                    {CODE_VIEWER.AUTOMATIONS}
                </Typography>
                <div className={styles.rightSection}>
                    {!isOpen && <ArrowRight />}
                    <Typography variant="Regular_16" className={styles.color} onClick={handleClose}>
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
                            <Typography variant="Semibold_14" className={styles.templateHeading}>
                                {CODE_VIEWER.RECOMMENDED_TEMPLATES_HEADING[0]}
                            </Typography>
                            <Typography variant="Regular_14" className={styles.templateHeading}>
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

                    {configLoading && (
                        <Typography variant="Semibold_14" className={styles.loading}>
                            {CODE_VIEWER.LOADING}
                        </Typography>
                    )}

                    {/* Saved templates when code box in collapse state */}
                    {configData && (
                        <div className={styles.accordionStructure}>
                            <Typography variant="Semibold_14" className={styles.templateHeading}>
                                {CODE_VIEWER.MY_TEMPLATES}
                            </Typography>
                            {configData.map((item: any, i: number) => (
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
                                    <Typography variant="Semibold_14" className={styles.templateHeading}>
                                        {CODE_VIEWER.RECOMMENDED_TEMPLATES_HEADING[0]}
                                    </Typography>
                                    <Typography variant="Regular_14" className={styles.templateHeading}>
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
                        {/* saved templates list when code box in expanded state */}
                        {configData && isOpen && (
                            <div className={styles.accordionStructure}>
                                <Typography variant="Semibold_14" className={styles.templateHeading}>
                                    {CODE_VIEWER.MY_TEMPLATES}
                                </Typography>
                                {configData.map((item: any, i: number) => (
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
                    <div className={styles.rightSideView}>
                        {/* Code for top bar here */}
                        <div className={styles.rightSideTopBar}>
                            <Typography variant="Semibold_14" className={styles.rightSideHeading}>
                                {openedItem?.name}
                            </Typography>
                            <div className={styles.menuContainer}>
                                <div className={styles['copy']}>
                                    {disableCopy ? 
                                        // Disabled copy button 
                                        (<div className={styles.menuItemDisabled}>
                                            <Copy />
                                            <Typography
                                                variant="Semibold_14"
                                                className={styles.rightSideHeadingDisabled}
                                            >
                                                {CODE_VIEWER.COPY}
                                            </Typography>
                                        </div>) :
                                        // Enabled copy button
                                        (<Popover
                                            popoverClass={styles['copy-popover']}
                                            children={CODE_VIEWER.COPIED_TO_CLIPBOARD}
                                            container={
                                                <CopyToClipboard text={copyResponseData()}>
                                                    <div className={styles.menuItem}>
                                                        <Copy />
                                                        <Typography
                                                            variant="Semibold_14"
                                                            className={styles.rightSideHeading}
                                                        >
                                                            {CODE_VIEWER.COPY}
                                                        </Typography>
                                                    </div>
                                                </CopyToClipboard>
                                            }
                                        />)
                                    } 
                                </div>

                                <div className={styles.menuItem} onClick={loadWizard}>
                                    <LoadIcon />
                                    <Typography variant="Semibold_14" className={styles.rightSideHeading}>
                                        {CODE_VIEWER.SIDEBAR_LOAD_WIZARD}
                                    </Typography>
                                </div>

                                {dropDownValue === CODE_VIEWER.CLOUDFORMATION && (
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
                                                    if (menuId === 'downloadYaml') {
                                                        handleDownloadYAML(
                                                            rightPanelTemplateResponse?.template,
                                                            openedItem?.name
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
                                )}
                            </div>
                        </div>
                        {/* Top bar code ends */}

                        {/* Code for Search bar and input */}
                        <div className={styles.secondBar}>
                            <div className={styles.inputPart}>
                                <Typography variant="Regular_14" style={{ color: 'var(--white)' }}>
                                    {CODE_VIEWER.SHOW_CODE_AS}
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
                            <SearchInput onChange={e => setSearchInput(e)} />
                        </div>
                        {/* Search bar input code ends here */}

                        {/* Last section starts here */}
                        <div className={styles.thirdBar}>
                            <Typography variant="Regular_14" style={{ color: 'var(--white)' }}>
                                {setDisplayedDataInCodeBox()}
                            </Typography>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
