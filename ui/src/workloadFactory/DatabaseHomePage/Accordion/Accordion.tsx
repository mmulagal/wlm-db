import React, { useState, useRef } from 'react';
import { ReactComponent as Arrow } from '../../../assets/Row arrow.svg';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { ReactComponent as ActionDots } from '../../../assets/table action icon.svg';
import { Typography } from '@netapp/design-system';
import styles from './Accordion.module.scss';

type AccordionContent = {
    heading: string;
    subHeading: string;
    toggle: any;
    open: boolean;
    openedItem?: any;
};

const Accordion = ({ heading, subHeading, toggle, open, openedItem }: AccordionContent) => {
    const [menuOpenedRow, setOpenedRow] = useState<string | null>(null);
    const menuOpenedRowDetail: any = useRef(null);

    const menuItems = [
        {
            id: '1',
            displayName: 'View full info'
        },
        {
            id: '2',
            displayName: 'Clone'
        },
        {
            id: '3',
            displayName: 'Migrate'
        },
        {
            id: '4',
            displayName: 'Protect'
        }
    ];
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
                        toggle(heading);
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
