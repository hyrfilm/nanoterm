<script lang="ts">
  import { onMount } from 'svelte';
  import { createNanoTerm } from './index';
  import type { NanoTermConfig } from './config';

  let { config = undefined }: { config?: NanoTermConfig } = $props();

  let containerEl: HTMLDivElement;

  onMount(() => {
    const instance = createNanoTerm(containerEl, config);
    return () => instance.dispose();
  });
</script>

<div bind:this={containerEl} class="terminal-container"></div>

<style>
  .terminal-container {
    width: 100%;
    height: 100%;
  }
  .terminal-container :global(.xterm) {
    height: 100%;
    padding: 4px;
  }
</style>
