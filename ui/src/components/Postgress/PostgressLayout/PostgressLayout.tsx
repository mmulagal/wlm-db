import { AccordionController, Typography } from '@netapp/design-system';
import styles from './PostgressLayout.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import AwsAccount from '../../CreateMsSql/AwsSettings/AwsAccount/AwsAccount';
import RegionVpc from '../../CreateMsSql/AwsSettings/RegionVpc/RegionVpc';
import AvailabilityZone from '../../CreateMsSql/AwsSettings/AvailabilityZone/AvailabilityZone';

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
import SelectConfig from '../../CreateMsSql/SelectConfig/SelectConfig';
import { useAppSelector } from '../../../store/storeHooks';
import PostgreDeploymentModel from '../PostgreDeploymentModel/PostgreDeploymentModel';
import EstimatedCost from '../../CreateMsSql/Cost/EstimatedCost';
import PostgreOperatingSystem from '../PostgreOperatingSystem/PostgreOperatingSystem';
import PostgreVersion from '../PostgreVersion/PostgreVersion';
import PostgreServerName from '../PostgreServerName/PostgreServerName';

import { DBType, WIZARD_TYPE } from '../../../utils/consts';
import SecurityGroup from '../../CreateMsSql/AwsSettings/SecurityGroup/SecurityGroup';
import StorageCapacity from '../../CreateMsSql/InfrastructureSettings/StorageCapacity/StorageCapacity';
import PreviewDefaultPostgres from '../PreviewDefaultPostgre/PreviewDefaultPostgre';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setSelectedDatabaseType } from '../../../store/postgre/postgreFormSlice';

function PostgressLayout() {
    const selectedConfig = useAppSelector(state => state.mssqlForm.selectConfig);
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setSelectedDatabaseType(DBType.POSTGRESQL));
    }, []);

    return (
        <>
            <div className={`${styles['aws-settings']} ${CommonStyles['accordion-group']} ${styles.protectLayout}`}>
                <SelectConfig isDisabled={false} wizardType={WIZARD_TYPE.PGSQL} />
                <AccordionController isGrouped>
                    {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && (
                        <div className={styles['header-buttons']}>
                            <Typography
                                style={{
                                    padding: '0 0 8px',
                                    marginTop: '40px'
                                }}
                                variant="Semibold_16"
                            >
                                {GENERAL.DEPLOYMENT_MODEL}
                            </Typography>
                        </div>
                    )}

                    {/* Deployment model accordions */}
                    {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <PostgreDeploymentModel />}

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
                    <div className={styles['pgsql-availability-zone']}>
                        <AvailabilityZone wizardType={WIZARD_TYPE.PGSQL} />
                    </div>
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
                    <>
                        {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <PostgreOperatingSystem />}
                        {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <PostgreVersion />}
                        {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <PostgreServerName />}
                        <DatabaseCredentials wizardType={WIZARD_TYPE.PGSQL} />
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
                        {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <InstanceType />}
                        <FSxNSystem wizardType={WIZARD_TYPE.PGSQL} />
                        {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && <SnapshotPolicy />}
                        <StorageCapacity wizardType={WIZARD_TYPE.PGSQL} />
                        {selectedConfig === SELECT_CONFIG.STANDARD_CREATE && (
                            <>
                                <ProvisionedIOPS />
                                <ThroughputCapacity />
                                <Encryption />
                                <Tags />
                                <SimpleNotificationService />
                                <CloudWatch wizardType={WIZARD_TYPE.PGSQL} />
                                <ResourceRollBack />
                            </>
                        )}
                    </>

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
                    {selectedConfig === SELECT_CONFIG.EASY_CREATE && <PreviewDefaultPostgres />}
                    <EstimatedCost wizardType={WIZARD_TYPE.PGSQL} />
                    <div style={{ marginBottom: '40px' }} />
                </AccordionController>
            </div>
        </>
    );
}

export default PostgressLayout;
