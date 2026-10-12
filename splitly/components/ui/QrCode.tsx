import qrcode from "qrcode-generator";

// A QR code, drawn here as one shape: no image is fetched and nothing about
// the link leaves the page. Dark squares on white whatever the theme, with
// the quiet border a scanner needs.

/** The squares of the code for a text: its size in modules, and one path covering every dark one. */
export function qrShape(value: string): { size: number; path: string } {
  const code = qrcode(0, "M");
  code.addData(value);
  code.make();
  const size = code.getModuleCount();
  let path = "";
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (!code.isDark(row, column)) continue;
      // Neighbouring dark squares in a row are drawn as one run.
      let run = 1;
      while (column + run < size && code.isDark(row, column + run)) run++;
      path += `M${column} ${row}h${run}v1h-${run}z`;
      column += run - 1;
    }
  }
  return { size, path };
}

export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = qrShape(value);
  const quiet = 4;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-quiet} ${-quiet} ${size + quiet * 2} ${size + quiet * 2}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={-quiet} y={-quiet} width={size + quiet * 2} height={size + quiet * 2} fill="#fff" />
      <path d={path} fill="#111a17" />
    </svg>
  );
}
