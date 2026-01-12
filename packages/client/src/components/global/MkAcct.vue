<template>
<span class="mk-acct">
	<span class="username">@{{ user.username }}</span>
	<span v-if="user.school && user.school.domain" class="school-domain">@{{ user.school.domain }}</span>
	<span v-else-if="isStaff(user)" class="staff-domain">@{{ getStaffDomain(user) }}</span>
</span>
</template>

<script lang="ts" setup>
import * as misskey from 'calckey-js';
import { toUnicode } from 'punycode/';
import { host as hostRaw } from '@/config';

defineProps<{
	user: misskey.entities.UserDetailed;
	detail?: boolean;
}>();

const host = toUnicode(hostRaw);

// Check if user is staff (Campra or Avunite)
function isStaff(user: any): boolean {
	return user.isStaff || user.username?.match(/@(campra|avunite)$/);
}

// Get staff domain for handle display
function getStaffDomain(user: any): string {
	if (user.username?.includes('@campra') || user.email?.includes('@campra')) {
		return 'campra';
	}
	if (user.username?.includes('@avunite') || user.email?.includes('@avunite.com')) {
		return 'avunite';
	}
	return 'campra'; // default fallback
}
</script>

<style lang="scss" scoped>
.mk-acct {
	display: inline-flex;
	align-items: center;

	> .username {
		font-weight: 500;
	}
	
	> .school-domain {
		opacity: 0.6;
		margin-left: 1px;
		font-weight: 400;
		color: var(--fgTransparentWeak);
	}
	
	> .staff-domain {
		opacity: 0.7;
		margin-left: 1px;
		font-weight: 500;
		color: var(--accent);
	}
}
</style>
