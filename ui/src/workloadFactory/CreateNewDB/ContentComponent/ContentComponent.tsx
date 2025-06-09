import { AccordionController, DsTypography } from '@netapp/design-system';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import styles from './ContentComponent.module.scss';
import DatabaseName from './DatabaseInformation/DatabaseName/DatabaseName';
import FilesSize from './FileSettings/FilesSize/FilesSize';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import FileSettingsMode from './FileSettings/FileSettingsMode/FileSettingsMode';
import FileNames from './FileSettings/FileNames/FileNames';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { useGetCollationListV2Query, useGetDriveInfoV2Query } from '../../../utils/apiService';
import {
    setCollationList,
    setCollationListLoading,
    setDriveInfoList,
    setDriveInfoListLoading
} from '../../../store/workloadFactory/createNewDBSlice';
import Collation from './DatabaseInformation/Collation/Collation';

const ContentComponent = () => {
    const dispatch = useDispatch();
    const { dbHostName, instanceId, instanceName, cdbCredId, cdbRegionId } = useAppSelector(
        state => state.createNewUser
    );
    const { resourceId } = useAppSelector(state => state.auth);

    const { data: driveInfoListV2, isFetching: driveInfoListLoadingV2 } = useGetDriveInfoV2Query({
        credentialId: cdbCredId,
        region: cdbRegionId,
        id: resourceId,
        instanceId
    });

    const { data: collationListV2, isFetching: collationListLoadingV2 } = useGetCollationListV2Query({
        credentialId: cdbCredId,
        region: cdbRegionId,
        id: resourceId,
        instanceId
    });

    useEffect(() => {
        dispatch(setDriveInfoList(driveInfoListV2));
        dispatch(setDriveInfoListLoading(driveInfoListLoadingV2));
    }, [driveInfoListV2, driveInfoListLoadingV2]);

    useEffect(() => {
        dispatch(setCollationList(collationListV2));
        dispatch(setCollationListLoading(collationListLoadingV2));
    }, [collationListV2, collationListLoadingV2]);

    return (
        <div className={`${styles.contentComponent} ${CommonStyles['accordion-group']}`}>
            <DsTypography variant="Semibold_20" className={styles.heading}>
                {GENERAL.CREATE_USER_DB_TITLE}
            </DsTypography>
            <DsTypography variant="Semibold_16" className={styles.headingHost}>
                {`${GENERAL.DB_CREATE_HOST} ${dbHostName}${` | ${GENERAL.DB_CREATE_INSTANCE} ${instanceName}`}`}
            </DsTypography>

            <div className={styles.accordionContainer}>
                <AccordionController isGrouped>
                    <DsTypography variant="Semibold_16" className={styles.accordionContainer}>
                        {GENERAL.DATABASE_INFORMATION}
                    </DsTypography>
                    <DatabaseName />
                    <Collation />
                    <DsTypography variant="Semibold_16" className={styles.accordionContainer}>
                        {GENERAL.FILE_SETTINGS}
                    </DsTypography>
                    <FileSettingsMode />
                    <FileNames />
                    <FilesSize />
                </AccordionController>
            </div>
        </div>
    );
};

export default ContentComponent;
