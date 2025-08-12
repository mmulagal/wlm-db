import { Typography } from '@netapp/design-system';
import { ReactComponent as Add } from '../../../../assets/ic_add.svg';
import { ReactComponent as Remove } from '../../../../assets/ic_remove.svg';
import styles from './DBAccordion.module.scss';

type AccordionContent = {
    heading: string;
    content: any;
    toggle: any;
    open: boolean;
    resourceLoading?: boolean;
};

const DbAccordion = ({ heading, toggle, open, content, resourceLoading }: AccordionContent) => {
    return (
        <div className={resourceLoading ? `${styles.dbAccordion} ${styles.disabledApplied}` : `${styles.dbAccordion}`}>
            <div
                className={!open ? `${styles.accordionContainer} ${styles.addBorder}` : `${styles.accordionContainer}`}
            >
                <div className={styles.accordionHeader} onClick={() => toggle(heading)}>
                    <div className={styles.firstLevel}>
                        <Typography variant="Semibold_14" className={styles.accordionHeading}>
                            {heading}
                        </Typography>

                        <div className={styles.rightMenu}>{open ? <Remove /> : <Add />}</div>
                    </div>
                </div>
                {open && <div className={styles.contentBorder}>{content}</div>}
            </div>
        </div>
    );
};

export default DbAccordion;
