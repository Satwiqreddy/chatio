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

      // Permissions
      await grantPermission(publicRole, 'api::friendship.friendship.create');
      await grantPermission(authRole, 'api::friendship.friendship.create');
      await grantPermission(authRole, 'api::friendship.friendship.find');
      await grantPermission(publicRole, 'api::message.message.create');
      await grantPermission(authRole, 'api::message.message.create');
      await grantPermission(authRole, 'api::message.message.find');
      await grantPermission(publicRole, 'api::chat-group.chat-group.create');
      await grantPermission(authRole, 'api::chat-group.chat-group.create');
      await grantPermission(authRole, 'api::chat-group.chat-group.find');

      // ===== FORCE SYNC NAMES FOR DASHBOARD =====
      console.log('🔄 Starting Friendship name sync...');
      
      const friendships = await strapi.db.query('api::friendship.friendship').findMany({
        populate: { user1: true, user2: true }
      });

      for (const f of friendships) {
        const u1 = f.user1?.username || 'Unknown';
        const u2 = f.user2?.username || 'Unknown';
        const combined = `${u1} ${u2}`.trim();
        
        await strapi.documents('api::friendship.friendship').update({
          documentId: f.documentId,
          data: {
            user1_name: u1,
            user2_name: u2,
            combined_name: combined
          }
        });
      }

      console.log('✅ Synchronization complete');
      console.log('✅ Permissions bootstrap complete');
    } catch (err: any) {
      console.error('❌ Error in bootstrap:', err.message);
    }
  },
};
