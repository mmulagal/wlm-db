import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';
import styles from './DefineTag.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';

const DefineTag = () => {
    const setHeader = () => {
        return <DsTypography variant="Regular_14">Dev</DsTypography>;
    };
    return (
        <div className={styles.defineTag}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="4"
                title={<div className={CommonStyles.title}>{'Define tag'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>Content here</DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DefineTag;
