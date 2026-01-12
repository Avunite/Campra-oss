<template>
	<MkSpacer :content-max="1000" :margin-min="16" :margin-max="32">
		<div class="content-flags-page">
			<div class="page-header">
				<h1><i class="ph-flag ph-lg"></i> Flagged Content Management</h1>
				<div class="header-actions">
					<MkButton @click="loadContentFlags" :loading="loading">
						<i class="ph-arrow-clockwise ph-lg"></i>
						Refresh
					</MkButton>
				</div>
			</div>
			
			<div class="description">
				Review and manage content that has been flagged by the automatic moderation system.
			</div>

			<!-- Content Flags List -->
			<div class="content-flags-section">
				<div v-if="loading" class="loading">
					<MkLoading/>
				</div>
				<div v-else-if="contentFlags.length === 0" class="empty-state">
					<i class="ph-shield-check ph-lg"></i>
					<p>No flagged content</p>
					<p class="sub-text">All content is currently approved or no flags have been raised.</p>
				</div>
				<div v-else class="flags-list">
					<div v-for="flag in contentFlags" :key="flag.id" class="flag-item">
						<div class="flag-header">
							<div class="flag-info">
								<span class="flag-type">{{ formatContentType(flag.contentType) }}</span>
								<span class="flag-confidence">{{ Math.round((flag.confidence || 0.8) * 100) }}% confidence</span>
								<span class="flag-date">{{ formatDate(flag.createdAt) }}</span>
							</div>
							<div class="flag-status" :class="flag.status">{{ flag.status }}</div>
						</div>
						
						<div class="flag-content">
							<div class="content-preview">
								<strong>Content ID:</strong> {{ flag.contentId }}<br>
								<strong>Flag Type:</strong> {{ flag.flagType }}<br>
								<strong>Source:</strong> {{ flag.source }}<br>
								<div v-if="flag.content" class="content-text">
									<strong>Content:</strong> 
									<div class="text-preview">{{ truncateText(flag.content, 200) }}</div>
								</div>
							</div>
						</div>
						
						<div class="flag-actions">
							<MkButton 
								v-if="flag.status === 'pending'" 
								@click="unhideContent(flag)" 
								:loading="flag.unhiding"
								primary
							>
								<i class="ph-eye ph-lg"></i>
								Approve & Unhide
							</MkButton>
							<MkButton 
								v-if="flag.status === 'pending'" 
								@click="rejectContent(flag)" 
								:loading="flag.rejecting"
								danger
							>
								<i class="ph-x ph-lg"></i>
								Reject
							</MkButton>
							<span v-if="flag.status === 'approved'" class="status-text approved">
								<i class="ph-check ph-lg"></i>
								Approved by {{ flag.reviewedBy || 'system' }}
							</span>
							<span v-if="flag.status === 'rejected'" class="status-text rejected">
								<i class="ph-x ph-lg"></i>
								Rejected by {{ flag.reviewedBy || 'system' }}
							</span>
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
import MkButton from '@/components/MkButton.vue';
import MkLoading from '@/components/MkLoading.vue';
import * as os from '@/os';
import { $i } from '@/account';
import { definePageMetadata } from '@/scripts/page-metadata';

const loading = ref(true);
const contentFlags = ref([]);

async function loadContentFlags() {
	if (!$i?.isSchoolAdmin || !$i?.adminForSchoolId) {
		os.alert({
			type: 'error',
			text: 'School admin access required'
		});
		return;
	}

	loading.value = true;
	
	try {
		contentFlags.value = await os.api('schools/content-flags', {
			limit: 50,
			status: ['pending', 'approved', 'rejected'],
		});
	} catch (error) {
		console.warn('Could not load content flags:', error);
		os.alert({
			type: 'error',
			text: 'Failed to load flagged content'
		});
		contentFlags.value = [];
	} finally {
		loading.value = false;
	}
}

async function unhideContent(flag: any) {
	const confirm = await os.confirm({
		type: 'question',
		text: `Are you sure you want to approve and unhide this ${flag.contentType}? This will make the content visible again.`
	});

	if (!confirm.canceled) {
		const reason = await os.inputText({
			title: 'Approval Reason (Optional)',
			placeholder: 'Enter reason for approving this content...'
		});

		if (!reason.canceled) {
			flag.unhiding = true;
			try {
				await os.api('schools/unhide-content', {
					contentId: flag.contentId,
					contentType: flag.contentType,
					reason: reason.result || 'Approved by school admin'
				});

				os.success('Content successfully approved and unhidden');
				
				// Update the flag status locally
				flag.status = 'approved';
				flag.reviewedBy = $i?.username || 'admin';
				flag.reviewedAt = new Date();
			} catch (error) {
				console.error('Failed to unhide content:', error);
				os.alert({
					type: 'error',
					text: 'Failed to approve content. Please try again.'
				});
			} finally {
				flag.unhiding = false;
			}
		}
	}
}

