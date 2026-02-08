import { useCallback, useState } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * Maneja un modal de confirmacion basado en promesas.
 * Permite pedir confirmacion y resolverla de forma centralizada.
 */
export function useConfirm(): {
  confirmState: ConfirmState | null;
  askConfirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (value: boolean) => void;
} {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const askConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const resolveConfirm = useCallback(
    (value: boolean) => {
      if (confirmState) {
        confirmState.resolve(value);
        setConfirmState(null);
      }
    },
    [confirmState]
  );

  return { confirmState, askConfirm, resolveConfirm };
}
