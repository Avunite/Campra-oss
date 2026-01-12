<script lang="ts">
import { defineComponent, h, PropType, TransitionGroup } from 'vue';
import { defaultStore } from '@/store';

export default defineComponent({
  props: {
    items: {
      type: Array as PropType<{ id: string; createdAt: string; }[]>,
      required: true,
    },
    direction: {
      type: String,
      required: false,
      default: 'down',
    },
    reversed: {
      type: Boolean,
      required: false,
      default: false,
    },
    noGap: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  setup(props, { slots }) {
    if (props.items.length === 0) return;

    const renderChildren = () => props.items.map((item) => {
      if (!slots || !slots.default) return;
      const el = slots.default({ item })[0];
      if (el.key == null && item.id) el.key = item.id;

      return el;
    });

    return () => h(
      defaultStore.state.animation ? TransitionGroup : 'div',
      defaultStore.state.animation ? {
        class: 'mkSimpleList' + (props.noGap ? ' noGap' : ''),
        name: 'list',
        tag: 'div',
        'data-direction': props.direction,
        'data-reversed': props.reversed ? 'true' : 'false',
      } : {
        class: 'mkSimpleList' + (props.noGap ? ' noGap' : ''),
      },
      { default: renderChildren }
    );
  },
});
</script>

<style lang="scss">
.mkSimpleList {
  > *:empty {
    display: none;
  }
  > *:not(:last-child) {
    margin-bottom: var(--margin);
  }
  > .list-move {
    transition: transform 0.7s cubic-bezier(0.23, 1, 0.32, 1);
  }
  > .list-enter-active {
    transition: transform 0.7s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.7s cubic-bezier(0.23, 1, 0.32, 1);
  }
  &[data-direction="up"] {
    > .list-enter-from {
      opacity: 0;
      transform: translateY(64px);
    }
  }
  &[data-direction="down"] {
    > .list-enter-from {
      opacity: 0;
      transform: translateY(-64px);
    }
  }
  &.noGap {
    > * {
      margin: 0 !important;
      border: none;
      border-radius: 0;
      box-shadow: none;
      &:not(:last-child) {
        border-bottom: solid 0.5px var(--divider);
      }
    }
  }
}
</style>