async function rejectContent(flag: any) {
	const confirm = await os.confirm({
		type: 'warning',
		text: `Are you sure you want to reject this ${flag.contentType}? The content will remain hidden.`
	});

	if (!confirm.canceled) {
		const reason = await os.inputText({
			title: 'Rejection Reason',
			placeholder: 'Enter reason for rejecting this content...'
		});

		if (!reason.canceled && reason.result) {
			flag.rejecting = true;
			try {
				// For now, we'll just update the flag status
				// In a full implementation, you'd call an API to reject the content
				flag.status = 'rejected';
				flag.reviewedBy = $i?.username || 'admin';
				flag.reviewedAt = new Date();

				os.success('Content rejected');
			} catch (error) {
				console.error('Failed to reject content:', error);
				os.alert({
					type: 'error',
					text: 'Failed to reject content. Please try again.'
				});
			} finally {
				flag.rejecting = false;
			}
		}
	}
}

function formatContentType(type: string): string {
	switch (type) {
		case 'note': return 'Post';
		case 'profile-bio': return 'Profile Bio';
		case 'profile-name': return 'Profile Name';
		case 'file': return 'File/Image';
		default: return type;
	}
}

function formatDate(date: string | Date): string {
	return new Date(date).toLocaleString();
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + '...';
}

onMounted(() => {
	loadContentFlags();
});

definePageMetadata({
	title: 'Flagged Content Management',
	icon: 'ph-flag ph-lg',
});
</script>

<style lang="scss" scoped>
.content-flags-page {
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
		
		h1 {
			margin: 0;
			font-size: 1.5em;
			font-weight: 600;
			display: flex;
			align-items: center;
			gap: 8px;
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

	.flags-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.flag-item {
		background: var(--panel);
		border: 1px solid var(--divider);
		border-radius: 8px;
		padding: 20px;

		.flag-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 12px;

			.flag-info {
				display: flex;
				gap: 12px;
				align-items: center;
				flex-wrap: wrap;

				.flag-type {
					background: var(--accent);
					color: var(--fgOnAccent);
					padding: 4px 8px;
					border-radius: 4px;
					font-size: 0.85em;
					font-weight: 500;
				}

				.flag-confidence {
					background: var(--warn);
					color: var(--fgOnWarn);
					padding: 4px 8px;
					border-radius: 4px;
					font-size: 0.85em;
				}

				.flag-date {
					opacity: 0.7;
					font-size: 0.85em;
				}
			}

			.flag-status {
				padding: 4px 12px;
				border-radius: 4px;
				font-size: 0.85em;
				font-weight: 500;
				text-transform: uppercase;

				&.pending {
					background: var(--warn);
					color: var(--fgOnWarn);
				}

				&.approved {
					background: var(--success);
					color: var(--fgOnAccent);
				}

				&.rejected {
					background: var(--error);
					color: var(--fgOnAccent);
				}
			}
		}

		.flag-content {
			margin-bottom: 16px;

			.content-preview {
				background: var(--bg);
				padding: 12px;
				border-radius: 6px;
				font-size: 0.9em;
				line-height: 1.4;

				.text-preview {
					margin-top: 8px;
					padding: 8px;
					background: var(--panel);
					border-radius: 4px;
					font-family: monospace;
					white-space: pre-wrap;
					word-break: break-word;
				}
			}
		}

		.flag-actions {
			display: flex;
			gap: 12px;
			align-items: center;

			.status-text {
				display: flex;
				align-items: center;
				gap: 6px;
				font-size: 0.9em;

				&.approved {
					color: var(--success);
				}

				&.rejected {
					color: var(--error);
				}
			}
		}
	}
}

@media (max-width: 768px) {
	.content-flags-page {
		.page-header {
			flex-direction: column;
			align-items: stretch;
			gap: 16px;
		}

		.flag-item {
			.flag-header {
				flex-direction: column;
				align-items: stretch;
				gap: 12px;
			}

			.flag-actions {
				flex-direction: column;
				align-items: stretch;
			}
		}
	}
}
</style>
