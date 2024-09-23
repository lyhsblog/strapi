import type { Database } from '../..';
import type { Schema, Column, Index, ForeignKey } from '../../schema/types';
import type { SchemaInspector } from '../dialect';

interface RawColumn {
  data_type: string;
  column_name: string;
  character_maximum_length: number;
  column_default: string;
  is_nullable: string;
}

interface RawIndex {
  indexrelid: string;
  index_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

const toStrapiType = (column: RawColumn) => {
  const rootType = column.data_type.toLowerCase().match(/[^(), ]+/)?.[0];

  switch (rootType) {
    case 'integer': {
      // find a way to figure out the increments
      return { type: 'integer' };
    }
    case 'text': {
      return { type: 'text', args: ['longtext'] };
    }
    case 'boolean': {
      return { type: 'boolean' };
    }
    case 'character': {
      return { type: 'string', args: [column.character_maximum_length] };
    }
    case 'timestamp': {
      return { type: 'datetime', args: [{ useTz: false, precision: 6 }] };
    }
    case 'date': {
      return { type: 'date' };
    }
    case 'time': {
      return { type: 'time', args: [{ precision: 3 }] };
    }
    case 'numeric': {
      return { type: 'decimal', args: [10, 2] };
    }
    case 'real':
    case 'double': {
      return { type: 'double' };
    }
    case 'bigint': {
      return { type: 'bigInteger' };
    }
    case 'jsonb': {
      return { type: 'jsonb' };
    }
    default: {
      return { type: 'specificType', args: [column.data_type] };
    }
  }
};

const getIndexType = (index: RawIndex) => {
  if (index.is_primary) {
    return 'primary';
  }

  if (index.is_unique) {
    return 'unique';
  }
};

export default class PostgresqlSchemaInspector implements SchemaInspector {
  db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  getSchema(): Promise<Schema> {
    throw new Error('Method not implemented.');
  }

  getDatabaseSchema(): string {
    return this.db.getSchemaName() || 'public';
  }

  async getTables(): Promise<string[]> {
    const tables = await this.db.connection
      .withSchema('information_schema')
      .select('table_name')
      .from('tables')
      .where({
        table_schema: this.getDatabaseSchema(),
        table_type: 'BASE TABLE',
      })
      .whereNotIn('table_name', ['geometry_columns', 'spatial_ref_sys']);

    return tables.map((table) => table.table_name);
  }

  async getColumns(tableName: string): Promise<Column[]> {
    const columns = await this.db.connection
      .withSchema('information_schema')
      .select(
        'data_type',
        'column_name',
        'character_maximum_length',
        'column_default',
        'is_nullable'
      )
      .from('columns')
      .where({
        table_schema: this.getDatabaseSchema(),
        table_name: tableName,
      });

    return columns.map((column) => {
      const { type, args = [], ...rest } = toStrapiType(column);
      const defaultTo =
        column.column_default && column.column_default.includes('nextval(')
          ? null
          : column.column_default;

      return {
        type,
        args,
        defaultTo,
        name: column.column_name,
        notNullable: column.is_nullable === 'NO',
        unsigned: false,
        ...rest,
      };
    });
  }

  async getIndexes(tableName: string): Promise<Index[]> {
    const indexes = await this.db
      .connection('pg_indexes')
      .where({
        schemaname: this.getDatabaseSchema(),
        tablename: tableName,
      })
      .select('indexname', 'indexdef');

    return indexes.map((index) => ({
      name: index.indexname,
      columns: this.parseIndexColumns(index.indexdef),
      type: getIndexType(index),
    }));
  }

  parseIndexColumns(indexDef: string): string[] {
    // Use regex or another parsing technique to extract column names from index definition
    const matches = indexDef.match(/\((.*?)\)/);
    return matches ? matches[1].split(',').map((col) => col.trim()) : [];
  }

  async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    const constraints = await this.db.connection
      .withSchema('information_schema')
      .select('constraint_name')
      .from('table_constraints')
      .where({
        table_schema: this.getDatabaseSchema(),
        table_name: tableName,
        constraint_type: 'FOREIGN KEY',
      });

    const foreignKeys = await Promise.all(
      constraints.map(async (constraint) => {
        const columns = await this.getForeignKeyColumns(constraint.constraint_name, tableName);
        const references = await this.getForeignKeyReferences(constraint.constraint_name);

        return {
          name: constraint.constraint_name,
          columns,
          referencedTable: references.referencedTable,
          referencedColumns: references.referencedColumns,
          onUpdate: references.onUpdate,
          onDelete: references.onDelete,
        };
      })
    );

    return foreignKeys;
  }

  async getForeignKeyColumns(constraintName: string, tableName: string): Promise<string[]> {
    const result = await this.db.connection
      .withSchema('information_schema')
      .select('column_name')
      .from('key_column_usage')
      .where({
        constraint_name: constraintName,
        table_schema: this.getDatabaseSchema(),
        table_name: tableName,
      });

    return result.map((row) => row.column_name);
  }

  async getForeignKeyReferences(constraintName: string) {
    const [references] = await this.db.connection
      .withSchema('information_schema')
      .select('update_rule as onUpdate', 'delete_rule as onDelete', 'unique_constraint_name')
      .from('referential_constraints')
      .where({
        constraint_name: constraintName,
        constraint_schema: this.getDatabaseSchema(),
      });

    const refColumns = await this.db.connection
      .withSchema('information_schema')
      .select('table_name as referencedTable', 'column_name as referencedColumn')
      .from('key_column_usage')
      .where({
        constraint_name: references.unique_constraint_name,
        table_schema: this.getDatabaseSchema(),
      });

    return {
      onUpdate: references.onUpdate,
      onDelete: references.onDelete,
      referencedTable: refColumns[0]?.referencedTable || null,
      referencedColumns: refColumns.map((col) => col.referencedColumn),
    };
  }
}
