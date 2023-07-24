import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import ActionRequired from "../../../common/ActionRequired/ActionRequired";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const ActiveDirectory = () => {
  //Set the Header text here
  const setHeader = () => {
    return <ActionRequired />;
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="13"
        title={
          <div className={CommonStyles.title}>{GENERAL.ACTIVE_DIRECTORY}</div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default ActiveDirectory;
