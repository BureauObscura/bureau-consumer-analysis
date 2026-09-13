"use client";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RunResult } from "@/lib/sim/types";
import { dollars, number } from "./controls";
export function PriceChart({ run }: { run: RunResult }) {
  if (new Set(run.scenarios.map((s) => s.product.price)).size < 3) return null;
  const data = run.results
    .map((r, i) => ({
      price: run.scenarios[i].product.price,
      orders: r.purchases,
      contribution: Math.round(r.contribution - r.adSpend),
    }))
    .sort((a, b) => a.price - b.price);
  const lo = data[0],
    hi = data[data.length - 1],
    elasticity =
      lo.orders && hi.orders && lo.price !== hi.price
        ? Math.log(hi.orders / lo.orders) / Math.log(hi.price / lo.price)
        : null;
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <h3>Price response</h3>
          <p>Orders and contribution across the tested prices.</p>
        </div>
        {elasticity != null && (
          <span className="tag">
            Endpoint log elasticity {elasticity.toFixed(2)}
          </span>
        )}
      </div>
      <div className="form-grid two">
        {(
          [
            ["orders", "Orders"],
            ["contribution", "Contribution after media"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <h4>{label}</h4>
            <ChartContainer
              config={{
                [key]: {
                  label,
                  color: key === "orders" ? "#98e598" : "#e0b868",
                },
              }}
              className="price-chart"
            >
              <LineChart
                data={data}
                margin={{ left: 12, right: 18, top: 18, bottom: 8 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="price"
                  tickFormatter={(v) => dollars(v)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  width={70}
                  tickFormatter={(v) => number(v)}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="linear"
                  dataKey={key}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          </div>
        ))}
      </div>
      <p className="hint">
        Elasticity is calculated from the first and last tested prices. It is
        interpretable as a price-only response only when every other journey
        input is held constant. Zero-order endpoints do not have a finite log
        elasticity.
      </p>
    </div>
  );
}
