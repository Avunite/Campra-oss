<template>
	<MkSpacer :content-max="1000" :margin-min="16" :margin-max="32">
		<div class="moderation-page">
			<div class="page-header">
				<h1>{{ i18n.ts.moderation }}</h1>
				<div class="header-actions">
					<MkButton @click="loadReports" :loading="loadingReports">
						<i class="ph-arrow-clockwise ph-lg"></i>
						Refresh Reports
					</MkButton>
				</div>
			</div>
			
			<div class="description">
				Review flagged content and manage student accounts in your school.
			</div>

			<!-- Moderation Statistics -->
			<div class="moderation-stats">
				<div v-if="loadingStats" class="loading">
					<MkLoading/>
				</div>
				<div v-else class="stats-grid">
					<div class="stat-card">
						<i class="ph-flag ph-lg"></i>
						<div class="stat-content">
							<div class="stat-value">{{ moderationStats?.pendingReports || 0 }}</div>
							<div class="stat-label">Pending Reports</div>
						</div>
					</div>
					<div class="stat-card">
						<i class="ph-user ph-lg"></i>
						<div class="stat-content">
							<div class="stat-value">{{ moderationStats?.suspendedUsers || 0 }}</div>
							<div class="stat-label">Suspended Users</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Reports Section -->
			<div class="reports-section">
				<h2>User Reports</h2>
				<div v-if="loadingReports" class="loading">
					<MkLoading/>
				</div>
				<div v-else-if="reports.length === 0" class="empty-state">
					<i class="ph-shield-check ph-lg"></i>
					<p>No pending user reports</p>
				</div>
				<div v-else class="reports-list">
					<MkAbuseReport v-for="report in reports" :key="report.id" :report="report" @resolved="resolved"/>
				</div>
			</div>
		</div>
	</MkSpacer>
</template>
	
<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { i18n } from '@/i18n';
import MkButton from '@/components/MkButton.vue';
import MkLoading from '@/components/MkLoading.vue';
import * as os from '@/os';
import { $i } from '@/account';
import { definePageMetadata } from '@/scripts/page-metadata';
import MkAbuseReport from '@/components/MkAbuseReport.vue';

const loadingStats = ref(true);
const loadingReports = ref(true);
const moderationStats = ref(null);
const reports = ref([]);

async function loadModerationStats() {
	if (!$i?.isSchoolAdmin || !$i?.adminForSchoolId) {
		os.alert({
			type: 'error',
			text: 'School admin access required'
		});
		return;
	}

	loadingStats.value = true;
	
	try {
		moderationStats.value = await os.api('schools/moderation-stats', {});
	} catch (error) {
		console.warn('Could not load moderation stats:', error);
		// Set default values on error
		moderationStats.value = {
			hiddenPosts: 0,
			pendingReports: 0,
			suspendedUsers: 0,
			flaggedContent: 0,
		};
	} finally {
		loadingStats.value = false;
	}
}

async function loadReports() {
	loadingReports.value = true;
	if (!$i?.isSchoolAdmin || !$i?.adminForSchoolId) {
		loadingReports.value = false;
		return;
	}
	try {
		reports.value = await os.api('admin/abuse-user-reports', {
			limit: 20,
			state: 'unresolved',
			schoolId: $i.adminForSchoolId, // Filter by school ID
		});
	} catch (error) {
		console.warn('Could not load reports:', error);
		reports.value = [];
	} finally {
		loadingReports.value = false;
	}
}

function resolved(reportId: string) {
	reports.value = reports.value.filter(r => r.id !== reportId);
}

onMounted(() => {
	loadModerationStats();
	loadReports();
});

definePageMetadata({
	title: i18n.ts.moderation,
	icon: 'ph-shield-check ph-lg',
});
</script>
	
<style lang="scss" scoped>
.moderation-page {
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
		
		h1 {
			margin: 0;
			font-size: 1.5em;
			font-weight: 600;
		}

		.header-actions {
			display: flex;
			gap: 12px;
		}
	}

	.description {
		opacity: 0.7;
		margin-bottom: 32px;
		line-height: 1.5;
	}

	.moderation-stats {
		margin-bottom: 32px;

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 16px;
		}

		.stat-card {
			background: var(--panel);
			border-radius: 8px;
			padding: 20px;
			border: 1px solid var(--divider);
			display: flex;
			align-items: center;
			gap: 16px;

			i {
				font-size: 1.8rem;
				color: var(--accent);
				flex-shrink: 0;
			}

			.stat-content {
				flex: 1;

				.stat-value {
					font-size: 1.5rem;
					font-weight: bold;
					line-height: 1;
					margin-bottom: 4px;
				}

				.stat-label {
					font-size: 0.85rem;
					opacity: 0.7;
				}
			}

			.stat-action {
				font-size: 1.2rem;
				color: var(--accent);
			}
		}
	}

	.reports-section {
		h2 {
			font-size: 1.25em;
			font-weight: 600;
			margin-bottom: 20px;
		}
	}

	.empty-state {
		text-align: center;
		padding: 48px 24px;
		
		i {
			font-size: 48px;
			color: var(--success);
			margin-bottom: 16px;
		}
		
		p {
			margin: 0 0 8px 0;
			font-size: 1.1em;
			font-weight: 500;
		}

		.sub-text {
			opacity: 0.7;
			font-size: 0.9em;
		}
	}

	.loading {
		text-align: center;
		padding: 48px 24px;
	}
}

@media (max-width: 768px) {
	.moderation-page {
		.page-header {
			flex-direction: column;
			align-items: stretch;
			gap: 16px;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}
	}
}
</style>
	