// Shared Preact + htm binding so every module renders into the same component tree.
import { h } from 'preact';
import htm from 'htm';

export const html = htm.bind(h);
export { h };
