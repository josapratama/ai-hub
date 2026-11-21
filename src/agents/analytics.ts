export interface AuditLogEntry {
  id: string;
  timestamp: string;
  project: string;
  toolName: string;
  status: "success" | "error";
  durationMs: number;
  details?: string;
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  cameraName: string;
  objectClass: string;
  isLoitering: boolean;
  snapshotUrl?: string;
  summary: string;
  dispatchedToWA: boolean;
}

class AgentAnalyticsManager {
  private totalRequests = 0;
  private toolInvocations: Record<string, number> = {};
  private auditLogs: AuditLogEntry[] = [];
  private securityAlerts: SecurityAlert[] = [];
  private readonly maxLogs = 100;

  incrementRequests() {
    this.totalRequests++;
  }

  recordToolExecution(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const log: AuditLogEntry = { id, timestamp, ...entry };

    this.toolInvocations[entry.toolName] = (this.toolInvocations[entry.toolName] || 0) + 1;
    this.auditLogs.unshift(log);

    if (this.auditLogs.length > this.maxLogs) {
      this.auditLogs.pop();
    }
    return log;
  }

  recordSecurityAlert(alert: Omit<SecurityAlert, "id" | "timestamp">) {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const fullAlert: SecurityAlert = { id, timestamp, ...alert };

    this.securityAlerts.unshift(fullAlert);
    if (this.securityAlerts.length > this.maxLogs) {
      this.securityAlerts.pop();
    }
    return fullAlert;
  }

  getSummary() {
    return {
      totalRequests: this.totalRequests,
      totalToolCalls: Object.values(this.toolInvocations).reduce((a, b) => a + b, 0),
      toolCallsBreakdown: this.toolInvocations,
      recentAuditLogs: this.auditLogs.slice(0, 30),
      recentSecurityAlerts: this.securityAlerts.slice(0, 15),
    };
  }
}

export const agentAnalytics = new AgentAnalyticsManager();
