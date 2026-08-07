export default function FormaDots({ forma, n = 5 }) {
  return (
    <span className="forma">
      {forma.slice(-n).map((e, i) => <i key={i} className={`dot ${e}`} title={e} />)}
    </span>
  );
}
