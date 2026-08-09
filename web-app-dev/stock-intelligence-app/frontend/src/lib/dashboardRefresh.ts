export const DASHBOARD_REFRESH_EVENT = "trade-craft-dashboard-refresh";

export function triggerDashboardRefresh(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT));
}

export function onDashboardRefresh(listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;
    const handler = () => listener();
    window.addEventListener(DASHBOARD_REFRESH_EVENT, handler);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, handler);
}
