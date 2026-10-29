import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.GITHUB_ACTIONS === 'true'
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/',
}));
