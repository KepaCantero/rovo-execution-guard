import { token } from '@atlaskit/tokens';
import SectionMessage from '@atlaskit/section-message';
import Button from '@atlaskit/button';
import Spinner from '@atlaskit/spinner';
import type { GraphHealthReport } from '../../../../backend/services/relationship-index/graph-maintenance';

interface RelationshipIndexTabProps {
  readonly health: GraphHealthReport | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onBootstrap: () => void;
}

function MetricCard({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly testId: string;
}): React.ReactElement {
  return (
    <div
      style={{
        flex: '1 1 150px',
        padding: '16px',
        border: `1px solid ${token('color.border')}`,
        borderRadius: '4px',
      }}
    >
      <div style={{ fontSize: '12px', color: token('color.text.subtlest') }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 600 }} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

export function RelationshipIndexTab(props: RelationshipIndexTabProps): React.ReactElement {
  const { health, loading, error, refreshing, onRefresh, onBootstrap } = props;

  if (loading) {
    return <Spinner testId="relationship-index-loading" />;
  }

  if (error !== null) {
    return (
      <SectionMessage appearance="error" testId="relationship-index-error">
        <p>{error}</p>
        <Button appearance="primary" onClick={onRefresh} testId="relationship-index-retry-button">
          Retry
        </Button>
      </SectionMessage>
    );
  }

  if (health === null) {
    return (
      <div data-testid="relationship-index-empty">
        <p style={{ marginBottom: '16px' }}>
          The relationship index is empty. Bootstrap indexing to populate it with your existing Jira
          issues.
        </p>
        <Button
          appearance="primary"
          onClick={onBootstrap}
          isDisabled={refreshing}
          testId="relationship-index-bootstrap-button"
        >
          {refreshing ? 'Indexing...' : 'Index Project Data'}
        </Button>
      </div>
    );
  }

  return (
    <section data-testid="relationship-index-metrics" aria-label="Relationship index status">
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const }}>
        <MetricCard label="Status" value={health.status} testId="ri-status" />
        <MetricCard label="Total Nodes" value={health.totalNodes} testId="ri-total-nodes" />
        <MetricCard label="Total Edges" value={health.totalEdges} testId="ri-total-edges" />
        <MetricCard
          label="Orphaned Nodes"
          value={health.orphanedNodes}
          testId="ri-orphaned-nodes"
        />
        <MetricCard label="Stale Edges" value={health.staleEdges} testId="ri-stale-edges" />
        <MetricCard
          label="Avg Edges/Node"
          value={health.avgEdgesPerNode.toFixed(2)}
          testId="ri-avg-edges"
        />
        <MetricCard label="Storage Keys" value={health.storageKeysUsed} testId="ri-storage-keys" />
      </div>

      {health.lastMaintenanceAt && (
        <p style={{ marginTop: '16px', fontSize: '12px', color: token('color.text.subtlest') }}>
          Last maintenance: {health.lastMaintenanceAt}
        </p>
      )}

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <Button
          appearance="primary"
          onClick={onBootstrap}
          isDisabled={refreshing}
          testId="relationship-index-reindex-button"
        >
          {refreshing ? 'Indexing...' : 'Re-index Project'}
        </Button>
        <Button
          onClick={onRefresh}
          isDisabled={refreshing}
          testId="relationship-index-refresh-button"
        >
          Refresh
        </Button>
      </div>
    </section>
  );
}
