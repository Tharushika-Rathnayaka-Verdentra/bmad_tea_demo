import { test, expect, log } from '../support/merged-fixtures';
import { createTodo } from '../support/factories/todo-factory';

test('@p1 [P1] 1.0-E2E-001 unique todo creation', async ({ page }) => {
  const todo = createTodo();

  await log.step('Given the TodoMVC app is open');
  await page.goto('./');

  await log.step('When a unique todo is created');
  const newTodoInput = page.getByRole('textbox', { name: 'New Todo Input' });
  await newTodoInput.fill(todo.title);
  await newTodoInput.press('Enter');

  await log.step('Then the todo appears exactly once as active');
  const todoItems = page.getByRole('listitem').filter({ hasText: todo.title });
  await expect(todoItems).toHaveCount(1);
  await expect(todoItems.getByRole('checkbox')).not.toBeChecked();
});

test('@p1 [P1] 1.0-E2E-002 mixed active/completed todo membership through All, Active, Completed', async ({ page }) => {
  const activeTodo = createTodo();
  const completedTodo = createTodo();

  await log.step('Given the TodoMVC app is open');
  await page.goto('./');

  await log.step('When one todo is created and left active');
  const newTodoInput = page.getByRole('textbox', { name: 'New Todo Input' });
  await newTodoInput.fill(activeTodo.title);
  await newTodoInput.press('Enter');

  await log.step('And a second todo is created and marked completed');
  await newTodoInput.fill(completedTodo.title);
  await newTodoInput.press('Enter');
  const completedItem = page.getByRole('listitem').filter({ hasText: completedTodo.title });
  await completedItem.getByRole('checkbox').check();
  await expect(completedItem.getByRole('checkbox')).toBeChecked();

  await log.step('Then All view shows both todos');
  await page.getByRole('link', { name: 'All' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: activeTodo.title })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: completedTodo.title })).toBeVisible();

  await log.step('And Active view shows only the active todo');
  await page.getByRole('link', { name: 'Active' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: activeTodo.title })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: completedTodo.title })).not.toBeVisible();

  await log.step('And Completed view shows only the completed todo');
  await page.getByRole('link', { name: 'Completed' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: completedTodo.title })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: activeTodo.title })).not.toBeVisible();
  await expect(completedItem.getByRole('checkbox')).toBeChecked();
});

// INTENTIONAL FAILURE — probes the TestRail/Jira defect pipeline. The final expectation is
// deliberately wrong so the reporter raises (or comments on) a Jira issue for this test.
// Fix the expectation to "1 item left" or delete this test once the integration is verified.
test('@p2 [P2] 1.0-E2E-003 clearing completed todos keeps the active count accurate', async ({ page }) => {
  const activeTodo = createTodo();
  const completedTodo = createTodo();

  await log.step('Given the TodoMVC app is open with one active and one completed todo');
  await page.goto('./');
  const newTodoInput = page.getByRole('textbox', { name: 'New Todo Input' });
  await newTodoInput.fill(activeTodo.title);
  await newTodoInput.press('Enter');
  await newTodoInput.fill(completedTodo.title);
  await newTodoInput.press('Enter');
  await page.getByRole('listitem').filter({ hasText: completedTodo.title }).getByRole('checkbox').check();

  await log.step('When completed todos are cleared');
  await page.getByRole('button', { name: 'Clear completed' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: completedTodo.title })).toHaveCount(0);

  await log.step('Then the footer reports the remaining active todo count');
  await expect(page.getByTestId('footer')).toContainText('2 items left');
});