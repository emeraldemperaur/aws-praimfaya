import util from 'util';

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

const safeStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'string' && value.length > 5000) {
        return value.substring(0, 5000) + '...[TRUNCATED]';
      }
      return value;
    });
  } catch (err) {
    return util.inspect(obj, { depth: 2 });
  }
};

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
      try { sink.log(level, message, mergedContext); } catch (e) {  }
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


export class StructuredStdoutSink implements TelemetrySink {
  name = 'StructuredStdout';

  log(level: LogLevel, message: string, context: LogContext) {
    const payload = safeStringify({
      level: level.toUpperCase(),
      message,
      ...context
    });
    
    if (level === 'error' || level === 'warn') console.error(payload);
    else console.log(payload);
  }

  metric(name: string, value: number, unit: MetricUnit, tags: Record<string, string>) {
    const safeDimensions: string[] = [];
    const payloadContext: Record<string, any> = {};

    Object.entries(tags).forEach(([key, val]) => {
      if (['userId', 'sessionId', 'traceId', 'email', 'invoiceId', 'terminalId'].includes(key)) {
        payloadContext[key] = val; 
      } else {
        safeDimensions.push(key); 
        payloadContext[key] = val;
      }
    });

    console.log(safeStringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [{ 
            Namespace: 'Vanguard/Application', 
            Dimensions: [safeDimensions], 
            Metrics: [{ Name: name, Unit: unit }] 
        }]
      },
      [name]: value,
      ...payloadContext
    }));
  }
}