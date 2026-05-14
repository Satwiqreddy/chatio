export default {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }: { strapi: any }) {
    const grantPermission = async (roleType: string, action: string) => {
      try {
        const role = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: roleType },
        });
        if (role) {
          const permission = await strapi.db.query('plugin::users-permissions.permission').findOne({
            where: { role: role.id, action },
          });
          if (!permission) {
            await strapi.db.query('plugin::users-permissions.permission').create({
              data: { role: role.id, action },
            });
          }
        }
      } catch (err: any) {
        console.error(`Error granting ${action} to ${roleType}:`, err.message);
      }
    };

    try {
      await grantPermission('public', 'api::friendship.friendship.create');
      await grantPermission('authenticated', 'api::friendship.friendship.create');
      await grantPermission('authenticated', 'api::friendship.friendship.find');
      await grantPermission('public', 'api::message.message.create');
      await grantPermission('authenticated', 'api::message.message.create');
      await grantPermission('authenticated', 'api::message.message.find');
      await grantPermission('public', 'api::chat-group.chat-group.create');
      await grantPermission('authenticated', 'api::chat-group.chat-group.create');
      await grantPermission('authenticated', 'api::chat-group.chat-group.find');

      // Sync combined_name from user1 + user2 string fields
      const friendships = await strapi.db.query('api::friendship.friendship').findMany({});
      for (const f of friendships) {
        if (f.user1 && f.user2) {
          await strapi.db.query('api::friendship.friendship').update({
            where: { id: f.id },
            data: { combined_name: `${f.user1} ${f.user2}` }
          });
        }
      }

      console.log('✅ Permissions bootstrap complete');
    } catch (err: any) {
      console.error('❌ Error in bootstrap:', err.message);
    }
  },
};
