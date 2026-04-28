import type { IModelFactory } from './modelFactory';
import { SqliteModelFactory } from './sqlite/modelFactory';

export type { IModelFactory } from './modelFactory';
export { SqliteModelFactory } from './sqlite/modelFactory';

/**
 * Returns the app’s model factory (persistence gateway). Routes and services should use this
 * and depend only on {@link IModelFactory}; wire a different implementation here when adding Postgres, etc.
 */
export function getModelFactory(): IModelFactory {
  return SqliteModelFactory.getInstance();
}
