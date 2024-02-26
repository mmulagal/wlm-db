import { AccordionController, Button, Typography, useDialog } from '@netapp/design-system';

import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import AvailabilityZone from '../AwsSettings/AvailabilityZone/AvailabilityZone';
import AwsAccount from '../AwsSettings/AwsAccount/AwsAccount';
import RegionVpc from '../AwsSettings/RegionVpc/RegionVpc';
import SecurityGroup from '../AwsSettings/SecurityGroup/SecurityGroup';
import OperatingSystem from '../ApplicationSettings/OperatingSystem/OperatingSystem';
import DatabaseDeploymentModel from '../DeploymentModel/DatabaseDeploymentModel/DatabaseDeploymentModel';
import DatabaseEdition from '../ApplicationSettings/DatabaseEdition/DatabaseEdition';
import DatabaseVersion from '../ApplicationSettings/DatabaseVersion/DatabaseVersion';
import License from '../ApplicationSettings/License/License';
import DatabaseName from '../ApplicationSettings/DatabaseName/DatabaseName';
import DatabaseCredentials from '../ApplicationSettings/DatabaseCredentials/DatabaseCredentials';
import KeyPair from '../Connectivity/KeyPair/KepPair';
import ActiveDirectory from '../Connectivity/ActiveDirectory/ActiveDirectory';
import InstanceType from '../InfrastructureSettings/InstanceType/InstanceType';
import FSxNSystem from '../InfrastructureSettings/FSXNSystem/FSxNSystem';
import StorageCapacity from '../InfrastructureSettings/StorageCapacity/StorageCapacity';
import ProvisionedIOPS from '../InfrastructureSettings/ProvisionedIOPS/ProvisionedIOPS';
import ThroughputCapacity from '../InfrastructureSettings/ThroughputCapacity/ThroughputCapacity';
import Encryption from '../InfrastructureSettings/Encryption/Encryption';
import Tags from '../InfrastructureSettings/Tags/Tags';
import SimpleNotificationService from '../InfrastructureSettings/SimpleNotificationService/SimpleNotificationService';

import styles from './MSSqlAccordions.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import CloudWatch from '../InfrastructureSettings/CloudWatch/CloudWatch';
import EstimatedCost from '../Cost/EstimatedCost';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import PreviewDefault from '../Cost/PreviewDefault/PreviewDefault';
import { createMssqlPayload } from './MSSqlFooter/createSqlServer';
import ViewDialog from '../../../common/ViewDialog/ViewDialog';
import { useEffect, useState } from 'react';
import { setMovingFromChatbot } from '../../../store/chatbot/chatbotSlice';
import ResourceRollBack from '../InfrastructureSettings/ResourceRollBack/ResourceRollBack';

const MSSqlAccordions = () => {
    const { setDialog } = useDialog();
    const selectedConfig = useAppSelector(state => state.mssqlForm.selectConfig);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const { vpcLoading } = useAppSelector(state => state.mssql.getVPCList);
    const [isVpcLoadingStarted, setIsVpcLoadingStarted] = useState(false);
    const state = useAppSelector(state => state);
    const dispatch = useAppDispatch();

    const handleViewAPIRequest = () => {
        const data = JSON.stringify(createMssqlPayload(state), null, 2);
        setDialog(
            <DialogComponent
                header={GENERAL.API_REQUEST}
                content={<ViewDialog data={data} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
            />
        );
    };

    useEffect(() => {
        if (vpcLoading) {
            setIsVpcLoadingStarted(true);
        } else if (isVpcLoadingStarted && !vpcLoading) {
            dispatch(setMovingFromChatbot(false));
            setIsVpcLoadingStarted(false);
        }
    }, [vpcLoading]);

    return (
        <div className={`${styles['aws-settings']} ${CommonStyles['accordion-group']}`}>
            <AccordionController isGrouped>
                {/* Deployment model heading added in case of Standard create */}
                {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && (
                    <div className={styles['header-buttons']}>
                        <Typography
                            style={{
                                padding: '0 0 8px'
                            }}
                            variant="Semibold_16"
                        >
                            {GENERAL.DEPLOYMENT_MODEL}
                        </Typography>
                        {!isWorkloadFactory && (
                            <Button
                                onClick={handleViewAPIRequest}
                                Component="button"
                                variant="text"
                                className={styles.buttonClass}
                            >
                                {GENERAL.VIEW_API_REQUEST}
                            </Button>
                        )}
                    </div>
                )}

                {/* Deployment model accordions */}
                {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <DatabaseDeploymentModel />}
                {/* Ends here */}

                <div className={styles['header-buttons']}>
                    <Typography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                        className={selectedConfig === SELECT_CONFIG.STANDARD_CREATE ? styles.adjustMargin : ''}
                    >
                        {GENERAL.AWS_SETTINGS}
                    </Typography>
                    {/* View API request added here in case of easy create otherwise added as part of Deployment Model */}
                    {selectedConfig === SELECT_CONFIG.EASY_CREATE && !isWorkloadFactory && (
                        <Button
                            onClick={handleViewAPIRequest}
                            Component="button"
                            variant="text"
                            className={styles.buttonClass}
                        >
                            {GENERAL.VIEW_API_REQUEST}
                        </Button>
                    )}
                </div>
                {/* AWS Accounts Accordion */}
                {/* <MssqlApis /> */}
                <AwsAccount />
                <RegionVpc />
                <AvailabilityZone />
                {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <SecurityGroup />}

                <Typography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                    className={styles.adjustMargin}
                >
                    {GENERAL.APPLICATION_SETTINGS}
                </Typography>

                {/* Application settings accordions */}
                {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && (
                    <>
                        <OperatingSystem />
                        <DatabaseEdition />
                        <DatabaseVersion />
                        <License />
                        <DatabaseName />
                    </>
                )}

                <DatabaseCredentials />
                {/* Ends here */}

                <div className={styles['header-buttons']}>
                    <Typography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                        className={styles.adjustMargin}
                    >
                        {GENERAL.CONNECTIVITY}
                    </Typography>
                </div>
                {/* Connectivity accordions */}
                <KeyPair />

                <ActiveDirectory />
                {/* Ends here */}

                <Typography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                    className={styles.adjustMargin}
                >
                    {GENERAL.INFRASTRUCTURE_SETTINGS}
                </Typography>

                {/* Infra settings accordions */}
                {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <InstanceType />}

                <FSxNSystem />
                <StorageCapacity />

                {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && (
                    <>
                        <ProvisionedIOPS />
                        <ThroughputCapacity />
                        <Encryption />
                        <Tags />
                        <SimpleNotificationService />
                        <CloudWatch />
                        {/* <ResourceRollBack /> */}
                    </>
                )}

                {/* Ends here */}

                {/* Cost */}

                <>
                    <Typography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                        className={styles.adjustMargin}
                    >
                        {GENERAL.SUMMARY}
                    </Typography>
                </>
                {selectedConfig === SELECT_CONFIG.EASY_CREATE && <PreviewDefault />}
                <EstimatedCost />
            </AccordionController>
        </div>
    );
};

export default MSSqlAccordions;
