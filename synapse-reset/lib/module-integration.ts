export type IntegrationPriority = "low" | "medium" | "high";

export interface ModuleIntegrationEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  type: string;
  source: string;
  deeplink?: string;
  readOnly: true;
}

export interface ModuleIntegrationNotification {
  id: string;
  title: string;
  body?: string;
  type: string;
  priority: IntegrationPriority;
  timestamp: string;
  deeplink?: string;
}

export interface ModuleIntegrationQuickAction {
  id: string;
  title: string;
  deeplink: string;
}

export interface ModuleIntegrationTodayCard {
  title: string;
  subtitle: string;
  priority: IntegrationPriority;
  deeplink: string;
}

export interface ModuleIntegrationObservation {
  source: string;
  type: string;
  priority: IntegrationPriority;
  title: string;
  timestamp: string;
  deeplink?: string;
}

export interface ModuleIntegrationService<
  DashboardSummary,
  Observation extends ModuleIntegrationObservation = ModuleIntegrationObservation,
> {
  getDashboardSummary(): Promise<DashboardSummary>;
  getUpcomingEvents(): Promise<ModuleIntegrationEvent[]>;
  getNotifications(): Promise<ModuleIntegrationNotification[]>;
  getQuickActions(): Promise<ModuleIntegrationQuickAction[]>;
  getTodayCard(): Promise<ModuleIntegrationTodayCard>;
  getObservations(): Promise<Observation[]>;
}
