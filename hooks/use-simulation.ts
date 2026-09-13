"use client";
import { useEffect, useRef, useState } from "react";
import { runRequestSchema } from "@/lib/sim/validation";
import type {
  Coefficients,
  FunnelCounts,
  RunRequest,
  RunResult,
  WorkerResponse,
} from "@/lib/sim/types";
export function useSimulation() {
  const [run, setRun] = useState<RunResult | null>(null),
    [busy, setBusy] = useState<"run" | "calibrate" | null>(null),
    [error, setError] = useState("");
  const worker = useRef<Worker | null>(null),
    current = useRef<string | null>(null),
    resolve = useRef<((run: RunResult) => void) | null>(null),
    reject = useRef<((e: Error) => void) | null>(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
    },
    [],
  );
  function start(
    request: RunRequest,
    onCalibrated?: (c: Coefficients) => void,
    observed?: FunnelCounts,
  ): Promise<RunResult> {
    return new Promise((done, failed) => {
      if (current.current) {
        failed(Error("A calculation is already running."));
        return;
      }
      try {
        request = runRequestSchema.parse(request);
      } catch (e) {
        setError(String(e));
        failed(e as Error);
        return;
      }
      setError("");
      setBusy(observed ? "calibrate" : "run");
      if (!observed) setRun(null);
      current.current = request.id;
      resolve.current = done;
      reject.current = failed;
      let w: Worker;
      try {
        w = new Worker("/workers/simulation.js");
      } catch {
        current.current = null;
        setBusy(null);
        setError("This browser could not start a background worker.");
        failed(Error("This browser could not start a background worker."));
        return;
      }
      worker.current = w;
      const finish = () => {
        w.terminate();
        worker.current = null;
        current.current = null;
        setBusy(null);
        resolve.current = null;
        reject.current = null;
      };
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.id !== current.current) return;
        if (m.type === "progress")
          setRun({
            ...m.result,
            population: request.population,
            scenarios: request.scenarios,
            coefficients: request.coefficients,
          });
        if (m.type === "complete") {
          setRun(m.result);
          finish();
          done(m.result);
        }
        if (m.type === "calibrated") {
          onCalibrated?.(m.coefficients);
          finish();
          done(null as unknown as RunResult);
        }
        if (m.type === "error") {
          setError(m.message);
          finish();
          failed(Error(m.message));
        }
      };
      w.onerror = () => {
        const message =
          "The simulation worker failed to load or execute. Reload the app and try again.";
        setError(message);
        finish();
        failed(Error(message));
      };
      w.postMessage(
        observed
          ? { type: "calibrate", request, observed }
          : { type: "run", request },
      );
    });
  }
  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    current.current = null;
    setBusy(null);
    const fail = reject.current;
    resolve.current = null;
    reject.current = null;
    fail?.(
      Error(
        "Calculation stopped. Partial results are labeled and can be exported.",
      ),
    );
  }
  return {
    run,
    setRun,
    busy,
    error,
    start,
    cancel,
    clearError: () => setError(""),
  };
}
