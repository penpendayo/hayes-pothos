import { GraphQLResolveInfo } from 'graphql';
import { SmartSubscriptionOptions } from './types';

export function rootName(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return rootName(path.prev);
  }

  return String(path.key);
}

export function stringPath(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return `${stringPath(path.prev)}.${path.key}`;
  }

  return String(path.key);
}

export function subscribeOptionsFromIterator<T, Context extends object = object>(
  createIterator: (name: string, context: Context) => AsyncIterator<T>,
): Pick<SmartSubscriptionOptions<Context>, 'subscribe' | 'unsubscribe'> {
  const iterators = new WeakMap<Context, Map<string, AsyncIterator<T>>>();

  return {
    subscribe: async (name, context, cb) => {
      const itr = createIterator(name, context);

      if (!iterators.has(context)) {
        iterators.set(context, new Map());
      }

      const map = iterators.get(context)!;

      if (map.has(name)) {
        throw new Error(`Can't create multiple subscriptions for the same event name ${name}`);
      }

      map.set(name, itr);

      try {
        for await (const value of { [Symbol.asyncIterator]: () => itr }) {
          cb(null, value);
        }
      } catch (error) {
        cb(error);
      }
    },
    unsubscribe: (name, context) => {
      const map = iterators.get(context)!;

      if (!map || !map.has(name)) {
        return;
      }

      const itr = map.get(name)!;

      if (itr.return) {
        itr.return();
      }
    },
  };
}