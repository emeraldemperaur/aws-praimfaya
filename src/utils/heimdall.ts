export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type MetricUnit = 'Count' | 'Milliseconds' | 'Seconds' | 'Bytes' | 'Percent';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  traceId?: string;
  component?: string;
  [key: string]: any;
}

export interface TelemetrySink {
  name: string;
  log(level: LogLevel, message: string, context: LogContext): void;
  metric(name: string, value: number, unit: MetricUnit, tags: Record<string, string>): void;
}

class TelemetryEngine {
  private sinks: TelemetrySink[] = [];
  private globalContext: LogContext = {};

  public registerSink(sink: TelemetrySink) {
    this.sinks.push(sink);
  }

  public setGlobalContext(context: Partial<LogContext>) {
    this.globalContext = { ...this.globalContext, ...context };
  }

  private dispatchLog(level: LogLevel, message: string, localContext?: LogContext) {
    const mergedContext = { ...this.globalContext, ...localContext, timestamp: new Date().toISOString() };
    this.sinks.forEach(sink => {
      try { sink.log(level, message, mergedContext); } catch (e) { /* swallow */ }
    });
  }

  public debug(msg: string, ctx?: LogContext) { this.dispatchLog('debug', msg, ctx); }
  public info(msg: string, ctx?: LogContext) { this.dispatchLog('info', msg, ctx); }
  public warn(msg: string, ctx?: LogContext) { this.dispatchLog('warn', msg, ctx); }
  public error(msg: string, err?: Error | unknown, ctx?: LogContext) {
    const errorCtx = err instanceof Error ? { errorName: err.name, errorMessage: err.message, stack: err.stack } : { rawError: String(err) };
    this.dispatchLog('error', msg, { ...ctx, ...errorCtx });
  }

  public trackMetric(name: string, value: number, unit: MetricUnit = 'Count', tags: Record<string, string> = {}) {
    const mergedTags = { env: process.env.NODE_ENV || 'development', ...tags };
    this.sinks.forEach(sink => {
      try { sink.metric(name, value, unit, mergedTags); } catch (e) {  }
    });
  }
}

export const Telemetry = new TelemetryEngine();


export class HttpTelemetrySink implements TelemetrySink {
  name = 'HttpIngest';
  private endpoint: string;
  private apiKey: string;
  private logQueue: any[] = [];
  private isFlushing = false;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly FLUSH_THRESHOLD = 50;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    
    if (typeof window !== 'undefined') {
      setInterval(() => this.flush(), 5000);
      window.addEventListener('beforeunload', () => this.flush(true));
      window.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') this.flush(true);
      });
    }
  }

  log(level: LogLevel, message: string, context: LogContext) {
    this.enqueue({ level, message, ...context });
  }

  metric(name: string, value: number, unit: MetricUnit, tags: Record<string, string>) {
    this.enqueue({ type: 'metric', name, value, unit, tags, timestamp: new Date().toISOString() });
  }

  private enqueue(event: any) {
    if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
        this.logQueue.shift(); 
    }
    this.logQueue.push(event);
    if (this.logQueue.length >= this.FLUSH_THRESHOLD) {
        this.flush();
    }
  }

  private async flush(isUnloading = false) {
    if (this.logQueue.length === 0 || this.isFlushing) return;
    
    this.isFlushing = true;
    const payload = [...this.logQueue];
    this.logQueue = [];

    const safePayload = isUnloading ? payload.slice(-20) : payload;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}`, 'DD-API-KEY': this.apiKey },
        body: JSON.stringify(safePayload),
        keepalive: isUnloading 
      });

      if (!response.ok && !isUnloading) {
         this.logQueue = [...payload, ...this.logQueue].slice(-this.MAX_QUEUE_SIZE);
      }
    } catch {
       if (!isUnloading) {
           this.logQueue = [...payload, ...this.logQueue].slice(-this.MAX_QUEUE_SIZE);
       }
    } finally {
        this.isFlushing = false;
    }
  }
}