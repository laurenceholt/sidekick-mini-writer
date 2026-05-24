type MinisWordmarkProps = {
  size?: number | string;
  color?: string;
  mustard?: string;
  green?: string;
  className?: string;
};

function Tittle({ color }: { color: string }) {
  return (
    <span className="minis-wordmark-i">
      {"\u0131"}
      <span aria-hidden className="minis-wordmark-dot" style={{ background: color }} />
    </span>
  );
}

export function MinisWordmark({
  size,
  color = "#18140F",
  mustard = "#E8B736",
  green = "#2DBE60",
  className,
}: MinisWordmarkProps) {
  const fontSize = typeof size === "number" ? `${size}px` : size;

  return (
    <span className={className ? `minis-wordmark ${className}` : "minis-wordmark"} style={{ color, fontSize }} aria-label="Minis">
      m<Tittle color={mustard} />n<Tittle color={green} />s
    </span>
  );
}
