import { Alert, AlertTitle, Button, Stack } from "@mui/material";

type Props = {
  message: string;
  onRetry?: () => void;
  onOpenAccount?: () => void;
  onDismiss?: () => void;
};

export default function ConnectionBanner({ message, onRetry, onOpenAccount, onDismiss }: Props) {
  return (
    <Alert
      severity="error"
      data-testid="connection-banner"
      onClose={onDismiss}
      action={
        <Stack direction="row" spacing={1}>
          {onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              重试
            </Button>
          )}
          {onOpenAccount && (
            <Button color="inherit" size="small" onClick={onOpenAccount}>
              检查账号
            </Button>
          )}
        </Stack>
      }
    >
      <AlertTitle>无法连接邮箱</AlertTitle>
      {message}
    </Alert>
  );
}
