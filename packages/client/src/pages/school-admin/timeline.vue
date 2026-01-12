<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :content-max="800" :margin-min="16" :margin-max="32">
		<div class="school-timeline">
			<div class="_formRoot">
				<div class="_formBlock">
					<div class="timeline-header">
						<div class="header-content">
							<div class="title-section">
								<h2><i class="ph-newspaper ph-lg"></i> {{ school?.name || i18n.ts.schoolTimeline || 'School Timeline' }}</h2>
								<p class="description">{{ i18n.ts.schoolTimelineDescription || 'Posts from your school community' }}</p>
							</div>
							<div class="controls">
								<MkSwitch v-model="includeNearbySchools" @update:model-value="onSettingsChange">
									<template #label>{{ i18n.ts.includeNearbySchools || 'Include nearby schools' }}</template>
									<template #caption>{{ i18n.ts.includeNearbySchoolsDescription || 'Show posts from schools within 50 miles' }}</template>
								</MkSwitch>
							</div>
						</div>
					</div>
				</div>

				<!-- Timeline Content -->
				<div class="_formBlock">
					<div v-if="!school" class="loading">
						<MkLoading/>
					</div>
					<div v-else-if="error" class="error">
						<MkError @retry="loadSchool">
							{{ error }}
						</MkError>
					</div>
					<div v-else class="timeline-content">
						<!-- Empty State -->
						<div v-if="showEmptyState" class="empty-state">
							<div class="empty-content">
								<i class="ph-newspaper ph-lg empty-icon"></i>
								<h3>{{ i18n.ts.noSchoolPosts || 'No posts from your school yet' }}</h3>
								<p class="empty-description">{{ i18n.ts.noSchoolPostsDescription || 'Be the first to share something with your school community!' }}</p>
								
								<div class="onboarding-tips">
									<h4>{{ i18n.ts.getStarted || 'Get started:' }}</h4>
									<ul>
										<li>{{ i18n.ts.createFirstPost || 'Create your first post to get the conversation started' }}</li>
										<li>{{ i18n.ts.inviteMoreStudents || 'Invite more students to join your school' }}</li>
										<li>{{ i18n.ts.encourageParticipation || 'Encourage teachers and students to share updates' }}</li>
									</ul>
								</div>
								
								<div class="empty-actions">
									<MkButton @click="createPost" primary>
										<i class="ph-plus ph-lg"></i>
										{{ i18n.ts.createPost || 'Create Post' }}
									</MkButton>
									<MkButton @click="goToStudents">
										<i class="ph-users ph-lg"></i>
										{{ i18n.ts.manageStudents || 'Manage Students' }}
									</MkButton>
								</div>
							</div>
						</div>

						<!-- Timeline -->
						<div v-else class="timeline-notes">
							<MkNotes 
								:pagination="timelinePagination" 
								:no-gap="false"
								:use-date-separator="true"
							/>
						</div>
					</div>
				</div>

				<!-- Timeline Stats -->
				<div v-if="school && !showEmptyState" class="_formBlock">
					<div class="timeline-stats">
						<div class="stats-grid">
							<div class="stat-item">
								<div class="stat-value">{{ stats.totalPosts || 0 }}</div>
								<div class="stat-label">{{ i18n.ts.totalPosts || 'Total Posts' }}</div>
							</div>
							<div class="stat-item">
								<div class="stat-value">{{ stats.activeUsers || 0 }}</div>
								<div class="stat-label">{{ i18n.ts.activeUsers || 'Active Users' }}</div>
							</div>
							<div class="stat-item">
								<div class="stat-value">{{ stats.postsThisWeek || 0 }}</div>
								<div class="stat-label">{{ i18n.ts.postsThisWeek || 'Posts This Week' }}</div>
							</div>
							<div v-if="includeNearbySchools" class="stat-item">
								<div class="stat-value">{{ stats.nearbySchools || 0 }}</div>
								<div class="stat-label">{{ i18n.ts.nearbySchools || 'Nearby Schools' }}</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/form/switch.vue';
import MkNotes from '@/components/MkNotes.vue';
import MkLoading from '@/components/MkLoading.vue';
import MkError from '@/components/MkError.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { $i } from '@/account';
import { useRouter } from '@/router';

const router = useRouter();

const school = ref(null);
const error = ref('');
const includeNearbySchools = ref(false);
const showEmptyState = ref(false);

const stats = ref({
	totalPosts: 0,
	activeUsers: 0,
	postsThisWeek: 0,
	nearbySchools: 0
});

const headerActions = computed(() => [
	{
		icon: 'ph-plus ph-lg',
		text: i18n.ts.createPost || 'Create Post',
		handler: createPost,
	},
	{
		icon: 'ph-arrow-clockwise ph-lg',
		text: i18n.ts.refresh || 'Refresh',
		handler: refreshTimeline,
	},
]);

const headerTabs = computed(() => []);

const timelinePagination = computed(() => ({
	endpoint: 'schools/timeline' as const,
	limit: 20,
	params: computed(() => ({
		includeNearbySchools: includeNearbySchools.value
	})),
}));

