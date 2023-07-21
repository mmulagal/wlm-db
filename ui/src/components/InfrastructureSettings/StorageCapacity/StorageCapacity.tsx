import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const StorageCapacity = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["1024 GiB"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="16"
        title={
          <div className={CommonStyles.title}>{GENERAL.STORAGE_CAPACITY}</div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default StorageCapacity;
