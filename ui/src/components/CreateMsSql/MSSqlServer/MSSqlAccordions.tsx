import { AccordionController, Button, Typography, useDialog } from '@netapp/design-system';

import { GENERAL } from '../../../utils/appConstants';
import AvailabilityZone from '../AwsSettings/AvailabilityZone/AvailabilityZone';
import AwsAccount from '../AwsSettings/AwsAccount/AwsAccount';
import RegionVpc from '../AwsSettings/RegionVpc/RegionVpc';
import SecurityGroup from '../AwsSettings/SecurityGroup/SecurityGroup';
import OperatingSystem from '../ApplicationSettings/OperatingSystem/OperatingSystem';
import DatabaseDeploymentModel from '../ApplicationSettings/DatabaseDeploymentModel/DatabaseDeploymentModel';
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
import MssqlApis from './MssqlApis';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import CloudWatch from '../InfrastructureSettings/CloudWatch/CloudWatch';
import ViewAPIRequest from './ViewAPIRequest/ViewAPIRequest';
import EstimatedCost from '../Cost/EstimatedCost';

const MSSqlAccordions = () => {
    const { setDialog } = useDialog();

    MssqlApis();

    const handleViewAPIRequest = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.API_REQUEST}
                content={<ViewAPIRequest />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
            />
        );
    };

    return (
        <div className={`${styles['aws-settings']} ${CommonStyles['accordion-group']}`}>
            <AccordionController isGrouped>
                <div className={styles['header-buttons']}>
                    <Typography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                    >
                        {GENERAL.AWS_SETTINGS}
                    </Typography>
                    <Button
                        onClick={handleViewAPIRequest}
                        Component="button"
                        variant="text"
                        className={styles.buttonClass}
                    >
                        {GENERAL.VIEW_API_REQUEST}
                    </Button>
                </div>
                {/* AWS Accounts Accordion */}
                {/* <MssqlApis /> */}
                <AwsAccount />
                <RegionVpc />
                <AvailabilityZone />
                <SecurityGroup />

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
                <OperatingSystem />
                <DatabaseDeploymentModel />
                <DatabaseEdition />
                <DatabaseVersion />
                <License />
                <DatabaseName />
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
                <InstanceType />
                <FSxNSystem />
                <StorageCapacity />
                <ProvisionedIOPS />
                <ThroughputCapacity />
                <Encryption />
                <Tags />
                <SimpleNotificationService />
                <CloudWatch />
                {/* Ends here */}

                {/* Cost */}
                {/* <Typography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                    className={styles.adjustMargin}
                >
                    {GENERAL.COST}
                </Typography>
                <EstimatedCost /> */}
            </AccordionController>
        </div>
    );
};

export default MSSqlAccordions;
