import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';

import styles from './PostgreDeploymentModel.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';

import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { SQL_DEPLOYMENT_MODE } from '../../../utils/consts';
import { setSelectedDBDeploymentModel } from '../../../store/mssql/mssqlFormSlice';

const PostgreDeploymentModel = () => {
    const dispatch = useDispatch();
    const deploymentModel = useAppSelector(state => state.mssqlForm.dbDeploymentModel);

    //Set the Header text here
    const setHeader = () => {
        return (
            <Typography variant="Regular_14">
                {deploymentModel?.label === GENERAL.FAILOVER_CLUSTER
                    ? GENERAL.HIGH_AVAILABILITY
                    : GENERAL.STANDALONE_INSTANCE}
            </Typography>
        );
    };
    return (
        <div className={styles['db-deployment']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="6"
                title={<div className={CommonStyles.title}>Deployment model</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.failOver}>
                            <RadioButton
                                isChecked={deploymentModel?.label === GENERAL.FAILOVER_CLUSTER}
                                onChange={() => {
                                    dispatch(
                                        setSelectedDBDeploymentModel({
                                            label: GENERAL.FAILOVER_CLUSTER,
                                            value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
                                        })
                                    );
                                }}
                                children={GENERAL.HIGH_AVAILABILITY}
                                className={styles.radio}
                                data-testid="wlm-db-deployment-model-high-availability"
                            />
                            <Typography variant="Regular_14" className={styles.failoverText}>
                                {GENERAL.PGSQL_HA}
                            </Typography>
                        </div>

                        <div className={styles.separator} />
                        <div className={styles.failOver}>
                            <RadioButton
                                isChecked={deploymentModel?.label === GENERAL.SINGLE_INSTANCE}
                                onChange={() => {
                                    dispatch(
                                        setSelectedDBDeploymentModel({
                                            label: GENERAL.SINGLE_INSTANCE,
                                            value: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                                        })
                                    );
                                }}
                                children={GENERAL.STANDALONE_INSTANCE}
                                className={styles.radio}
                                data-testid="wlm-db-deployment-model-standalone"
                            />
                            <Typography variant="Regular_14" className={styles.failoverText}>
                                {GENERAL.PGSQL_STANDALONE}
                            </Typography>
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default PostgreDeploymentModel;
