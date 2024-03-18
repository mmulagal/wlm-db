import { AccordionCard, AccordionCardContent, DsTypography, Popover, ToggleSelector } from '@netapp/design-system';

import styles from './ResourceRollBack.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

const ResourceRollBack = () => {
    const setHeader = () => {
        return <DsTypography variant="Regular_14">{'Disabled'}</DsTypography>;
    };
    const handleChange = () => {};
    return (
        <div className={styles.resourceRollback}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="23"
                title={<div className={CommonStyles.title}>{GENERAL.RESOURCE_ROLLBACK}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <Popover
                            popoverClass={styles['popover-resource']}
                            children={"Resources rollback isn't supported"}
                            trigger="hover"
                            container={
                                <ToggleSelector
                                    className={styles.toggleClass}
                                    value={false}
                                    isDisabled={false}
                                    onChange={() => {}}
                                >
                                    {GENERAL.RESOURCE_ROLLBACK}
                                </ToggleSelector>
                            }
                        />

                        <DsTypography variant="Regular_14" className={styles.subText1}>
                            {GENERAL.RESOURCE_TEXT_ONE}
                        </DsTypography>
                        <DsTypography variant="Regular_14" className={styles.subText2}>
                            {GENERAL.RESOURCE_TEXT_TWO}
                        </DsTypography>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default ResourceRollBack;
