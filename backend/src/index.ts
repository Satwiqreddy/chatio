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
      const publicRole = 'public';
      const authRole = 'authenticated';

      // Permissions for Friendships
      await grantPermission(publicRole, 'api::friendship.friendship.create');
      await grantPermission(authRole, 'api::friendship.friendship.create');
      await grantPermission(authRole, 'api::friendship.friendship.find');

      // Permissions for Messages
      await grantPermission(publicRole, 'api::message.message.create');
      await grantPermission(authRole, 'api::message.message.create');
      await grantPermission(authRole, 'api::message.message.find');

      // Permissions for ChatGroups
      await grantPermission(publicRole, 'api::chat-group.chat-group.create');
      await grantPermission(authRole, 'api::chat-group.chat-group.create');
      await grantPermission(authRole, 'api::chat-group.chat-group.find');

      // 3. Fix existing friendships to show names in dashboard
      try {
        const friendships = await strapi.documents('api::friendship.friendship').findMany({
          populate: ['user1', 'user2']
        });

        for (const f of friendships) {
          const u1 = (f.user1 as any)?.username || f.user1_name;
          const u2 = (f.user2 as any)?.username || f.user2_name;
          const combined = `${u1 || ''} ${u2 || ''}`.trim();
          
          await strapi.documents('api::friendship.friendship').update({
            documentId: f.documentId,
            data: {
              user1_name: u1,
              user2_name: u2,
              combined_name: combined
            }
          });
        }
        console.log('✅ Friendship names and combined search synchronized');
      } catch (e: any) {
        console.error('❌ Migration failed:', e.message);
      }

      console.log('✅ Permissions bootstrap complete');
    } catch (err: any) {
      console.error('❌ Error setting permissions:', err.message);
    }
  },
};
