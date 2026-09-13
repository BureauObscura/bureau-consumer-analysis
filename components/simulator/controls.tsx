"use client";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
export { Button } from "@/components/ui/button";
export const number = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
export const dollars = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
export const percent = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
export function Field({
  label,
  value,
  onChange,
  help,
  multiline = false,
  type = "text",
  min,
  max,
  step = 1,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  help?: string;
  multiline?: boolean;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={Number.isNaN(value) ? "" : value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
        />
      )}{" "}
      {help && <small>{help}</small>}
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  help,
  min = 0,
  max = 100000,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChange={(v) => onChange(v === "" ? NaN : Number(v))}
      type="number"
      min={min}
      max={max}
      step={step}
      help={help}
    />
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  help?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      {help && <small>{help}</small>}
    </div>
  );
}
export function Toggle({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  const id = useId();
  return (
    <div className="toggle-field">
      <div>
        <label htmlFor={id}>{label}</label>
        {help && <small>{help}</small>}
      </div>
      <Switch id={id} checked={value} onCheckedChange={onChange} />
    </div>
  );
}
export function Range({
  label,
  value,
  onChange,
  help,
  min = 0,
  max = 1,
  step = 0.01,
  format = percent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  format?: (n: number) => string;
}) {
  const id = useId();
  return (
    <div className="range-field">
      <div>
        <label id={id}>{label}</label>
        <output>{format(value)}</output>
      </div>
      <Slider
        aria-labelledby={id}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
      />
      {help && <small>{help}</small>}
    </div>
  );
}
export const options = (values: string[]) =>
  values.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " "),
  }));
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
