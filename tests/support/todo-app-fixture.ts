import { test as base, expect, type Locator, type Page } from '@playwright/test';

export type TodoFilter = 'All' | 'Active' | 'Completed';

/**
 * Thin driver for the TodoMVC UI. Every locator is role/name based because the live app exposes
 * no stable test IDs beyond the footer. Each action ends on a web-first assertion so callers never
 * need to synchronise manually.
 */
export class TodoApp {
  readonly newTodoInput: Locator;
  readonly footer: Locator;
  readonly clearCompletedButton: Locator;

  constructor(readonly page: Page) {
    this.newTodoInput = page.getByRole('textbox', { name: 'New Todo Input' });
    this.footer = page.getByTestId('footer');
    this.clearCompletedButton = page.getByRole('button', { name: 'Clear completed' });
  }

  async open(): Promise<void> {
    await this.page.goto('./');
    await expect(this.newTodoInput).toBeVisible();
  }

  item(title: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: title });
  }

  checkbox(title: string): Locator {
    return this.item(title).getByRole('checkbox');
  }

  async add(title: string): Promise<Locator> {
    await this.newTodoInput.fill(title);
    await this.newTodoInput.press('Enter');
    const item = this.item(title);
    await expect(item).toHaveCount(1);
    return item;
  }

  async addMany(...titles: string[]): Promise<void> {
    for (const title of titles) {
      await this.add(title);
    }
  }

  async complete(title: string): Promise<void> {
    const checkbox = this.checkbox(title);
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  }

  async delete(title: string): Promise<void> {
    const item = this.item(title);
    // The destroy button is CSS-hidden until the row is hovered.
    await item.hover();
    await item.getByRole('button', { name: 'Delete todo' }).click();
    await expect(item).toHaveCount(0);
  }

  async clearCompleted(): Promise<void> {
    await this.clearCompletedButton.click();
  }

  async filterBy(filter: TodoFilter): Promise<void> {
    await this.page.getByRole('link', { name: filter, exact: true }).click();
  }

  async expectRemainingCount(count: number): Promise<void> {
    await expect(this.footer).toContainText(`${count} ${count === 1 ? 'item' : 'items'} left`);
  }
}

export const test = base.extend<{ todoApp: TodoApp }>({
  todoApp: async ({ page }, use) => {
    // Third-party analytics are not under test and routinely hold the `load` event for seconds.
    await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort());
    await use(new TodoApp(page));
  },
});
