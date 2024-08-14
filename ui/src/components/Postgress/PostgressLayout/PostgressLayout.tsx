import { AccordionController, Button, Typography } from '@netapp/design-system';
import styles from './PostgressLayout.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import AwsAccount from '../../CreateMsSql/AwsSettings/AwsAccount/AwsAccount';
import RegionVpc from '../../CreateMsSql/AwsSettings/RegionVpc/RegionVpc';
import AvailabilityZone from '../../CreateMsSql/AwsSettings/AvailabilityZone/AvailabilityZone';
import License from '../../CreateMsSql/ApplicationSettings/License/License';
import SqlServerCollation from '../../CreateMsSql/ApplicationSettings/Collation/SqlServerCollation';
import DatabaseName from '../../CreateMsSql/ApplicationSettings/DatabaseName/DatabaseName';
import DatabaseCredentials from '../../CreateMsSql/ApplicationSettings/DatabaseCredentials/DatabaseCredentials';
import KeyPair from '../../CreateMsSql/Connectivity/KeyPair/KepPair';
import InstanceType from '../../CreateMsSql/InfrastructureSettings/InstanceType/InstanceType';
import FSxNSystem from '../../CreateMsSql/InfrastructureSettings/FSXNSystem/FSxNSystem';
import SnapshotPolicy from '../../CreateMsSql/InfrastructureSettings/SnapshotPolicy/SnapshotPolicy';
import ProvisionedIOPS from '../../CreateMsSql/InfrastructureSettings/ProvisionedIOPS/ProvisionedIOPS';
import ThroughputCapacity from '../../CreateMsSql/InfrastructureSettings/ThroughputCapacity/ThroughputCapacity';
import Encryption from '../../CreateMsSql/InfrastructureSettings/Encryption/Encryption';
import Tags from '../../CreateMsSql/InfrastructureSettings/Tags/Tags';
import SimpleNotificationService from '../../CreateMsSql/InfrastructureSettings/SimpleNotificationService/SimpleNotificationService';
import CloudWatch from '../../CreateMsSql/InfrastructureSettings/CloudWatch/CloudWatch';
import ResourceRollBack from '../../CreateMsSql/InfrastructureSettings/ResourceRollBack/ResourceRollBack';

function PostgressLayout() {
    return (
        <div className={`${styles['aws-settings']} ${CommonStyles['accordion-group']} ${styles.protectLayout}`}>
            <AccordionController isGrouped>
                <div className={styles['header-buttons']}>
                    <Typography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                        className={styles.adjustMargin}
                    >
                        {GENERAL.LANDING_ZONE}
                    </Typography>
                </div>
                <AwsAccount />
                <RegionVpc />
                <AvailabilityZone />

                <Typography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                    className={styles.adjustMargin}
                >
                    {GENERAL.APPLICATION_SETTINGS}
                </Typography>
                <>
                    <DatabaseCredentials />
                </>

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
                <KeyPair />

                <Typography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                    className={styles.adjustMargin}
                >
                    {GENERAL.INFRASTRUCTURE_SETTINGS}
                </Typography>

                <>
                    <InstanceType />
                    <FSxNSystem />
                    <SnapshotPolicy />
                    <ProvisionedIOPS />
                    <ThroughputCapacity />
                    <Encryption />
                    <Tags />
                    <SimpleNotificationService />
                    <CloudWatch />
                    <ResourceRollBack />
                </>
            </AccordionController>
        </div>
    );
}

export default PostgressLayout;
