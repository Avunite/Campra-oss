import cluster from 'node:cluster';
import chalk from 'chalk';
import Xev from 'xev';

import Logger from '@/services/logger.js';
import { envOption } from '../env.js';

// for typeorm
import 'reflect-metadata';
import { masterMain } from './master.js';
import { workerMain } from './worker.js';

const logger = new Logger('core', 'cyan');
const clusterLogger = logger.createSubLogger('cluster', 'orange', false);
const ev = new Xev();

/**
 * Init process
 */
async function boot() {
  process.title = `Campra (${cluster.isPrimary ? 'master' : 'worker'})`;
    
  if (cluster.isPrimary || envOption.disableClustering) {
		await masterMain();
	    
		if (cluster.isPrimary) {
		  ev.mount();
		}
  }
    
  if (cluster.isWorker || envOption.disableClustering) {
		await workerMain();
  }
    
  // For when Campra is started in a child process during unit testing.
  // Otherwise, process.send cannot be used, so start it.
  if (process.send) {
		process.send('ok');
  }
}

export default boot;

//#region Events

// Listen new workers
cluster.on('fork', worker => {
  clusterLogger.debug(`Process forked: [${worker.id}]`);
});

// Listen online workers
cluster.on('online', worker => {
  clusterLogger.debug(`Process is now online: [${worker.id}]`);
});

// Listen dying workers
cluster.on('exit', (worker, code, signal) => {
  // Replace the dead worker,
  // we're not using cluster.schedulingPolicy = cluster.SCHED_NONE
  // because it breaks the --no-daemons flag
  clusterLogger.warn(`[${worker.id}] died (${signal || code}). Restarting...`);
  cluster.fork();
});

// Display detail of unhandled promise rejection
if (!envOption.quiet) {
  process.on('unhandledRejection', console.dir);
}

// Display detail of uncaught exception
process.on('uncaughtException', err => {
  try {
		logger.error(err);
  } catch { }
});

// Dying away...
process.on('exit', code => {
  logger.info(`The process is going to exit with code ${code}`);
});

//#endregion