function onSettingsChange() {
	// Timeline will automatically refresh due to reactive params
	loadStats();
}

async function loadSchool() {
	if (!$i?.isSchoolAdmin || !$i?.adminForSchoolId) {
		error.value = i18n.ts.schoolAdminAccessRequired || 'School administrator access required';
		return;
	}

	try {
		school.value = await os.api('schools/show', {
			schoolId: $i.adminForSchoolId
		});
		
		await loadStats();
		
	} catch (err) {
		console.error('Failed to load school:', err);
		error.value = (err as any)?.message || i18n.ts.failedToLoadSchool || 'Failed to load school data';
	}
}

async function loadStats() {
	if (!school.value) return;
	
	try {
		const result = await os.api('schools/timeline-stats', {
			includeNearbySchools: includeNearbySchools.value
		});
		
		stats.value = result;
		
		// Show empty state if no posts and no active users
		showEmptyState.value = result.totalPosts === 0 && result.activeUsers <= 1;
		
	} catch (err) {
		console.error('Failed to load timeline stats:', err);
		// Don't show error for stats, just use defaults
		stats.value = {
			totalPosts: 0,
			activeUsers: 0,
			postsThisWeek: 0,
			nearbySchools: 0
		};
		showEmptyState.value = true;
	}
}

function refreshTimeline() {
	// Force refresh the timeline pagination
	loadStats();
}

function createPost() {
	os.post();
}

function goToStudents() {
	router.push('/school-admin/students');
}

// Watch for changes in nearby schools setting
watch(includeNearbySchools, () => {
	onSettingsChange();
});

onMounted(() => {
	loadSchool();
});

definePageMetadata({
	title: i18n.ts.schoolTimeline || 'School Timeline',
	icon: 'ph-newspaper ph-lg',
});
</script>

<style lang="scss" scoped>
.school-timeline {
	.timeline-header {
		.header-content {
			display: flex;
			flex-direction: column;
			gap: 16px;
			
			.title-section {
				h2 {
					margin: 0 0 8px 0;
					font-size: 1.5em;
					font-weight: bold;
					display: flex;
					align-items: center;
					gap: 12px;
				}
				
				.description {
					margin: 0;
					opacity: 0.7;
					font-size: 0.95em;
				}
			}
			
			.controls {
				padding: 16px;
				background: var(--panel);
				border-radius: 8px;
			}
		}
	}
	
	.timeline-content {
		min-height: 400px;
	}
	
	.empty-state {
		text-align: center;
		padding: 60px 20px;
		
		.empty-content {
			max-width: 500px;
			margin: 0 auto;
			
			.empty-icon {
				font-size: 64px;
				color: var(--accent);
				margin-bottom: 24px;
			}
			
			h3 {
				margin: 0 0 12px 0;
				font-size: 1.3em;
				font-weight: 600;
			}
			
			.empty-description {
				margin: 0 0 32px 0;
				opacity: 0.7;
				font-size: 1em;
				line-height: 1.5;
			}
			
			.onboarding-tips {
				text-align: left;
				background: var(--panel);
				padding: 24px;
				border-radius: 12px;
				margin-bottom: 32px;
				
				h4 {
					margin: 0 0 16px 0;
					font-size: 1.1em;
					font-weight: 600;
					color: var(--accent);
				}
				
				ul {
					margin: 0;
					padding-left: 20px;
					
					li {
						margin-bottom: 8px;
						line-height: 1.4;
						
						&:last-child {
							margin-bottom: 0;
						}
					}
				}
			}
			
			.empty-actions {
				display: flex;
				gap: 12px;
				justify-content: center;
				flex-wrap: wrap;
			}
		}
	}
	
	.timeline-notes {
		// Timeline styles are handled by MkNotes component
	}
	
	.timeline-stats {
		background: var(--panel);
		padding: 20px;
		border-radius: 8px;
		
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 20px;
			
			.stat-item {
				text-align: center;
				
				.stat-value {
					font-size: 1.8em;
					font-weight: bold;
					color: var(--accent);
					margin-bottom: 4px;
				}
				
				.stat-label {
					font-size: 0.9em;
					opacity: 0.7;
				}
			}
		}
	}
	
	.loading, .error {
		text-align: center;
		padding: 40px 20px;
	}
}

@media (max-width: 768px) {
	.school-timeline {
		.timeline-header {
			.header-content {
				.title-section {
					h2 {
						font-size: 1.3em;
						flex-direction: column;
						align-items: flex-start;
						gap: 8px;
					}
				}
			}
		}
		
		.empty-state {
			padding: 40px 16px;
			
			.empty-content {
				.empty-icon {
					font-size: 48px;
				}
				
				.empty-actions {
					flex-direction: column;
				}
			}
		}
		
		.timeline-stats {
			.stats-grid {
				grid-template-columns: repeat(2, 1fr);
				gap: 16px;
			}
		}
	}
}
</style>