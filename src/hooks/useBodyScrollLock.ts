import { useEffect } from 'react';

/**
 * Fija el scroll del <body> mientras `locked` es true, para que al abrir una
 * ventana (modal) la pantalla de atrás no se mueva ni haga scroll.
 * Soporta varios modales abiertos a la vez mediante un contador global.
 */
let lockCount = 0;
let previousOverflow = '';

export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [locked]);
}
