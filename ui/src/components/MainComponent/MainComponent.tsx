import {
  Button,
  Header,
  StepLayout,
  WizardContent,
  WizardFooter,
} from "@netapp/design-system";
import { SELECT_CONFIG } from "../../utils/appConstants";
import AwsSettings from "../AwsSettings/AwsSettings";
import SelectConfig from "../SelectConfig/SelectConfig";
import styles from "./MainComponent.module.scss";

const MainComponent = () => {
  return (
    <StepLayout className={styles.header}>
      <Header
        closeButtonProps={{
          onClick: function noRefCheck() {},
        }}
        title={SELECT_CONFIG.WIZARD_HEADING}
      >
        <div className={styles["header-button"]}>
          <Button
            Component="button"
            onClick={function noRefCheck() {}}
            variant="text"
          >
            {SELECT_CONFIG.LOAD_CONFIG}
          </Button>
          <div className={styles.separator}></div>
          <Button
            Component="button"
            onClick={function noRefCheck() {}}
            variant="text"
          >
            {SELECT_CONFIG.SAVE_CONFIG}
          </Button>
        </div>
      </Header>
      <WizardContent className={styles.content}>
        <SelectConfig />
        <AwsSettings />
      </WizardContent>
      <WizardFooter>
        <Button variant="secondary" isThin>
          {SELECT_CONFIG.CANCEL}
        </Button>
        <Button isThin>{SELECT_CONFIG.CONTINUE}</Button>
      </WizardFooter>
    </StepLayout>
  );
};

export default MainComponent;
