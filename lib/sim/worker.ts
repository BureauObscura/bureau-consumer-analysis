/// <reference lib="webworker" />
import { calibrate, createRun, processRange, traceConsumer } from "./engine";
import {
  runRequestSchema,
  scenarioSchema,
  populationSchema,
  coefficientsSchema,
  validCounts,
} from "./validation";
import type { WorkerMessage, WorkerResponse } from "./types";
const send = (message: WorkerResponse) => self.postMessage(message);
let running = false;
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  const id =
    message?.type === "trace"
      ? message.id
      : (message?.request?.id ?? "invalid-request");
  if (running) {
    send({
      type: "error",
      id,
      message: "This worker is already processing a run.",
    });
    return;
  }
  running = true;
  try {
    if (!message || !["run", "calibrate", "trace"].includes(message.type))
      throw Error("Unknown worker operation.");
    if (message.type === "trace") {
      const pop = populationSchema.parse(message.population),
        scenario = scenarioSchema.parse(message.scenario),
        co = coefficientsSchema.parse(message.coefficients);
      if (
        !Number.isInteger(message.consumerId) ||
        message.consumerId < 0 ||
        message.consumerId >= pop.size
      )
        throw Error("Consumer ID is outside this population.");
      send({
        type: "trace",
        id,
        trace: traceConsumer(message.consumerId, scenario, pop, co),
      });
      return;
    }
    const request = runRequestSchema.parse(message.request);
    if (message.type === "calibrate") {
      if (!validCounts(message.observed))
        throw Error("Enter positive, nested historical funnel counts.");
      const coefficients = await calibrate(request, message.observed);
      send({ type: "calibrated", id, coefficients });
      return;
    }
    const result = createRun(request),
      begin = performance.now(),
      start = request.startId ?? 0;
    let done = 0,
      chunk = 25000,
      lastMessage = 0;
    while (done < result.planned) {
      const n = Math.min(chunk, result.planned - done),
        t = performance.now();
      processRange(result, start + done, start + done + n);
      done += n;
      const duration = performance.now() - t;
      chunk = Math.max(
        1000,
        Math.min(100000, Math.round((n * 45) / Math.max(1, duration))),
      );
      result.elapsedMs = performance.now() - begin;
      if (result.elapsedMs - lastMessage > 250) {
        const {
          population: _,
          scenarios: __,
          coefficients: ___,
          ...progress
        } = result;
        send({ type: "progress", id, result: progress });
        lastMessage = result.elapsedMs;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    result.status = "complete";
    result.elapsedMs = performance.now() - begin;
    send({ type: "complete", id, result });
  } catch (error) {
    send({
      type: "error",
      id,
      message: error instanceof Error ? error.message : "Simulation failed.",
    });
  } finally {
    running = false;
  }
};
