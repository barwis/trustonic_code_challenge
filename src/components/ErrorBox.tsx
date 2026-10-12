type ErrorBoxProps = {
  errors: string[];
  onRetry: () => void;
};

export function ErrorBox({ errors, onRetry }: ErrorBoxProps) {
  if (errors.length === 0) return null;

  return (
    <div className="error" role="alert">
      {errors.map((e, i) => (
        <div key={i}>{e}</div>
      ))}
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
