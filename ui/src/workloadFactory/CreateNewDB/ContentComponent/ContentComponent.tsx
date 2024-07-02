import { AccordionController, DsTypography } from '@netapp/design-system';

import styles from './ContentComponent.module.scss';
import DatabaseName from './DatabaseInformation/DatabaseName/DatabaseName';
import FilesSize from './FileSettings/FilesSize/FilesSize';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import FileSettingsMode from './FileSettings/FileSettingsMode/FileSettingsMode';
import FileNames from './FileSettings/FileNames/FileNames';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import {
    useGetCollationListQuery,
    useGetCollationListV2Query,
    useGetDriveInfoQuery,
    useGetDriveInfoV2Query
} from '../../../utils/apiService';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
    setCollationList,
    setCollationListLoading,
    setDriveInfoList,
    setDriveInfoListLoading
} from '../../../store/workloadFactory/createNewDBSlice';
import Collation from './DatabaseInformation/Collation/Collation';

const ContentComponent = () => {
    const dispatch = useDispatch();
    const { dbHostName, instanceId, instanceName } = useAppSelector(state => state.createNewUser);
    const { resourceId, isInventoryV2 } = useAppSelector(state => state.auth);
    const selectedCredId = useAppSelector(state => state.headers.headerSelectedCred);
    const selectedRegionCode = useAppSelector(state => state.headers.headerSelectedRegion);

    const { data: driveInfoList, isFetching: driveInfoListLoading } = useGetDriveInfoQuery(
        {
            credentialId: selectedCredId?.data?.credentialsId,
            region: selectedRegionCode?.data?.regionCode,
            id: resourceId
        },
        { skip: isInventoryV2 }
    );

    const { data: collationList, isFetching: collationListLoading } = useGetCollationListQuery(
        {
            credentialId: selectedCredId?.data?.credentialsId,
            region: selectedRegionCode?.data?.regionCode,
            id: resourceId
        },
        { skip: isInventoryV2 }
    );

    const { data: driveInfoListV2, isFetching: driveInfoListLoadingV2 } = useGetDriveInfoV2Query(
        {
            credentialId: selectedCredId?.data?.credentialsId,
            region: selectedRegionCode?.data?.regionCode,
            id: resourceId,
            instanceId
        },
        { skip: !isInventoryV2 }
    );

    const { data: collationListV2, isFetching: collationListLoadingV2 } = useGetCollationListV2Query(
        {
            credentialId: selectedCredId?.data?.credentialsId,
            region: selectedRegionCode?.data?.regionCode,
            id: resourceId,
            instanceId
        },
        { skip: !isInventoryV2 }
    );

    useEffect(() => {
        if (!isInventoryV2) {
            dispatch(setDriveInfoList(driveInfoList));
            dispatch(setDriveInfoListLoading(driveInfoListLoading));
        }
    }, [driveInfoList, driveInfoListLoading]);

    useEffect(() => {
        if (isInventoryV2) {
            dispatch(setDriveInfoList(driveInfoListV2));
            dispatch(setDriveInfoListLoading(driveInfoListLoadingV2));
        }
    }, [driveInfoListV2, driveInfoListLoadingV2]);

    useEffect(() => {
        if (!isInventoryV2) {
            dispatch(setCollationList(collationList));
            dispatch(setCollationListLoading(collationListLoading));
        }
    }, [collationList, collationListLoading]);

    useEffect(() => {
        if (isInventoryV2) {
            dispatch(setCollationList(collationListV2));
            dispatch(setCollationListLoading(collationListLoadingV2));
        }
    }, [collationListV2, collationListLoadingV2]);

    return (
        <div className={`${styles.contentComponent} ${CommonStyles['accordion-group']}`}>
            <DsTypography variant="Semibold_20" className={styles.heading}>
                {GENERAL.CREATE_USER_DB_TITLE}
            </DsTypography>
            <DsTypography variant="Semibold_16" className={styles.headingHost}>
                {`${GENERAL.DB_CREATE_HOST} ${dbHostName}${
                    isInventoryV2 ? ` | ${GENERAL.DB_CREATE_INSTANCE} ${instanceName}` : ''
                }`}
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
