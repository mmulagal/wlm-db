import {
  Button,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogLayout,
  useDialog,
} from "@netapp/design-system";
import { ReactNode } from "react";

type DialogProps = {
  header: string;
  content: ReactNode | string;
  primaryButton: string;
  secondaryButton: string;
  callback: () => void;
};

const DialogComponent = ({
  header,
  content,
  primaryButton,
  secondaryButton,
  callback,
}: DialogProps) => {
  const { closeDialog } = useDialog();

  return (
    <DialogLayout>
      <DialogHeader>{header}</DialogHeader>
      <DialogContent>{content}</DialogContent>
      <DialogFooter>
        <Button
          variant={"primary"}
          className={"continue-button"}
          isThin={true}
          onClick={() => {
            callback();
            closeDialog();
          }}
        >
          {primaryButton}
        </Button>
        <Button
          variant={"secondary"}
          isThin={true}
          onClick={() => closeDialog(null)}
        >
          {secondaryButton}
        </Button>
      </DialogFooter>
    </DialogLayout>
  );
};

export default DialogComponent;
