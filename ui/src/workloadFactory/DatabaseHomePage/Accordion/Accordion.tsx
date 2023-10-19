import React, { useState, useRef } from 'react';
import { ReactComponent as Arrow } from '../../../assets/Row arrow.svg';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { ReactComponent as ActionDots } from '../../../assets/table action icon.svg';
import { Typography } from '@netapp/design-system';
import styles from './Accordion.module.scss';
import { useDeleteConfigMutation, useLazyGetConfigDataQuery } from '../../../utils/apiService';
import { useDispatch } from 'react-redux';
import { setIsLoading, setIsRecommendedInstance } from '../../../store/mssql/msSqlActionSlice';
import {
    LoadConfiguration,
    LoadRecommendedConfig
} from '../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { useNavigate } from 'react-router-dom';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';
import { setRecommendedValues } from '../../../utils/utilityFunctions';
import { CODE_VIEWER, GENERAL } from '../../../utils/appConstants';
import { initialMssqlState } from '../../../store/mssql/mssqlFormSlice';

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
    viewCode?: any;
    recommended?: boolean; //recommended templates check
};

const Accordion = ({
    heading,
    subHeading,
    toggle,
    open,
    openedItem,
    id,
    configRefetch,
    isExpanded,
    expand,
    viewCode,
    recommended
}: AccordionContent) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [menuOpenedRow, setOpenedRow] = useState<string | null>(null);
    const menuOpenedRowDetail: any = useRef(null);
    const [deleteConfigApi] = useDeleteConfigMutation();
    const [loadConfigDataExe] = useLazyGetConfigDataQuery();

    // Default menu items applicable for all
    const menuItems = [
        {
            id: 'viewCode',
            displayName: CODE_VIEWER.VIEW_CODE
        },
        {
            id: 'loadWizard',
            displayName: CODE_VIEWER.MENU_LOAD_WIZARD
        }
    ];

    // Add rename and delete if it is saved config but not recommended template
    const savedConfigMenu = () => {
        if (!recommended) {
            menuItems.push({
                id: 'rename',
                displayName: CODE_VIEWER.RENAME
            });
            menuItems.push({
                id: 'delete',
                displayName: CODE_VIEWER.DELETE
            });
        }
        return menuItems;
    };

    const handleDelete = () => {
        deleteConfigApi({ configId: id }).then((data: any) => {
            configRefetch();
        });
    };

    const handleLoadWizard = () => {
        dispatch(setIsLoading(true));
        navigate(WLF_TO_FORM_NAVIGATE);
        if (recommended) {
            // Load config by setting recommended data in initial state
            const data = setRecommendedValues(initialMssqlState, id || '');
            dispatch(setIsRecommendedInstance(data?.instanceType));
            LoadRecommendedConfig(dispatch, data);
        } else {
            // Load config by getting data from load config API and update in form
            LoadConfiguration(dispatch, loadConfigDataExe, null, id);
        }
    };

    const handleViewCode = () => {
        if (!isExpanded) {
            expand();
        }
        viewCode(heading, id);
    };

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
                                    menuItems={savedConfigMenu()}
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
                    {/* Creation date will be shown only for saved config but not for recommended templates*/}
                    {!recommended && (
                        <Typography
                            variant="Regular_13"
                            className={open ? `${styles.secondLevel} ${styles.addColor}` : `${styles.secondLevel}`}
                        >
                            {CODE_VIEWER.CREATION_DATE} {subHeading}
                        </Typography>
                    )}
                </div>
                {open && (
                    <div className={styles.contentArea}>
                        <Typography variant="Regular_13" className={styles.contentText}>
                            {CODE_VIEWER.DEPLOYMENT} {GENERAL.NUMBER_OF_EXECUTION}
                        </Typography>
                        <div className={styles.extraSpace} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Accordion;
