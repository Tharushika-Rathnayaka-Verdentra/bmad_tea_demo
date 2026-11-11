import { test, expect, log } from '../support/merged-fixtures';
import { createTodo } from '../support/factories/todo-factory';

test('@p1 [P1] 1.0-E2E-001 unique todo creation', async ({ todoApp }) => {
  const todo = createTodo();

  await log.step('Given the TodoMVC app is open');
  await todoApp.open();

  await log.step('When a unique todo is created');
  const item = await todoApp.add(todo.title);

  await log.step('Then the todo appears exactly once as active');
  await expect(item).toHaveCount(1);
  await expect(todoApp.checkbox(todo.title)).not.toBeChecked();
});

test('@p1 [P1] 1.0-E2E-002 mixed active/completed todo membership through All, Active, Completed', async ({ todoApp }) => {
  const activeTodo = createTodo();
  const completedTodo = createTodo();

  await log.step('Given the TodoMVC app is open');
  await todoApp.open();

  await log.step('When one todo is created and left active');
  await todoApp.add(activeTodo.title);

  await log.step('And a second todo is created and marked completed');
  await todoApp.add(completedTodo.title);
  await todoApp.complete(completedTodo.title);

  await log.step('Then All view shows both todos');
  await todoApp.filterBy('All');
  await expect(todoApp.item(activeTodo.title)).toBeVisible();
  await expect(todoApp.item(completedTodo.title)).toBeVisible();

  await log.step('And Active view shows only the active todo');
  await todoApp.filterBy('Active');
  await expect(todoApp.item(activeTodo.title)).toBeVisible();
  await expect(todoApp.item(completedTodo.title)).not.toBeVisible();

  await log.step('And Completed view shows only the completed todo');
  await todoApp.filterBy('Completed');
  await expect(todoApp.item(completedTodo.title)).toBeVisible();
  await expect(todoApp.item(activeTodo.title)).not.toBeVisible();
  await expect(todoApp.checkbox(completedTodo.title)).toBeChecked();
});

// Test design 1.0-E2E-003 (delete). Numbered 004 here because 1.0-E2E-003 is already carried by the
// defect-pipeline probe below; renaming that test would break its TestRail case and Jira dedupe key.
test('@p2 [P2] 1.0-E2E-004 deleting one todo removes only the selected row', async ({ todoApp }) => {
  const keptTodo = createTodo();
  const deletedTodo = createTodo();

  await log.step('Given the TodoMVC app is open with two todos');
  await todoApp.open();
  await todoApp.addMany(keptTodo.title, deletedTodo.title);
  await todoApp.expectRemainingCount(2);

  await log.step('When one todo is deleted');
  await todoApp.delete(deletedTodo.title);

  await log.step('Then only the selected todo disappears and the other remains active');
  await expect(todoApp.item(deletedTodo.title)).toHaveCount(0);
  await expect(todoApp.item(keptTodo.title)).toHaveCount(1);
  await expect(todoApp.checkbox(keptTodo.title)).not.toBeChecked();
  await todoApp.expectRemainingCount(1);
});

// INTENTIONAL FAILURE — probes the TestRail/Jira defect pipeline. The final expectation is
// deliberately wrong so the reporter raises (or updates) a Jira issue for this test.
// Keep the title unchanged: the Jira dedupe label hashes project|file|title.
// Fix the expectation to "1 item left" or delete this test once the integration is no longer being demoed.
test('@p2 [P2] 1.0-E2E-003 clearing completed todos keeps the active count accurate', async ({ todoApp }) => {
  const activeTodo = createTodo();
  const completedTodo = createTodo();

  await log.step('Given the TodoMVC app is open with one active and one completed todo');
  await todoApp.open();
  await todoApp.addMany(activeTodo.title, completedTodo.title);
  await todoApp.complete(completedTodo.title);

  await log.step('When completed todos are cleared');
  await todoApp.clearCompleted();
  await expect(todoApp.item(completedTodo.title)).toHaveCount(0);

  await log.step('Then the footer reports the remaining active todo count');
  await expect(todoApp.footer).toContainText('2 items left');
});