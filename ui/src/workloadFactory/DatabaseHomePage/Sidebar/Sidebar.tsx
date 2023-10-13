import { useState, useEffect, useMemo } from 'react';
import { Typography, SearchInput } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { ReactComponent as ArrowRight } from '../../../assets/ic_arrow_right.svg';
import { ReactComponent as ArrowLeft } from '../../../assets/ic_arrow_left.svg';
import Highlighter from '../Highlighter/Highlighter';

import styles from './Sidebar.module.scss';
import Accordion from '../Accordion/Accordion';
import { formatDateWithTime, generateOptionType } from '../../../utils/utilityFunctions';
import { useGetConfigListQuery, useLazyGetConfigDataQuery } from '../../../utils/apiService';
import { createMssqlPayload } from '../../../components/CreateMsSql/MSSqlServer/MSSqlFooter/createSqlServer';

const Sidebar = ({ isOpen, onClose }: any) => {
    const [openKey, setOpenKey] = useState();
    const [openedItem, setOpenedItem] = useState('');
    const [searchInput, setSearchInput] = useState('');

    const [rightPanelResponse, setRightPanelResponse] = useState('');
    const [isRightPanelDataLoading, setIsRightPanelDataLoading] = useState(false);

    const [loadConfigDataExe] = useLazyGetConfigDataQuery();

    const {
        data: configData,

        isFetching: configLoading,

        isError: configError,
        refetch: configRefetch
    } = useGetConfigListQuery({});

    const getRestResponse = (id: string) => {
        setIsRightPanelDataLoading(true);
        loadConfigDataExe({ configId: id }).then(data => {
            const actualData = data?.data?.data;
            const changeObjectForm = {
                mssqlForm: actualData
            };
            const res = JSON.stringify(createMssqlPayload(changeObjectForm), null, 2);
            setRightPanelResponse(res);
            setIsRightPanelDataLoading(false);
        });
    };

    useEffect(() => {
        if (configData) {
            setOpenedItem(configData[0].name);
            getRestResponse(configData[0].id);
        }
    }, [configData]);

    const handleToggle = (key: any, id: string) => {
        if (!isOpen) {
            setOpenKey(openKey !== key ? key : null);
        } else {
            setOpenedItem(key);
            getRestResponse(id);
        }
    };

    //Function to generate the options for Select Field for License
    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = ['AWS CLI', 'REST API'];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);
    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            <div className={styles.topBar}>
                <Typography variant="Regular_16" className={styles.colorAutomation}>
                    Automations
                </Typography>
                <div className={styles.rightSection}>
                    {!isOpen && <ArrowRight />}
                    <Typography variant="Regular_16" className={styles.color} onClick={onClose}>
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
                                open={openKey === item.name}
                                id={item.id}
                                configRefetch={configRefetch}
                            />
                        </div>
                    ))}
                </div>
            )}

            {configData && isOpen && (
                <div className={styles.openView}>
                    <div className={styles.leftSideView}>
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
                                        open={openKey === item.name}
                                        openedItem={openedItem}
                                        id={item.id}
                                        configRefetch={configRefetch}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.rightSideView}>
                        {/* Code for top bar here */}
                        <div className={styles.rightSideTopBar}>
                            <Typography variant="Semibold_14" className={styles.rightSideHeading}>
                                Dev/Test
                            </Typography>
                            <div className={styles.menuContainer}>
                                <Typography variant="Semibold_14" className={styles.rightSideHeading}>
                                    Copy
                                </Typography>
                                <Typography variant="Semibold_14" className={styles.rightSideHeading}>
                                    Load Wizard
                                </Typography>
                                <Typography variant="Semibold_14" className={styles.rightSideHeading}>
                                    Menu
                                </Typography>
                            </div>
                        </div>
                        {/* Top bar code ends */}

                        {/* Code for Search bar and input */}
                        <div className={styles.secondBar}>
                            <div className={styles.inputPart}>
                                <Typography variant="Regular_14" style={{ color: 'var(--content-background' }}>
                                    Show code as:
                                </Typography>
                                <div className={styles.inputBox} style={{ color: 'var(--content-background)' }}>
                                    <SelectField
                                        isClearable={false}
                                        onChange={function noRefCheck() {}}
                                        isSearchable={false}
                                        variant="underline"
                                        options={generateCLIOptions}
                                        defaultValue={[generateCLIOptions[1]]}
                                    />
                                </div>
                            </div>
                            <SearchInput onChange={e => setSearchInput(e)} />
                        </div>
                        {/* Search bar input code ends here */}

                        {/* Last section starts here */}
                        <div className={styles.thirdBar}>
                            <Typography variant="Regular_14" style={{ color: 'var(--content-background)' }}>
                                {isRightPanelDataLoading ? (
                                    <Typography variant="Semibold_14" className={styles.loading}>
                                        Loading...
                                    </Typography>
                                ) : (
                                    <Highlighter highlight={searchInput}>
                                        <pre>{rightPanelResponse}</pre>
                                    </Highlighter>
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
