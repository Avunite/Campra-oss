import cluster from 'node:cluster';
import { initDb } from '../db/postgre.js';
import { contentAutoModerator } from '../services/content-auto-moderator.js';

/**
 * Init worker process
 */
export async function workerMain() {
	await initDb();

	// Initialize content auto-moderation
	await contentAutoModerator.initialize();

	// start server
	await import('../server/index.js').then(x => x.default());

	// start job queue
	import('../queue/index.js').then(x => x.default());

	if (cluster.isWorker) {
		// Send a 'ready' message to parent process
		process.send!('ready');
	}
}
