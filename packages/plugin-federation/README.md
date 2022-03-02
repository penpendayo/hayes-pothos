# Federation Plugin

A plugin for building subGraphs that are compatible with
[Apollo Federation 2](https://www.apollographql.com/blog/announcement/backend/announcing-federation-2/).

## Disclaimer

Apollo federation 2 is still in alpha, and the API of this plugin may change in the future. This is
an early release intended to allow early adopeters to build federation compatible schemas with
pothos, but this plugin may not be as stable as other parts of the Pothos eco-system.

## Usage

This page will describe the basics of the Pothos API for federation, but will not cover detailed
information on how federation works, or what all the terms on this page mean. For more general
information on federation, see the
[official docs](https://www.apollographql.com/docs/federation/v2/)

### Install

You will need to install the plugin, as well as `@apollo/subgraph`

```bash
yarn add @pothos/plugin-federation @apollo/subgraph@^2.0.0-alpha.3
```

You will likely want to install apollo-server as well, but it is not required if you want to use a
different server

```bash
yarn add apollo-server
```

### Setup

```typescript
import FederationPlugin from '@pothos/plugin-federation';
const builder = new SchemaBuilder({
  // If you are using other plugins, the federation plugin should be listed after plugins like auth that wrap resolvers
  plugins: [FederationPlugin],
});
```

### Defining entities

Defining entities for you schema is a 2 step process. First you will need to define an object type
as you would normally, then you can convert that object type to an entity by providing a `key` (or
`keys`), and a method to load that entity.

```typescript
const UserType = builder.objectRef<User>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    username: t.exposeString('username'),
  }),
});

builder.asEntity(UserType, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: (user) => users.find(({ id }) => user.id === id),
});
```

`keys` are defined using `builder.selection`. This method _MUST_ be called with a generic argument
that defines the types for any fields that are part of the key. `key` may also be an array.
`resolveReference` will be called with the type used by the `key` selection.

### Extending external entities

External enties can be extended by calling `builder.externalRef`, and then calling implement on the
returned ref.

`builder.externalRef` takes the name of the entity, a selection (using `builder.selecton`, just like
a `key` on an entity object), and a resolve method that loads an object given a `key`. The return
type of the resolver is used as the backing type for the ref, and will be the type of the `parent`
arg when defining fields for this type.

```typescript
const ProductRef = builder.externalRef(
  'Product',
  builder.selection<{ upc: string }>('upc'),
  (entity) => {
    const product = inventory.find(({ upc }) => upc === entity.upc);

    // estends the enitity ({upc: string}) with other product details available in this service
    return product && { ...entity, ...product };
  },
);

ProductRef.implement({
  // Additional external fields can be defined here which can be used by `requires` or `provides` directives
  externalFields: (t) => ({
    price: t.float(),
    weight: t.float(),
  }),
  fields: (t) => ({
    // exposes properties added during loading of the entity above
    upc: t.exposeString('upc'),
    inStock: t.exposeBoolean('inStock'),
    shippingEstimate: t.float({
      // fields can add a `requires` directive for any of the externalFields defined above
      // which will be made available as oart of the first arg in the resolver.
      requires: builder.selection<{ weight?: number; price?: number }>('price weight'),
      resolve: (data) => {
        // free for expensive items
        if ((data.price ?? 0) > 1000) {
          return 0;
        }
        // estimate is based on weight
        return (data.weight ?? 0) * 0.5;
      },
    }),
  }),
});
```

### Adding a provides directive

To add a `@provides` directive, you will need to implement the Parent type of the field being
provided as an external ref, and then use the `.provides` method of the returned ref when defining
the field that will have the `@provides` directive. The provided field must be listed as an
`externalField` in the external type.

```typescript
const UserType = builder.externalRef('User', builder.selection<{ id: string }>('id')).implement({
  externalFields: (t) => ({
    // The field that will be provided
    username: t.string(),
  }),
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const ReviewType = builder.objectRef<Review>('Review');
ReviewType.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body'),
    author: t.field({
      // using UserType.provides<...>(...) instead of just UserType adds the provide anotation
      // and ensures the resolved value includes data for the provided field
      // The generic in Type.provides works the same as the `builder.selection` method.
      type: UserType.provides<{ username: string }>('username'),
      resolve: (review) => ({
        id: review.authorID,
        username: usernames.find((username) => username.id === review.authorID)!.username,
      }),
    }),
    product: t.field({
      type: Product,
      resolve: (review) => ({ upc: review.product.upc }),
    }),
  }),
});
```

### Building your schema and starting a server

```typescript
// Use new `toSubGraphSchema` method to add subGraph specific types and queries to the schema
const schema = builder.toSubGraphSchema({});

const server = new ApolloServer({
  schema,
});

server
  .listen(4000)
  .then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  })
  .catch((error) => {
    throw error;
  });
```

For a functional example that combines multiple graphs built with Pothos into a single query see
[https://github.com/hayes/pothos/tree/main/packages/plugin-federation/tests/example](https://github.com/hayes/pothos/tree/main/packages/plugin-federation/tests/example)