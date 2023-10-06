import React, { useState } from 'react';
import { ReactComponent as Arrow } from '../../../assets/Row arrow.svg';
import { ReactComponent as ActionDots } from '../../../assets/table action icon.svg';
import { Typography } from '@netapp/design-system';
import styles from './Accordion.module.scss';

type AccordionContent = {
    heading: string;
    subHeading: string;
    toggle: any;
    open: boolean;
};

const Accordion = ({ heading, subHeading, toggle, open }: AccordionContent) => {
    return (
        <div className={styles.accordions}>
            <div className={open ? `${styles.accordionContainer} ${styles.addBorder}` : `${styles.accordionContainer}`}>
                <div className={styles.accordionHeader} onClick={() => toggle(heading)}>
                    <div className={styles.firstLevel}>
                        <div
                            className={
                                open ? `${styles.accordionHeading} ${styles.addColor}` : `${styles.accordionHeading}`
                            }
                        >
                            {heading}
                        </div>
                        <div className={styles.rightMenu}>
                            <ActionDots />
                            <div className={styles['panel-collapse']}>
                                <Arrow className={!open ? styles['arrow-up'] : ''} width={18} height={18} />
                            </div>
                        </div>
                    </div>

                    <Typography
                        variant="Regular_13"
                        className={open ? `${styles.secondLevel} ${styles.addColor}` : `${styles.secondLevel}`}
                    >
                        {subHeading}
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
