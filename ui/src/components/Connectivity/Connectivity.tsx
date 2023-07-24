import { AccordionController, Typography } from "@netapp/design-system";
import { GENERAL } from "../../utils/appConstants";

import CommonStyles from "../../utils/CommonStyles.module.scss";
import ActiveDirectory from "./ActiveDirectory/ActiveDirectory";
import KeyPair from "./KeyPair/KepPair";

const Connectivity = () => {
  return (
    <div className={CommonStyles["accordion-group"]}>
      <AccordionController isGrouped>
        <Typography
          style={{
            padding: "0 0 8px",
          }}
          variant="Semibold_16"
        >
          {GENERAL.CONNECTIVITY}
        </Typography>

        {/* Connectivity accordions */}
        <KeyPair />
        <ActiveDirectory />
        {/* Ends here */}
      </AccordionController>
    </div>
  );
};

export default Connectivity;
