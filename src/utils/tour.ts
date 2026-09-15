import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_SEEN_PREFIX = 'verdu_tour_seen';

const tourSeenKey = (userId: string) => `${TOUR_SEEN_PREFIX}_${userId}_v2`;

export const hasSeenTour = (userId: string): boolean => {
  try {
    return localStorage.getItem(tourSeenKey(userId)) === 'true';
  } catch {
    return false;
  }
};

export const markTourSeen = (userId: string) => {
  try {
    localStorage.setItem(tourSeenKey(userId), 'true');
  } catch {}
};

const dispatchNavigate = (view: string) => {
  window.dispatchEvent(new CustomEvent('verdu-tour-navigate', { detail: view }));
};

// Evita que dos tours corran a la vez (p. ej. por doble montaje en desarrollo).
let activeTour: { destroy: () => void } | null = null;

export const startTour = (rol?: string, userId?: string) => {
  if (activeTour) {
    console.info('[Tour] Ya hay un tour activo, se ignora la nueva petición.');
    return;
  }

  // Bienvenida: centrada en el medio de la pantalla, sin resaltar ningún elemento.
  const welcomeStep: DriveStep = {
    popover: {
      title: '¡Bienvenido/a!',
      description:
        rol === 'gerencia'
          ? 'Este es el panel de administración del pañol. Te mostramos las herramientas principales.'
          : rol === 'panolero'
            ? 'Esta es tu pantalla de trabajo diario: consulta de ubicación, stock e historial.'
            : 'Este es el sistema de gestión de inventario. Te mostramos las herramientas principales.',
      side: 'bottom',
      align: 'center',
    },
  };

  const operacionesStep: DriveStep = {
    element: '#operaciones',
    data: { view: null },
    popover: {
      title: 'Operaciones',
      description: 'Desde aquí podés realizar salidas, entradas y devoluciones de material. Cada operación se registra con código de barras o búsqueda.',
      side: 'bottom',
      align: 'center',
    },
  };

  // Operaciones de la pantalla táctil del pañolero: sus propios botones de SALIDA, DEVOLUCIÓN y ENTRADA.
  const operacionesPanoleroStep: DriveStep = {
    element: '#operaciones-panolero',
    data: { view: null },
    popover: {
      title: 'Operaciones',
      description: 'Tocá SALIDA para retirar repuestos, DEVOLUCIÓN para reintegrar sobrantes o ENTRADA para ingresar stock al pañol.',
      side: 'bottom',
      align: 'center',
    },
  };

  // Anclado a la barra superior de secciones/ubicaciones del inventario (visible en la vista principal).
  const ubicacionesStep: DriveStep = {
    element: '#ubicaciones',
    data: { view: 'panol' },
    waitForElement: 3000,
    popover: {
      title: 'Ubicaciones',
      description: 'Acá podes encontrar cada producto por su ubicacion. Tocá cada sección para ver sus productos.',
      side: 'bottom',
      align: 'center',
    },
  };

  const excelStep: DriveStep = {
    element: '#excel',
    data: { view: 'gerencia' },
    waitForElement: 3000,
    popover: {
      title: 'Carga de Excel',
      description: 'Arrastrá o subí un archivo Excel para importar o actualizar el inventario de forma masiva.',
      side: 'right',
      align: 'center',
    },
  };

  const nuevoProductoStep: DriveStep = {
    element: '#nuevo-producto',
    data: { view: 'gerencia' },
    waitForElement: 3000,
    popover: {
      title: 'Carga de Producto',
      description: 'Registrá un producto nuevo al inventario completando los datos manualmente.',
      side: 'bottom',
      align: 'center',
    },
  };

  const estadisticasStep: DriveStep = {
    element: '#estadisticas',
    data: { view: 'gerencia' },
    waitForElement: 3000,
    popover: {
      title: 'Estadísticas',
      description: 'En esta seccion podemos ver la valuación total, stock crítico, productos sin stock y el desglose por sección.',
      side: 'bottom',
      align: 'center',
    },
  };

  const respaldoStep: DriveStep = {
    element: '#respaldo',
    data: { view: 'gerencia' },
    waitForElement: 3000,
    popover: {
      title: 'Respaldo de base de datos',
      description: 'Acá podés generar una copia de seguridad de toda la base de datos (.json y .csv) o revisar el historial de respaldos.',
      side: 'bottom',
      align: 'center',
    },
  };

  const flechitaStep: DriveStep = {
    element: '#flechita',
    data: { view: 'panol' },
    waitForElement: 3000,
    popover: {
      title: 'Flechita',
      description: 'Con estas flechas podemos ordenar de mayor a menos o viceversa.',
      side: 'bottom',
      align: 'center',
    },
  };

  const buscadorGlobalStep: DriveStep = {
    element: '#buscador-global',
    data: { view: null },
    popover: {
      title: 'Buscador Global',
      description: 'Buscá productos por código, descripción, proveedor, ubicación o código de barras en todo el inventario.',
      side: 'bottom',
      align: 'center',
    },
  };

  const historialStep: DriveStep = {
    element: '#historial',
    data: { view: null },
    popover: {
      title: 'Historial',
      description: 'Acá consultás el historial completo de salidas, entradas y devoluciones del pañol.',
      side: 'bottom',
      align: 'center',
    },
  };

  // Operaciones: SÓLO para el perfil de administración.
  let steps: DriveStep[];
  if (rol === 'gerencia') {
    steps = [
      welcomeStep,
      operacionesStep,
      ubicacionesStep,
      excelStep,
      nuevoProductoStep,
      estadisticasStep,
      respaldoStep,
      flechitaStep,
      buscadorGlobalStep,
    ];
  } else if (rol === 'panolero') {
    // El pañolero tiene sus botones táctiles de operaciones en su pantalla dedicada.
    steps = [welcomeStep, operacionesPanoleroStep, buscadorGlobalStep, historialStep];
  } else {
    // Ventas y otros roles: sin operaciones; mostrar solo pasos cuyos elementos existen.
    steps = [
      welcomeStep,
      ubicacionesStep,
      flechitaStep,
      buscadorGlobalStep,
    ].filter(step => !step.element || !!document.querySelector(step.element as string));
  }

  if (steps.length === 0) {
    console.info('[Tour] No hay pasos disponibles para este rol, se omite.');
    return;
  }

  let driverObj: ReturnType<typeof driver>;
  driverObj = driver({
    showProgress: true,
    skipMissingElement: true,
    duration: 200,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Entendido',
    // driver.js 1.8.0 llama a onNextClick/onPrevClick SIN argumentos desde el botón,
    // por eso tomamos el índice activo de la propia API (getActiveIndex()).
    onNextClick: () => {
      const index = driverObj.getActiveIndex() ?? 0;
      const next = steps[index + 1];
      const view = next?.data?.view;
      if (view) dispatchNavigate(String(view));
      driverObj.moveNext();
    },
    // Al retroceder, preparamos la vista del paso anterior.
    onPrevClick: () => {
      const index = driverObj.getActiveIndex() ?? 0;
      const prev = steps[index - 1];
      const view = prev?.data?.view;
      if (view) dispatchNavigate(String(view));
      driverObj.movePrevious();
    },
    onDestroyStarted: () => {
      if (userId) markTourSeen(userId);
      driverObj.destroy();
    },
    onDestroyed: () => {
      if (userId) markTourSeen(userId);
      activeTour = null;
    },
    steps,
  });

  activeTour = driverObj;
  console.info(`[Tour] Iniciando tutorial para rol: ${rol} (${steps.length} pasos)`);
  driverObj.drive();
};