interface Props {
  value: string;
}

export default function DateCell({ value }: Props) {
  const date = new Date(value);
  const display = date.toLocaleDateString();
  const full = date.toLocaleString();

  return (
    <span title={full}>
      {display}
    </span>
  );
}
