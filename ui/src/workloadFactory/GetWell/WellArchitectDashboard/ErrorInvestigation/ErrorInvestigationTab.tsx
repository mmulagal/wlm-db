import { useAppSelector } from '../../../../store/storeHooks';
import { ERROR_ANALYZER_STATUS } from '../../../../utils/consts';
import ErrorInvestigation from './ErrorInvestigation';
import ActivatingScreen from './LogAnalyzerOnboarding/ActivatingScreen/ActivatingScreen';
import LogAnalyzerOnboarding from './LogAnalyzerOnboarding/LogAnalyzerOnboarding';

const ErrorInvestigationTab = () => {
    const { logAnalyzerState } = useAppSelector(state => state?.agenticAI);
    return (
        <>
            {logAnalyzerState === ERROR_ANALYZER_STATUS.ACTIVE && <ErrorInvestigation />}
            {logAnalyzerState === ERROR_ANALYZER_STATUS.NOT_ACTIVE && <LogAnalyzerOnboarding />}
            {logAnalyzerState === ERROR_ANALYZER_STATUS.RUNNING && <ActivatingScreen />}
        </>
    );
};

export default ErrorInvestigationTab;
