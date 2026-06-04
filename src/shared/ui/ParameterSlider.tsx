type ParameterSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
};

export function ParameterSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: ParameterSliderProps) {
  return (
    <label className="parameter-control">
      <span className="parameter-label">
        {label}
        <strong>
          {value}
          {unit ? ` ${unit}` : ""}
        </strong>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
