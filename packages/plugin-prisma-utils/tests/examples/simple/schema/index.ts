import type { InputRef } from '@pothos/core';
import type { Prisma } from '../../../client';
import builder, { prisma } from '../builder';

const StringFilter = builder.prismaFilter('String', {
  ops: ['contains', 'equals', 'startsWith', 'not', 'equals'],
});
export const IDFilter = builder.prismaFilter('Int', {
  ops: ['equals', 'not'],
});

const StringListFilter = builder.prismaListFilter(StringFilter, {
  ops: ['every', 'some', 'none'],
});

builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => (typeof value === 'number' ? new Date(value) : new Date(String(value))),
});

builder.queryType();

builder.queryField('post', (t) =>
  t.prismaField({
    type: 'Post',
    nullable: true,
    args: {
      title: t.arg({
        type: StringFilter,
      }),
      list: t.arg({ type: StringListFilter }),
    },
    resolve: (_query, _, args) =>
      prisma.post.findFirst({
        where: {
          title: args.title ?? undefined,
          comments: {},
        },
      }),
  }),
);

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
  }),
});

const ProfileOrderBy: InputRef<Prisma.ProfileOrderByWithRelationInput> = builder.prismaOrderBy(
  'Profile',
  {
    fields: () => ({
      bio: true,
      user: UserOrderBy,
    }),
  },
);

const UserOrderBy = builder.prismaOrderBy('User', {
  fields: {
    name: true,
    profile: ProfileOrderBy,
  },
});

export const PostOrderBy = builder.prismaOrderBy('Post', {
  fields: {
    id: true,
    title: true,
    createdAt: true,
    author: UserOrderBy,
  },
});

const CommentWhere = builder.prismaWhere('Comment', {
  fields: {
    createdAt: 'DateTime',
  },
});

const UserOrWhere = builder.prismaWhere('User', {
  name: 'UserFilterOr',
  fields: {
    name: 'String',
    id: 'Int',
  },
});

const UserWhere = builder.prismaWhere('User', {
  fields: () => ({
    id: IDFilter,
    NOT: true,
    OR: UserOrWhere,
  }),
});

const PostFilter = builder.prismaWhere('Post', {
  fields: (t) => ({
    id: IDFilter,
    title: 'String',
    createdAt: 'DateTime',
    author: UserWhere,
    comments: builder.prismaListFilter(CommentWhere, { ops: ['some'] }),
    authorId: t.field({ type: IDFilter, description: 'filter by author id' }),
  }),
});

builder.queryField('posts', (t) =>
  t.prismaField({
    type: ['Post'],
    args: { filter: t.arg({ type: PostFilter }), order: t.arg({ type: PostOrderBy }) },
    resolve: (query, _, args) =>
      prisma.post.findMany({
        ...query,
        where: args.filter ?? undefined,
        orderBy: args.order ?? undefined,
        take: 3,
      }),
  }),
);

const CreateUserPostsInput = builder.prismaCreateRelation('User', 'posts', {
  fields: () => ({
    create: CreatePostInput,
    connect: PostWhereUnique,
  }),
});

const CreateUserInput = builder.prismaCreate('User', {
  fields: () => ({
    email: 'String',
    name: 'String',
    posts: CreateUserPostsInput,
  }),
});

const PostWhereUnique = builder.prismaWhereUnique('Post', {
  name: 'PostWhereUnique',
  fields: {
    id: 'Int',
  },
});

const CreatePostInput = builder.prismaCreate('Post', {
  fields: {
    title: 'String',
    authorId: 'String',
  },
});

const IntAtomicUpdate = builder.prismaIntAtomicUpdate();

const UpdatePostInput = builder.prismaUpdate('Post', {
  fields: {
    title: 'String',
    views: IntAtomicUpdate,
  },
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: true }),
    email: t.exposeString('email'),
    posts: t.relation('posts'),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createUser: t.prismaField({
      type: 'User',
      args: {
        data: t.arg({ type: CreateUserInput, required: true }),
      },
      resolve: (query, _, args) => prisma.user.create({ ...query, data: args.data }),
    }),
    createPosts: t.prismaField({
      type: ['Post'],
      args: {
        data: t.arg({ type: [CreatePostInput], required: true }),
      },
      resolve: async (query) => {
        await prisma.post.create({ ...query, data: { title: '123', authorId: 1 } });

        return [];
      },
    }),
    updatePost: t.prismaField({
      type: 'Post',
      args: {
        id: t.arg({ type: 'Int', required: true }),
        data: t.arg({ type: UpdatePostInput, required: true }),
      },
      resolve: (query, _, args) =>
        prisma.post.update({
          ...query,
          where: { id: args.id },
          data: args.data,
        }),
    }),
  }),
});

export default builder.toSchema();
