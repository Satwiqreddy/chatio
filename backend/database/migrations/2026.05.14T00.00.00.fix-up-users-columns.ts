import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('up_users');
  
  if (!hasTable) {
    // Create the table fresh with all required columns
    await knex.schema.createTable('up_users', (table) => {
      table.increments('id').primary();
      table.string('document_id').unique();
      table.string('username').unique();
      table.string('email').unique();
      table.string('provider');
      table.string('password');
      table.string('reset_password_token');
      table.string('confirmation_token');
      table.boolean('confirmed').defaultTo(false);
      table.boolean('blocked').defaultTo(false);
      table.timestamps(true, true);
      table.integer('created_by_id').unsigned();
      table.integer('updated_by_id').unsigned();
      table.string('locale');
      table.datetime('published_at');
    });
    return;
  }

  // Add missing columns if they don't exist
  const hasEmail = await knex.schema.hasColumn('up_users', 'email');
  const hasUsername = await knex.schema.hasColumn('up_users', 'username');
  const hasProvider = await knex.schema.hasColumn('up_users', 'provider');

  await knex.schema.alterTable('up_users', (table) => {
    if (!hasEmail) table.string('email').unique();
    if (!hasUsername) table.string('username').unique();
    if (!hasProvider) table.string('provider');
  });
}

export async function down(knex: Knex): Promise<void> {
  // no-op
}
