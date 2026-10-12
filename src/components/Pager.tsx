import { pageCount } from '../lib/format';

type PagerProps = {
  page: number;
  pageSize: number;
  total: number | null | undefined;
  loading: boolean;
  onPage: (page: number) => void;
};

export function Pager({ page, pageSize, total, loading, onPage }: PagerProps) {
  if (total == null) return null;

  const pages = pageCount(total, pageSize);

  return (
    <div className="pager">
      <button type="button" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </button>
      Page {page} of {pages} ({total} total)
      <button type="button" disabled={loading || page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
