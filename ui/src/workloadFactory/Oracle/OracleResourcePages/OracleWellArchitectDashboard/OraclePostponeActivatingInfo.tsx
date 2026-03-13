import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import { ActivatingInfo, PostponeInfo, calculatePostponeInfo } from '../../../GetWell/GetWellHelper';

const useOraclePostponeInfo = () => {
    const { t } = useTranslation();
    const { cardData } = useAppSelector(state => state.getWellOptimize);

    const getPostponeInfo = useMemo(() => (key: string) => calculatePostponeInfo(cardData, key), [cardData]);

    const renderPostponeActivatingInfo = useCallback(
        (configKey: string, showDismissedConfigurations: boolean) => (
            <>
                {showDismissedConfigurations && (
                    <PostponeInfo configKey={configKey} getPostponeInfo={getPostponeInfo} translation={t} />
                )}
                {!showDismissedConfigurations && (
                    <ActivatingInfo configKey={configKey} cardData={cardData} translation={t} />
                )}
            </>
        ),
        [getPostponeInfo, cardData, t]
    );

    return { cardData, getPostponeInfo, renderPostponeActivatingInfo };
};

export default useOraclePostponeInfo;
