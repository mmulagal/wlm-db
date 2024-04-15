import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import styles from './EBSCalculation.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

const EBSCalculation = () => {
    const setHeader = () => {
        return <DsTypography variant="Regular_14">$XXX</DsTypography>;
    };
    return (
        <div className={styles.ebsCalculation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="2"
                title={<div>Microsoft SQL server on EBS calculation</div>}
            >
                <AccordionCardContent>
                    <DsTypography>Content</DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default EBSCalculation;
