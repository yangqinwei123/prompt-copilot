import type { SiteAdapter } from './types';
import { chatgptAdapter } from './chatgpt';
import { deepseekAdapter } from './deepseek';
import { doubaoAdapter } from './doubao';
import { claudeAdapter } from './claude';

const adapters: SiteAdapter[] = [chatgptAdapter, deepseekAdapter, doubaoAdapter, claudeAdapter];

export function getAdapter(url: string): SiteAdapter | null {
  return adapters.find((a) => a.matches(url)) ?? null;
}