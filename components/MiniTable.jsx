export default function MiniTable({ title, rows, cols, note }) {
  return (
    <div>
      <h3>{title}</h3>
      {note && <div className="note">{note}</div>}
      <table>
        <thead><tr><th className="rank">#</th>{cols.map((c) => <th key={c} className={c === "Giocatore" ? "" : "num"}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="rank">{i + 1}</td>
              {r.map((c, j) => <td key={j} className={j === 0 ? "pname" : "num"}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
