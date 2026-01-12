<template>
<header class="kkwtjztg">
	<div class="user-info">
		<MkA v-user-preview="note.user.id" class="name" :to="userPage(note.user)">
			<MkUserName :user="note.user" class="mkusername">
				<span v-if="note.user.isBot" class="is-bot">bot</span>
				<!-- <span v-if="note.user.isPlus" class="is-plus"><i class="ph-dog-bold"></i> </span>
		    <span v-if="note.user.isVerified" class="is-verified"><i class="ph-circle-wavy-check ph-lg"></i> </span>-->
			</MkUserName>
		</MkA>
		<div class="username"><MkAcct :user="note.user"/></div>
	</div>
	<div class="info">
		<MkA class="created-at" :to="notePage(note)">
			<MkTime :time="note.createdAt"/>
		</MkA>
		<MkVisibility :note="note"/>
	</div>
</header>
</template>

<script lang="ts" setup>
import { } from 'vue';
import type * as misskey from 'calckey-js';
import MkVisibility from '@/components/MkVisibility.vue';
import { notePage } from '@/filters/note';
import { userPage } from '@/filters/user';

defineProps<{
	note: misskey.entities.Note;
	pinned?: boolean;
}>();
</script>

<style lang="scss" scoped>
.kkwtjztg {
	display: flex;
	align-items: flex-start;
	white-space: nowrap;
	width: 100%;
	padding: .1em .7em;
	border-radius: 100px;
	font-size: .8em;
	text-shadow: 0 2px 2px var(--shadow);

	> .user-info {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		margin: 0 .5em 0 0;
		min-width: 0;

		> .name {
			display: block;
			margin: 0;
			padding: 0;
			overflow: hidden;
			font-size: 1.2em;
			font-weight: bold;
			text-decoration: none;
			text-overflow: ellipsis;

			>.mkusername >.is-bot {
				flex-shrink: 0;
				align-self: center;
				margin: 0 .5em 0 0;
				padding: 1px 6px;
				font-size: 80%;
				border: solid 0.5px var(--divider);
				border-radius: 3px;
			}

			&:hover {
				text-decoration: underline;
			}
		}

		> .username {
			margin: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 0.9em;
			opacity: 0.7;
		}
	}

	> .info {
		flex: 0 0 auto;
		margin-left: auto;
		font-size: 0.9em;
	}
}
</style>
