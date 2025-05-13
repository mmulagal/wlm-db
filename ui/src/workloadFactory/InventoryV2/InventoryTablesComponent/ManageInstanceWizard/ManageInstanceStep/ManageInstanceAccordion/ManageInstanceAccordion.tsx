import React from 'react';
import styles from './ManageInstanceAccordion.module.scss';
import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Arrow } from '../../../../../../assets/row arrow2.svg';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Cross } from '../../../../../../assets/black-cross.svg';

export type AccordionItem = {
    id: string;
    title: string;
    subtitle?: string;
    readinessStatus: string;
    disabled?: boolean;
    content: React.ReactNode;
    image: any;
    missingPermission?: boolean;
};

type AccordionProps = {
    items: AccordionItem[];
    expandedId: string | null;
    setExpandedId: any;
    disableAll?: boolean;
};

export const ManageInstanceAccordion: React.FC<AccordionProps> = ({
    items,
    expandedId,
    setExpandedId,
    disableAll = false
}) => {
    const handleToggle = (id: string) => {
        if (disableAll) return;
        setExpandedId((prev: any) => (prev === id ? null : id));
    };

    return (
        <div className={styles['accordion-container']}>
            {items.map(item => (
                <div
                    key={item.id}
                    className={`${styles['accordion-item']} 
            ${expandedId === item.id ? styles['expanded'] : ''} 
            ${disableAll || item.disabled ? styles['disabled'] : ''}`}
                >
                    <div className={styles['accordion-header-wrapper']}>
                        <div className={styles['accordion-header']} onClick={() => handleToggle(item.id)}>
                            <div className={styles['accordion-title']}>
                                <div className={styles.imageContainer}>{item.image}</div>

                                <div className={styles.valueSection}>
                                    <DsTypography variant="Semibold_14">{item.title}</DsTypography>
                                    <DsTypography variant="Regular_14">{item.subtitle}</DsTypography>
                                </div>
                            </div>

                            <div className={styles.readinessSection}>
                                <div className={styles.valueSection}>
                                    <div className={styles.statusSection}>
                                        {!item?.missingPermission && <Success />}
                                        {item?.missingPermission && <Cross />}
                                        <DsTypography variant="Semibold_14">{item.readinessStatus}</DsTypography>
                                    </div>

                                    <DsTypography variant="Regular_14">Readiness</DsTypography>
                                </div>
                            </div>
                            <div className={styles['accordion-status']}>
                                <DsTypography className={styles.text} variant="Semibold_14">
                                    View prerequisites list
                                </DsTypography>
                                <Arrow />
                            </div>
                        </div>
                    </div>
                    {expandedId === item.id && <div className={styles['accordion-content']}>{item.content}</div>}
                </div>
            ))}
        </div>
    );
};
