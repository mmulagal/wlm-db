import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './DatabaseDeploymentModel.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedDBDeploymentModel } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { SQL_DEPLOYMENT_MODE } from '../../../../utils/consts';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const DatabaseDeploymentModel = () => {
    const dispatch = useDispatch();
    const deploymentModel = useAppSelector(state => state.mssqlForm.dbDeploymentModel);

    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{deploymentModel?.label}</Typography>;
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
                                isChecked={deploymentModel?.label === GENERAL.FAILOVER_CLUSTER}
                                onChange={() => {
                                    dispatch(
                                        setSelectedDBDeploymentModel({
                                            label: GENERAL.FAILOVER_CLUSTER,
                                            value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
                                        })
                                    );
                                    dispatch(setIsWizardTouched(true));
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
                                isChecked={deploymentModel?.label === GENERAL.SINGLE_INSTANCE}
                                onChange={() => {
                                    dispatch(
                                        setSelectedDBDeploymentModel({
                                            label: GENERAL.SINGLE_INSTANCE,
                                            value: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                                        })
                                    );
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.SINGLE_INSTANCE}
                                className={styles.radio}
                            />
                            <Typography variant="Regular_14" className={styles.failoverText}>
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
