import { NIIMBOT_T50X30_B1, NIIMBOT_B1_MODEL, renderLabelToCanvas } from './niimbotPrinter';

const NIIMBOT_USB_VID = 0x3513;
const NIIMBOT_USB_PID = 0x0002;
const SERIAL_BAUD = 115200;
const PAGE_WAIT_MS = 25000;

export const isUsbNiimbotSupported = (): boolean => !!navigator.serial;

interface PendingWait {
  cmd: number | null;
  resolve: (frame: { cmd: number; data: number[] } | null) => void;
}

function pack(cmd: number, data: number[]): Uint8Array {
  const pkt = new Uint8Array(7 + data.length);
  pkt[0] = 0x55; pkt[1] = 0x55; pkt[2] = cmd; pkt[3] = data.length;
  let crc = cmd ^ data.length;
  for (let i = 0; i < data.length; i++) { pkt[4 + i] = data[i]; crc ^= data[i]; }
  pkt[4 + data.length] = crc & 0xff;
  pkt[5 + data.length] = 0xaa; pkt[6 + data.length] = 0xaa;
  return pkt;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NiimbotSerialClient {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buf: number[] = [];
  private pending: PendingWait | null = null;
  private reading = false;

  private onStatus?: (s: string) => void;

  constructor(onStatus?: (s: string) => void) {
    this.onStatus = onStatus;
  }

  async connect(): Promise<void> {
    if (!navigator.serial) throw new Error('Web Serial no está disponible en este navegador. Usá Chrome o Edge.');
    if (this.port) return;

    let port: SerialPort;
    try {
      port = await navigator.serial.requestPort({ filters: [{ usbVendorId: NIIMBOT_USB_VID, usbProductId: NIIMBOT_USB_PID }] });
    } catch (err: any) {
      if (err?.name === 'NotFoundError') throw new Error('Selección cancelada.');
      throw err;
    }

    await port.open({ baudRate: SERIAL_BAUD });
    this.port = port;
    this.buf = [];
    this.reading = true;
    this.reader = port.readable!.getReader();
    this.writer = port.writable!.getWriter();
    this.readLoop();
  }

  private async readLoop(): Promise<void> {
    const reader = this.reader!;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const b of value) this.buf.push(b);
        this.drainBuffer();
      }
    } catch {
      // stream closed/aborted
    } finally {
      this.reading = false;
      if (this.pending) {
        const p = this.pending; this.pending = null;
        p.resolve(null);
      }
    }
  }

  // Extract complete frames [55 55 cmd len ...data crc aa aa] from the buffer.
  private drainBuffer(): void {
    while (this.buf.length >= 7) {
      // Resync to a potential frame start.
      if (this.buf[0] !== 0x55 || this.buf[1] !== 0x55) { this.buf.shift(); continue; }
      const cmd = this.buf[2];
      const len = this.buf[3];
      const total = 7 + len;
      if (this.buf.length < total) return; // wait for more bytes
      if (this.buf[6 + len] !== 0xaa || this.buf[5 + len] !== 0xaa) { this.buf.shift(); continue; }
      const data = this.buf.slice(4, 4 + len);
      this.buf.splice(0, total);
      // crc byte = frame[4+len]; accepted leniently (some models differ)
      if (this.pending && (this.pending.cmd === null || this.pending.cmd === cmd)) {
        const p = this.pending; this.pending = null;
        p.resolve({ cmd, data });
      }
    }
  }

  private async writeFrame(cmd: number, data: number[]): Promise<void> {
    await this.writer!.write(pack(cmd, data));
  }

  private async sendWait(cmd: number, data: number[], wantResp: number | null, timeoutMs: number): Promise<{ cmd: number; data: number[] } | null> {
    const rep = new Promise<{ cmd: number; data: number[] } | null>((resolve) => {
      this.pending = { cmd: wantResp, resolve };
    });
    await this.writeFrame(cmd, data);
    const res = await Promise.race([rep, sleep(timeoutMs).then(() => null) as any]);
    if (this.pending && this.pending.cmd === wantResp) this.pending = null;
    return res;
  }

  async disconnect(): Promise<void> {
    this.reading = false;
    try { if (this.reader) await this.reader.cancel(); } catch {}
    try { if (this.writer) await this.writer.releaseLock(); } catch {}
    try { if (this.port) await this.port.close(); } catch {}
    this.port = null; this.reader = null; this.writer = null; this.buf = [];
    if (this.pending) { const p = this.pending; this.pending = null; p.resolve(null); }
  }

  // Post-connect handshake that "arms" the B1 (0xA5 status, PrinterInfo reads, heartbeat).
  private async b1Handshake(): Promise<void> {
    this.onStatus?.('conectando…');
    await this.sendWait(0xa5, [0x01], 0xb5, 1500);
    for (const sub of [0x08, 0x0b, 0x0d, 0x0a, 0x07, 0x03, 0x0c, 0x09]) {
      await this.sendWait(0x40, [sub], null, 800);
    }
    await this.sendWait(0xdc, [0x04], 0xd9, 1500);
  }

  // Poll 0xA3 → 0xB3 until the printed-page counter reaches `target`.
  private async waitPage(target: number, onProgress: (s: string) => void): Promise<boolean> {
    onProgress('imprimiendo…');
    const t0 = Date.now();
    let lastPage = -1;
    while (Date.now() - t0 < PAGE_WAIT_MS) {
      const st = await this.sendWait(0xa3, [0x01], 0xb3, 900);
      if (st && st.data.length >= 4) {
        const page = (st.data[0] << 8) | st.data[1];
        const print = st.data[2];
        if (page !== lastPage) { lastPage = page; onProgress(`imprimiendo… ${print}%`); }
        if (page >= target) return true;
      }
      await sleep(150);
    }
    return false;
  }

  async printImage(
    url: string,
    opts: {
      copies?: number;
      onProgress?: (s: string) => void;
    } = {}
  ): Promise<void> {
    if (!this.port) throw new Error('Impresora USB no conectada.');
    const copies = Math.max(1, opts.copies | 0);
    const onProgress = opts.onProgress || (() => {});

    const size = NIIMBOT_T50X30_B1;
    const W = size.w_px, H = size.h_px;

    await this.b1Handshake();

    onProgress('configurando…');
    // Density + label type (validate 1–5 like the reference driver).
    const density = NIIMBOT_B1_MODEL.density;
    await this.sendWait(0x21, [density], 0x31, 1500);
    await this.sendWait(0x23, [NIIMBOT_B1_MODEL.label_type], 0x33, 1500);
    // PrintStart (b1: 7b, pages = copies)
    await this.sendWait(0x01, [(copies >> 8) & 0xff, copies & 0xff, 0, 0, 0, 0, 0], 0x02, 2500);

    // PageStart + SetPageSize 6b (rows, cols, copies)
    await this.sendWait(0x03, [0x01], 0x04, 1500);
    await this.sendWait(0x13, [
      (H >> 8) & 0xff, H & 0xff, (W >> 8) & 0xff, W & 0xff,
      (copies >> 8) & 0xff, copies & 0xff,
    ], 0x14, 2500);

    // Row data (burst; USB CDC buffers it, no BLE MTU pacing needed).
    onProgress('enviando imagen…');
    const { buf, stride } = await this.canvasToPacked(url, W, H, size.offset_y_px || 0);
    await this.sendRows(buf, stride, H);

    const acked = await this.sendWait(0xe3, [0x01], 0xe4, 3000);
    if (!acked) {
      await this.sendWait(0xf3, [0x01], 0xf4, 2500); // feed out before failing
      throw new Error('La impresora no confirmó el fin de página. Se envió el corte del papel igual — revisá la etiqueta.');
    }

    const reached = await this.waitPage(copies, onProgress);
    await this.sendWait(0xf3, [0x01], 0xf4, 2500); // PrintEnd
    if (!reached) {
      throw new Error('La impresora no confirmó la impresión completa. Revisá el papel y reintentá.');
    }
    onProgress('ok');
  }

  private async canvasToPacked(url: string, w: number, h: number, offsetY: number): Promise<{ buf: Uint8Array; stride: number }> {
    const bmp = await fetch(url).then((r) => r.blob()).then((b) => createImageBitmap(b));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, offsetY, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const stride = (w + 7) >> 3;
    const buf = new Uint8Array(stride * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (px[i + 3] > 32 && lum < 128) buf[y * stride + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    return { buf, stride };
  }

  private isRowEmpty(buf: Uint8Array, off: number, stride: number): boolean {
    for (let b = 0; b < stride; b++) if (buf[off + b]) return false;
    return true;
  }

  private popcountRow(buf: Uint8Array, off: number, stride: number): number {
    let n = 0;
    for (let b = 0; b < stride; b++) { let v = buf[off + b]; while (v) { n += v & 1; v >>= 1; } }
    return n;
  }

  // Send rows with run-length grouping, identical to the reference driver.
  private async sendRows(buf: Uint8Array, stride: number, h: number): Promise<void> {
    let r = 0;
    while (r < h) {
      const off = r * stride;
      const isVoid = this.isRowEmpty(buf, off, stride);
      let run = 1;
      while (r + run < h && run < 200) {
        let same = true;
        const off2 = (r + run) * stride;
        for (let b = 0; b < stride; b++) if (buf[off + b] !== buf[off2 + b]) { same = false; break; }
        if (!same) break;
        run++;
      }
      if (isVoid) {
        await this.writeFrame(0x84, [(r >> 8) & 0xff, r & 0xff, run]);
      } else {
        const total = this.popcountRow(buf, off, stride);
        const data = [0, 0, 0, 0, 0, 0];
        data[0] = (r >> 8) & 0xff; data[1] = r & 0xff; data[2] = 0;
        data[3] = total & 0xff; data[4] = (total >> 8) & 0xff; data[5] = run;
        data.push(...Array.from(buf.slice(off, off + stride)));
        await this.writeFrame(0x85, data);
      }
      r += run;
    }
  }
}

export async function printToNiimbotUsb(
  item: {
    codigo?: string;
    proveedor?: string;
    descripcion?: string;
    ubicacion?: string;
    codigoBarras?: string;
  },
  options: {
    copies?: number;
    onProgress?: (status: string) => void;
  } = {}
): Promise<void> {
  const canvas = renderLabelToCanvas(item);
  const url = canvas.toDataURL('image/png');

  const client = new NiimbotSerialClient(options.onProgress);
  await client.connect();
  try {
    await client.printImage(url, { copies: options.copies || 1, onProgress: options.onProgress });
  } finally {
    await client.disconnect();
  }
}