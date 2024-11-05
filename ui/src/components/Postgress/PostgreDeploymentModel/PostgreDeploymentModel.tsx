import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';

import styles from './PostgreDeploymentModel.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';

import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { SQL_DEPLOYMENT_MODE } from '../../../utils/consts';
import { setPostgreDeploymentType } from '../../../store/postgre/postgreFormSlice';

const PostgreDeploymentModel = () => {
    const dispatch = useDispatch();
    const deploymentModel = useAppSelector(state => state.postgreForm.postgreDeploymentType);

    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{deploymentModel}</Typography>;
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
                                isChecked={deploymentModel === GENERAL.STANDALONE_INSTANCE}
                                onChange={() => {
                                    dispatch(setPostgreDeploymentType(GENERAL.STANDALONE_INSTANCE));
                                }}
                                children={GENERAL.STANDALONE_INSTANCE}
                                className={styles.radio}
                            />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.failOver}>
                            <RadioButton
                                isChecked={deploymentModel === GENERAL.HIGH_AVAILABILITY}
                                onChange={() => {
                                    dispatch(setPostgreDeploymentType(GENERAL.HIGH_AVAILABILITY));
                                }}
                                children={GENERAL.HIGH_AVAILABILITY}
                                className={styles.radio}
                                isDisabled={true}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default PostgreDeploymentModel;
