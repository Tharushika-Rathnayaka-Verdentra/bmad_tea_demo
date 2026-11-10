import { faker } from '@faker-js/faker';

export type Todo = {
  title: string;
};

export function createTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    title: faker.lorem.words({ min: 2, max: 4 }),
    ...overrides,
  };
}