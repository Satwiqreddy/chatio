import { Server } from 'socket.io';

export default {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }: { strapi: any }) {
    // ===== PERMISSIONS =====
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
            data: { combined_name: `${f.user1} ${f.user2} ${f.user2} ${f.user1}` }
          });
        }
      }

      console.log('✅ Permissions bootstrap complete');
    } catch (err: any) {
      console.error('❌ Error in bootstrap:', err.message);
    }

    // ===== SOCKET.IO =====
    const httpServer = strapi.server.httpServer;
    const io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    const onlineUsers: Record<string, string> = {}; // username -> socketId
    const userSockets: Record<string, string> = {}; // socketId -> username

    io.on('connection', (socket) => {
      console.log('A user connected:', socket.id);

      socket.on('identify', async (username: string) => {
        onlineUsers[username] = socket.id;
        userSockets[socket.id] = username;

        io.emit('user_status_change', { username, status: 'online' });
        io.to(socket.id).emit('initial_online_users', Object.keys(onlineUsers));

        // Load friendships and groups
        try {
          const friendships = await strapi.db.query('api::friendship.friendship').findMany({
            where: {
              $or: [{ user1: username }, { user2: username }],
            },
          });

          const friends = friendships.map((f: any) =>
            f.user1 === username ? f.user2 : f.user1
          );

          const groups = await strapi.db.query('api::chat-group.chat-group').findMany({
            where: { members: { $contains: username } },
          });

          socket.emit('initial_data', { friends, groups });
        } catch (err: any) {
          console.error('Error loading initial data:', err.message);
          socket.emit('initial_data', { friends: [], groups: [] });
        }
      });

      socket.on('join_room', ({ room, username }: { room: string; username: string }) => {
        socket.join(room);
        console.log(`${username} joined room: ${room}`);
      });

      socket.on('send_message', (messageData: any) => {
        io.to(messageData.room).emit('receive_message', messageData);
      });

      socket.on('add_friend', async ({ from, toUsername }: { from: string; toUsername: string }) => {
        try {
          const existing = await strapi.db.query('api::friendship.friendship').findMany({
            where: {
              $or: [
                { user1: from, user2: toUsername },
                { user1: toUsername, user2: from },
              ],
            },
          });

          if (existing.length === 0) {
            await strapi.db.query('api::friendship.friendship').create({
              data: {
                user1: from,
                user2: toUsername,
                combined_name: `${from} ${toUsername} ${toUsername} ${from}`,
              },
            });
          }

          const fromSocketId = onlineUsers[from];
          const toSocketId = onlineUsers[toUsername];

          if (fromSocketId) io.to(fromSocketId).emit('friend_added', { username: toUsername });
          if (toSocketId) io.to(toSocketId).emit('friend_added', { username: from });
        } catch (err: any) {
          console.error('Error adding friend:', err.message);
          socket.emit('friend_error', 'Could not add friend');
        }
      });

      socket.on('create_group', async ({ creator, name, members }: { creator: string; name: string; members: string[] }) => {
        try {
          const allMembers = [...new Set([creator, ...members])];
          const group = await strapi.db.query('api::chat-group.chat-group').create({
            data: { name, members: allMembers },
          });

          allMembers.forEach((member) => {
            const sid = onlineUsers[member];
            if (sid) io.to(sid).emit('group_created', group);
          });
        } catch (err: any) {
          console.error('Error creating group:', err.message);
        }
      });

      socket.on('add_group_members', async ({ groupId, members, adder }: { groupId: string; members: string[]; adder: string }) => {
        try {
          const group = await strapi.db.query('api::chat-group.chat-group').findOne({
            where: { id: groupId },
          });

          if (group) {
            const updatedMembers = [...new Set([...(group.members || []), ...members])];
            const updated = await strapi.db.query('api::chat-group.chat-group').update({
              where: { id: groupId },
              data: { members: updatedMembers },
            });

            updatedMembers.forEach((member) => {
              const sid = onlineUsers[member];
              if (sid) io.to(sid).emit('group_updated', updated);
            });
          }
        } catch (err: any) {
          console.error('Error adding group members:', err.message);
        }
      });

      socket.on('disconnect', () => {
        const username = userSockets[socket.id];
        if (username) {
          delete onlineUsers[username];
          delete userSockets[socket.id];
          io.emit('user_status_change', { username, status: 'offline' });
        }
      });
    });
  },
};
