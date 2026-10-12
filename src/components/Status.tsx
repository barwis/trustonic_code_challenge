type StatusProps = {
  loading: boolean;
  empty: boolean;
  emptyText: string;
};

export function Status({ loading, empty, emptyText }: StatusProps) {
  if (loading) {
    return (
      <div role="status" className="status">
        <svg className="spinner" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28 10" />
        </svg>
        <span className="visually-hidden">Loading...</span>
      </div>
    );
  }
  return (
    <div role="status" className="status muted">
      {empty ? emptyText : ''}
    </div>
  );
}
