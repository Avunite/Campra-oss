<template>
<MkSpacer :content-max="800" :margin-min="16" :margin-max="32">
	<div v-if="loading" class="loading">
		<MkLoading/>
	</div>
	<div v-else>
		<div class="title">
			{{ i18n.ts.analytics }}
		</div>
		<div class="description">
			{{ i18n.ts.analyticsDescription }}
		</div>

		<div class="analytics-cards">
			<MkInfo v-if="!analytics" class="info">
				{{ i18n.ts.analyticsUnavailable }}
			</MkInfo>
			<template v-else>
				<div class="analytics-card">
					<i class="ph-users ph-lg icon"></i>
					<div class="content">
						<div class="value">{{ analytics.totalUsers }}</div>
						<div class="label">{{ i18n.ts.totalUsers }}</div>
					</div>
				</div>
				<div class="analytics-card">
					<i class="ph-user-check ph-lg icon"></i>
					<div class="content">
						<div class="value">{{ analytics.activeUsers }}</div>
						<div class="label">{{ i18n.ts.activeUsers }}</div>
					</div>
				</div>
				<div class="analytics-card">
					<i class="ph-note ph-lg icon"></i>
					<div class="content">
						<div class="value">{{ analytics.postsThisWeek }}</div>
						<div class="label">{{ i18n.ts.postsThisWeek }}</div>
					</div>
				</div>
				<div class="analytics-card">
					<i class="ph-chart-line ph-lg icon"></i>
					<div class="content">
						<div class="value">{{ analytics.engagementRate || '0%' }}</div>
						<div class="label">{{ i18n.ts.engagementRate }}</div>
					</div>
				</div>
				<div class="analytics-card">
					<i class="ph-user-plus ph-lg icon"></i>
					<div class="content">
						<div class="value">{{ analytics.newUsersThisWeek }}</div>
						<div class="label">{{ i18n.ts.newUsersThisWeek }}</div>
					</div>
				</div>
			</template>
		</div>

		<div class="charts-section">
			<div class="section-title">{{ i18n.ts.trends }}</div>
			<div class="chart-grid">
				<div class="chart-card">
					<div class="chart-header">
						<h3>Weekly Growth</h3>
						<span class="chart-period">Last 7 days</span>
					</div>
					<div class="chart-content">
						<div class="metric">
							<span class="metric-label">New Students</span>
							<span class="metric-value">{{ analytics?.newUsersThisWeek || 0 }}</span>
						</div>
						<div class="metric">
							<span class="metric-label">Posts Created</span>
							<span class="metric-value">{{ analytics?.postsThisWeek || 0 }}</span>
						</div>
					</div>
				</div>
				<div class="chart-card">
					<div class="chart-header">
						<h3>Engagement Overview</h3>
						<span class="chart-period">Current</span>
					</div>
					<div class="chart-content">
						<div class="metric">
							<span class="metric-label">Active Rate</span>
							<span class="metric-value">{{ Math.round((analytics?.activeUsers / analytics?.totalUsers) * 100) || 0 }}%</span>
						</div>
						<div class="metric">
							<span class="metric-label">Posts per User</span>
							<span class="metric-value">{{ Math.round((analytics?.postsThisWeek / analytics?.activeUsers) * 10) / 10 || 0 }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</MkSpacer>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { i18n } from '@/i18n';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os';
import { $i } from '@/account';
import { definePageMetadata } from '@/scripts/page-metadata';

const loading = ref(true);
const analytics = ref(null);

async function loadAnalytics() {
	if (!$i?.isSchoolAdmin || !$i?.adminForSchoolId) {
		os.alert({
			type: 'error',
			text: i18n.ts.schoolAdminAccessRequired
		});
		return;
	}

	loading.value = true;
	
	try {
		analytics.value = await os.api('schools/analytics', {});
	} catch (error) {
		console.warn('Could not load analytics:', error);
		os.alert({
			type: 'error',
			text: i18n.ts.failedToLoadAnalytics
		});
	} finally {
		loading.value = false;
	}
}

onMounted(() => {
	loadAnalytics();
});

definePageMetadata({
	title: i18n.ts.analytics,
	icon: 'ph-chart-line ph-lg',
});
</script>

<style lang="scss" scoped>
.title {
	font-weight: bold;
	font-size: 1.2em;
	margin-bottom: 0.5em;
}

.description {
	opacity: 0.7;
	margin-bottom: 2em;
}

.analytics-cards {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 1rem;
	margin-bottom: 2rem;
}

.analytics-card {
	background: var(--panel);
	border-radius: 8px;
	padding: 1.5rem;
	display: flex;
	align-items: center;
	gap: 1rem;
	border: 1px solid var(--divider);

	.icon {
		font-size: 2rem;
		color: var(--accent);
		flex-shrink: 0;
	}

	.content {
		flex: 1;

		.value {
			font-size: 1.8rem;
			font-weight: bold;
			line-height: 1;
		}

		.label {
			font-size: 0.85rem;
			opacity: 0.7;
			margin-top: 0.25rem;
		}
	}
}

.charts-section {
	.section-title {
		font-weight: bold;
		font-size: 1.1em;
		margin-bottom: 1rem;
	}
}

.chart-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 1.5rem;
}

.chart-card {
	background: var(--panel);
	border-radius: 12px;
	padding: 1.5rem;
	border: 1px solid var(--divider);

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;

		h3 {
			margin: 0;
			font-size: 1rem;
			font-weight: 600;
		}

		.chart-period {
			font-size: 0.85rem;
			opacity: 0.7;
		}
	}

	.chart-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;

		.metric {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.75rem;
			background: var(--bg);
			border-radius: 6px;

			.metric-label {
				font-size: 0.9rem;
				opacity: 0.8;
			}

			.metric-value {
				font-weight: bold;
				font-size: 1.1rem;
				color: var(--accent);
			}
		}
	}
}

.loading {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 200px;
}
</style>
