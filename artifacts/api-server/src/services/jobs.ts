import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { runMaterializationTick } from './task-materializer.js';

/**
 * In-process job runner. Enterprise-grade means SOMETHING must run
 * periodically — this is the smallest viable implementation that keeps the
 * interface stable. A later phase replaces the internals with BullMQ, a
 * dedicated worker process, or a k8s CronJob without touching the callers.
 *
 * Guarded by JOBS_ENABLED so tests + short-lived processes can opt out.
 */
type StopHandle = () => void;

export function startJobRunner(): StopHandle {
  if (!env.JOBS_ENABLED) {
    logger.info('jobs runner disabled (JOBS_ENABLED=false)');
    return () => {};
  }

  const intervalMs = env.JOBS_MATERIALIZER_INTERVAL_SEC * 1000;
  let running = false;

  const tick = async () => {
    if (running) return; // never overlap
    running = true;
    const started = Date.now();
    try {
      const result = await runMaterializationTick(env.JOBS_MATERIALIZER_HORIZON_HOURS);
      logger.info(
        { ms: Date.now() - started, ...result },
        'materialization tick',
      );
    } catch (err) {
      logger.error({ err }, 'materialization tick failed');
    } finally {
      running = false;
    }
  };

  // Run once on startup so a freshly-seeded DB has visible tasks
  void tick();
  const handle = setInterval(() => void tick(), intervalMs);
  logger.info({ intervalSec: env.JOBS_MATERIALIZER_INTERVAL_SEC }, 'jobs runner started');
  return () => clearInterval(handle);
}
