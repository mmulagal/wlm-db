import { useState, useEffect, useMemo, useRef } from 'react';
import { Typography, SearchInput, Popover } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { ReactComponent as ArrowRight } from '../../../assets/ic_arrow_right.svg';
import { ReactComponent as ArrowLeft } from '../../../assets/ic_arrow_left.svg';
import { ReactComponent as Copy } from '../../../assets/ic_copy_replicate.svg';
import { ReactComponent as LoadIcon } from '../../../assets/ic_restore.svg';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import Highlighter from '../Highlighter/Highlighter';

import styles from './Sidebar.module.scss';
import Accordion from '../Accordion/Accordion';
import { formatDateWithTime, generateOptionType, setRecommendedValues } from '../../../utils/utilityFunctions';
import { useGetConfigListQuery, useLazyGetConfigDataQuery } from '../../../utils/apiService';
import { createMssqlPayload } from '../../../components/CreateMsSql/MSSqlServer/MSSqlFooter/createSqlServer';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { LoadConfiguration } from '../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { useNavigate } from 'react-router-dom';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';

type ConfigType = {
    id?: string;
    name?: string;
    data?: any;
}

const Sidebar = ({ isOpen, onClose }: any) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [openKey, setOpenKey] = useState();
    const [openedItem, setOpenedItem] = useState<ConfigType>({});
    const [searchInput, setSearchInput] = useState('');

    const initialMssqlState = useAppSelector(state => state.mssqlForm);

    // For expanded menu
    const [menuOpenedRow, setOpenedRow] = useState<string | null>(null);
    const menuOpenedRowDetail: any = useRef(null);

    //For selected option from dropdown
    const [dropDownValue, setDropdownValue] = useState('REST API');

    const [rightPanelResponse, setRightPanelResponse] = useState('');
    const [isRightPanelDataLoading, setIsRightPanelDataLoading] = useState(false);
    const [recommendedData, setRecommendedData] = useState<ConfigType[]>([]);

    const [loadConfigDataExe] = useLazyGetConfigDataQuery();

    const menuItems = [
        {
            id: 'view in aws cloudFormation',
            displayName: 'View in AWS CloudFormation'
        },
        {
            id: 'download yaml',
            displayName: 'Download YAML file '
        }
    ];

    const {
        data: configData,
        isFetching: configLoading,
        refetch: configRefetch
    } = useGetConfigListQuery({});

    useEffect(() => {
        const recList = [
            {
                name: 'Dev/Test',
                id: '0',
                data: setRecommendedValues(initialMssqlState, 'dev')
            },
            {
                name: 'Production',
                id: '1',
                data: setRecommendedValues(initialMssqlState, 'prod')
            }
        ]
        setRecommendedData(recList);
    }, []);

    const getRestResponse = (id: string) => {
        setIsRightPanelDataLoading(true);
        if(id === '0' || id === '1'){
            const actualData = recommendedData.filter((item: any) => item.id === id);
            const changeObjectForm = {
                mssqlForm: actualData[0].data
            };
            const res = JSON.stringify(createMssqlPayload(changeObjectForm), null, 2);
            setRightPanelResponse(res);
            setIsRightPanelDataLoading(false);
        } else {
            loadConfigDataExe({ configId: id }).then(data => {
                const actualData = data?.data?.data;
                const changeObjectForm = {
                    mssqlForm: actualData
                };
                const res = JSON.stringify(createMssqlPayload(changeObjectForm), null, 2);
                setRightPanelResponse(res);
                setIsRightPanelDataLoading(false);
            });
        }
    };

    useEffect(() => {
        if (configData && configData.length) {
            if (openKey && (openKey === '0' || openKey === '1')){
                const recList = recommendedData.filter((item: any) => item.id === openKey);
                setOpenedItem(recList[0]);
                getRestResponse(openKey);
            }
            else if (openKey) {
                const updatedConfigData = configData.filter((item: any) => item.id === openKey);
                setOpenedItem(updatedConfigData[0]);
                getRestResponse(updatedConfigData[0].id);
            } else {
                setOpenedItem(configData[0]);
                getRestResponse(configData[0].id);
            }
        }
    }, [configData, openKey]);

    const handleToggle = (key: any, id: any) => {
        setOpenKey(openKey !== id ? id : null);
        setOpenedItem({name: key, id: id});
        getRestResponse(id);
    };

    const handleViewCode = (key: any, id: any) => {
        setOpenKey(openKey !== id ? id : openKey);
        setOpenedItem({name: key, id: id});
        getRestResponse(id);
    };

    //To expand collapse side bar
    const handleClose = () => {
        onClose();
    };

    //Function to generate the options for Select Field for License
    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = ['CLoudFormation', 'AWS CLI', 'REST API'];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    //To set the data that will be displayed after selecting the drop down option in code box
    const setDisplayedDataInCodeBox = () => {
        if (dropDownValue === 'CLoudFormation') {
            return (
                <Typography variant="Regular_16" className={styles.colorAutomation}>
                    Coming Soon
                </Typography>
            );
        }
        if (dropDownValue === 'REST API') {
            return (
                <Highlighter highlight={searchInput}>
                    <pre>{rightPanelResponse}</pre>
                </Highlighter>
            );
        }
        if (dropDownValue === 'AWS CLI') {
            return (
                <Typography variant="Regular_16" className={styles.colorAutomation}>
                    Coming Soon
                </Typography>
            );
        }
    };

    const loadWizard = async () => {
        dispatch(setIsLoading(true));
        navigate(WLF_TO_FORM_NAVIGATE);
        LoadConfiguration(dispatch, loadConfigDataExe, null, openedItem?.id);
    };

    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            <div className={styles.topBar}>
                <Typography variant="Regular_16" className={styles.colorAutomation}>
                    Automations
                </Typography>
                <div className={styles.rightSection}>
                    {!isOpen && <ArrowRight />}
                    <Typography variant="Regular_16" className={styles.color} onClick={handleClose}>
                        {!isOpen ? 'Expand' : 'Collapse'}
                    </Typography>
                    {isOpen && <ArrowLeft />}
                </div>
            </div>

            {configLoading && (
                <Typography variant="Semibold_14" className={styles.loading}>
                    Loading...
                </Typography>
            )}

            {/* Recommended templates when code box in collapse state */}
            {!isOpen && (
                <div className={styles.accordionStructure}>
                    <div className={styles.recTemplateHeading}>
                        <Typography variant="Semibold_14" className={styles.templateHeading}>
                            Recommended Templates - 
                        </Typography>
                        <Typography variant="Regular_14" className={styles.templateHeading}>
                            Microsoft SQL server deployment
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
            )}

            {/* Saved templates when code box in collapse state */}
            {configData && !isOpen && (
                <div className={styles.accordionStructure}>
                    <Typography variant="Semibold_14" className={styles.templateHeading}>
                        My Templates
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

            {/* when code box in expanded state */}
            { isOpen && (
                <div className={styles.openView}>
                    <div className={styles.leftSideView}>
                        {/* recommended templates list when code box in expanded state */}
                        {isOpen && 
                            <div className={styles.accordionStructure}>
                                <div className={styles.recTemplateHeading}>
                                    <Typography variant="Semibold_14" className={styles.templateHeading}>
                                        Recommended Templates - 
                                    </Typography>
                                    <Typography variant="Regular_14" className={styles.templateHeading}>
                                        Microsoft SQL server deployment
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
                        }
                        {/* saved templates list when code box in expanded state */}
                        {configData && isOpen && 
                            <div className={styles.accordionStructure}>
                                <Typography variant="Semibold_14" className={styles.templateHeading}>
                                    My Templates
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
                        }
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
                                    <Popover
                                        popoverClass={styles['copy-popover']}
                                        children={'Copied to clipboard'}
                                        container={
                                            <CopyToClipboard text={rightPanelResponse}>
                                                <div className={styles.menuItem}>
                                                    <Copy />
                                                    <Typography
                                                        variant="Semibold_14"
                                                        className={styles.rightSideHeading}
                                                    >
                                                        Copy
                                                    </Typography>
                                                </div>
                                            </CopyToClipboard>
                                        }
                                    />
                                </div>

                                <div className={styles.menuItem} onClick={loadWizard}>
                                    <LoadIcon />
                                    <Typography variant="Semibold_14" className={styles.rightSideHeading}>
                                        {GENERAL.SIDEBAR_LOAD_WIZARD}
                                    </Typography>
                                </div>

                                {dropDownValue === 'CLoudFormation' && (
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
                                    Show code as:
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
                                {isRightPanelDataLoading ? (
                                    <Typography variant="Semibold_14" className={styles.loading}>
                                        Loading...
                                    </Typography>
                                ) : (
                                    setDisplayedDataInCodeBox()
                                )}
                            </Typography>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
