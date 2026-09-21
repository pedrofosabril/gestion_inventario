declare global {
  interface NiimbotPrinterInfo {
    modelId?: number;
    protocolVersion?: number;
    label?: string;
    task?: string;
    dpi?: number;
  }

  interface NiimbotModel {
    label: string;
    id: number;
    dpi: number;
    protocol?: string;
    task: string;
    density: number;
    label_type: number;
    speed: number;
    name_prefixes: string[];
  }

  interface NiimbotSize {
    label: string;
    code: string;
    w_mm: number;
    h_mm: number;
    w_px: number;
    h_px: number;
    margin?: number;
    offset_y_px?: number;
    dpi: number;
  }

  interface NiimbotPrintOptions {
    model: NiimbotModel;
    size: NiimbotSize;
    copies?: number;
    offsetY?: number;
    onProgress?: (status: string) => void;
  }

  interface NiimbotApi {
    isSupported(): boolean;
    connect(model?: NiimbotModel): Promise<void>;
    disconnect(): void;
    identify(model?: NiimbotModel): Promise<NiimbotPrinterInfo>;
    printImage(url: string, opts: NiimbotPrintOptions): Promise<void>;
    printBatch(urls: string[], opts: NiimbotPrintOptions): Promise<void>;
    printer: NiimbotPrinterInfo | undefined;
  }

  interface Window {
    Niimbot?: NiimbotApi;
  }
}

export {};