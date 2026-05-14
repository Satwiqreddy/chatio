export default {
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Automatically fill in usernames for easier viewing in the dashboard
    if (data.user1 && !data.user1_name) {
      const user1 = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: data.user1 }
      });
      if (user1) {
        data.user1_name = user1.username;
        data.combined_name = `${data.user1_name || ''} ${data.user2_name || ''}`.trim();
      }
    }

    if (data.user2 && !data.user2_name) {
      const user2 = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: data.user2 }
      });
      if (user2) {
        data.user2_name = user2.username;
        data.combined_name = `${data.user1_name || ''} ${data.user2_name || ''}`.trim();
      }
    }
  },

  async beforeUpdate(event: any) {
    const { data } = event.params;
    
    // Sync names if users are updated
    if (data.user1) {
      const user1 = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: data.user1 }
      });
      if (user1) data.user1_name = user1.username;
    }

    if (data.user2) {
      const user2 = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: data.user2 }
      });
      if (user2) data.user2_name = user2.username;
      data.combined_name = `${data.user1_name || ''} ${data.user2_name || ''}`.trim();
    }
  }
};
