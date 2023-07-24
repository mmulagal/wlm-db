import { ReactComponent as ActionRequiredIcon } from "../../assets/action-required.svg";
import styles from "./ActionRequired.module.scss";

const ActionRequired = () => {
  return (
    <div className={styles["action-required"]}>
      <ActionRequiredIcon />
      <div className={styles.text}>Action required</div>
    </div>
  );
};

export default ActionRequired;
