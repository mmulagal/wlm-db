import React, { useState, useRef } from 'react';
import { ReactComponent as Arrow } from '../../../assets/Row arrow.svg';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { ReactComponent as ActionDots } from '../../../assets/table action icon.svg';
import { Typography } from '@netapp/design-system';
import styles from './Accordion.module.scss';
import { useDeleteConfigMutation, useLazyGetConfigDataQuery } from '../../../utils/apiService';
import { useDispatch } from 'react-redux';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { LoadConfiguration } from '../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { useNavigate } from 'react-router-dom';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';

type AccordionContent = {
    heading: string;
    subHeading: string;
    toggle: any;
    open: boolean;
    openedItem?: any;
    id?: string;
    configRefetch?: any;
    isExpanded?: boolean;
    expand?: any;
};

const Accordion = ({ heading, subHeading, toggle, open, openedItem, id, configRefetch, isExpanded, expand }: AccordionContent) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [menuOpenedRow, setOpenedRow] = useState<string | null>(null);
    const menuOpenedRowDetail: any = useRef(null);
    const [deleteConfigApi] = useDeleteConfigMutation();
    const [loadConfigDataExe] = useLazyGetConfigDataQuery();

    const menuItems = [
        {
            id: 'viewCode',
            displayName: 'View Code'
        },
        {
            id: 'loadWizard',
            displayName: 'Load (Wizard)'
        },
        {
            id: '3',
            displayName: 'Rename'
        },
        {
            id: 'delete',
            displayName: 'Delete'
        }
    ];

    const handleDelete = () => {
        deleteConfigApi({ configId: id }).then((data: any) => {
            configRefetch();
            // if (!data?.error) {
            //     configListRefetch();
            // }
        });
    };

    const handleLoadWizard = () => {
        dispatch(setIsLoading(true));
        navigate(WLF_TO_FORM_NAVIGATE);
        LoadConfiguration(dispatch, loadConfigDataExe, null, id);
    };

    const handleViewCode = () => {
        if(!isExpanded){
            expand();
        }
        toggle(heading, id);
    }

    return (
        <div className={styles.accordions}>
            <div
                className={
                    open || openedItem === heading
                        ? `${styles.accordionContainer} ${styles.addBorder}`
                        : `${styles.accordionContainer}`
                }
            >
                <div
                    className={styles.accordionHeader}
                    onClick={() => {
                        toggle(heading, id);
                    }}
                >
                    <div className={styles.firstLevel}>
                        <div
                            className={
                                open ? `${styles.accordionHeading} ${styles.addColor}` : `${styles.accordionHeading}`
                            }
                        >
                            {heading}
                        </div>
                        <div className={styles.rightMenu}>
                            <div className={styles.accordionMenuPopover} onClick={e => e.stopPropagation()}>
                                <MenuPopover
                                    isMenuOpen={menuOpenedRowDetail.current === heading || menuOpenedRow === heading}
                                    menuItems={menuItems}
                                    toggleMenu={(toggleType: string, menuId: string) => {
                                        if (toggleType === 'close') {
                                            menuOpenedRowDetail.current = null;
                                            setOpenedRow(null);
                                        } else if (toggleType === 'open') {
                                            menuOpenedRowDetail.current = null;
                                            setOpenedRow(heading);
                                            menuOpenedRowDetail.current = heading;
                                        } else if (toggleType === 'selectedOption') {
                                            menuOpenedRowDetail.current = null;
                                            setOpenedRow(null);

                                            if (menuId === 'delete') {
                                                handleDelete();
                                            } else if (menuId === 'loadWizard') {
                                                handleLoadWizard();
                                            } else if (menuId === 'viewCode') {
                                                handleViewCode();
                                            }
                                        }
                                    }}
                                    CustomMenu={undefined}
                                    disabledText={undefined}
                                    isBlackLayout={true}
                                />
                            </div>
                            <div className={styles['panel-collapse']}>
                                <Arrow className={!open ? styles['arrow-up'] : ''} width={18} height={18} />
                            </div>
                        </div>
                    </div>

                    <Typography
                        variant="Regular_13"
                        className={open ? `${styles.secondLevel} ${styles.addColor}` : `${styles.secondLevel}`}
                    >
                        Creation date: {subHeading}
                    </Typography>
                </div>
                {open && (
                    <div className={styles.contentArea}>
                        <Typography variant="Regular_13" className={styles.contentText}>
                            Deployment: Number of Execution
                        </Typography>
                        <div className={styles.extraSpace} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Accordion;
