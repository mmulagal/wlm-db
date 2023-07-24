import { ReactComponent as StandardCreate } from "../../assets/standard-create.svg";
import { ReactComponent as BlueTick } from "../../assets/blue-tick.svg";
import { ReactComponent as EasyCreate } from "../../assets/easy-create.svg";

import styles from "./SelectConfig.module.scss";
import { Tag } from "@netapp/design-system";
import { SELECT_CONFIG } from "../../utils/appConstants";
const SelectConfig = () => {
  return (
    <div className={styles["select-config"]}>
      {/* Standard create section here */}
      <div className={styles["standard-create"]}>
        <StandardCreate />
        <div className={styles["standard-create-content"]}>
          <div className={styles["standard-create-heading"]}>
            {SELECT_CONFIG.STANDARD_CREATE}
          </div>
          <div className={styles["standard-create-content-text"]}>
            {SELECT_CONFIG.STANDARD_CREATE_CONTENT}
          </div>
        </div>
        <div className={styles["tick-placement"]}>
          <BlueTick />
        </div>
      </div>

      {/* Easy create section from here */}
      <div className={styles["easy-create"]}>
        <EasyCreate />
        <div className={styles["easy-create-content"]}>
          <div className={styles["easy-create-heading"]}>
            {SELECT_CONFIG.EASY_CREATE}
          </div>
          <div className={styles["easy-create-content-text"]}>
            {SELECT_CONFIG.EASY_CREATE_CONTENT}
          </div>
        </div>
        <div className={styles["tag"]}>
          <Tag backgroundColor="var(--chart-9)">
            {SELECT_CONFIG.COMING_SOON}
          </Tag>
        </div>
      </div>
    </div>
  );
};

export default SelectConfig;
