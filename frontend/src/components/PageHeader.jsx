import React from "react";

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="page-title">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-4" data-testid="empty-state">
    {Icon && (
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
    )}
    <h3 className="text-lg font-semibold">{title}</h3>
    {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const Loader = ({ label = "Loading…" }) => (
  <div className="flex items-center justify-center py-20" data-testid="section-loader">
    <div className="flex items-center gap-3 text-muted-foreground text-sm">
      <div className="h-4 w-4 rounded-full border-2 border-[#B8FF00] border-t-transparent animate-spin" />
      {label}
    </div>
  </div>
);
