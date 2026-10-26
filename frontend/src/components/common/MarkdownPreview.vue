<script setup lang="ts">
import { computed } from 'vue';
import { config, MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/preview.css';
import { useAppStore } from '../../stores/app';

config({
  markdownItConfig(mdit) {
    mdit.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
      const token = tokens[idx];
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
      return self.renderToken(tokens, idx, options);
    };
  }
});

interface Props {
  content: string;
  editorId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  editorId: 'fnos-notice-preview'
});

const appStore = useAppStore();

const isDark = computed(() => {
  if (appStore.themeMode === 'dark') return true;
  if (appStore.themeMode === 'light') return false;
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark');
  }
  return false;
});

const mdTheme = computed(() => (isDark.value ? 'dark' : 'light'));
const codeTheme = computed(() => (isDark.value ? 'github' : 'atom'));
</script>

<template>
  <div class="mslx-md-wrapper transition-colors duration-200">
    <MdPreview
      :editor-id="editorId"
      :model-value="content"
      :theme="mdTheme"
      :code-theme="codeTheme"
      :preview-theme="'vuepress'"
      class="mslx-custom-preview"
    />
  </div>
</template>

<style scoped>
.mslx-md-wrapper {
  --mslx-primary: #2563eb;
  --mslx-primary-hover: #1d4ed8;
  --mslx-primary-bg: rgba(37, 99, 235, 0.1);
  --mslx-border: rgba(228, 228, 231, 0.8);
}

:global(.dark) .mslx-md-wrapper,
.dark .mslx-md-wrapper {
  --mslx-primary: #60a5fa;
  --mslx-primary-hover: #93c5fd;
  --mslx-primary-bg: rgba(96, 165, 250, 0.15);
  --mslx-border: rgba(63, 63, 70, 0.6);
}

:deep(.md-editor),
:deep(.md-editor-preview) {
  --md-bk-color: transparent !important;
  --md-color: inherit !important;
  background-color: transparent !important;
  text-align: left !important;
  font-size: 13px !important;
  line-height: 1.6 !important;
  word-break: break-word !important;
}

:deep(.md-editor.md-editor-previewOnly .md-editor-preview-wrapper) {
  padding: 0 !important;
}
:deep(.md-editor.md-editor-previewOnly) {
  border: none !important;
}

:deep(.md-editor-preview figure.md-editor-code) {
  background-color: var(--md-theme-code-block-bg-color) !important;
  border: 1px solid var(--mslx-border) !important;
  border-radius: 10px !important;
  overflow: hidden !important;
  margin: 1rem 0 !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02) !important;
  display: block !important;
}
:global(.dark) :deep(.md-editor-preview figure.md-editor-code),
.dark :deep(.md-editor-preview figure.md-editor-code) {
  box-shadow: none !important;
}

:deep(.md-editor-preview .md-editor-code-head) {
  background-color: var(--md-theme-code-before-bg-color) !important;
  border-bottom: 1px solid var(--mslx-border) !important;
  position: relative !important;
  margin: 0 !important;
}

:deep(.md-editor-preview img) {
  border-radius: 10px;
  border: 1px solid var(--mslx-border);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  margin-top: 1rem;
  margin-bottom: 1rem;
  max-width: 100%;
}
:global(.dark) :deep(.md-editor-preview img),
.dark :deep(.md-editor-preview img) {
  box-shadow: none;
}

:deep(.md-editor-preview a) {
  color: var(--mslx-primary);
  text-decoration: none;
  transition: all 0.2s ease-in-out;
}
:deep(.md-editor-preview a:hover) {
  color: var(--mslx-primary-hover);
  text-decoration: underline;
  text-underline-offset: 4px;
}

:deep(.md-editor-preview code:not([class*='language-'])) {
  color: var(--mslx-primary);
  background-color: var(--mslx-primary-bg);
  border-radius: 6px;
  padding: 2px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  font-weight: 600;
}

:deep(.md-editor-preview blockquote) {
  background: transparent !important;
  border-left: 4px solid var(--mslx-primary) !important;
  color: inherit !important;
  opacity: 0.85;
  margin: 1rem 0;
  padding: 0.4rem 0 0.4rem 0.8rem;
}

:deep(.md-editor-preview table tr:nth-child(n)) {
  background-color: transparent !important;
}
:deep(.md-editor-preview table th),
:deep(.md-editor-preview table td) {
  border-color: var(--mslx-border) !important;
  padding: 6px 12px !important;
}

:deep(.md-editor-preview h1),
:deep(.md-editor-preview h2) {
  margin-top: 1rem !important;
  margin-bottom: 0.5rem !important;
  font-weight: 700 !important;
}
:deep(.md-editor-preview h3),
:deep(.md-editor-preview h4),
:deep(.md-editor-preview h5) {
  margin-top: 0.75rem !important;
  margin-bottom: 0.35rem !important;
  font-weight: 600 !important;
}
:deep(.md-editor-preview > *:first-child) {
  margin-top: 0 !important;
}
:deep(.md-editor-preview p) {
  margin-top: 0.5rem !important;
  margin-bottom: 0.5rem !important;
}

:deep(.md-editor-preview ul) {
  list-style-type: disc !important;
  padding-left: 1.25rem !important;
  margin: 0.5rem 0 !important;
}
:deep(.md-editor-preview ol) {
  list-style-type: decimal !important;
  padding-left: 1.25rem !important;
  margin: 0.5rem 0 !important;
}

:deep(.md-editor-dark .vuepress-theme),
:deep(.md-editor-dark.vuepress-theme) {
  --md-theme-color: #f4f4f5 !important;
  --md-theme-heading-color: #ffffff !important;
}
</style>
