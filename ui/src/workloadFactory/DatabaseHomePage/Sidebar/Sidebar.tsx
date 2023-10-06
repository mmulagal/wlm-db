import { useState } from 'react';
import { Typography, SearchInput, SelectField } from '@netapp/design-system';
import { ReactComponent as ArrowRight } from '../../../assets/ic_arrow_right.svg';
import { ReactComponent as ArrowLeft } from '../../../assets/ic_arrow_left.svg';
import Highlighter from '../Highlighter/Highlighter';

import styles from './Sidebar.module.scss';
import Accordion from '../Accordion/Accordion';

const Sidebar = ({ isOpen, onClose }: any) => {
    const [openKey, setOpenKey] = useState();
    const [searchInput, setSearchInput] = useState('');

    const handleToggle = (key: any) => {
        setOpenKey(openKey !== key ? key : null);
    };
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

            {!isOpen && (
                <div className={styles.accordionStructure}>
                    <Accordion
                        heading="Heading"
                        subHeading=" Creation date: Sep 20, 2023, 00:00:00"
                        toggle={handleToggle}
                        open={openKey === 'Heading'}
                    />
                    <Accordion
                        heading="Heading2"
                        subHeading=" Creation date: Sep 20, 2023, 00:00:00"
                        toggle={handleToggle}
                        open={openKey === 'Heading2'}
                    />
                </div>
            )}

            {isOpen && (
                <div className={styles.openView}>
                    <div className={styles.leftSideView}>
                        <div className={styles.accordionStructure}>
                            <Accordion
                                heading="Heading"
                                subHeading=" Creation date: Sep 20, 2023, 00:00:00"
                                toggle={handleToggle}
                                open={openKey === 'Heading'}
                            />
                            <Accordion
                                heading="Heading2"
                                subHeading=" Creation date: Sep 20, 2023, 00:00:00"
                                toggle={handleToggle}
                                open={openKey === 'Heading2'}
                            />
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
                                <Typography variant="Regular_14" style={{ color: '#fff' }}>
                                    Show code as:
                                </Typography>
                                <div className={styles.inputBox} style={{ color: '#fff' }}>
                                    <SelectField
                                        isClearable={false}
                                        onChange={function noRefCheck() {}}
                                        isSearchable={false}
                                        variant="underline"
                                        options={[
                                            {
                                                label: 'label1',
                                                value: 'value1'
                                            },
                                            {
                                                label: 'label2',
                                                value: 'value2'
                                            }
                                        ]}
                                    />
                                </div>
                            </div>
                            <SearchInput onChange={e => setSearchInput(e)} />
                        </div>
                        {/* Search bar input code ends here */}

                        {/* Last section starts here */}
                        <div className={styles.thirdBar}>
                            <Typography variant="Regular_14" style={{ color: '#fff' }}>
                                <Highlighter highlight={searchInput}>Coming Soon</Highlighter>
                            </Typography>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
