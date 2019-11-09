import { GraphQLInputObjectType, GraphQLInputFieldConfigMap } from 'graphql';
import fromEntries from 'object.fromentries';
import { InputFields } from './types';
import TypeStore from './store';
import BaseType from './base';
import { buildArg } from './utils';
import InputFieldBuilder from './fieldUtils/input';

export default class InputObjectType<
  Types extends GiraphSchemaTypes.TypeInfo,
  Shape,
  Fields extends InputFields<Types>,
  Name extends string,
  MatchShape = Shape
> extends BaseType<Types, Name, Shape, Shape, MatchShape> {
  kind: 'InputObject' = 'InputObject';

  fields: Fields;

  constructor(name: Name, options: GiraphSchemaTypes.InputTypeOptions<Types, Fields>) {
    super(name);

    this.fields = options.shape(new InputFieldBuilder());
  }

  buildFields(store: TypeStore<Types>): GraphQLInputFieldConfigMap {
    return fromEntries(
      Object.keys(this.fields).map(key => {
        const field = this.fields[key];
        return [
          key,
          {
            description:
              typeof field !== 'object' || field instanceof BaseType || Array.isArray(field)
                ? undefined
                : field.description,
            required:
              typeof field !== 'object' || field instanceof BaseType || Array.isArray(field)
                ? false
                : field.required || false,
            type: buildArg(field, store),
          },
        ];
      }),
    );
  }

  buildType(store: TypeStore<Types>) {
    return new GraphQLInputObjectType({
      name: this.typename,
      fields: () => this.buildFields(store),
    });
  }
}