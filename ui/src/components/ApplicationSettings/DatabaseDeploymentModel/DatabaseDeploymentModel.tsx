import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './DatabaseDeploymentModel.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setSelectedDBDeploymentModel } from '../../../store/mssql/mssqlFormSlice';

const DatabaseDeploymentModel = () => {
    const dispatch = useDispatch();
    const [deploymentModel, setDeploymentModel] = useState(GENERAL.FAILOVER_CLUSTER);
    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{deploymentModel}</Typography>;
    };
    return (
        <div className={styles['db-deployment']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="6"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_DEPLOYMENT_MODEL}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.failOver}>
                            <RadioButton
                                isChecked={deploymentModel === GENERAL.FAILOVER_CLUSTER}
                                onChange={() => {
                                    setDeploymentModel(GENERAL.FAILOVER_CLUSTER);
                                    dispatch(setSelectedDBDeploymentModel(GENERAL.FAILOVER_CLUSTER));
                                }}
                                children={GENERAL.FAILOVER_CLUSTER}
                                className={styles.radio}
                            />
                            <Typography variant="Regular_14" className={styles.failoverText}>
                                {GENERAL.FAILOVER_CLUSTER_TEXT}
                            </Typography>
                        </div>
                        <div className={styles.failOver}>
                            <RadioButton
                                isChecked={deploymentModel === GENERAL.SINGLE_INSTANCE}
                                onChange={() => {
                                    setDeploymentModel(GENERAL.SINGLE_INSTANCE);
                                }}
                                children={GENERAL.SINGLE_INSTANCE}
                                className={styles.radio}
                                isDisabled
                            />
                            <Typography variant="Regular_14" className={styles.failoverTextDisabled}>
                                {GENERAL.SINGLE_INSTANCE_TEXT}
                            </Typography>
                            <div className={styles.separator} />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseDeploymentModel;
