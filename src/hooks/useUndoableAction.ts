import { useCallback, useEffect, useRef, useState } from 'react';

const UNDO_WINDOW_MS = 8000;

export function useUndoableAction() {
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    actionRef.current = null;
    setIsPending(false);
  }, []);

  const schedule = useCallback((action: () => void) => {
    cancel();
    actionRef.current = action;
    setIsPending(true);
    timerRef.current = setTimeout(() => {
      const pendingAction = actionRef.current;
      actionRef.current = null;
      timerRef.current = null;
      setIsPending(false);
      pendingAction?.();
    }, UNDO_WINDOW_MS);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { isPending, schedule, cancel };
}
