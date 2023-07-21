import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import ActionRequired from "../../../common/ActionRequired/ActionRequired";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const FSxNSystem = () => {
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
        id="15"
        title={<div className={CommonStyles.title}>{GENERAL.FSXN_SYSTEM}</div>}
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default FSxNSystem;
