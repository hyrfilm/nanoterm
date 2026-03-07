<script lang="ts">
  import './lib/commands/index';
  import TerminalView from './lib/Terminal.svelte';
  import userConfig from './nanoterm.config';
</script>

<TerminalView config={userConfig} />
