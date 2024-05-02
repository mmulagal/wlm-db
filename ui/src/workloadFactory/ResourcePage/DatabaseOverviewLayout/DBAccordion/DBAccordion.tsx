import { ReactComponent as Add } from '../../../../assets/ic_add.svg';
import { ReactComponent as Remove } from '../../../../assets/ic_remove.svg';
import { Typography } from '@netapp/design-system';
import styles from './DBAccordion.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';

type AccordionContent = {
    heading: string;
    content: any;
    toggle: any;
    open: boolean;
};

const DbAccordion = ({ heading, toggle, open, content }: AccordionContent) => {
    const { resourceLoading } = useAppSelector(state => state.workloadFactoryResource);

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
