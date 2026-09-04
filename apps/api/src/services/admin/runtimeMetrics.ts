/**
 * In-process health counters shared by HTTP, sockets, and the admin System Health page.
 *
 * AdminHandler owns the buffers the dashboard reads. Callers that are not the handler
 * (request logger, error handler, connection/match) go through this sink so those
 * methods are actually invoked.
 */
export interface RuntimeMetricsSink {
  trackError(message: string): void;
  trackMatch(matchTime: number): void;
  trackFailedMatch(): void;
  trackConnection(): void;
  trackDisconnection(): void;
  trackRequest(responseTime: number): void;
}

let sink: RuntimeMetricsSink | null = null;

export function registerRuntimeMetrics(next: RuntimeMetricsSink): void {
  sink = next;
}

export const runtimeMetrics: RuntimeMetricsSink = {
  trackError(message) {
    sink?.trackError(message);
  },
  trackMatch(matchTime) {
    sink?.trackMatch(matchTime);
  },
  trackFailedMatch() {
    sink?.trackFailedMatch();
  },
  trackConnection() {
    sink?.trackConnection();
  },
  trackDisconnection() {
    sink?.trackDisconnection();
  },
  trackRequest(responseTime) {
    sink?.trackRequest(responseTime);
  },
};
