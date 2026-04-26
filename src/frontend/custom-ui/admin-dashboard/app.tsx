import React from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@forge/bridge';
import { ConfigurationTab } from './components/ConfigurationTab';
import { OverviewTab } from './components/OverviewTab';
import { useProjectConfig } from './hooks/useProjectConfig';
import { useAdminData } from './hooks/useAdminData';
import { useAuditLog } from './hooks/useAuditLog';
import type { TabIdentifier } from './types';

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const TAB_STYLE: React.CSSProperties = {
  padding: '6px 12px',
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
};

const TABS: ReadonlyArray<{ readonly id: TabIdentifier; readonly label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'auditLog', label: 'Audit Log' },
];

// ═══════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════

const TabButton = ({
  label,
  active,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}): React.ReactElement => (
  <button
    onClick={onClick}
    style={{
      ...TAB_STYLE,
      background: active ? '#0052CC' : '#F4F5F7',
      color: active ? 'white' : '#172B4D',
    }}
  >
    {label}
  </button>
);

/** Audit log tab — consumes useAuditLog hook data directly */
const AuditTab = ({
  loading,
  error,
  entries,
  hasMore,
  onLoadMore,
}: {
  readonly loading: boolean;
  readonly error: string | null;
  readonly entries: ReadonlyArray<{ readonly action: string; readonly timestamp: string }>;
  readonly hasMore: boolean;
  readonly onLoadMore: () => void;
}): React.ReactElement => {
  if (loading && entries.length === 0) return <p>Loading audit log...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (entries.length === 0) return <p>No audit log entries.</p>;
  return (
    <div>
      {entries.map((entry, i) => (
        <div key={i} style={{ padding: '8px', borderBottom: '1px solid #DFE1E6' }}>
          <strong>{entry.action}</strong> &mdash; {entry.timestamp}
        </div>
      ))}
      {hasMore && (
        <button onClick={onLoadMore} style={{ marginTop: '8px' }}>
          Load more
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// PROJECT KEY RESOLUTION
// ═══════════════════════════════════════════

/**
 * Fetches the projectKey from Forge context via the getProjectConfig resolver.
 * The admin dashboard is rendered inside a Jira admin page, so we can extract
 * the projectKey from the resolver context. Falls back to the first project found.
 */
const fetchProjectKey = async (): Promise<string> => {
  try {
    const response = await invoke<{ success: boolean; data?: { projectKey: string } }>(
      'getProjectConfig',
      { projectKey: 'DEFAULT' },
    );
    if (response.success && response.data?.projectKey) {
      return response.data.projectKey;
    }
  } catch {
    // Fallback: use DEFAULT project key
  }
  return 'DEFAULT';
};

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════

const AdminDashboard = (): React.ReactElement => {
  const [projectKey, setProjectKey] = React.useState<string>('DEFAULT');
  const [activeTab, setActiveTab] = React.useState<TabIdentifier>('overview');

  // Fetch projectKey on mount
  React.useEffect(() => {
    void fetchProjectKey().then(setProjectKey);
  }, []);

  // All hooks require projectKey — [UI-ADS-201] hooks at top level
  const configState = useProjectConfig(projectKey);
  const adminData = useAdminData(projectKey);
  const auditLog = useAuditLog(projectKey);

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }}
    >
      <h2 style={{ marginBottom: '16px' }}>Rovo Execution Guard</h2>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '1px solid #DFE1E6',
          paddingBottom: '8px',
        }}
      >
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>
      {activeTab === 'overview' && (
        <OverviewTab
          metrics={adminData.data}
          loading={adminData.loading}
          error={adminData.error}
          onRevalidate={() => {
            void adminData.refresh();
          }}
        />
      )}
      {activeTab === 'configuration' && (
        <ConfigurationTab
          config={configState.data}
          loading={configState.loading}
          error={configState.error}
          saving={configState.saving}
          onSave={configState.saveConfig}
        />
      )}
      {activeTab === 'auditLog' && (
        <AuditTab
          loading={auditLog.loading}
          error={auditLog.error}
          entries={auditLog.data}
          hasMore={auditLog.pagination.hasMore}
          onLoadMore={auditLog.loadMore}
        />
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AdminDashboard />);
}
