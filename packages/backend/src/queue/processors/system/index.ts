import Bull from 'bull';
import { tickCharts } from './tick-charts.js';
import { resyncCharts } from './resync-charts.js';
import { cleanCharts } from './clean-charts.js';
import { checkExpiredMutings } from './check-expired-mutings.js';
import { clean } from './clean.js';
import { checkSubscriptions } from './check-subscriptions.js';
import approvePendingContent from '../approve-pending-content.js';
import { lmsAutoSync } from './lms-sync.js';
import { processGraduations } from './process-graduations.js';
import { processGraduatedDeletions } from './process-graduated-deletions.js';

const jobs = {
	tickCharts,
	resyncCharts,
	cleanCharts,
	checkExpiredMutings,
	clean,
	checkSubscriptions,
	approvePendingContent,
	lmsAutoSync,
	processGraduations,
	processGraduatedDeletions,
} as Record<string, Bull.ProcessCallbackFunction<Record<string, unknown>> | Bull.ProcessPromiseFunction<Record<string, unknown>>>;

export default function(dbQueue: Bull.Queue<Record<string, unknown>>) {
	for (const [k, v] of Object.entries(jobs)) {
		dbQueue.process(k, v);
	}
}
