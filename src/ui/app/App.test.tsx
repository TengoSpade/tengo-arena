import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { loadThemeFiles } from '../../platform/content-loader';
import { App } from './App';

afterEach(cleanup);

describe('App shell', () => {
  it('renders the title, content status and a passing RNG self-check', () => {
    const content = loadThemeFiles('fixture', {
      '/content/fixture/classes.json': [],
      '/content/fixture/races.json': [],
      '/content/fixture/notes.json': {},
    });
    render(<App content={content} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Arena League');
    expect(screen.getByText('classes.json')).toBeTruthy();
    expect(screen.getAllByText('found')).toHaveLength(2);
    expect(screen.getByText('notes.json')).toBeTruthy();
    expect(screen.getByTestId('rng-check').textContent).toBe('deterministic');
  });
});
