import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import styles from './OntapCalculation.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

const OntapCalculation = () => {
    const setHeader = () => {
        return <DsTypography variant="Regular_14">$XXX</DsTypography>;
    };
    return (
        <div className={styles.ontapCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div>Microsoft SQL server on FSx for ONTAP calculation</div>}
            >
                <AccordionCardContent>
                    <DsTypography>Content</DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default OntapCalculation;
